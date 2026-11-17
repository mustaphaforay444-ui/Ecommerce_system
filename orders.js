let ordersChannel;
document.addEventListener('DOMContentLoaded', loadOrders);
window.addEventListener('focus', loadOrders);

async function loadOrders() {
  const message = document.getElementById('ordersMessage');
  const list = document.getElementById('ordersList');
  if (!message || !list || message.dataset.loading === 'yes') return;
  message.dataset.loading = 'yes';
  try {
    const client = await window.supabaseReady;
    const { data: { user } } = await client.auth.getUser();
    if (!user) { message.textContent = 'Sign in to see orders linked to your account.'; list.replaceChildren(); return; }
    const orders = await window.bookStore.getMyOrders();
    message.textContent = orders.length ? '' : 'You have not placed any orders yet.';
    list.replaceChildren(...orders.map(renderOrder));
    if (!ordersChannel) {
      ordersChannel = client.channel(`customer-orders-${user.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, loadOrders)
        .subscribe();
    }
  } catch (error) { message.textContent = error.message || 'Your order history could not be loaded.'; }
  finally { delete message.dataset.loading; }
}

function renderOrder(order) {
  const article = document.createElement('article'); article.className = 'order-card';
  const head = document.createElement('div'); head.className = 'order-head';
  const id = document.createElement('strong'); id.textContent = `Order ${order.id}`;
  const date = document.createElement('time'); date.dateTime = order.created_at; date.textContent = new Date(order.created_at).toLocaleString();
  const status = document.createElement('span'); status.className = 'order-status'; status.textContent = (order.status || '').replaceAll('_', ' ');
  head.append(id, date, status);
  const items = document.createElement('ul'); items.className = 'order-lines';
  (order.order_items || []).forEach(item => { const li = document.createElement('li'); li.textContent = `${item.title_snapshot} × ${item.quantity} — KES ${(Number(item.unit_price) * Number(item.quantity)).toLocaleString()}`; items.appendChild(li); });
  const location = document.createElement('p'); location.textContent = order.delivery_address ? `Delivery location: ${order.delivery_address}` : `Delivery: ${order.delivery_type}`;
  const total = document.createElement('strong'); total.textContent = `Total: KES ${Number(order.total).toLocaleString()} · Payment: ${(order.payment_status || 'unpaid').replaceAll('_', ' ')}`;
  article.append(head, items, location, total); return article;
}
window.loadOrders = loadOrders;
