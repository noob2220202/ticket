const categoryToggle = document.getElementById('categoryToggle');
const categoryList = document.getElementById('categoryList');

if (categoryToggle && categoryList) {
  categoryToggle.addEventListener('click', () => {
    const isOpen = categoryList.classList.toggle('open');
    categoryToggle.setAttribute('aria-expanded', isOpen);
  });
}

const productGrid = document.getElementById('productGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');

let activeCategory = 'all';

function applyFilters() {
  if (!productGrid) return;

  const cards = productGrid.querySelectorAll('.product-card');
  const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
  let visibleCount = 0;

  cards.forEach((card) => {
    const matchesCategory = activeCategory === 'all' || card.dataset.category === activeCategory;
    const matchesKeyword = !keyword || card.dataset.name.toLowerCase().includes(keyword);
    const visible = matchesCategory && matchesKeyword;
    card.style.display = visible ? '' : 'none';
    if (visible) visibleCount += 1;
  });

  if (emptyState) emptyState.hidden = visibleCount !== 0;
}

if (categoryList) {
  categoryList.querySelectorAll('a[data-category]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      activeCategory = link.dataset.category;

      categoryList.querySelectorAll('a[data-category]').forEach((el) => el.classList.remove('active'));
      link.classList.add('active');

      applyFilters();
      categoryList.classList.remove('open');
      if (categoryToggle) categoryToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

if (searchInput) {
  searchInput.addEventListener('input', applyFilters);
}

if (productGrid) {
  productGrid.querySelectorAll('.product-card').forEach((card) => {
    const buyBtn = card.querySelector('[data-add-to-cart]');
    if (!buyBtn) return;
    buyBtn.addEventListener('click', () => {
      const denom = Number(card.dataset.denom);
      const discount = Number(card.dataset.discount);
      addToCart(
        {
          id: card.dataset.id,
          name: card.dataset.name,
          category: card.dataset.category,
          denom,
          discount,
          price: salePrice(denom, discount),
        },
        1
      );
      window.location.href = 'cart.html';
    });
  });
}
