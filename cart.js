// Load cart data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadCart();
    loadSuggestedBooks();
    setupDeliveryOptions();
});

let currentCart = [];
let databaseWishlist = new Set();
let checkoutInProgress = false;

function resolveImagePath(path) {
    const raw = String(path || "").trim();
    return raw;
}

function getStockClass(stock) {
    if (stock > 45) return "stock-very-high";
    if (stock > 30) return "stock-high";
    if (stock > 15) return "stock-medium";
    if (stock > 5) return "stock-low";
    if (stock > 0) return "stock-critical";
    return "stock-out";
}

function getSuggestedBadgeColor(seed) {
    const palette = [
        "#00796b", "#2e7d32", "#1565c0", "#6a1b9a", "#ef6c00",
        "#00838f", "#c62828", "#5d4037", "#283593", "#37474f"
    ];
    return palette[Math.abs(Number(seed) || 0) % palette.length];
}

function normalizeCartItems(items) {
    return (items || []).map(item => ({
        ...item,
        productId: item.id || item.productId,
        name: String(item.name || "Book"),
        price: Number(item.price) || 0,
        quantity: Number(item.quantity || item.qty) || 1,
        image: resolveImagePath(item.image)
    }));
}

async function getCheckoutUser() { return window.bookStore.currentProfile(); }

function isInWishlist(productId) {
    return databaseWishlist.has(String(productId));
}

async function toggleSuggestedWishlist(id) {
    try {
        await window.bookStore.toggleWishlist(id);
        databaseWishlist.has(String(id)) ? databaseWishlist.delete(String(id)) : databaseWishlist.add(String(id));
        loadSuggestedBooks();
    } catch (error) {
        alert(error.message || 'Sign in to save books to your reading list.');
    }
}

// Load and display cart items
async function loadCart() {
    const container = document.getElementById('cartItemsContainer');
    const emptyMessage = document.getElementById('emptyCartMessage');
    if (!container || !emptyMessage) return;
    container.innerHTML = '<p class="cart-loading" role="status">Loading your cart…</p>';
    container.style.display = 'flex';
    emptyMessage.style.display = 'none';

    try {
        const client = await window.supabaseReady;
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
            container.style.display = 'none';
            emptyMessage.style.display = 'block';
            emptyMessage.innerHTML = '<i class="fas fa-user-lock"></i><h2>Sign in to view your cart</h2><p>Your saved cart is linked to your bookstore account.</p><a href="login.html?next=cart.html" class="btn btn-primary">Sign In</a>';
            currentCart = [];
            updateTotals();
            return;
        }
        const profile = await window.bookStore.currentProfile();
        if (profile?.role !== 'customer') { await window.bookStore.requireRole('customer'); return; }
        currentCart = normalizeCartItems(await window.bookStore.getCart());
    } catch (error) {
        container.innerHTML = `<p class="cart-error" role="alert">Your cart could not be loaded. ${String(error.message || 'Please try again.')}</p>`;
        updateTotals();
        return;
    }

    if(currentCart.length === 0) {
        container.style.display = 'none';
        emptyMessage.style.display = 'block';
        updateTotals();
        return;
    }

    container.style.display = 'flex';
    emptyMessage.style.display = 'none';
    container.innerHTML = '';

    currentCart.forEach((item, index) => {
        const itemElement = createCartItemElement(item, index);
        container.appendChild(itemElement);
    });

    updateTotals();
}

// Create cart item element
function createCartItemElement(item, index) {
    const div = document.createElement('div');
    div.className = 'cart-item';
    
    const itemTotal = item.price * item.quantity;
    const mainImage = resolveImagePath(item.image);

    div.innerHTML = `
        <div class="cart-item-image">
            <img src="${mainImage}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">KES ${(item.price || 0).toLocaleString()}</div>
            <div class="cart-item-quantity">
                <button class="qty-btn" onclick="updateQuantity(${index}, -1)">−</button>
                <input type="number" id="quantity-${index}" value="${item.quantity}" min="1" readonly>
                <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
            </div>
            ${item.productId || item.productId === 0 ? `<a class="view-details-btn" href="product-view.html?id=${item.productId}">View Details</a>` : ''}
        </div>
        <div class="cart-item-total">
            <div class="item-subtotal">KES ${itemTotal.toLocaleString()}</div>
            <button class="remove-btn" onclick="removeFromCart(${index})">
                <i class="fas fa-trash"></i> Remove
            </button>
        </div>
    `;

    return div;
}

// Update item quantity
async function updateQuantity(index, change) {
    const item = currentCart[index];
    if (!item) return;
    try {
        await window.bookStore.setCartQuantity(item.productId, Math.max(0, item.quantity + change));
        await loadCart();
    } catch (error) {
        alert(error.message || 'Could not update the cart.');
    }
}

// Remove item from cart
async function removeFromCart(index) {
    if(confirm('Are you sure you want to remove this item?')) {
        const item = currentCart[index];
        if (!item) return;
        try {
            await window.bookStore.setCartQuantity(item.productId, 0);
            await loadCart();
        } catch (error) {
            alert(error.message || 'Could not remove this book from your cart.');
        }
    }
}

// Update totals
function updateTotals() {
    const deliveryFeeElement = document.querySelector('input[name="delivery"]:checked');
    const deliveryFee = deliveryFeeElement ? parseInt(deliveryFeeElement.value) : 0;

    let subtotal = 0;
    currentCart.forEach(item => {
        subtotal += (item.price || 0) * (item.quantity || 1);
    });

    const total = subtotal + deliveryFee;

    document.getElementById('subtotal').textContent = 'KES ' + subtotal.toLocaleString();
    document.getElementById('deliveryFee').textContent = 'KES ' + deliveryFee.toLocaleString();
    document.getElementById('total').textContent = 'KES ' + Math.max(0, total).toLocaleString();
}

// Setup delivery options
function setupDeliveryOptions() {
    const deliveryOptions = document.querySelectorAll('input[name="delivery"]');
    const addressSection = document.getElementById('deliveryAddressSection');
    const addressInput = document.getElementById('deliveryAddress');
    const updateAddressField = () => {
        const selected = document.querySelector('input[name="delivery"]:checked');
        const needsAddress = Boolean(selected && Number(selected.value) > 0);
        if (addressSection) addressSection.hidden = !needsAddress;
        if (addressInput) addressInput.required = needsAddress;
    };

    deliveryOptions.forEach(option => {
        option.addEventListener('change', function() {
            updateAddressField();
            updateTotals();
        });
    });
    updateAddressField();
}

// Checkout
async function checkout() {
    if (checkoutInProgress) return;
    if(currentCart.length === 0) {
        alert('Your cart is empty');
        return;
    }

    // Get delivery option
    const deliveryOption = document.querySelector('input[name="delivery"]:checked');
    const deliveryType = deliveryOption ? deliveryOption.nextElementSibling.textContent.trim() : 'Pickup';
    const deliveryFee = deliveryOption ? parseInt(deliveryOption.value, 10) || 0 : 0;
    const deliveryAddress = deliveryFee > 0
        ? (document.getElementById('deliveryAddress')?.value || '').trim()
        : '';
    const requestedValue = document.getElementById('requestedFulfillmentAt')?.value || '';
    const requestedFulfillmentAt = requestedValue ? new Date(requestedValue).toISOString() : null;
    if (requestedValue && new Date(requestedValue).getTime() <= Date.now()) {
        alert('Choose a future date and time, or leave this blank for the soonest available order.');
        return;
    }

    if (deliveryFee > 0 && !deliveryAddress) {
        alert('Please enter the location where you want your books delivered.');
        document.getElementById('deliveryAddress')?.focus();
        return;
    }

    checkoutInProgress = true;
    const checkoutButton = document.querySelector('.btn-checkout');
    if (checkoutButton) checkoutButton.disabled = true;
    try {
        await window.supabaseReady;
        const buyer = await getCheckoutUser();
        if (!buyer) {
            window.location.href = 'login.html?next=cart.html';
            return;
        }
        const order = await window.bookStore.placeOrder({
            items: currentCart.map(item => ({ id: item.productId, quantity: item.quantity })),
            deliveryType,
            deliveryFee,
            deliveryAddress,
            requestedFulfillmentAt
        });
        const orderId = order.order_id || order.id || 'placed';
        alert(`Order received (${orderId}). Payment is still pending; no payment has been processed. Your order and delivery details are saved.`);
        await loadCart();
    } catch (error) {
        alert(error.message || 'We could not place your order. Please try again.');
    } finally {
        checkoutInProgress = false;
        if (checkoutButton) checkoutButton.disabled = false;
    }
}

// Load suggested products
async function loadSuggestedBooks() {
    const container = document.getElementById('suggestedBooks');
    if (!container) return;
    container.innerHTML = '<p role="status">Loading books…</p>';
    let suggested = [];
    try {
        const client = await window.supabaseReady;
        const { data: { session } } = await client.auth.getSession();
        const allBooks = await window.bookStore.getProducts();
        const [cart, wishlist] = session
            ? await Promise.all([window.bookStore.getCart(), window.bookStore.getWishlist()])
            : [[], []];
        currentCart = normalizeCartItems(cart);
        databaseWishlist = new Set(wishlist.map(book => String(book.id)));
        const cartBookIds = new Set(currentCart.map(item => String(item.productId)));
        suggested = allBooks.filter(product => !cartBookIds.has(String(product.id)));
    } catch (error) {
        container.innerHTML = `<p role="alert">Book suggestions could not be loaded. ${String(error.message || '')}</p>`;
        return;
    }
    container.innerHTML = '';

    if(suggested.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">No products available</p>';
        return;
    }

    suggested.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'suggested-card';
        const stock = Number(product.stock) || 0;
        const stockClass = getStockClass(stock);
        const stockText = stock > 0 ? `${stock} in stock` : "Out of stock";
        const badgeColor = getSuggestedBadgeColor((Number(product.id) || 0) + index);
        const liked = isInWishlist(product.id);
        const likedClass = liked ? "liked" : "";
        const heart = liked ? "\u2665" : "\u2661";
        card.innerHTML = `
            <div class="suggested-card-image" data-product-id="${product.id}">
                <span class="suggested-stock-badge ${stockClass}" style="background:${badgeColor};">${stockText}</span>
                <img src="${product.image}" alt="Cover of ${product.name}">
            </div>
            <div class="suggested-card-info">
                <div class="suggested-card-name">${product.name}</div>
                <div class="suggested-card-price">KES ${(product.price || 0).toLocaleString()}</div>
                <div class="suggested-card-actions">
                    <button class="suggested-card-btn" type="button">
                        <i class="fas fa-plus"></i> Add
                    </button>
                    <button class="suggested-wishlist-btn ${likedClass}" type="button" aria-label="Toggle reading list">
                        ${heart}
                    </button>
                </div>
            </div>
        `;
        card.querySelector('.suggested-card-btn').addEventListener('click', () => addSuggestedToCart(product.id));
        card.querySelector('.suggested-wishlist-btn').addEventListener('click', () => toggleSuggestedWishlist(product.id));
        container.appendChild(card);
    });
}

// Add suggested product to cart
async function addSuggestedToCart(id) {
    try {
        await window.bookStore.addToCart(id, 1);
        await loadCart();
        await loadSuggestedBooks();
    } catch (error) {
        alert(error.message || 'Sign in to add this book to your cart.');
    }
}




