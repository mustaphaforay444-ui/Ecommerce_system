document.addEventListener('DOMContentLoaded', initializeSellerPortal);

async function initializeSellerPortal() {
  const notice = document.getElementById('sellerNotice');
  try {
    const profile = await window.bookStore.requireRole('seller');
    if (!profile) return;
    if (profile.seller_status !== 'approved') {
      await window.bookStore.signOut();
      location.replace(`seller-login.html?status=${encodeURIComponent(profile.seller_status || 'pending')}`);
      return;
    }
    document.body.classList.remove('seller-auth-checking');
    document.getElementById('sellerWelcome').textContent = `Welcome, ${profile.full_name || 'Seller'}`;
    document.getElementById('sellerName').value = profile.full_name || '';
    document.getElementById('sellerEmail').value = profile.email || '';
    document.getElementById('sellerPhone').value = profile.phone || '';
    notice.textContent = '';
  } catch (error) {
    notice.textContent = error.message || 'Your seller portal could not be loaded.';
    document.body.classList.remove('seller-auth-checking');
    return;
  }

  const layout = document.querySelector('.seller-layout');
  const toggle = document.getElementById('sellerMenuToggle');
  const closeMenu = () => { layout.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    const open = layout.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('sellerBackdrop').addEventListener('click', closeMenu);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  document.querySelectorAll('[data-view],[data-open-view]').forEach(button => button.addEventListener('click', () => {
    const view = button.dataset.view || button.dataset.openView;
    document.querySelectorAll('.seller-view').forEach(panel => panel.classList.toggle('active', panel.id === `sellerView-${view}`));
    document.querySelectorAll('.seller-nav-item[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
    document.getElementById('sellerHeading').textContent = view === 'account' ? 'My Account' : 'Dashboard';
    closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }));

  document.getElementById('sellerProfileForm').addEventListener('submit', async event => {
    event.preventDefault(); const button = document.getElementById('saveSellerProfile'); button.disabled = true;
    try {
      const profile = await window.bookStore.updateMyProfile({ full_name: document.getElementById('sellerName').value.trim(), phone: document.getElementById('sellerPhone').value.trim() });
      document.getElementById('sellerWelcome').textContent = `Welcome, ${profile.full_name || 'Seller'}`;
      notice.textContent = 'Your account details were saved.';
    } catch (error) { notice.textContent = error.message || 'Your account details could not be saved.'; }
    finally { button.disabled = false; }
  });
  document.getElementById('signOut').addEventListener('click', async () => {
    try { await window.bookStore.signOut(); } finally { location.replace('seller-login.html'); }
  });
}
