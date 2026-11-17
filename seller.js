document.addEventListener('DOMContentLoaded', async () => {
  const notice = document.getElementById('notice');
  try {
    const profile = await window.bookStore.requireRole('seller');
    if (!profile) return;
    document.getElementById('fullName').value = profile.full_name || '';
    document.getElementById('email').value = profile.email || '';
    document.getElementById('phone').value = profile.phone || '';
    notice.textContent = 'You are signed in to your seller account.';
  } catch (error) { notice.textContent = error.message || 'Your account could not be loaded.'; }

  document.getElementById('profileForm').addEventListener('submit', async event => {
    event.preventDefault(); const button = document.getElementById('save'); button.disabled = true;
    try {
      await window.bookStore.updateMyProfile({ full_name: document.getElementById('fullName').value.trim(), phone: document.getElementById('phone').value.trim() });
      notice.textContent = 'Your details were saved.';
    } catch (error) { notice.textContent = error.message || 'Your details could not be saved.'; }
    finally { button.disabled = false; }
  });
  document.getElementById('signOut').addEventListener('click', async () => {
    try { await window.bookStore.signOut(); } finally { location.replace('seller-login.html'); }
  });
});
