let currentBook = null;
let quantity = 1;

function toggleMenu() {
    document.getElementById('sideMenu')?.classList.toggle('active');
    document.querySelector('.hamburger')?.classList.toggle('active');
}
function closeMenu() {
    document.getElementById('sideMenu')?.classList.remove('active');
    document.querySelector('.hamburger')?.classList.remove('active');
}
window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;

document.addEventListener('click', event => {
    const menu = document.getElementById('sideMenu');
    const button = document.querySelector('.hamburger');
    if (menu?.classList.contains('active') && !menu.contains(event.target) && !button?.contains(event.target)) closeMenu();
});

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('relatedBooks');
    if (container) container.textContent = 'Loading book details…';
    try {
        await window.supabaseReady;
        const id = new URLSearchParams(location.search).get('id');
        if (!id) throw new Error('Book not found.');
        currentBook = await window.bookStore.getProduct(id);
        loadBookDetails();
        await Promise.all([loadRelatedBooks(), checkWishlist(), loadBookReviews()]);
    } catch (error) {
        if (container) container.textContent = error.message || 'Book details could not be loaded.';
        const title = document.getElementById('productName');
        if (title) title.textContent = 'Book unavailable';
    }
});

function loadBookDetails() {
    const image = document.getElementById('mainImage');
    if (image) {
        image.src = currentBook.image || '';
        image.alt = currentBook.name;
        image.onerror = () => { image.removeAttribute('src'); image.alt = 'No cover image available'; };
    }
    const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    set('productName', currentBook.name);
    set('breadcrumbName', currentBook.name);
    set('productCategory', [currentBook.category, currentBook.author && `by ${currentBook.author}`].filter(Boolean).join(' · '));
    set('productRating', currentBook.rating ? `★ ${currentBook.rating}` : 'No reviews yet');
    set('productStock', `${currentBook.stock} in stock`);
    set('productPrice', `KES ${currentBook.price.toLocaleString()}`);
    set('specAuthor', currentBook.author || '—');
    set('specIsbn', currentBook.isbn || '—');
    set('specPublisher', currentBook.publisher || '—');
    set('specYear', currentBook.year || '—');
    set('relatedCategory', currentBook.category || 'Books');
    set('productDescription', currentBook.description || '');
}

async function loadRelatedBooks() {
    const container = document.getElementById('relatedBooks');
    if (!container) return;
    const books = (await window.bookStore.getProducts({ category: currentBook.category }))
        .filter(book => String(book.id) !== String(currentBook.id)).slice(0, 4);
    if (!books.length) { container.textContent = 'No other books in this category yet.'; return; }
    container.replaceChildren(...books.map(book => {
        const item = document.createElement('button');
        item.type = 'button'; item.className = 'related-item';
        item.addEventListener('click', () => viewBook(book.id));
        const img = document.createElement('img'); img.src = book.image || ''; img.alt = book.name;
        img.onerror = () => img.removeAttribute('src');
        const title = document.createElement('h4'); title.textContent = book.name;
        const price = document.createElement('p'); price.textContent = `KES ${book.price.toLocaleString()}`;
        item.append(img, title, price); return item;
    }));
}

function increaseQuantity() { quantity++; document.getElementById('quantity').value = quantity; }
function decreaseQuantity() { if (quantity > 1) quantity--; document.getElementById('quantity').value = quantity; }
window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;

async function addBookToCart() {
    try {
        await window.bookStore.addToCart(currentBook.id, quantity);
        alert(`${quantity} × ${currentBook.name} added to your cart.`);
        quantity = 1;
        document.getElementById('quantity').value = 1;
    } catch (error) { alert(error.message || 'Sign in to add this book to your cart.'); }
}
window.addBookToCart = addBookToCart;

async function checkWishlist() {
    const btn = document.getElementById('wishlistBtn');
    const text = document.getElementById('wishlistText');
    if (!btn || !text) return;
    try {
        const saved = await window.bookStore.getWishlist();
        const inList = saved.some(book => String(book.id) === String(currentBook.id));
        btn.classList.toggle('in-wishlist', inList);
        text.textContent = inList ? 'Remove from Wishlist' : 'Add to Wishlist';
    } catch { text.textContent = 'Sign in to use your Reading List'; }
}
async function toggleWishlist() {
    try { await window.bookStore.toggleWishlist(currentBook.id); await checkWishlist(); }
    catch (error) { alert(error.message || 'Sign in to manage your Reading List.'); }
}
window.checkWishlist = checkWishlist;
window.toggleWishlist = toggleWishlist;
function viewBook(id) { location.href = `product-view.html?id=${encodeURIComponent(id)}`; }
window.viewBook = viewBook;

async function loadBookReviews() {
    const container = document.getElementById('productReviews'); if (!container) return;
    try {
        const reviews = await window.bookStore.getProductReviews(currentBook.id);
        container.replaceChildren();
        if (!reviews.length) { container.textContent = 'No approved reviews yet.'; return; }
        reviews.forEach(review => {
            const article = document.createElement('article'); article.className = 'product-review';
            const heading = document.createElement('strong'); heading.textContent = `${'★'.repeat(Number(review.rating))} Reader`;
            const body = document.createElement('p'); body.textContent = review.body;
            const date = document.createElement('time'); date.dateTime = review.created_at; date.textContent = new Date(review.created_at).toLocaleDateString();
            article.append(heading, body, date); container.appendChild(article);
        });
    } catch (error) { container.textContent = error.message || 'Reviews could not be loaded.'; }
}
async function submitBookReview(event) {
    event.preventDefault();
    const button = event.submitter; if (button) button.disabled = true;
    try {
        await window.bookStore.submitReview({ productId: currentBook.id, rating: Number(document.getElementById('reviewRating').value), body: document.getElementById('reviewBody').value.trim() });
        document.getElementById('reviewForm').reset();
        alert('Review submitted for approval.');
        await loadBookReviews();
    } catch (error) { alert(error.message || 'Sign in to submit a review.'); }
    finally { if (button) button.disabled = false; }
}
window.submitBookReview = submitBookReview;
