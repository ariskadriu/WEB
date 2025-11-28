async function loadProducts() {
  const productsTableBody = document.querySelector('#products-table tbody');
  const products = await fetch('/api/products').then(r=>r.json());
  productsTableBody.innerHTML = '';
  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>$${p.price.toFixed(2)}</td><td>${p.quantity}</td>`;
    productsTableBody.appendChild(tr);
  });
}
loadProducts();
document.getElementById('logout').onclick = function() {
  localStorage.clear();
};
