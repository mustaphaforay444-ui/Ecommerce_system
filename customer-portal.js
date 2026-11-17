let portalUser;
let portalChannel;

document.addEventListener('DOMContentLoaded', initializePortal);

async function initializePortal() {
  const notice = document.getElementById('portalNotice');
  try {
    const client = await window.supabaseReady;
    const { data: { user } } = await client.auth.getUser();
    if (!user) { location.href = 'login.html?next=customer-portal.html'; return; }
    portalUser = user;
    const profile = await window.bookStore.currentProfile();
    if (profile?.role === 'admin') { location.href = 'admin.html'; return; }
    document.getElementById('portalGreeting').textContent = `Welcome, ${profile.full_name || 'Reader'}`;
    document.getElementById('portalEmail').textContent = profile.email || user.email || '';
    document.getElementById('profileName').value = profile.full_name || '';
    document.getElementById('profileEmail').value = profile.email || user.email || '';
    document.getElementById('profilePhone').value = profile.phone || '';
    notice.textContent = '';
    bindPortalNavigation();
    await loadCustomerMessages();
    portalChannel = client.channel(`customer-messages-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'customer_messages', filter: `customer_id=eq.${user.id}` }, loadCustomerMessages).subscribe();
  } catch (error) { notice.textContent = error.message || 'Your portal could not be loaded.'; }
}

function bindPortalNavigation() {
  document.querySelectorAll('[data-view],[data-open]').forEach(button => button.addEventListener('click', () => showPortalView(button.dataset.view || button.dataset.open)));
  document.getElementById('signOut').addEventListener('click', async event => {
    event.preventDefault();
    try { await window.bookStore.signOut(); location.href = 'index.html'; }
    catch (error) { document.getElementById('portalNotice').textContent = error.message || 'Could not sign out.'; }
  });
  document.getElementById('profileForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      const profile = await window.bookStore.updateMyProfile({ full_name: document.getElementById('profileName').value.trim(), phone: document.getElementById('profilePhone').value.trim() });
      document.getElementById('portalGreeting').textContent = `Welcome, ${profile.full_name || 'Reader'}`;
      document.getElementById('portalNotice').textContent = 'Your account details were saved.';
    } catch (error) { document.getElementById('portalNotice').textContent = error.message || 'Your account details could not be saved.'; }
    finally { button.disabled = false; }
  });
  document.getElementById('messageForm').addEventListener('submit', sendCustomerMessage);
}

function showPortalView(view) {
  document.querySelectorAll('.portal-view').forEach(panel => panel.classList.toggle('active', panel.id === `view-${view}`));
  document.querySelectorAll('.portal-nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'messages') loadCustomerMessages();
  if (view === 'orders' || view === 'cart' || view === 'reading') {
    const frame = document.querySelector(`#view-${view} iframe`);
    if (frame?.contentWindow) frame.contentWindow.postMessage({ type: 'portal-refresh' }, location.origin);
  }
}

async function loadCustomerMessages() {
  const list = document.getElementById('messageList'); if (!list || !portalUser) return;
  try {
    const messages = await window.bookStore.getCustomerMessages();
    list.replaceChildren();
    if (!messages.length) { const empty = document.createElement('p'); empty.className = 'chat-empty'; empty.textContent = 'No messages yet. Send a message if you need help with a book or order.'; list.appendChild(empty); }
    messages.forEach(message => {
      const bubble = document.createElement('div'); bubble.className = `message-bubble${message.sender_id === portalUser.id ? ' mine' : ''}`;
      bubble.append(document.createTextNode(message.body));
      const meta = document.createElement('small'); meta.className = 'message-meta'; meta.textContent = `${message.sender_id === portalUser.id ? 'You' : 'Reader’s Corner'} · ${new Date(message.created_at).toLocaleString()}`;
      bubble.appendChild(meta); list.appendChild(bubble);
    });
    list.scrollTop = list.scrollHeight;
  } catch (error) { list.replaceChildren(); const msg = document.createElement('p'); msg.className = 'chat-error'; msg.textContent = error.message || 'Messages could not be loaded.'; list.appendChild(msg); }
}

async function sendCustomerMessage(event) {
  event.preventDefault(); const input = document.getElementById('messageText'); const button = event.currentTarget.querySelector('button');
  const body = input.value.trim(); if (!body) return;
  button.disabled = true;
  try { await window.bookStore.sendCustomerMessage(body); input.value = ''; await loadCustomerMessages(); }
  catch (error) { document.getElementById('portalNotice').textContent = error.message || 'Message could not be sent.'; }
  finally { button.disabled = false; }
}
