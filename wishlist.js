document.addEventListener('DOMContentLoaded', () => {
    setupSideMenu();
    loadWishlist();
});

function toggleMenu() { document.getElementById('sideMenu')?.classList.toggle('active'); }
window.toggleMenu = toggleMenu;

function setupSideMenu() {
    document.addEventListener('click', event => {
        const menu = document.getElementById('sideMenu');
        const button = document.querySelector('.hamburger');
        if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) menu.classList.remove('active');
    });
    document.querySelectorAll('.side-menu .nav-menu a').forEach(link => link.addEventListener('click', () => document.getElementById('sideMenu')?.classList.remove('active')));
}

async function loadWishlist() {
    const container = document.getElementById('wishlistItemsContainer');
    const empty = document.getElementById('emptyWishlistMessage');
    if (!container || !empty) return;
    container.style.display = 'grid';
    container.textContent = 'Loading your Reading List…';
    empty.style.display = 'none';
    try {
        await window.supabaseReady;
        const profile = await window.bookStore.currentProfile();
        if (profile?.role !== 'customer') { await window.bookStore.requireRole('customer'); return; }
        const books = await window.bookStore.getWishlist();
        container.replaceChildren();
        if (!books.length) { container.style.display = 'none'; empty.style.display = 'block'; return; }
        books.forEach(book => container.appendChild(renderBook(book)));
    } catch (error) {
        container.replaceChildren();
        empty.textContent = error.message || 'Sign in to view your Reading List.';
        empty.style.display = 'block';
    }
}

function renderBook(book) {
    const card = document.createElement('article'); card.className = 'wishlist-item';
    const media = document.createElement('button'); media.type = 'button'; media.className = 'wishlist-item-image';
    media.addEventListener('click', () => viewBook(book.id));
    const img = document.createElement('img'); img.src = book.image || ''; img.alt = book.name; img.onerror = () => img.removeAttribute('src');
    const stock = document.createElement('span'); stock.className = 'stock-badge'; stock.textContent = book.stock > 0 ? `${book.stock} in stock` : 'Out of stock';
    media.append(img, stock);
    const info = document.createElement('div'); info.className = 'wishlist-item-info';
    const title = document.createElement('h3'); title.textContent = book.name;
    const category = document.createElement('p'); category.className = 'wishlist-item-category'; category.textContent = book.category || '';
    const price = document.createElement('p'); price.className = 'wishlist-item-price'; price.textContent = `KES ${book.price.toLocaleString()}`;
    const actions = document.createElement('div'); actions.className = 'wishlist-item-actions';
    const add = document.createElement('button'); add.className = 'btn-add-to-cart'; add.textContent = 'Add to Cart'; add.disabled = book.stock < 1;
    add.addEventListener('click', () => addToCart(book.id));
    const remove = document.createElement('button'); remove.className = 'btn-remove'; remove.title = 'Remove from Reading List'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeFromWishlist(book.id));
    actions.append(add, remove); info.append(title, category, price, actions); card.append(media, info); return card;
}

async function removeFromWishlist(id) {
    try { await window.bookStore.toggleWishlist(id); await loadWishlist(); }
    catch (error) { alert(error.message || 'Could not update your Reading List.'); }
}
async function addToCart(id) {
    try { await window.bookStore.addToCart(id, 1); alert('Book added to your cart.'); }
    catch (error) { alert(error.message || 'Sign in to add books to your cart.'); }
}
function viewBook(id) { location.href = `product-view.html?id=${encodeURIComponent(id)}`; }
window.loadWishlist = loadWishlist;
window.removeFromWishlist = removeFromWishlist;
window.addToCart = addToCart;
window.viewBook = viewBook;
