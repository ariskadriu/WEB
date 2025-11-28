let productsCache = [];
async function loadProducts() {
  const products = await fetch('/api/products').then(r=>r.json());
  productsCache = products;
}
loadProducts();
const oProductInput = document.getElementById('o-product-input');
const oQty = document.getElementById('o-qty');
const oTotal = document.getElementById('o-total');
const oDestination = document.getElementById('o-destination');
function updateTotal() {
  const name = oProductInput.value.trim();
  const prod = productsCache.find(p => p.name.toLowerCase() === name.toLowerCase());
  const price = prod ? Number(prod.price) : 0;
  const qty = Number(oQty.value) || 0;
  oTotal.textContent = (price * qty).toFixed(2);
}
oProductInput.addEventListener('input', updateTotal);
oQty.addEventListener('input', updateTotal);
document.getElementById('order-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const name = oProductInput.value.trim();
  const prod = productsCache.find(p => p.name.toLowerCase() === name.toLowerCase());
  const productId = prod ? prod.id : '';
  const qtyVal = oQty.value.trim();
  const destination = oDestination.value.trim();
  const msgDiv = document.getElementById('order-msg');
  msgDiv.textContent = '';
  if (!productId) {
    msgDiv.textContent = 'Please select a valid product.';
    return;
  }
  if (!qtyVal || isNaN(Number(qtyVal)) || Number(qtyVal) <= 0) {
    msgDiv.textContent = 'Enter a valid quantity.';
    return;
  }
  if (!destination) {
    msgDiv.textContent = 'Enter a destination.';
    return;
  }
  const employeeToken = localStorage.getItem('employeeToken');
  if (!employeeToken) {
    msgDiv.textContent = 'Please login first.';
    return;
  }
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-employee-token': employeeToken },
      body: JSON.stringify({ productId, quantity: Number(qtyVal), destination })
    });
    msgDiv.style.color = 'green';
    msgDiv.textContent = 'Order placed.';
    document.getElementById('order-form').reset();
    updateTotal();
  } catch (err) {
    msgDiv.style.color = 'red';
    msgDiv.textContent = 'Error: ' + (err.message || err);
  }
});
document.getElementById('logout').onclick = function() {
  localStorage.clear();
};
