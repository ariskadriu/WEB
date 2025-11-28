// If the frontend is opened from a different origin/port (e.g. Live Server at :5500),
// point API requests to the backend running on port 3000. If the page is served
// by the backend (origin includes :3000), use relative paths.
const API_BASE = (location.port && location.port !== '3000') ? 'http://localhost:3000' : '';

async function fetchJSON(url, opts) {
  const res = await fetch(API_BASE + url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Request failed');
  }
  return res.json();
}

// Elements
const pForm = document.getElementById('product-form');
const productsTableBody = document.querySelector('#products-table tbody');
const ordersTableBody = document.querySelector('#orders-table tbody');
const oForm = document.getElementById('order-form');
const oProductInput = document.getElementById('o-product-input');
const oProductId = document.getElementById('o-product-id');
const oQty = document.getElementById('o-qty');
const oTotal = document.getElementById('o-total');
const oDestination = document.getElementById('o-destination');

// Employee elements
const eLoginForm = document.getElementById('employee-login-form');
const eUsername = document.getElementById('e-username');
const ePassword = document.getElementById('e-password');
const eLoginBtn = document.getElementById('e-login');
const eCurrent = document.getElementById('e-current');

let employeeToken = localStorage.getItem('employeeToken') || null;

let currentEmployee = null;

// cache products for quick lookup
let productsCache = [];

async function loadProducts() {
  const products = await fetchJSON('/api/products');
  productsCache = products;
  productsTableBody.innerHTML = '';
  // fill datalists
  const orderDatalist = document.getElementById('order-products');
  const productNamesDatalist = document.getElementById('product-names');
  if (orderDatalist) orderDatalist.innerHTML = '';
  if (productNamesDatalist) productNamesDatalist.innerHTML = '';
  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(p.name)}</td><td>$${p.price.toFixed(2)}</td><td>${p.quantity}</td>`;
    productsTableBody.appendChild(tr);
    // populate product name datalist
    if (productNamesDatalist) {
      const opn = document.createElement('option');
      opn.value = p.name;
      productNamesDatalist.appendChild(opn);
    }
    // populate order product datalist
    if (orderDatalist) {
      const opo = document.createElement('option');
      opo.value = p.name;
      orderDatalist.appendChild(opo);
    }
  });

  // if there's a selected product name in the input, resolve to ID
  if (oProductInput && oProductInput.value) {
    const found = productsCache.find(pp => pp.name.toLowerCase() === oProductInput.value.trim().toLowerCase());
    if (found) oProductId.value = found.id;
    else oProductId.value = '';
  }
}

async function loadEmployees() {
  try {
    const list = await fetchJSON('/api/employees');
    const dl = document.getElementById('employees-list');
    if (dl) {
      dl.innerHTML = '';
      list.forEach(e => {
        const op = document.createElement('option');
        op.value = e.username;
        dl.appendChild(op);
      });
    }
  } catch (err) {
    console.warn('Could not load employees for datalist', err);
  }
}

async function loadOrders() {
  const orders = await fetchJSON('/api/orders');
  ordersTableBody.innerHTML = '';
  orders.slice().reverse().forEach(o => {
    const tr = document.createElement('tr');
    const status = o.status || 'at_base';
    tr.innerHTML = `<td>${new Date(o.createdAt).toLocaleString()}</td><td>${escapeHtml(o.productName)}</td><td>${o.quantity}</td><td>$${o.unitPrice.toFixed(2)}</td><td>$${o.total.toFixed(2)}</td><td>${escapeHtml(o.employeeName || '')}</td><td>${escapeHtml(o.destination || '')}</td>`;
    // status cell
    const tdStatus = document.createElement('td');
    const sel = document.createElement('select');
    // status options (include returned/refused)
    const statusOptions = ['at_base','shipping','shipped','returned','refused'];
    const labels = { at_base: 'At Base', shipping: 'Shipping', shipped: 'Shipped', returned: 'Returned', refused: 'Refused' };
    statusOptions.forEach(s => { const op = document.createElement('option'); op.value = s; op.text = labels[s] || s; if (s===status) op.selected = true; sel.appendChild(op); });
    // determine permissions
    const isDriver = currentEmployee && currentEmployee.role === 'driver';
    const terminal = ['shipped','returned','refused'];
    sel.disabled = !employeeToken || !isDriver || terminal.includes(status);
    const btn = document.createElement('button'); btn.textContent = 'Update'; btn.style.marginLeft = '6px';
    btn.disabled = !employeeToken || !isDriver || terminal.includes(status);
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      if (!employeeToken) return alert('Login required');
      if (!isDriver) return alert('Only drivers can update order status');
      if (terminal.includes(status)) return alert('This order is finalized and cannot be changed');
      try {
        await fetchJSON(`/api/orders/${o.id}/status`, {method:'PATCH', headers:{'content-type':'application/json','x-employee-token': employeeToken}, body: JSON.stringify({status: sel.value})});
        await loadProducts();
        await loadOrders();
      } catch (err) {
        alert('Error updating status: ' + err.message);
      }
    });
    tdStatus.appendChild(sel); tdStatus.appendChild(btn);
    tr.appendChild(tdStatus);
    ordersTableBody.appendChild(tr);
  });
}

function escapeHtml(s){
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

// Product form
pForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('p-name').value.trim();
  const priceVal = document.getElementById('p-price').value.trim();
  const qtyVal = document.getElementById('p-qty').value.trim();
  
  if (!name || !priceVal || !qtyVal) return alert('All fields are required: name, price, quantity');
  
  const price = Number(priceVal);
  const quantity = Number(qtyVal);
  
  if (isNaN(price) || isNaN(quantity)) return alert('Price and quantity must be valid numbers');
  if (price < 0 || quantity < 0) return alert('Price and quantity must be non-negative');
  
  const adjustIfExists = document.getElementById('p-adjust').checked;
  try {
    if (adjustIfExists) {
      // try to find by name and adjust
      const products = await fetchJSON('/api/products');
      const found = products.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (found) {
        await fetchJSON('/api/products/adjust', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ id: found.id, adjust: quantity })});
      } else {
        await fetchJSON('/api/products', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({name, price, quantity})});
      }
    } else {
      await fetchJSON('/api/products', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({name, price, quantity})});
    }
    pForm.reset();
    await loadProducts();
  } catch (err) {
    alert('Error adding product: ' + err.message);
  }
});

// Order calculations
if (oProductInput) oProductInput.addEventListener('input', () => {
  // resolve product id when user types or selects
  const name = oProductInput.value.trim();
  if (!name) { if (oProductId) oProductId.value = ''; updateTotal(); return; }
  const found = productsCache.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (found) {
    if (oProductId) oProductId.value = found.id;
  } else {
    if (oProductId) oProductId.value = '';
  }
  updateTotal();
});
if (oQty) oQty.addEventListener('input', updateTotal);

function updateTotal(){
  const name = oProductInput ? oProductInput.value.trim() : '';
  if (!name) { oTotal.textContent = '0.00'; return; }
  const prod = productsCache.find(p => p.name.toLowerCase() === name.toLowerCase());
  const price = prod ? Number(prod.price) : 0;
  const qty = Number(oQty.value) || 0;
  oTotal.textContent = (price * qty).toFixed(2);
}

oForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentEmployee) return alert('Please login as an employee before placing orders.');
  if (!employeeToken) return alert('Please login as an employee before placing orders.');
  
  const productId = oProductId ? oProductId.value : (oProductInput ? oProductInput.value : '');
  const qtyVal = oQty.value.trim();
  const destination = oDestination.value.trim();
  
  if (!productId) return alert('Please select a product');
  if (!qtyVal) return alert('Please enter a quantity');
  if (!destination) return alert('Please enter a destination');
  
  const quantity = Number(qtyVal);
  if (isNaN(quantity) || quantity <= 0) return alert('Quantity must be a positive number');
  
  try {
    await fetchJSON('/api/orders', {method:'POST', headers:{'content-type':'application/json', 'x-employee-token': employeeToken}, body:JSON.stringify({productId, quantity, destination})});
    oForm.reset();
    oTotal.textContent = '0.00';
    await loadProducts();
    await loadOrders();
  } catch (err) {
    alert('Error creating order: ' + err.message);
  }
});

function renderCurrentEmployee(){
  if (currentEmployee) {
    eCurrent.textContent = `Logged in: ${currentEmployee.username}`;
    document.getElementById('order-hint').style.display = 'none';
  } else {
    eCurrent.textContent = 'Not logged in';
    document.getElementById('order-hint').style.display = 'block';
  }
}

eLoginForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const username = eUsername.value.trim();
  const password = ePassword.value;
  if (!username || !password) return alert('Username and password required');
  try {
    const data = await fetchJSON('/api/employees/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({username, password})});
    employeeToken = data.token;
    currentEmployee = data.employee;
    localStorage.setItem('employeeToken', employeeToken);
    localStorage.setItem('currentEmployee', JSON.stringify(currentEmployee));
    eUsername.value = '';
    ePassword.value = '';
    renderCurrentEmployee();
    await loadOrders();
  } catch (err) {
    alert('Login failed: ' + err.message);
  }
});

// init
// init
const storedEmp = localStorage.getItem('currentEmployee');
if (storedEmp) {
  try { currentEmployee = JSON.parse(storedEmp); } catch (err) { currentEmployee = null; }
}
employeeToken = localStorage.getItem('employeeToken') || null;
loadProducts();
loadOrders();
loadEmployees();

// Wire admin modal button if present (fallback wiring so button works reliably)
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-open-admin-modal');
  const adminModal = document.getElementById('admin-modal');
  const modalClose = document.getElementById('modal-close');
  const adminModalPass = document.getElementById('admin-modal-pass');
  const adminModalError = document.getElementById('admin-modal-error');
  const adminModalSubmit = document.getElementById('admin-modal-submit');
  if (!btn || !adminModal) return;
  btn.addEventListener('click', () => { adminModal.classList.add('show'); if (adminModalPass) adminModalPass.focus(); if (adminModalError) adminModalError.textContent = ''; });
  if (modalClose) modalClose.addEventListener('click', () => { adminModal.classList.remove('show'); if (adminModalPass) adminModalPass.value = ''; if (adminModalError) adminModalError.textContent = ''; });
  adminModal.addEventListener('click', (e) => { if (e.target === adminModal) { adminModal.classList.remove('show'); if (adminModalPass) adminModalPass.value = ''; if (adminModalError) adminModalError.textContent = ''; } });
  if (adminModalSubmit) adminModalSubmit.addEventListener('click', () => {
    (async () => {
      const pass = adminModalPass ? adminModalPass.value.trim() : '';
      if (!pass) { if (adminModalError) adminModalError.textContent = 'Please enter a password'; return; }
      try {
        const res = await fetch(API_BASE + '/api/admin/login', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ password: pass }) });
        if (!res.ok) {
          const e = await res.json().catch(()=>({}));
          throw new Error(e.error || res.statusText || 'Login failed');
        }
        const data = await res.json();
        if (data && data.ok) {
          // store admin password for admin page usage (prototype-only)
          localStorage.setItem('adminPass', pass);
          adminModal.classList.remove('show');
          window.location.href = '/admin.html';
        } else throw new Error('Login failed');
      } catch (err) {
        if (adminModalError) adminModalError.textContent = String(err.message || err);
        if (adminModalPass) { adminModalPass.value = ''; adminModalPass.focus(); }
      }
    })();
  });
});
