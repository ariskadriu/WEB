document.getElementById('product-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const name = document.getElementById('p-name').value.trim();
  const priceVal = document.getElementById('p-price').value.trim();
  const qtyVal = document.getElementById('p-qty').value.trim();
  const adjustIfExists = document.getElementById('p-adjust').checked;
  const msgDiv = document.getElementById('add-stock-msg');
  msgDiv.textContent = '';
  if (!name || !priceVal || !qtyVal) {
    msgDiv.textContent = 'All fields required.';
    return;
  }
  const price = Number(priceVal);
  const quantity = Number(qtyVal);
  if (isNaN(price) || isNaN(quantity)) {
    msgDiv.textContent = 'Price and quantity must be numbers.';
    return;
  }
  try {
    if (adjustIfExists) {
      const products = await fetch('/api/products').then(r=>r.json());
      const found = products.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (found) {
        await fetch('/api/products/adjust', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ id: found.id, adjust: quantity })});
      } else {
        await fetch('/api/products', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({name, price, quantity})});
      }
    } else {
      await fetch('/api/products', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({name, price, quantity})});
    }
    msgDiv.style.color = 'green';
    msgDiv.textContent = 'Product added/adjusted.';
    document.getElementById('product-form').reset();
  } catch (err) {
    msgDiv.style.color = 'red';
    msgDiv.textContent = 'Error: ' + (err.message || err);
  }
});
document.getElementById('logout').onclick = function() {
  localStorage.clear();
};
