async function renderAuthUI() {
  const guestLinks = document.querySelectorAll('.auth-guest');
  const userBox = document.getElementById('authUser');
  const userName = document.getElementById('authUserName');

  if (!userBox) return null;

  let session = null;
  try {
    session = await api.getMe();
  } catch (e) {
    session = null;
  }

  if (session) {
    guestLinks.forEach((el) => (el.hidden = true));
    userBox.hidden = false;
    if (userName) userName.textContent = session.name;
  } else {
    guestLinks.forEach((el) => (el.hidden = false));
    userBox.hidden = true;
  }

  return session;
}

document.addEventListener('DOMContentLoaded', () => {
  renderAuthUI();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await api.logout();
      } catch (e) {
        /* ignore */
      }
      clearCart();
      window.location.href = 'index.html';
    });
  }
});
