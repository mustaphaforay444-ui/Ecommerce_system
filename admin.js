let products = [];
let categories = [];
let orders = [];
let buyers = [];
let editingId = null;
let editingCategoryId = null;
let editingCategoryIsActive = true;
let adminOrdersChannel = null;
let adminMessagesChannel = null;
let sellerApplications = [];

async function initializeAdminAfterAuthorization() {
    document.getElementById('categoryName')?.addEventListener('input', event => {
        if (editingCategoryId) return;
        document.getElementById('categorySlug').value = event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    });
    document.getElementById('ordersSearch')?.addEventListener('input', renderOrdersTable);
    document.getElementById('ordersStatusFilter')?.addEventListener('change', renderOrdersTable);
    document.getElementById('messageCustomerSelect')?.addEventListener('change', loadAdminMessages);
    document.getElementById('adminMessageForm')?.addEventListener('submit', sendAdminMessage);
    document.getElementById('sellerStatusFilter')?.addEventListener('change', renderSellerApplications);
    const sidebar = document.querySelector('.admin-sidebar');
    const menuToggle = document.getElementById('adminMenuToggle');
    const closeAdminMenu = () => { sidebar?.classList.remove('menu-open'); menuToggle?.setAttribute('aria-expanded', 'false'); };
    menuToggle?.addEventListener('click', () => {
        const open = sidebar.classList.toggle('menu-open');
        menuToggle.setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('.admin-nav .nav-item').forEach(item => item.addEventListener('click', closeAdminMenu));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAdminMenu(); });
    try {
        await window.supabaseReady;
        const client = await window.supabaseReady;
        subscribeToAdminOrderUpdates(client);
        subscribeToAdminMessageUpdates(client);
        await Promise.all([loadDashboard(), populateCategories(), loadCategoriesTable(), loadBooksTable(), loadOrdersTable(), loadBuyersTable(), loadSellerApplications()]);
    } catch (error) { showPageError(error.message || 'Admin data could not be loaded.'); }
}

if (document.body.classList.contains('admin-auth-checking')) {
    window.addEventListener('admin:authorized', initializeAdminAfterAuthorization, { once: true });
} else {
    initializeAdminAfterAuthorization();
}

function subscribeToAdminOrderUpdates(client) {
    if (adminOrdersChannel) return;
    adminOrdersChannel = client.channel('admin-order-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
            try { await Promise.all([loadOrdersTable(), loadDashboard()]); }
            catch (error) { showPageError(error.message || 'Live order updates could not be loaded.'); }
        })
        .subscribe(status => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                showPageError('Live order updates are unavailable. Refresh the page to check for changes.');
            }
        });
}

function subscribeToAdminMessageUpdates(client) {
    if (adminMessagesChannel) return;
    adminMessagesChannel = client.channel('admin-customer-message-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_messages' }, () => {
            if (document.getElementById('messages')?.classList.contains('active')) loadAdminMessages();
        }).subscribe();
}

function showPageError(message) {
    let banner = document.getElementById('adminDataError');
    if (!banner) { banner = document.createElement('div'); banner.id = 'adminDataError'; banner.className = 'admin-data-error'; document.querySelector('.admin-content')?.prepend(banner); }
    banner.textContent = message;
}
function clearError() { document.getElementById('adminDataError')?.remove(); }

async function refreshAdminData() {
    clearError();
    try { await Promise.all([loadDashboard(), populateCategories(), loadCategoriesTable(), loadBooksTable(), loadOrdersTable(), loadBuyersTable(), loadSellerApplications()]); }
    catch (error) { showPageError(error.message || 'Unable to load current database records.'); }
}

function showSection(sectionId, navEl) {
    document.querySelectorAll('.section').forEach(section => section.classList.toggle('active', section.id === sectionId));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    navEl?.classList.add('active');
    if (sectionId === 'dashboard') loadDashboard();
    if (sectionId === 'products') loadBooksTable();
    if (sectionId === 'orders') loadOrdersTable();
    if (sectionId === 'buyers') loadBuyersTable();
    if (sectionId === 'sellers') loadSellerApplications();
    if (sectionId === 'messages') loadMessageCustomers();
    if (sectionId === 'sales') loadSalesReport();
    if (sectionId === 'reviews') loadReviewsTable();
}
window.showSection = showSection;

async function loadDashboard() {
    const [books, actualOrders, actualBuyers] = await Promise.all([
        window.bookStore.getAdminProducts(), window.bookStore.getAdminOrders(), window.bookStore.getAdminCustomers()
    ]);
    products = books; orders = actualOrders; buyers = actualBuyers;
    setCount('totalBooks', books.length);
    setCount('totalBuyers', actualBuyers.length); setCount('totalOrders', actualOrders.length);
    const note = document.querySelector('.admin-help-note');
    if (note) note.textContent = 'Dashboard totals show records currently stored in the connected bookstore database.';
}
function setCount(id, count) { const node = document.getElementById(id); if (node) node.textContent = count; }

async function populateCategories() {
    categories = await window.bookStore.getCategories({ includeInactive: true });
    const select = document.getElementById('productCategory');
    if (!select) return;
    const current = select.value;
    select.replaceChildren(new Option('Select category', ''));
    categories.filter(category => category.is_active).forEach(category => select.add(new Option(category.name, category.id)));
    if (current) select.value = current;
}

function showCategoryForm(category = null) {
    editingCategoryId = category?.id || null;
    editingCategoryIsActive = category?.is_active !== false;
    const form = document.getElementById('categoryForm');
    form.reset();
    document.getElementById('categoryName').value = category?.name || '';
    document.getElementById('categorySlug').value = category?.slug || '';
    document.getElementById('categorySort').value = category?.sort_order ?? categories.length + 1;
    form.hidden = false;
    requestAnimationFrame(() => {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('categoryName').focus({ preventScroll: true });
    });
}
function hideCategoryForm() { document.getElementById('categoryForm').hidden = true; editingCategoryId = null; editingCategoryIsActive = true; }
async function saveCategory(event) {
    event.preventDefault();
    try {
        await window.bookStore.saveCategory({
            id: editingCategoryId,
            name: document.getElementById('categoryName').value,
            slug: document.getElementById('categorySlug').value || document.getElementById('categoryName').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            sort_order: document.getElementById('categorySort').value,
            is_active: editingCategoryIsActive
        });
        hideCategoryForm(); await populateCategories(); await loadCategoriesTable();
    } catch (error) { showPageError(error.message || 'Category could not be saved.'); }
}
async function toggleCategory(id, active) {
    try { await window.bookStore.setCategoryActive(id, active); await populateCategories(); await loadCategoriesTable(); }
    catch (error) { showPageError(error.message || 'Category could not be updated.'); }
}
async function deleteCategory(id) {
    const category = categories.find(item => String(item.id) === String(id));
    if (!category || !confirm(`Permanently delete “${category.name}”? Categories with books assigned to them cannot be deleted.`)) return;
    try {
        await window.bookStore.deleteCategory(id);
        await populateCategories(); await loadCategoriesTable();
    } catch (error) { showPageError(error.message || 'Category could not be deleted.'); }
}
async function loadCategoriesTable() {
    const tbody = document.getElementById('categoriesTableBody'); if (!tbody) return;
    categories = await window.bookStore.getCategories({ includeInactive: true });
    tbody.replaceChildren();
    if (!categories.length) { tbody.innerHTML = '<tr><td colspan="5">No categories.</td></tr>'; return; }
    categories.forEach(category => {
        const row = document.createElement('tr');
        [category.name, category.slug, String(category.sort_order), category.is_active ? 'Active' : 'Archived'].forEach(value => { const td = document.createElement('td'); td.textContent = value; row.appendChild(td); });
        const actions = document.createElement('td'); const actionGroup = document.createElement('div'); actionGroup.className = 'admin-row-actions';
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => showCategoryForm(category));
        const archive = document.createElement('button'); archive.type = 'button'; archive.className = 'btn btn-secondary'; archive.textContent = category.is_active ? 'Archive' : 'Restore'; archive.addEventListener('click', () => toggleCategory(category.id, !category.is_active));
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-danger'; remove.textContent = 'Delete'; remove.addEventListener('click', () => deleteCategory(category.id));
        actionGroup.append(edit, archive, remove); actions.appendChild(actionGroup); row.appendChild(actions); tbody.appendChild(row);
    });
}
window.showCategoryForm = showCategoryForm;
window.hideCategoryForm = hideCategoryForm;
window.saveCategory = saveCategory;

function showAddBookForm() {
    editingId = null;
    document.querySelector('#productForm h2').textContent = 'Add Book';
    document.querySelector('#productForm form').reset();
    document.getElementById('productForm').style.display = 'block';
}
function hideAddBookForm() { document.getElementById('productForm').style.display = 'none'; editingId = null; }
window.showAddBookForm = showAddBookForm;
window.hideAddBookForm = hideAddBookForm;

async function saveBook(event) {
    event.preventDefault();
    const saveButton = event.submitter;
    if (saveButton) saveButton.disabled = true;
    try {
        const product = {
            id: editingId,
            name: document.getElementById('productName').value.trim(),
            categoryId: document.getElementById('productCategory').value,
            price: Number(document.getElementById('productPrice').value),
            stock: Number(document.getElementById('productStock').value),
            image: document.getElementById('productImage').value.trim(),
            description: document.getElementById('productDescription').value.trim(),
            author: document.getElementById('productAuthor')?.value.trim() || '',
            isbn: document.getElementById('productIsbn')?.value.trim() || '',
            publisher: document.getElementById('productPublisher')?.value.trim() || '',
            year: document.getElementById('productYear')?.value || ''
        };
        product.is_active = editingId ? products.find(book => String(book.id) === String(editingId))?.is_active !== false : true;
        const file = document.getElementById('productCoverFile')?.files?.[0];
        const saved = await window.bookStore.saveProduct(product);
        const previousImage = editingId ? products.find(book => String(book.id) === String(editingId))?.image : '';
        if (file) {
            const upload = await window.bookStore.uploadProductImage(file, saved.id);
            await window.bookStore.attachProductImage(saved.id, upload);
        } else if (product.image && product.image !== previousImage && saved.id) await window.bookStore.attachExternalProductImage(saved.id, product.image);
        hideAddBookForm(); await refreshAdminData(); alert('Book saved to the bookstore.');
    } catch (error) { showPageError(error.message || 'Book could not be saved.'); }
    finally { if (saveButton) saveButton.disabled = false; }
}
window.saveBook = saveBook;

async function editBook(id) {
    try {
        if (!categories.length) await populateCategories();
        const product = products.find(book => String(book.id) === String(id));
        if (!product) throw new Error('This book is no longer in the list. Refresh the page and try again.');
        editingId = product.id;
        document.querySelector('#productForm h2').textContent = 'Edit Book';
        document.getElementById('productName').value = product.name || '';
        document.getElementById('productPrice').value = product.price ?? '';
        const category = categories.find(item => item.name === product.category);
        const categorySelect = document.getElementById('productCategory');
        if (category && !category.is_active && ![...categorySelect.options].some(option => option.value === category.id)) {
            categorySelect.add(new Option(`${category.name} (archived)`, category.id));
        }
        categorySelect.value = category?.id || '';
        document.getElementById('productStock').value = product.stock ?? '';
        document.getElementById('productImage').value = product.image || '';
        document.getElementById('productDescription').value = product.description || '';
        for (const [field, value] of [['productAuthor', product.author], ['productIsbn', product.isbn], ['productPublisher', product.publisher], ['productYear', product.year]]) {
            const input = document.getElementById(field); if (input) input.value = value || '';
        }
        const form = document.getElementById('productForm');
        form.style.display = 'block';
        requestAnimationFrame(() => {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('productName').focus({ preventScroll: true });
        });
    } catch (error) { showPageError(error.message || 'Book could not be opened for editing.'); }
}
window.editBook = editBook;

async function deleteBook(id) {
    const product = products.find(book => String(book.id) === String(id));
    if (!product || !confirm(`Permanently delete “${product.name}”? Its reviews, cart entries, reading-list entries and cover records will be removed. Existing order history will be kept.`)) return;
    try {
        const result = await window.bookStore.deleteProduct(id);
        await refreshAdminData();
        if (result.coverCleanupFailed) showPageError('Book deleted, but its stored cover image could not be removed.');
    } catch (error) { showPageError(error.message || 'Book could not be deleted.'); }
}
window.deleteBook = deleteBook;

async function toggleProductActive(id) {
    const product = products.find(book => String(book.id) === String(id));
    if (!product) return;
    try { await window.bookStore.setProductActive(id, product.is_active === false); await refreshAdminData(); }
    catch (error) { showPageError(error.message || 'Book visibility could not be updated.'); }
}

async function loadBooksTable() {
    const tbody = document.getElementById('productsTableBody'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7">Loading books…</td></tr>';
    products = await window.bookStore.getAdminProducts(); tbody.replaceChildren();
    if (!products.length) { tbody.innerHTML = '<tr><td colspan="7">No books in the catalogue yet.</td></tr>'; return; }
    products.forEach(book => {
        const row = document.createElement('tr');
        const values = [book.name, book.category || '—', `KES ${book.price.toLocaleString()}`, String(book.stock), book.rating ? `★ ${book.rating}` : '—', book.is_active ? 'Active' : 'Archived'];
        values.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); });
        const actions = document.createElement('td'); const actionGroup = document.createElement('div'); actionGroup.className = 'admin-row-actions';
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => editBook(book.id));
        const visibility = document.createElement('button'); visibility.type = 'button'; visibility.className = 'btn btn-secondary'; visibility.textContent = book.is_active ? 'Archive' : 'Restore'; visibility.addEventListener('click', () => toggleProductActive(book.id));
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-danger'; remove.textContent = 'Delete'; remove.addEventListener('click', () => deleteBook(book.id));
        actionGroup.append(edit, visibility, remove); actions.appendChild(actionGroup); row.appendChild(actions); tbody.appendChild(row);
    });
}
window.loadBooksTable = loadBooksTable;

async function loadOrdersTable() {
    const tbody = document.getElementById('ordersTableBody'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7">Loading orders…</td></tr>';
    orders = await window.bookStore.getAdminOrders();
    renderOrdersTable();
}
function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody'); if (!tbody) return;
    tbody.replaceChildren();
    if (!orders.length) { tbody.innerHTML = '<tr><td colspan="7">No orders yet.</td></tr>'; return; }
    const term = (document.getElementById('ordersSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('ordersStatusFilter')?.value || '';
    const visibleOrders = orders.filter(order => {
        const searchable = [order.id, order.profiles?.full_name, order.profiles?.email, order.delivery_address].join(' ').toLowerCase();
        return (!term || searchable.includes(term)) && (!status || order.status === status);
    });
    if (!visibleOrders.length) { tbody.innerHTML = '<tr><td colspan="7">No orders match these filters.</td></tr>'; return; }
    visibleOrders.forEach(order => {
        const row = document.createElement('tr');
        const requestedAt = order.requested_fulfillment_at ? `\nRequested: ${new Date(order.requested_fulfillment_at).toLocaleString()}` : '';
        const cells = [order.id, new Date(order.created_at).toLocaleString() + requestedAt, order.profiles?.full_name || order.profiles?.email || 'Buyer', order.delivery_address || '—', String(order.order_items?.length || 0), `KES ${Number(order.total || 0).toLocaleString()}`];
        cells.forEach((value, index) => { const td = document.createElement('td'); td.textContent = value; if (index === 1) td.className = 'order-date-cell'; if (index === 3) td.className = 'delivery-location-cell'; row.appendChild(td); });
        const td = document.createElement('td'); const select = document.createElement('select'); select.className = 'order-status-select';
        ['pending_payment', 'processing', 'shipped', 'delivered', 'cancelled'].forEach(status => select.add(new Option(status.replaceAll('_', ' '), status)));
        select.value = order.status || 'pending_payment'; select.addEventListener('change', () => updateOrderStatus(order.id, select.value)); td.appendChild(select); row.appendChild(td); tbody.appendChild(row);
    });
}
window.loadOrdersTable = loadOrdersTable;
async function updateOrderStatus(id, status) {
    try { await window.bookStore.updateOrderStatus(id, status); await loadOrdersTable(); }
    catch (error) { showPageError(error.message || 'Order status could not be updated.'); }
}
window.updateOrderStatus = updateOrderStatus;

async function loadBuyersTable() {
    const tbody = document.getElementById('buyersTableBody'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading buyers…</td></tr>';
    buyers = await window.bookStore.getAdminCustomers(); tbody.replaceChildren();
    if (!buyers.length) { tbody.innerHTML = '<tr><td colspan="6">No buyers yet.</td></tr>'; return; }
    buyers.forEach(buyer => {
        const row = document.createElement('tr');
        [buyer.full_name || 'Buyer', buyer.email || '—', buyer.phone || '—', String(buyer.order_count || 0), buyer.last_order ? new Date(buyer.last_order).toLocaleDateString() : '—'].forEach(value => { const td = document.createElement('td'); td.textContent = value; row.appendChild(td); });
        const locationCell = document.createElement('td'); const button = document.createElement('button'); button.className = 'btn btn-primary buyer-location-button'; button.type = 'button'; button.textContent = buyer.delivery_address ? 'View Location' : 'No delivery location'; button.disabled = !buyer.delivery_address; button.addEventListener('click', () => showBuyerLocation(buyer)); locationCell.appendChild(button); row.appendChild(locationCell); tbody.appendChild(row);
    });
}
window.loadBuyersTable = loadBuyersTable;

async function loadSellerApplications() {
    const tbody = document.getElementById('sellerApplicationsTableBody');
    if (!tbody) return;
    tbody.replaceChildren();
    const loading = document.createElement('tr'); loading.innerHTML = '<td colspan="6">Loading seller applications…</td>'; tbody.appendChild(loading);
    try {
        sellerApplications = await window.bookStore.getSellerApplications();
        const pendingCount = sellerApplications.filter(item => item.seller_status === 'pending').length;
        const badge = document.getElementById('sellerPendingCount');
        if (badge) { badge.textContent = String(pendingCount); badge.hidden = pendingCount === 0; }
        renderSellerApplications();
    } catch (error) {
        const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 6;
        cell.textContent = 'Seller screening is unavailable. Apply the latest seller screening SQL migration, then reload this page.';
        row.appendChild(cell); tbody.replaceChildren(row);
        if (error) console.warn('Seller screening could not be loaded.');
    }
}

function renderSellerApplications() {
    const tbody = document.getElementById('sellerApplicationsTableBody'); if (!tbody) return;
    const filter = document.getElementById('sellerStatusFilter')?.value || 'pending';
    const applications = sellerApplications.filter(item => filter === 'all' || item.seller_status === filter);
    tbody.replaceChildren();
    if (!applications.length) {
        const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 6;
        cell.textContent = filter === 'pending' ? 'No seller applications are waiting for review.' : 'No applications in this group.';
        row.appendChild(cell); tbody.appendChild(row); return;
    }
    applications.forEach(application => {
        const row = document.createElement('tr');
        const values = [application.full_name || 'Seller applicant', application.email || '', application.phone || '—', new Date(application.created_at).toLocaleString()];
        values.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); });
        const statusCell = document.createElement('td'); const status = document.createElement('span');
        status.className = `seller-status-pill seller-status-${application.seller_status}`; status.textContent = application.seller_status;
        statusCell.appendChild(status); row.appendChild(statusCell);
        const actions = document.createElement('td');
        if (application.seller_status === 'pending') {
            const approve = document.createElement('button'); approve.type = 'button'; approve.className = 'btn btn-success'; approve.textContent = 'Approve';
            approve.addEventListener('click', () => reviewSellerApplication(application.id, 'approved', approve));
            const reject = document.createElement('button'); reject.type = 'button'; reject.className = 'btn btn-secondary'; reject.textContent = 'Reject';
            reject.addEventListener('click', () => reviewSellerApplication(application.id, 'rejected', reject));
            actions.append(approve, reject);
        } else if (application.seller_reviewed_at) {
            const reviewed = document.createElement('span'); reviewed.textContent = `Reviewed ${new Date(application.seller_reviewed_at).toLocaleDateString()}`; actions.appendChild(reviewed);
        }
        row.appendChild(actions); tbody.appendChild(row);
    });
}

async function reviewSellerApplication(id, decision, button) {
    if (decision === 'rejected' && !window.confirm('Reject this seller application? The seller will not be able to sign in.')) return;
    button.disabled = true;
    try {
        await window.bookStore.reviewSellerApplication(id, decision);
        await loadSellerApplications();
        const notice = document.getElementById('adminDataError');
        if (notice) notice.remove();
    } catch (error) {
        showPageError(error.message || 'Seller application could not be reviewed.'); button.disabled = false;
    }
}
window.loadSellerApplications = loadSellerApplications;

async function loadMessageCustomers() {
    const select = document.getElementById('messageCustomerSelect'); if (!select) return;
    try {
        const previous = select.value;
        buyers = await window.bookStore.getAdminCustomers();
        select.replaceChildren(new Option('Select a customer', ''));
        buyers.forEach(buyer => select.add(new Option(`${buyer.full_name || 'Customer'} · ${buyer.email || buyer.id}`, buyer.id)));
        if (previous) select.value = previous;
        if (select.value) await loadAdminMessages();
    } catch (error) { showPageError(error.message || 'Customer list could not be loaded.'); }
}

async function loadAdminMessages() {
    const customerId = document.getElementById('messageCustomerSelect')?.value;
    const list = document.getElementById('adminMessageList'); if (!list) return;
    if (!customerId) { list.textContent = 'Select a customer to view messages.'; return; }
    try {
        const messages = await window.bookStore.getAdminCustomerMessages(customerId);
        list.replaceChildren();
        if (!messages.length) list.textContent = 'No messages yet. Send a reply to start the conversation.';
        messages.forEach(message => {
            const bubble = document.createElement('div'); bubble.className = `admin-message-bubble${message.sender_id === customerId ? '' : ' admin'}`;
            bubble.textContent = `${message.sender_id === customerId ? 'Customer' : 'Reader’s Corner'}: ${message.body} · ${new Date(message.created_at).toLocaleString()}`;
            list.appendChild(bubble);
        });
        list.scrollTop = list.scrollHeight;
    } catch (error) { list.textContent = error.message || 'Messages could not be loaded.'; }
}

async function sendAdminMessage(event) {
    event.preventDefault();
    const customerId = document.getElementById('messageCustomerSelect')?.value;
    const input = document.getElementById('adminMessageText'); const button = event.currentTarget.querySelector('button');
    if (!customerId) { showPageError('Choose a customer before replying.'); return; }
    const body = input.value.trim(); if (!body) return;
    button.disabled = true;
    try { await window.bookStore.sendCustomerMessage(body, customerId); input.value = ''; await loadAdminMessages(); }
    catch (error) { showPageError(error.message || 'Reply could not be sent.'); }
    finally { button.disabled = false; }
}

async function loadSalesReport() {
    const tbody = document.getElementById('salesTableBody'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3">Loading verified sales…</td></tr>';
    try {
        const report = await window.bookStore.getSalesReport();
        tbody.replaceChildren();
        if (!report.length) { tbody.innerHTML = '<tr><td colspan="3">No verified payments yet.</td></tr>'; return; }
        report.forEach(row => {
            const tr = document.createElement('tr');
            [new Date(row.sale_day).toLocaleDateString(), String(row.transaction_count), `KES ${Number(row.total_amount).toLocaleString()}`].forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.appendChild(td); });
            tbody.appendChild(tr);
        });
    } catch (error) { tbody.innerHTML = `<tr><td colspan="3">${String(error.message || 'Sales report could not be loaded.')}</td></tr>`; }
}
async function loadReviewsTable() {
    const tbody = document.getElementById('reviewsTableBody'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading reviews…</td></tr>';
    try {
        const reviews = await window.bookStore.getAdminReviews();
        tbody.replaceChildren();
        if (!reviews.length) { tbody.innerHTML = '<tr><td colspan="6">No reviews yet.</td></tr>'; return; }
        reviews.forEach(review => {
            const row = document.createElement('tr');
            [review.products?.title || 'Book', review.profiles?.full_name || review.profiles?.email || 'Reader', `${review.rating} / 5`, review.body, review.status].forEach(value => { const td = document.createElement('td'); td.textContent = value; row.appendChild(td); });
            const actions = document.createElement('td');
            for (const status of ['approved', 'rejected']) {
                const button = document.createElement('button'); button.type = 'button'; button.className = status === 'approved' ? 'btn btn-success' : 'btn btn-secondary'; button.textContent = status === 'approved' ? 'Approve' : 'Reject'; button.disabled = review.status === status; button.addEventListener('click', () => moderateReview(review.id, status)); actions.appendChild(button);
            }
            row.appendChild(actions); tbody.appendChild(row);
        });
    } catch (error) { tbody.innerHTML = `<tr><td colspan="6">${String(error.message || 'Reviews could not be loaded.')}</td></tr>`; }
}
async function moderateReview(id, status) {
    try { await window.bookStore.moderateReview(id, status); await loadReviewsTable(); }
    catch (error) { showPageError(error.message || 'Review could not be updated.'); }
}
function showBuyerLocation(buyer) {
    document.getElementById('buyerLocationName').textContent = buyer.full_name || buyer.email || 'Buyer';
    document.getElementById('buyerLocationAddress').textContent = buyer.delivery_address || 'No delivery location saved.';
    document.getElementById('buyerLocationOrder').textContent = buyer.last_order ? `Most recent order: ${new Date(buyer.last_order).toLocaleString()}` : '';
    document.getElementById('buyerLocationDialog')?.showModal();
}
function closeBuyerLocation() { document.getElementById('buyerLocationDialog')?.close(); }
window.closeBuyerLocation = closeBuyerLocation;

async function logoutAdmin(event) { event?.preventDefault(); try { await window.bookStore.signOut(); } finally { location.href = 'admin-login.html'; } }
window.logoutAdmin = logoutAdmin;
function exportData() { alert('Database export is not configured.'); }
function importData() { alert('Import is disabled until a verified database import workflow is configured.'); }
window.exportData = exportData; window.importData = importData;
