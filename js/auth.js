// localStorage가 막힌 환경(카카오톡 인앱브라우저, 프라이버시 강화 모드 등)에서도
// 예외가 터져 로그인/회원가입 흐름이 멈추지 않도록, 스토리지 접근을 전부
// try/catch로 감싸고 실패 시 메모리 기반으로 동작하도록 폴백을 둡니다.
function safeStorage(kind) {
  let store = null;
  try {
    store = window[kind];
    const testKey = '__auth_test__';
    store.setItem(testKey, '1');
    store.removeItem(testKey);
  } catch (e) {
    store = null;
  }

  const memory = {};

  return {
    getItem(key) {
      if (store) {
        try {
          return store.getItem(key);
        } catch (e) {
          // 접근 실패 시 메모리 값으로 폴백
        }
      }
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    setItem(key, value) {
      if (store) {
        try {
          store.setItem(key, value);
          return;
        } catch (e) {
          // 접근 실패 시 메모리에 저장
        }
      }
      memory[key] = value;
    },
    removeItem(key) {
      if (store) {
        try {
          store.removeItem(key);
          return;
        } catch (e) {
          // 접근 실패 시 메모리에서 제거
        }
      }
      delete memory[key];
    },
  };
}

const authStorage = safeStorage('localStorage');

const AUTH_MEMBERS_KEY = 'kk_members';
const AUTH_SESSION_KEY = 'kk_session';

function getMembers() {
  try {
    return JSON.parse(authStorage.getItem(AUTH_MEMBERS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveMembers(members) {
  authStorage.setItem(AUTH_MEMBERS_KEY, JSON.stringify(members));
}

function findMember(userId) {
  return getMembers().find((m) => m.userId === userId);
}

function getSession() {
  try {
    return JSON.parse(authStorage.getItem(AUTH_SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function setSession(session) {
  authStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  authStorage.removeItem(AUTH_SESSION_KEY);
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
