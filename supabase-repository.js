const db = () => {
  if (!window.supabaseReady) throw new Error('Supabase client is not loaded.');
  return window.supabaseReady;
};

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

function mapProduct(row) {
  const cover = row.product_images?.find(image => image.is_primary) || row.product_images?.[0];
  return {
    id: row.id,
    name: row.title,
    author: row.author || '',
    category: row.categories?.name || row.category_name || '',
    price: Number(row.price),
    stock: Number(row.stock),
    rating: Number(row.average_rating || 0),
    isbn: row.isbn || '',
    publisher: row.publisher || '',
    year: row.publication_year || '',
    description: row.description || '',
    image: cover?.public_url || row.image_url || ''
  };
}

window.bookStore = {
  async getProducts({ category, query } = {}) {
    const client = await db();
    let request = client.from('products')
      .select('*, categories(name), product_images(storage_path, public_url, is_primary)')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (category) request = request.eq('categories.name', category);
    if (query) request = request.or(`title.ilike.%${query}%,author.ilike.%${query}%,isbn.ilike.%${query}%`);
    return unwrap(await request).map(mapProduct);
  },

  async getCategories({ includeInactive = false } = {}) {
    const client = await db();
    let request = client.from('categories').select('id, name, slug, sort_order, is_active').order('sort_order');
    if (!includeInactive) request = request.eq('is_active', true);
    return unwrap(await request);
  },

  async saveCategory(category) {
    const client = await db();
    const payload = {
      name: category.name.trim(),
      slug: category.slug.trim().toLowerCase(),
      sort_order: Number(category.sort_order || 0),
      is_active: category.is_active !== false
    };
    const result = category.id
      ? await client.from('categories').update(payload).eq('id', category.id).select().single()
      : await client.from('categories').insert(payload).select().single();
    return unwrap(result);
  },

  async setCategoryActive(categoryId, isActive) {
    const client = await db();
    return unwrap(await client.from('categories').update({ is_active: isActive }).eq('id', categoryId));
  },

  async getAdminProducts() {
    const client = await db();
    return unwrap(await client.from('products')
      .select('*, categories(name), product_images(storage_path, public_url, is_primary)')
      .order('created_at', { ascending: true })).map(mapProduct);
  },

  async saveProduct(product) {
    const client = await db();
    const payload = {
      title: product.name,
      author: product.author || null,
      category_id: product.categoryId,
      price: Number(product.price),
      stock: Number(product.stock),
      image_url: product.image || null,
      isbn: product.isbn || null,
      publisher: product.publisher || null,
      publication_year: product.year ? Number(product.year) : null,
      description: product.description || null,
      is_active: product.is_active !== false
    };
    const result = product.id
      ? await client.from('products').update(payload).eq('id', product.id).select('id').single()
      : await client.from('products').insert(payload).select('id').single();
    return unwrap(result);
  },

  async attachProductImage(productId, image) {
    const client = await db();
    const previous = unwrap(await client.from('product_images').select('id, storage_path').eq('product_id', productId));
    unwrap(await client.from('product_images').update({ is_primary: false }).eq('product_id', productId));
    const saved = unwrap(await client.from('product_images').insert({
      product_id: productId,
      storage_path: image.storage_path,
      public_url: image.public_url,
      is_primary: true
    }).select('id').single());
    const oldPaths = previous.map(row => row.storage_path).filter(Boolean);
    if (oldPaths.length) await client.storage.from('book-covers').remove(oldPaths);
    if (previous.length) unwrap(await client.from('product_images').delete().eq('product_id', productId).neq('id', saved.id));
    return saved;
  },

  async attachExternalProductImage(productId, publicUrl) {
    const client = await db();
    const previous = unwrap(await client.from('product_images').select('id, storage_path').eq('product_id', productId));
    unwrap(await client.from('product_images').update({ is_primary: false }).eq('product_id', productId));
    const saved = unwrap(await client.from('product_images').insert({
      product_id: productId, public_url: publicUrl, storage_path: null, is_primary: true
    }).select('id').single());
    const oldPaths = previous.map(row => row.storage_path).filter(Boolean);
    if (oldPaths.length) await client.storage.from('book-covers').remove(oldPaths);
    if (previous.length) unwrap(await client.from('product_images').delete().eq('product_id', productId).neq('id', saved.id));
    return saved;
  },

  async archiveProduct(productId) {
    const client = await db();
    return unwrap(await client.from('products').update({ is_active: false }).eq('id', productId));
  },

  async getWishlist() {
    const client = await db();
    const rows = unwrap(await client.from('wishlist_items')
      .select('product:products(id, title, author, price, stock, categories(name), product_images(public_url, is_primary))'));
    return rows.map(row => mapProduct(row.product));
  },

  async toggleWishlist(productId) {
    const client = await db();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Sign in to save books to your reading list.');
    const found = unwrap(await client.from('wishlist_items').select('id').eq('product_id', productId).maybeSingle());
    if (found) return unwrap(await client.from('wishlist_items').delete().eq('id', found.id));
    return unwrap(await client.from('wishlist_items').insert({ product_id: productId }));
  },

  async getProduct(id) {
    const client = await db();
    const result = await client.from('products')
      .select('*, categories(name), product_images(storage_path, public_url, is_primary)')
      .eq('id', id).eq('is_active', true).single();
    return mapProduct(unwrap(result));
  },

  async signIn(email, password) {
    const client = await db();
    return unwrap(await client.auth.signInWithPassword({ email, password }));
  },

  async signInAdmin(identifier, password) {
    const client = await db();
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
    const saved = unwrap(await client.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token
    }));
    return { user: saved.user, session: saved.session };
  },

  async signUp({ name, email, phone, password }) {
    const client = await db();
    return unwrap(await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, phone } }
    }));
  },

  async signOut() {
    const client = await db();
    return unwrap(await client.auth.signOut());
  },

  async sendPasswordReset(email) {
    const client = await db();
    return unwrap(await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login.html?type=recovery`
    }));
  },

  async updatePassword(password) {
    const client = await db();
    return unwrap(await client.auth.updateUser({ password }));
  },

  async currentProfile() {
    const client = await db();
    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    if (!user) return null;
    return unwrap(await client.from('profiles').select('*').eq('id', user.id).single());
  },

  async getCart() {
    const client = await db();
    const rows = unwrap(await client.from('cart_items')
      .select('id, quantity, product:products(id, title, price, stock, categories(name), product_images(public_url, is_primary))')
      .order('created_at', { ascending: true }));
    return rows.map(row => ({ ...mapProduct(row.product), cartItemId: row.id, quantity: row.quantity }));
  },

  async setCartQuantity(productId, quantity) {
    const client = await db();
    if (quantity <= 0) {
      return unwrap(await client.from('cart_items').delete().eq('product_id', productId));
    }
    return unwrap(await client.from('cart_items').upsert(
      { product_id: productId, quantity },
      { onConflict: 'user_id,product_id' }
    ));
  },

  async addToCart(productId, amount = 1) {
    const client = await db();
    const existing = unwrap(await client.from('cart_items').select('quantity').eq('product_id', productId).maybeSingle());
    return this.setCartQuantity(productId, Number(existing?.quantity || 0) + Number(amount || 1));
  },

  async placeOrder({ items, deliveryType, deliveryFee, deliveryAddress }) {
    const client = await db();
    return unwrap(await client.rpc('place_order', {
      p_items: items.map(item => ({ product_id: item.id, quantity: item.quantity })),
      p_delivery_type: deliveryType,
      p_delivery_fee: deliveryFee,
      p_delivery_address: deliveryAddress || null
    }));
  },

  async getMyOrders() {
    const client = await db();
    return unwrap(await client.from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false }));
  },

  async getAdminOrders() {
    const client = await db();
    return unwrap(await client.from('orders')
      .select('*, profiles(full_name, email, phone), order_items(*)')
      .order('created_at', { ascending: false }));
  },

  async updateOrderStatus(orderId, status) {
    const client = await db();
    return unwrap(await client.from('orders').update({ status }).eq('id', orderId).select().single());
  },

  async getAdminCustomers() {
    const client = await db();
    return unwrap(await client.from('admin_customer_summary').select('*').order('full_name'));
  },

  async submitReview({ productId, rating, body }) {
    const client = await db();
    return unwrap(await client.from('reviews').insert({ product_id: productId, rating, body }));
  },

  async getProductReviews(productId) {
    const client = await db();
    return unwrap(await client.from('reviews')
      .select('id, rating, body, created_at, profiles(full_name)')
      .eq('product_id', productId).eq('status', 'approved').order('created_at', { ascending: false }));
  },

  async getAdminReviews() {
    const client = await db();
    return unwrap(await client.from('reviews')
      .select('*, profiles(full_name, email), products(title)')
      .order('created_at', { ascending: false }));
  },

  async moderateReview(reviewId, status) {
    const client = await db();
    return unwrap(await client.from('reviews').update({ status }).eq('id', reviewId));
  },

  async getSalesReport() {
    const client = await db();
    return unwrap(await client.from('sales_report').select('*').order('sale_day', { ascending: false }));
  },

  async uploadProductImage(file, productId) {
    const client = await db();
    const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${productId}/${crypto.randomUUID()}.${extension}`;
    const uploaded = unwrap(await client.storage.from('book-covers').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type
    }));
    const { data } = client.storage.from('book-covers').getPublicUrl(uploaded.path);
    return { storage_path: uploaded.path, public_url: data.publicUrl };
  }
};
