const loginForm = document.getElementById('loginForm');
const formMessage = document.getElementById('formMessage');

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.hidden = false;
  formMessage.className = 'form-message ' + type;
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const userId = document.getElementById('userId').value.trim();
  const password = document.getElementById('password').value;

  const member = findMember(userId);

  if (!member || member.password !== password) {
    showMessage('아이디 또는 비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  setSession({ userId: member.userId, name: member.name });
  showMessage('로그인되었습니다.', 'success');

  const redirect = sessionStorage.getItem('kk_redirect');
  sessionStorage.removeItem('kk_redirect');

  setTimeout(() => {
    window.location.href = redirect || 'index.html';
  }, 600);
});
