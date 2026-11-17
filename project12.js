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
    // Close the hamburger menu
    const sideMenu = document.getElementById("sideMenu");
    if(sideMenu) sideMenu.classList.remove("active");
    document.querySelector(".header")?.classList.remove("menu-open");
    document.querySelector(".home-library-gallery")?.setAttribute("hidden", "");
    document.querySelector(".featured-book-shelf")?.setAttribute("hidden", "");
    
    // Filter and display products
    const filtered = books.filter(v => v.category === category);
    
    if(filtered.length === 0) {
        document.querySelector(".products").innerHTML = `<h2 style="text-align:center; padding: 40px;">No books found in ${category}</h2>`;
        return;
    }
    
    let html = `<h2 class="catalog-category-title ${subjectClass(category)}">${category}</h2>`;
    filtered.forEach((book) => {
        const stockClass = book.stock > 45
            ? "stock-very-high"
            : book.stock > 30
                ? "stock-high"
                : book.stock > 15
                    ? "stock-medium"
                    : book.stock > 5
                        ? "stock-low"
                        : book.stock > 0
                            ? "stock-critical"
                            : "stock-out";
        const stockText = book.stock > 0 ? `${book.stock} in stock` : "Out of stock";
        
        html += `
        <div class="card ${subjectClass(category)}" style="opacity: 1;">
            <div class="card-image-wrapper" onclick="quickAddToCart('${book.name.replace(/'/g, "\\'")}',${book.price},'${book.image}', event)">
                <img src="${book.image}" alt="${book.name}" onerror="this.onerror=null;this.src='https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg'">
                <span class="stock-badge ${stockClass}">${stockText}</span>
            </div>
            <div class="card-content">
                <h3>${book.name}</h3>
                <div class="card-rating">
                    <span class="stars">${'★'.repeat(Math.floor(book.rating))}</span>
                    <span class="rating-value">${book.rating}</span>
                </div>
                <p class="card-category ${subjectClass(category)}">${book.category}</p>
                <p class="card-price">KES ${book.price.toLocaleString()}</p>
                <div class="card-actions">
                    <button class="home-add-btn" onclick="quickAddToCart('${book.name.replace(/'/g, "\\'")}',${book.price},'${book.image}', event)" ${book.stock === 0 ? 'disabled' : ''}><i class="fas fa-plus"></i> Add</button>
                    <button class="wishlist-heart-btn ${isProductInWishlist(book.id) ? "liked" : ""}" data-product-id="${book.id}" onclick="toggleWishlistByProductId('${book.id}', event)" title="Like">♡</button>
                </div>
            </div>
        </div>
        `;
    });
    
    const productContainer = document.querySelector(".products");
    if(productContainer) {
        productContainer.innerHTML = html;
        attachCardClicks();
        updateWishlistButtons();
        document.getElementById("bookCatalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function showAllBooks() {
    window.location.reload();
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

// Add click functionality to side menu categories
document.addEventListener("DOMContentLoaded", function(){
    const categoryItems = document.querySelectorAll("#categoryList > li");
    categoryItems.forEach(item => {
        if(item.textContent.trim() !== "" && item.tagName !== "HR") {
            item.addEventListener("click", function(){
                const category = this.textContent.trim();
                showToastNotification(`Filtering by: ${category}`);
                
                // Filter products by category
                filterBooksByCategory(category);
                document.getElementById("sideMenu").classList.remove("active");
            });
        }
    });
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

function renderFeaturedBookShelf() {
    const shelf = document.getElementById("featuredBooks");
    if (!shelf) return;
    const shownCategories = new Set();
    const featured = books.filter(book => {
        if (shownCategories.has(book.category)) return false;
        shownCategories.add(book.category);
        return true;
    });
    shelf.innerHTML = featured.map(book => {
        const bookIndex = books.indexOf(book);
        return `
            <article class="featured-book-card ${subjectClass(book.category)}">
                <div class="featured-book-cover">
                <img src="${book.image}" alt="Cover of ${book.name}" loading="lazy">
                </div>
                <div class="featured-book-info">
                    <p class="featured-book-category ${subjectClass(book.category)}">${book.category}</p>
                    <h3>${book.name}</h3>
                    <p class="featured-book-author">${book.author}</p>
                    <p class="featured-book-price">KES ${book.price.toLocaleString()}</p>
                    <button type="button" onclick="viewBookDetails(${bookIndex})">View book</button>
                </div>
            </article>`;
    }).join("");
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
        books = await window.bookStore.getProducts();
    } catch (error) {
        if (catalogProductsContainer) catalogProductsContainer.innerHTML = `<p class="catalog-data-message" role="alert">Books could not be loaded. ${String(error.message || "Please try again later.")}</p>`;
        if (featuredShelf) featuredShelf.hidden = true;
        return;
    }
    if (!books.length) {
        if (catalogProductsContainer) catalogProductsContainer.innerHTML = '<p class="catalog-data-message">There are no books available yet.</p>';
        if (featuredShelf) featuredShelf.hidden = true;
        return;
    }
    const categoryOrder = ["Physics", "Chemistry", "Biology", "Arabic", "Mathematics", "Computer Science & IT", "Cybersecurity", "Business & Humanities"];
    books.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
    try {
        const client = await window.supabaseReady;
        const { data: { session } } = await client.auth.getSession();
        const savedBooks = session ? await window.bookStore.getWishlist() : [];
        bookWishlistIds = new Set(savedBooks.map(book => String(book.id)));
    } catch (error) {
        bookWishlistIds = new Set();
    }
    renderFeaturedBookShelf();
    updateCartCount();
    // Update cart count
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

    // Populate categories dynamically
    const categories = [...new Set(books.map(book => book.category))];
    const categoryList = document.getElementById("categoryList");
    if(categoryList) {
        categories.forEach((cat, index) => {
            const li = document.createElement("li");
            li.textContent = cat;
            li.style.opacity = "1";
            li.style.cursor = "pointer";
            li.onclick = function() {
                const sideMenu = document.getElementById("sideMenu");
                const header = document.querySelector(".header");
                if(sideMenu && header) {
                    sideMenu.classList.remove("active");
                    header.classList.remove("menu-open");
                }
                filterByCategory(cat);
            };
            categoryList.appendChild(li);
            if(index !== categories.length - 1){
                const hr = document.createElement("hr");
                hr.style.border = "0.5px solid rgba(255,255,255,0.3)";
                categoryList.appendChild(hr);
            }
        });
    }

    // Generate all book cards dynamically
    const productsContainer = document.querySelector(".products");
    if(productsContainer){
        productsContainer.innerHTML = ""; // clear any existing HTML
        let lastCategory = "";
        books.forEach((book, index) => {
            if (book.category !== lastCategory) {
                const heading = document.createElement("h2");
                heading.className = "catalog-category-title " + subjectClass(book.category);
                heading.textContent = book.category;
                productsContainer.appendChild(heading);
                lastCategory = book.category;
            }
            const card = document.createElement("div");
            card.classList.add("card", subjectClass(book.category));
            card.style.opacity = "1";

            // Create stock status badge
            const stockClass = book.stock > 45
                ? "stock-very-high"
                : book.stock > 30
                    ? "stock-high"
                    : book.stock > 15
                        ? "stock-medium"
                        : book.stock > 5
                            ? "stock-low"
                            : book.stock > 0
                                ? "stock-critical"
                                : "stock-out";
            const stockText = book.stock > 0 ? `${book.stock} in stock` : "Out of stock";

            card.style.cursor = "pointer";
            card.innerHTML = `
                <div class="card-image-wrapper" onclick="quickAddToCart('${book.name.replace(/'/g, "\\'")}',${book.price},'${book.image}', event)">
                <img src="${book.image}" alt="${book.name}">
                    <span class="stock-badge ${stockClass}">${stockText}</span>
                </div>
                <div class="card-content">
                    <h3>${book.name}</h3>
                    <div class="card-rating">
                        <span class="stars">${'★'.repeat(Math.floor(book.rating))}</span>
                        <span class="rating-value">${book.rating}</span>
                    </div>
                    <p class="card-category ${subjectClass(book.category)}">${book.category}</p>
                    <p class="card-price">KES ${book.price.toLocaleString()}</p>
                    <div class="card-actions">
                        <button class="home-add-btn" onclick="quickAddToCart('${book.name.replace(/'/g, "\\'")}',${book.price},'${book.image}', event)" ${book.stock === 0 ? 'disabled' : ''}><i class="fas fa-plus"></i> Add</button>
                        <button class="wishlist-heart-btn ${isProductInWishlist(book.id) ? "liked" : ""}" data-product-id="${book.id}" onclick="toggleWishlistByProductId('${book.id}', event)" title="Like">♡</button>
                    </div>
                </div>
            `;
            productsContainer.appendChild(card);
        });
        
        // Attach click events after all cards are created
        attachCardClicks();
        updateWishlistButtons();
    }

    // Search functionality with smooth filtering
    const searchInput = document.getElementById("searchInput");
    if(searchInput){
        searchInput.addEventListener("input", function(){
            const text = searchInput.value.toLowerCase();
            const cards = document.querySelectorAll(".products .card");
            let visibleCount = 0;
            
            cards.forEach(card => {
                const name = card.querySelector("h3").textContent.toLowerCase();
                const category = card.querySelector(".card-category").textContent.toLowerCase();
                const price = card.querySelector(".card-price").textContent.toLowerCase();
                
                if (name.includes(text) || category.includes(text) || price.includes(text)) {
                    card.style.display = "flex";
                    card.style.animation = "fadeIn 0.3s ease";
                    visibleCount++;
                } else {
                    card.style.display = "none";
                }
            });
            
            document.querySelectorAll(".catalog-category-title").forEach((heading) => {
                let sibling = heading.nextElementSibling;
                let hasVisibleBook = false;
                while (sibling && !sibling.classList.contains("catalog-category-title")) {
                    if (sibling.classList.contains("card") && sibling.style.display !== "none") hasVisibleBook = true;
                    sibling = sibling.nextElementSibling;
                }
                heading.style.display = hasVisibleBook ? "" : "none";
            });
            if (visibleCount === 0 && text.length > 0) {
                showToastNotification("No books found matching your search");
            }
        });
    }
});

// View product details in modal
function viewBookDetails(index) {
    const book = books[index];
    const modal = `
        <div class="product-modal">
            <div class="product-modal-content">
                <span class="close" onclick="closeBookModal()">&times;</span>
                <div class="product-modal-body">
                    <div class="product-modal-image">
                        <img src="${book.image}" alt="Cover of ${book.name}" onerror="this.onerror=null;this.src='https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg'">
                    </div>
                    <div class="product-modal-details">
                        <h2>${book.name}</h2>
                        <p class="product-modal-category">Category: ${book.category}</p>
                        <div class="product-modal-rating">
                            <span class="stars">${'★'.repeat(Math.floor(book.rating))}</span>
                            <span>${book.rating}/5</span>
                        </div>
                        <p class="product-modal-price">KES ${book.price.toLocaleString()}</p>
                        <p class="product-modal-stock">${book.stock > 0 ? `${book.stock} in stock` : 'Out of stock'}</p>
                        <div class="product-modal-actions">
                            <button class="btn-primary" onclick="quickAddToCartAndOpenCart('${book.name.replace(/'/g, "\\'")}',${book.price},'${book.image}', event);" ${book.stock === 0 ? 'disabled' : ''}>
                                <i class="fas fa-shopping-cart"></i> Add to Cart
                            </button>
                            <a href="product-view.html?id=${index}" class="btn-secondary">
                                <i class="fas fa-eye"></i> View Details
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    showLightbox(modal);
}

function closeBookModal() {
    closeLightbox();
}












