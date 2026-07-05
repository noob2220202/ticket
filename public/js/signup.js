const signupForm = document.getElementById('signupForm');
const formMessage = document.getElementById('formMessage');

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.hidden = false;
  formMessage.className = 'form-message ' + type;
}

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = document.getElementById('userId').value.trim();
  const password = document.getElementById('password').value;
  const passwordConfirm = document.getElementById('passwordConfirm').value;
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const agree = document.getElementById('agree').checked;

  if (!signupForm.checkValidity()) {
    signupForm.reportValidity();
    return;
  }

  if (password !== passwordConfirm) {
    showMessage('비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  if (!agree) {
    showMessage('이용약관에 동의해주세요.', 'error');
    return;
  }

  const submitBtn = signupForm.querySelector('button[type=submit]');
  submitBtn.disabled = true;

  try {
    await api.signup({ userId, password, name, phone, email });
    showMessage('가입이 완료되었습니다. 로그인 페이지로 이동합니다.', 'success');

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1200);
  } catch (err) {
    showMessage(err.message, 'error');
    submitBtn.disabled = false;
  }
});
