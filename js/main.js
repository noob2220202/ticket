const categoryToggle = document.getElementById('categoryToggle');
const categoryList = document.getElementById('categoryList');

categoryToggle.addEventListener('click', () => {
  const isOpen = categoryList.classList.toggle('open');
  categoryToggle.setAttribute('aria-expanded', isOpen);
});
