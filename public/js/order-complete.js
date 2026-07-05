const lastOrderId = sessionStorage.getItem('kk_last_order');
const orderIdText = document.getElementById('orderIdText');
if (lastOrderId && orderIdText) {
  orderIdText.textContent = '주문번호 ' + lastOrderId;
}
