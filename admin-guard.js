async function verifyAdminAccess() {
  const redirectToLogin = () => { window.location.replace('admin-login.html'); };
  try {
    if (!window.bookStore) throw new Error('Admin client unavailable.');
    const client = await window.supabaseReady;
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return redirectToLogin();
    const profile = await window.bookStore.currentProfile();
    if (!profile || profile.role !== 'admin') {
      await window.bookStore.signOut();
      return redirectToLogin();
    }
    document.body.classList.remove('admin-auth-checking');
    window.dispatchEvent(new CustomEvent('admin:authorized', { detail: profile }));
  } catch {
    redirectToLogin();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', verifyAdminAccess, { once: true });
} else {
  verifyAdminAccess();
}
