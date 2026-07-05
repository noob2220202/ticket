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
const loadingState = document.getElementById('loadingState');
const searchInput = document.getElementById('searchInput');

let activeCategory = 'all';

function formatWon(n) {
  return n.toLocaleString('ko-KR') + '원';
}

function productCardHTML(p) {
  return `
    <li class="product-card" data-category="${p.category}" data-name="${p.name}" data-id="${p.id}">
      <div class="thumb ${p.brandClass}">
        <span class="brand-name">${p.brandLabel}</span>
        <span class="denom">${p.denom.toLocaleString('ko-KR')}<small>원</small></span>
      </div>
      <div class="card-body">
        <strong class="name">${p.name}</strong>
        <span class="discount">할인율 ${p.discount}%</span>
        <span class="sale-price">${formatWon(p.price)}</span>
        <button type="button" class="btn btn-buy" data-add-to-cart>구매하기</button>
      </div>
    </li>
  `;
}

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

function attachBuyHandlers(products) {
  productGrid.querySelectorAll('.product-card').forEach((card) => {
    const product = products.find((p) => p.id === card.dataset.id);
    const buyBtn = card.querySelector('[data-add-to-cart]');
    if (!buyBtn || !product) return;
    buyBtn.addEventListener('click', () => {
      addToCart(
        {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
        },
        1
      );
      window.location.href = 'cart.html';
    });
  });
}

async function loadProducts() {
  if (!productGrid) return;

  try {
    const products = await api.getProducts();
    productGrid.innerHTML = products.map(productCardHTML).join('');
    attachBuyHandlers(products);
    applyFilters();
  } catch (e) {
    productGrid.innerHTML = '';
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = '상품권 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
    }
  } finally {
    if (loadingState) loadingState.hidden = true;
  }
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

document.addEventListener('DOMContentLoaded', loadProducts);
