// ================================
// NAVIGATION & INTERACTIVITY
// ================================

// Cart icon click handler
document.addEventListener("DOMContentLoaded", function(){
    const cartIcon = document.querySelector(".cart-icon");
    if(cartIcon) {
        cartIcon.addEventListener("click", function(){
            window.location.href = 'cart.html';
        });
        cartIcon.style.cursor = "pointer";
    }
});

function navigateTo(page) {
    if(page === 'home') {
        window.location.href = 'index.html';
    } else if(page === 'about') {
        window.location.href = 'about.html';
    } else if(page === 'contact') {
        window.location.href = 'contact.html';
    }
}

function toggleMenu() {
    const sideMenu = document.getElementById("sideMenu");
    const header = document.querySelector(".header");
    if (sideMenu) {
        sideMenu.classList.toggle("active");
        header.classList.toggle("menu-open");
    }
}

// Mobile Navigation Menu Toggle
function toggleMobileNav() {
    const navMenu = document.getElementById("navMenuMobile");
    const header = document.querySelector(".header");
    if (navMenu) {
        navMenu.classList.toggle("active");
        header.classList.toggle("menu-open");
    }
}

// Close Mobile Navigation Menu
function closeMobileNav() {
    const navMenu = document.getElementById("navMenuMobile");
    const header = document.querySelector(".header");
    if (navMenu) {
        navMenu.classList.remove("active");
        header.classList.remove("menu-open");
    }
}

// Close menu when clicking outside
document.addEventListener("click", function(e) {
    const navMenu = document.getElementById("navMenuMobile");
    const hamburger = document.querySelector(".hamburger");
    const header = document.querySelector(".header");
    
    if (navMenu && hamburger && header) {
        if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
            if (navMenu.classList.contains("active")) {
                navMenu.classList.remove("active");
                header.classList.remove("menu-open");
            }
        }
    }
});

function navigateToSection(section) {
    // Remove active class from all nav links
    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.remove("active");
    });
    
    // Add active class to clicked link
    const activeLink = document.querySelector(`[data-section="${section}"]`);
    if(activeLink) activeLink.classList.add("active");
    
    // Close mobile menu
    const menu = document.getElementById("sideMenu");
    if(menu) menu.classList.remove("active");
}

function filterByCategory(category) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    document.querySelector(".side-menu")?.classList.remove("active");
    document.querySelector(".header")?.classList.remove("menu-open");
    document.querySelector(".home-library-gallery")?.setAttribute("hidden", "");
    document.querySelector(".featured-book-shelf")?.setAttribute("hidden", "");
    const filtered = books.filter(book => book.category === category);
    renderCatalog(filtered, false);
    document.getElementById("bookCatalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showAllBooks() {
    document.querySelector(".side-menu")?.classList.remove("active");
    document.querySelector(".header")?.classList.remove("menu-open");
    document.querySelector(".home-library-gallery")?.removeAttribute("hidden");
    document.querySelector(".featured-book-shelf")?.removeAttribute("hidden");
    const search = document.getElementById("searchInput");
    if (search) search.value = "";
    renderCatalog(books, true);
    document.getElementById("bookCatalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Handle navigation link clicks
document.addEventListener("DOMContentLoaded", function(){
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
        link.addEventListener("click", function(e){
            const href = this.getAttribute("href");
            const section = this.getAttribute("data-section");
            
            // Close mobile menu when clicking nav link
            const menu = document.getElementById("sideMenu");
            if(menu) menu.classList.remove("active");
        });
    });
});

// ================================
// CART AND WISHLIST DATA
// ================================
let cart = [];
let bookWishlistIds = new Set();

function showCart() { window.location.href = 'cart.html'; }

async function updateQty(index, change) {
    const item = cart[index];
    if (!item) return;
    try {
        await window.bookStore.setCartQuantity(item.id, Math.max(0, item.quantity + change));
        cart = await window.bookStore.getCart();
        updateCartCount();
        showCart();
    } catch (error) { alert(error.message || 'Please sign in to update your cart.'); }
}

async function removeFromCart(index) {
    const item = cart[index];
    if (!item) return;
    try {
        await window.bookStore.setCartQuantity(item.id, 0);
        cart = await window.bookStore.getCart();
        updateCartCount();
        if (!cart.length) closeLightbox();
        else showCart();
    } catch (error) { alert(error.message || 'Please sign in to update your cart.'); }
}

function checkout() { window.location.href = 'cart.html'; }

function showLightbox(content) {
    let lightbox = document.getElementById("lightbox");
    if(!lightbox) {
        lightbox = document.createElement("div");
        lightbox.id = "lightbox";
        lightbox.className = "lightbox";
        lightbox.onclick = function(e) {
            if(e.target === lightbox) closeLightbox();
        };
        document.body.appendChild(lightbox);
    }
    lightbox.innerHTML = content;
    lightbox.style.display = "flex";
}

function closeLightbox() {
    const lightbox = document.getElementById("lightbox");
    if(lightbox) lightbox.style.display = "none";
}

function isProductInWishlist(productId) { return bookWishlistIds.has(String(productId)); }

async function toggleWishlistByProductId(productId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const book = books.find(item => String(item.id) === String(productId));
    if (!book) return;

    const exists = bookWishlistIds.has(String(productId));
    try {
        await window.bookStore.toggleWishlist(book.id);
        exists ? bookWishlistIds.delete(String(productId)) : bookWishlistIds.add(String(productId));
        showToastNotification(`${book.name} ${exists ? 'removed from' : 'added to'} your reading list`);
        updateWishlistButtons();
    } catch (error) {
        showToastNotification(error.message || 'Sign in to save books to your reading list.');
    }
}

function updateWishlistButtons() {
    document.querySelectorAll(".wishlist-heart-btn").forEach((btn) => {
        const productId = btn.getAttribute("data-product-id");
        const likedNow = bookWishlistIds.has(String(productId));
        btn.classList.toggle("liked", likedNow);
        btn.setAttribute("aria-label", likedNow ? "Remove from wishlist" : "Add to wishlist");
        btn.textContent = likedNow ? "\u2665" : "\u2661";
    });
}

// Add to cart
async function addToCart(name) {
    const book = books.find(item => item.name === name);
    if (!book) return;
    try {
        const client = await window.supabaseReady;
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
            window.location.href = 'login.html?next=cart.html';
            return false;
        }
        await window.bookStore.addToCart(book.id, 1);
        updateCartCount();
        showToastNotification(`${book.name} added to your cart`);
        return true;
    } catch (error) {
        showToastNotification(error.message || 'Could not add this book to your cart.');
        return false;
    }
}

async function quickAddToCartAndOpenCart(name, price, image, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (await addToCart(name)) window.location.href = "cart.html";
}

async function quickAddToCart(name, price, image, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    await addToCart(name);
}

async function toggleLike() {
    const book = books.find(item => item.name === document.getElementById("modalName")?.innerText);
    if (book) await toggleWishlistByProductId(book.id);
}

function addToLiked(name) { return toggleWishlistByProductId(books.find(book => book.name === name)?.id); }

// Toast notification function
function showToastNotification(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: linear-gradient(135deg, #00a8e8, #0077be);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 122, 190, 0.4);
        z-index: 2000;
        animation: slideInRight 0.3s ease;
        font-weight: 600;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInLeft 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Open modal when image clicked
function openModal(book){
    document.getElementById("modalImage").src = book.image;
    document.getElementById("modalName").innerText = book.name;
    
    const priceHTML = `
        <div style="display: flex; justify-content: space-around; margin-top: 10px; font-size: 0.9rem; color: #666;">
            <span><strong>Price:</strong> KES ${book.price.toLocaleString()}</span>
            <span><strong>Category:</strong> ${book.category}</span>
            <span><strong>Rating:</strong> ★ ${book.rating}</span>
            <span><strong>Stock:</strong> ${book.stock > 0 ? `${book.stock} in stock` : 'Out of stock'}</span>
        </div>
    `;
    
    document.getElementById("modalPrice").innerHTML = "KES " + book.price.toLocaleString() + priceHTML;

    const btn = document.getElementById("modalAddToCart");
    btn.onclick = function(){
        quickAddToCartAndOpenCart(book.name, book.price, book.image);
    };
    
    if(book.stock === 0) {
        btn.disabled = true;
        btn.textContent = "Out of Stock";
    } else {
        btn.disabled = false;
        btn.textContent = "Add to Cart";
    }

    // Update like button state
    const likeButton = document.getElementById("likeButton");
    if(isProductInWishlist(book.id)) {
        likeButton.style.background = "#ff6b6b";
        likeButton.style.color = "white";
        likeButton.innerHTML = '<i class="fas fa-heart"></i> Liked';
    } else {
        likeButton.style.background = "#f0f0f0";
        likeButton.style.color = "inherit";
        likeButton.innerHTML = '<i class="fas fa-heart"></i> Like';
    }

    const modal = document.getElementById("productModal");
    modal.style.display = "block";
    
    // Reset modal position
    const modalContent = document.querySelector(".modal-content");
    modalContent.style.left = "0";
    modalContent.style.top = "0";
}

// Close modal
function closeModal(){
    document.getElementById("productModal").style.display = "none";
}

// Make modal draggable
function makeDraggable() {
    const modal = document.getElementById("productModal");
    const modalContent = document.querySelector(".modal-content");
    
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    // Check if modal exists
    if (!modalContent) return;
    
    // Add drag handle to modal content header (close button area)
    const closeBtn = modalContent.querySelector(".close");
    if (closeBtn) {
        closeBtn.style.cursor = "move";
        closeBtn.onmousedown = dragMouseDown;
    }
    
    // Also make the h3 draggable
    const h3 = modalContent.querySelector("h3");
    if (h3) {
        h3.style.cursor = "move";
        h3.onmousedown = dragMouseDown;
    }
    
    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        let newTop = modalContent.offsetTop - pos2;
        let newLeft = modalContent.offsetLeft - pos1;
        
        // Keep modal within viewport
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - modalContent.offsetHeight));
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - modalContent.offsetWidth));
        
        modalContent.style.top = newTop + "px";
        modalContent.style.left = newLeft + "px";
        modalContent.style.margin = "0";
    }
    
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Attach click events to all cards
function attachCardClicks(){
    // Home uses image/Add controls for cart actions, matching shopping page behavior.
    return;
}

// Close modal when clicking outside
window.addEventListener("click", function(event) {
    const modal = document.getElementById("productModal");
    const modalContent = document.querySelector(".modal-content");
    if (event.target === modal) {
        closeModal();
    }
});

// Call attachCardClicks after cards are generated
document.addEventListener("DOMContentLoaded", function(){
    attachCardClicks();
});

// Update cart count in header
async function updateCartCount() {
    let count = 0;
    try {
        const client = await window.supabaseReady;
        const { data: { session } } = await client.auth.getSession();
        cart = session ? await window.bookStore.getCart() : [];
        count = cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
    } catch (error) {
        cart = [];
    }
    const cartCountElem = document.getElementById("cart-count");
    if(cartCountElem) {
        cartCountElem.innerText = count;
        // Add pop animation
        cartCountElem.style.animation = 'none';
        setTimeout(() => {
            cartCountElem.style.animation = 'pop 0.3s ease';
        }, 10);
    }
}

// Add cart icon click functionality
document.addEventListener("DOMContentLoaded", function(){
    const cartIcon = document.querySelector(".cart-icon");
    if(cartIcon) {
        cartIcon.style.cursor = "pointer";
        cartIcon.addEventListener("click", () => { window.location.href = 'cart.html'; });
    }
});

// ================================
// SIDE MENU TOGGLE
// ================================
// Close menu when clicking outside
document.addEventListener("click", function(e){
    const menu = document.getElementById("sideMenu");
    const burger = document.querySelector(".hamburger");
    const header = document.querySelector(".header");
    if(menu && burger && !menu.contains(e.target) && !burger.contains(e.target)){
        menu.classList.remove("active");
        if (header) {
            header.classList.remove("menu-open");
        }
    }
});

// Filter products by category
function filterBooksByCategory(category) {
    filterByCategory(category);
}

// Close menu with ESC key
document.addEventListener("keydown", function(e){
    if(e.key === "Escape"){
        const menu = document.getElementById("sideMenu");
        if(menu) menu.classList.remove("active");
        closeModal();
    }
});

// ================================
// Shared catalog keeps subject groups in display order.
let books = [];
function subjectClass(category) { return "subject-" + String(category).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function resolveBookImage(path) { return String(path || ""); }

function safeImageUrl(value) {
    try {
        const url = new URL(String(value || ''), window.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
}

function createBookCard(book) {
    const card = document.createElement('article');
    card.className = `card ${subjectClass(book.category)}`;
    const imageWrapper = document.createElement('div'); imageWrapper.className = 'card-image-wrapper';
    const image = document.createElement('img');
    image.src = safeImageUrl(book.image) || (book.isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(book.isbn)}-M.jpg` : '');
    image.alt = `Cover of ${book.name}`; image.loading = 'lazy'; image.decoding = 'async'; imageWrapper.appendChild(image);
    const stock = Number(book.stock) || 0;
    const badge = document.createElement('span');
    badge.className = `stock-badge ${stock > 45 ? 'stock-very-high' : stock > 30 ? 'stock-high' : stock > 15 ? 'stock-medium' : stock > 5 ? 'stock-low' : stock > 0 ? 'stock-critical' : 'stock-out'}`;
    badge.textContent = stock > 0 ? `${stock} in stock` : 'Out of stock'; imageWrapper.appendChild(badge);
    const content = document.createElement('div'); content.className = 'card-content';
    const title = document.createElement('h3'); title.textContent = book.name;
    const rating = document.createElement('div'); rating.className = 'card-rating';
    const stars = document.createElement('span'); stars.className = 'stars'; stars.textContent = '★'.repeat(Math.max(0, Math.min(5, Math.floor(Number(book.rating) || 0))));
    const ratingValue = document.createElement('span'); ratingValue.className = 'rating-value'; ratingValue.textContent = String(Number(book.rating) || 0); rating.append(stars, ratingValue);
    const category = document.createElement('p'); category.className = `card-category ${subjectClass(book.category)}`; category.textContent = book.category;
    const price = document.createElement('p'); price.className = 'card-price'; price.textContent = `KES ${(Number(book.price) || 0).toLocaleString()}`;
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const add = document.createElement('button'); add.className = 'home-add-btn'; add.type = 'button'; add.disabled = stock < 1; add.innerHTML = '<i class="fas fa-plus" aria-hidden="true"></i> Add';
    add.addEventListener('click', event => quickAddToCart(book.name, book.price, book.image, event));
    const wishlist = document.createElement('button'); wishlist.className = 'wishlist-heart-btn'; wishlist.type = 'button'; wishlist.dataset.productId = String(book.id); wishlist.title = 'Reading list';
    wishlist.addEventListener('click', event => toggleWishlistByProductId(book.id, event));
    actions.append(add, wishlist); content.append(title, rating, category, price, actions); card.append(imageWrapper, content);
    card.addEventListener('click', event => { if (!event.target.closest('button')) viewBookDetails(books.findIndex(item => String(item.id) === String(book.id))); });
    return card;
}

function renderCatalog(items = books, grouped = true) {
    const container = document.querySelector('.products'); if (!container) return;
    const fragment = document.createDocumentFragment(); let previousCategory = null;
    items.forEach(book => {
        if (grouped && book.category !== previousCategory) {
            const heading = document.createElement('h2'); heading.className = `catalog-category-title ${subjectClass(book.category)}`; heading.textContent = book.category;
            fragment.appendChild(heading); previousCategory = book.category;
        }
        fragment.appendChild(createBookCard(book));
    });
    if (!items.length) {
        const message = document.createElement('p'); message.className = 'catalog-data-message';
        message.textContent = books.length ? 'No books are available in this category yet.' : 'There are no books available yet.'; fragment.appendChild(message);
    }
    container.replaceChildren(fragment); updateWishlistButtons();
}

function populateCategoryMenu() {
    const list = document.getElementById('categoryList'); if (!list) return;
    list.replaceChildren();
    const addCategory = (label, action) => {
        const item = document.createElement('li'); const button = document.createElement('button');
        button.type = 'button'; button.textContent = label; button.addEventListener('click', action); item.appendChild(button); list.appendChild(item);
    };
    addCategory('All Books', showAllBooks);
    [...new Set(books.map(book => book.category).filter(Boolean))].forEach(category => addCategory(category, () => filterByCategory(category)));
}

function renderFeaturedBookShelf() {
    const shelf = document.getElementById('featuredBooks'); if (!shelf) return;
    const seen = new Set(); const fragment = document.createDocumentFragment();
    books.filter(book => book.category && !seen.has(book.category) && seen.add(book.category)).forEach(book => {
        const card = document.createElement('article'); card.className = `featured-book-card ${subjectClass(book.category)}`;
        const cover = document.createElement('div'); cover.className = 'featured-book-cover';
        const image = document.createElement('img'); image.src = safeImageUrl(book.image); image.alt = `Cover of ${book.name}`; image.loading = 'lazy'; image.decoding = 'async'; cover.appendChild(image);
        const info = document.createElement('div'); info.className = 'featured-book-info';
        const category = document.createElement('p'); category.className = `featured-book-category ${subjectClass(book.category)}`; category.textContent = book.category;
        const title = document.createElement('h3'); title.textContent = book.name;
        const author = document.createElement('p'); author.className = 'featured-book-author'; author.textContent = book.author || '';
        const price = document.createElement('p'); price.className = 'featured-book-price'; price.textContent = `KES ${(Number(book.price) || 0).toLocaleString()}`;
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'View book';
        button.addEventListener('click', () => viewBookDetails(books.findIndex(item => String(item.id) === String(book.id))));
        info.append(category, title, author, price, button); card.append(cover, info); fragment.appendChild(card);
    });
    shelf.replaceChildren(fragment);
}

// ================================
// INITIALIZATION
// ================================
document.addEventListener("DOMContentLoaded", async function(){
    const catalogProductsContainer = document.querySelector(".products");
    const featuredShelf = document.querySelector(".featured-book-shelf");
    try {
        if (!window.bookStore) throw new Error("The bookstore database client did not load.");
        await window.supabaseReady;
        await refreshCatalog();
    } catch (error) {
        if (catalogProductsContainer) {
            const message = document.createElement('p'); message.className = 'catalog-data-message'; message.setAttribute('role', 'alert');
            message.textContent = `Books could not be loaded. ${String(error.message || 'Please try again later.')}`;
            catalogProductsContainer.replaceChildren(message);
        }
        if (featuredShelf) featuredShelf.hidden = true;
        return;
    }
    // Hydrate the reading list separately so it cannot delay the storefront catalogue.
    (async () => { try {
        const client = await window.supabaseReady;
        const { data: { session } } = await client.auth.getSession();
        const savedBooks = session ? await window.bookStore.getWishlist() : [];
        bookWishlistIds = new Set(savedBooks.map(book => String(book.id)));
        updateWishlistButtons();
    } catch (_) { bookWishlistIds = new Set(); } })();
    updateCartCount();

    // Toggle menu functionality
    function toggleMenu() {
        const sideMenu = document.getElementById("sideMenu");
        const header = document.querySelector(".header");
        if (sideMenu && header) {
            sideMenu.classList.toggle("active");
            header.classList.toggle("menu-open");
        }
    }

    // Expose toggleMenu globally
    window.toggleMenu = toggleMenu;

    // Close menu when clicking on navigation links
    const navLinks = document.querySelectorAll(".side-menu .nav-menu a");
    navLinks.forEach(link => {
        link.addEventListener("click", function() {
            const sideMenu = document.getElementById("sideMenu");
            const header = document.querySelector(".header");
            if (sideMenu && header) {
                sideMenu.classList.remove("active");
                header.classList.remove("menu-open");
            }
        });
    });

    // Make books links in hamburger menu functional
    const sparePartItems = document.querySelectorAll(".spare-parts-menu li");
    const categoryMap = Object.fromEntries([...new Set(books.map(book => book.category))].map(category => [category, category]));

    sparePartItems.forEach(item => {
        item.style.cursor = "pointer";
        item.addEventListener("click", function() {
            const label = item.textContent.trim();
            const matchedCategory = categoryMap[label];
            if (matchedCategory) {
                filterByCategory(matchedCategory);
            }
            const sideMenu = document.getElementById("sideMenu");
            const header = document.querySelector(".header");
            if (sideMenu && header) {
                sideMenu.classList.remove("active");
                header.classList.remove("menu-open");
            }
        });
    });

    // Close menu when clicking outside of it
    document.addEventListener("click", function(event) {
        const sideMenu = document.getElementById("sideMenu");
        const hamburger = document.querySelector(".hamburger");
        const header = document.querySelector(".header");
        
        if (sideMenu && hamburger && header) {
            if (!sideMenu.contains(event.target) && !hamburger.contains(event.target)) {
                if (sideMenu.classList.contains("active")) {
                    sideMenu.classList.remove("active");
                    header.classList.remove("menu-open");
                }
            }
        }
    });

    renderCatalog(books);

    // Search functionality with smooth filtering
    const searchInput = document.getElementById("searchInput");
    if(searchInput){
        searchInput.addEventListener("input", function(){
            const text = searchInput.value.toLowerCase();
            const cards = document.querySelectorAll(".products .card");
            let visibleCount = 0;
            cards.forEach(card => {
                const name = card.querySelector("h3")?.textContent.toLowerCase() || '';
                const category = card.querySelector(".card-category")?.textContent.toLowerCase() || '';
                const price = card.querySelector(".card-price")?.textContent.toLowerCase() || '';
                card.hidden = !(name.includes(text) || category.includes(text) || price.includes(text));
                if (!card.hidden) visibleCount++;
            });
            
            document.querySelectorAll(".catalog-category-title").forEach((heading) => {
                let sibling = heading.nextElementSibling;
                let hasVisibleBook = false;
                while (sibling && !sibling.classList.contains("catalog-category-title")) {
                    if (sibling.classList.contains("card") && !sibling.hidden) hasVisibleBook = true;
                    sibling = sibling.nextElementSibling;
                }
                heading.hidden = !hasVisibleBook;
            });
            if (visibleCount === 0 && text.length > 0) {
                showToastNotification("No books found matching your search");
            }
        });
    }

    let refreshTime = Date.now();
    window.addEventListener('focus', () => {
        if (Date.now() - refreshTime < 5000) return;
        refreshTime = Date.now();
        refreshCatalog();
    });
});

async function refreshCatalog() {
    const searchInput = document.getElementById('searchInput');
    const previousQuery = searchInput?.value || '';
    const categoryOrder = ['Physics', 'Chemistry', 'Biology', 'Arabic', 'Mathematics', 'Computer Science & IT', 'Cybersecurity', 'Business & Humanities'];
    const rank = name => { const index = categoryOrder.indexOf(name); return index < 0 ? categoryOrder.length : index; };
    books = (await window.bookStore.getProducts()).sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    populateCategoryMenu();
    renderCatalog(books);
    renderFeaturedBookShelf();
    if (searchInput && previousQuery) {
        searchInput.value = previousQuery;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// View product details in modal
function viewBookDetails(index) {
    const book = books[index];
    if (!book) return;
    showLightbox('');
    const lightbox = document.getElementById('lightbox');
    const outer = document.createElement('div'); outer.className = 'product-modal';
    const panel = document.createElement('div'); panel.className = 'product-modal-content';
    const close = document.createElement('button'); close.className = 'close'; close.type = 'button'; close.setAttribute('aria-label', 'Close details'); close.textContent = '×'; close.addEventListener('click', closeBookModal);
    const body = document.createElement('div'); body.className = 'product-modal-body';
    const cover = document.createElement('div'); cover.className = 'product-modal-image';
    const image = document.createElement('img'); image.src = safeImageUrl(book.image) || (book.isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(book.isbn)}-M.jpg` : ''); image.alt = `Cover of ${book.name}`; image.loading = 'lazy'; cover.appendChild(image);
    const details = document.createElement('div'); details.className = 'product-modal-details';
    const title = document.createElement('h2'); title.textContent = book.name;
    const category = document.createElement('p'); category.className = 'product-modal-category'; category.textContent = `Category: ${book.category}`;
    const rating = document.createElement('p'); rating.className = 'product-modal-rating'; rating.textContent = `${'★'.repeat(Math.max(0, Math.min(5, Math.floor(Number(book.rating) || 0))))} ${Number(book.rating) || 0}/5`;
    const price = document.createElement('p'); price.className = 'product-modal-price'; price.textContent = `KES ${(Number(book.price) || 0).toLocaleString()}`;
    const stock = document.createElement('p'); stock.className = 'product-modal-stock'; stock.textContent = Number(book.stock) > 0 ? `${book.stock} in stock` : 'Out of stock';
    const actions = document.createElement('div'); actions.className = 'product-modal-actions';
    const add = document.createElement('button'); add.className = 'btn-primary'; add.type = 'button'; add.disabled = Number(book.stock) < 1; add.textContent = 'Add to Cart';
    add.addEventListener('click', event => quickAddToCartAndOpenCart(book.name, book.price, book.image, event));
    const link = document.createElement('a'); link.href = `product-view.html?id=${encodeURIComponent(book.id)}`; link.className = 'btn-secondary'; link.textContent = 'View Details';
    actions.append(add, link); details.append(title, category, rating, price, stock, actions); body.append(cover, details); panel.append(close, body); outer.appendChild(panel);
    lightbox.replaceChildren(outer);
}

function closeBookModal() {
    closeLightbox();
}












