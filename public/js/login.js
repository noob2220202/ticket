const loginForm = document.getElementById('loginForm');
const formMessage = document.getElementById('formMessage');

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.hidden = false;
  formMessage.className = 'form-message ' + type;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = document.getElementById('userId').value.trim();
  const password = document.getElementById('password').value;
  const submitBtn = loginForm.querySelector('button[type=submit]');

  submitBtn.disabled = true;

  try {
    await api.login(userId, password);
    showMessage('로그인되었습니다.', 'success');

    const redirect = sessionStorage.getItem('kk_redirect');
    sessionStorage.removeItem('kk_redirect');

    setTimeout(() => {
      window.location.href = redirect || 'index.html';
    }, 500);
  } catch (err) {
    showMessage(err.message, 'error');
    submitBtn.disabled = false;
  }
});
