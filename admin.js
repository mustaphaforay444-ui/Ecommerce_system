let products = [];
let categories = [];
let orders = [];
let buyers = [];
let editingId = null;
let editingCategoryId = null;
let adminOrdersChannel = null;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('categoryName')?.addEventListener('input', event => {
        if (editingCategoryId) return;
        document.getElementById('categorySlug').value = event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    });
    try {
        await window.supabaseReady;
        await window.bookStore.currentProfile();
        subscribeToAdminOrderUpdates(await window.supabaseReady);
        await Promise.all([loadDashboard(), populateCategories(), loadCategoriesTable(), loadBooksTable(), loadOrdersTable(), loadBuyersTable()]);
    } catch (error) { showPageError(error.message || 'Admin data could not be loaded.'); }
});

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

function showPageError(message) {
    let banner = document.getElementById('adminDataError');
    if (!banner) { banner = document.createElement('div'); banner.id = 'adminDataError'; banner.className = 'admin-data-error'; document.querySelector('.admin-content')?.prepend(banner); }
    banner.textContent = message;
}
function clearError() { document.getElementById('adminDataError')?.remove(); }

async function refreshAdminData() {
    clearError();
    try { await Promise.all([loadDashboard(), populateCategories(), loadCategoriesTable(), loadBooksTable(), loadOrdersTable(), loadBuyersTable()]); }
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
    const form = document.getElementById('categoryForm');
    form.reset();
    document.getElementById('categoryName').value = category?.name || '';
    document.getElementById('categorySlug').value = category?.slug || '';
    document.getElementById('categorySort').value = category?.sort_order ?? categories.length + 1;
    form.hidden = false;
}
function hideCategoryForm() { document.getElementById('categoryForm').hidden = true; editingCategoryId = null; }
async function saveCategory(event) {
    event.preventDefault();
    try {
        await window.bookStore.saveCategory({
            id: editingCategoryId,
            name: document.getElementById('categoryName').value,
            slug: document.getElementById('categorySlug').value || document.getElementById('categoryName').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            sort_order: document.getElementById('categorySort').value
        });
        hideCategoryForm(); await populateCategories(); await loadCategoriesTable();
    } catch (error) { showPageError(error.message || 'Category could not be saved.'); }
}
async function toggleCategory(id, active) {
    try { await window.bookStore.setCategoryActive(id, active); await populateCategories(); await loadCategoriesTable(); }
    catch (error) { showPageError(error.message || 'Category could not be updated.'); }
}
async function loadCategoriesTable() {
    const tbody = document.getElementById('categoriesTableBody'); if (!tbody) return;
    categories = await window.bookStore.getCategories({ includeInactive: true });
    tbody.replaceChildren();
    if (!categories.length) { tbody.innerHTML = '<tr><td colspan="5">No categories.</td></tr>'; return; }
    categories.forEach(category => {
        const row = document.createElement('tr');
        [category.name, category.slug, String(category.sort_order), category.is_active ? 'Active' : 'Archived'].forEach(value => { const td = document.createElement('td'); td.textContent = value; row.appendChild(td); });
        const actions = document.createElement('td');
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => showCategoryForm(category));
        const archive = document.createElement('button'); archive.type = 'button'; archive.className = 'btn btn-secondary'; archive.textContent = category.is_active ? 'Archive' : 'Restore'; archive.addEventListener('click', () => toggleCategory(category.id, !category.is_active));
        actions.append(edit, archive); row.appendChild(actions); tbody.appendChild(row);
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
function hideAddBookForm() { document.getElementById('productForm').style.display = 'none'; }
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

function editBook(id) {
    const product = products.find(book => String(book.id) === String(id));
    if (!product) return;
    editingId = product.id;
    document.querySelector('#productForm h2').textContent = 'Edit Book';
    document.getElementById('productName').value = product.name || '';
    document.getElementById('productPrice').value = product.price ?? '';
    document.getElementById('productCategory').value = categories.find(category => category.name === product.category)?.id || '';
    document.getElementById('productStock').value = product.stock ?? '';
    document.getElementById('productImage').value = product.image || '';
    document.getElementById('productDescription').value = product.description || '';
    for (const [field, value] of [['productAuthor', product.author], ['productIsbn', product.isbn], ['productPublisher', product.publisher], ['productYear', product.year]]) {
        const input = document.getElementById(field); if (input) input.value = value || '';
    }
    document.getElementById('productForm').style.display = 'block';
}
window.editBook = editBook;

async function deleteBook(id) {
    if (!confirm('Archive this book from the public catalogue?')) return;
    try { await window.bookStore.archiveProduct(id); await refreshAdminData(); }
    catch (error) { showPageError(error.message || 'Book could not be archived.'); }
}
window.deleteBook = deleteBook;

async function loadBooksTable() {
    const tbody = document.getElementById('productsTableBody'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading books…</td></tr>';
    products = await window.bookStore.getAdminProducts(); tbody.replaceChildren();
    if (!products.length) { tbody.innerHTML = '<tr><td colspan="6">No books in the catalogue yet.</td></tr>'; return; }
    products.forEach(book => {
        const row = document.createElement('tr');
        const values = [book.name, book.category || '—', `KES ${book.price.toLocaleString()}`, String(book.stock), book.rating ? `★ ${book.rating}` : '—'];
        values.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); });
        const actions = document.createElement('td');
        const edit = document.createElement('button'); edit.className = 'btn btn-edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => editBook(book.id));
        const remove = document.createElement('button'); remove.className = 'btn btn-danger'; remove.textContent = 'Archive'; remove.addEventListener('click', () => deleteBook(book.id));
        actions.append(edit, remove); row.appendChild(actions); tbody.appendChild(row);
    });
}
window.loadBooksTable = loadBooksTable;

async function loadOrdersTable() {
    const tbody = document.getElementById('ordersTableBody'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7">Loading orders…</td></tr>';
    orders = await window.bookStore.getAdminOrders(); tbody.replaceChildren();
    if (!orders.length) { tbody.innerHTML = '<tr><td colspan="7">No orders yet.</td></tr>'; return; }
    orders.forEach(order => {
        const row = document.createElement('tr');
        const cells = [order.id, new Date(order.created_at).toLocaleString(), order.profiles?.full_name || order.profiles?.email || 'Buyer', order.delivery_address || '—', String(order.order_items?.length || 0), `KES ${Number(order.total || 0).toLocaleString()}`];
        cells.forEach((value, index) => { const td = document.createElement('td'); td.textContent = value; if (index === 3) td.className = 'delivery-location-cell'; row.appendChild(td); });
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
