const AUTH_MEMBERS_KEY = 'kk_members';
const AUTH_SESSION_KEY = 'kk_session';

function getMembers() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_MEMBERS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveMembers(members) {
  localStorage.setItem(AUTH_MEMBERS_KEY, JSON.stringify(members));
}

function findMember(userId) {
  return getMembers().find((m) => m.userId === userId);
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function renderAuthUI() {
  const session = getSession();
  const guestLinks = document.querySelectorAll('.auth-guest');
  const userBox = document.getElementById('authUser');
  const userName = document.getElementById('authUserName');

  if (!userBox) return;

  if (session) {
    guestLinks.forEach((el) => (el.hidden = true));
    userBox.hidden = false;
    if (userName) userName.textContent = session.name;
  } else {
    guestLinks.forEach((el) => (el.hidden = false));
    userBox.hidden = true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderAuthUI();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      renderAuthUI();
      window.location.href = 'index.html';
    });
  }
});
