window.addEventListener('load', async () => {
  const navigation = document.querySelector('.header-nav ul');
  if (!navigation || !window.supabaseReady || !window.bookStore) return;

  try {
    const client = await window.supabaseReady;
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;

    const links = [...navigation.querySelectorAll('a')];
    const signIn = links.find(link => link.getAttribute('href') === 'login.html');
    const register = links.find(link => link.getAttribute('href') === 'login.html#signup');
    if (signIn) {
      signIn.href = 'orders.html';
      signIn.textContent = session.user.user_metadata?.full_name?.trim() || 'My Account';
      signIn.setAttribute('aria-label', 'View your bookstore account and orders');
    }
    register?.closest('li')?.remove();

    const item = document.createElement('li');
    const signOut = document.createElement('a');
    signOut.className = 'nav-link';
    signOut.href = '#sign-out';
    signOut.textContent = 'Sign Out';
    signOut.addEventListener('click', async event => {
      event.preventDefault();
      signOut.setAttribute('aria-disabled', 'true');
      try {
        await window.bookStore.signOut();
        window.location.href = 'index.html';
      } catch (error) {
        signOut.removeAttribute('aria-disabled');
        alert(error.message || 'You could not be signed out. Please try again.');
      }
    });
    item.appendChild(signOut);
    navigation.appendChild(item);
  } catch {
    // The regular sign-in links remain available if session lookup fails.
  }
});
