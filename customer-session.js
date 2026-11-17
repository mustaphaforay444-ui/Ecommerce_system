window.addEventListener('load', async () => {
  const menu = document.getElementById('accountMenu');
  if (!menu || !window.supabaseReady || !window.bookStore) return;
  const summary = document.getElementById('accountMenuSummary');
  const register = document.getElementById('registerMenuLink');
  const login = document.getElementById('loginMenuLink');
  const portal = document.getElementById('customerPortalMenuLink');
  const adminPortal = document.getElementById('adminPortalMenuLink');
  const signOut = document.getElementById('signOutMenuButton');

  try {
    const client = await window.supabaseReady;
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    const profile = await window.bookStore.currentProfile();
    register.hidden = true;
    login.hidden = true;
    if (profile?.role === 'admin') {
      summary.textContent = 'Admin ▾';
      adminPortal.hidden = false;
    } else {
      summary.textContent = 'My Account ▾';
      portal.hidden = false;
    }
    signOut.hidden = false;
    signOut.addEventListener('click', async () => {
      signOut.disabled = true;
      try {
        await window.bookStore.signOut();
        window.location.href = 'index.html';
      } catch (error) {
        signOut.disabled = false;
        alert(error.message || 'You could not be signed out. Please try again.');
      }
    });
  } catch {
    // Keep registration and login available when Supabase cannot be reached.
    register.hidden = false;
    login.hidden = false;
  }
});
