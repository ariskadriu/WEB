const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Redirect root to login.html if index.html is missing
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Allow simple CORS so the frontend can be opened on another port (e.g. Live Server at :5500)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pass, x-employee-token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const dataDir = path.join(__dirname, 'data');
const productsFile = path.join(dataDir, 'products.json');
const ordersFile = path.join(dataDir, 'orders.json');
const employeesFile = path.join(dataDir, 'employees.json');

// Simple admin setup (prototype): set ADMIN_PASS env var to change password
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const employeeTokens = new Map(); // token -> employeeId

function makeToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function ensureDataFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(productsFile)) fs.writeFileSync(productsFile, JSON.stringify([] , null, 2));
  if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, JSON.stringify([] , null, 2));
  if (!fs.existsSync(employeesFile)) fs.writeFileSync(employeesFile, JSON.stringify([] , null, 2));
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

ensureDataFiles();

// Products endpoints
app.get('/api/products', (req, res) => {
  const products = readJSON(productsFile);
  res.json(products);
});

app.post('/api/products', (req, res) => {
  const { name, price, quantity } = req.body;
  if (!name || price == null || quantity == null) return res.status(400).json({ error: 'Missing fields' });
  const products = readJSON(productsFile);
  const id = Date.now().toString();
  const product = { id, name, price: Number(price), quantity: Number(quantity) };
  products.push(product);
  writeJSON(productsFile, products);
  res.status(201).json(product);
});

// Adjust product stock by id or name. Body: { id?, name?, adjust }
app.post('/api/products/adjust', (req, res) => {
  const { id, name, adjust } = req.body;
  if ((id == null) && !name) return res.status(400).json({ error: 'Provide id or name' });
  if (adjust == null) return res.status(400).json({ error: 'Missing adjust value' });
  const products = readJSON(productsFile);
  let product;
  if (id) product = products.find(p => p.id === id);
  if (!product && name) product = products.find(p => p.name.toLowerCase() === String(name).toLowerCase());
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const adj = Number(adjust) || 0;
  product.quantity = Math.max(0, Number(product.quantity || 0) + adj);
  writeJSON(productsFile, products);
  res.json(product);
});

// Employees endpoints
app.get('/api/employees', (req, res) => {
  const employees = readJSON(employeesFile);
  // Return employees without hashedPassword
  const out = employees.map(e => ({ id: e.id, username: e.username, name: e.name, role: e.role || 'employee' }));
  res.json(out);
});

app.post('/api/employees', (req, res) => {
  // Require admin password header to create employees (no tokens)
  const pass = req.get('x-admin-pass');
  if (!pass || pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const { username, name, password, role } = req.body;
  if (!username) return res.status(400).json({ error: 'Missing username' });
  if (!password) return res.status(400).json({ error: 'Missing password' });
  const employees = readJSON(employeesFile);
  // check duplicate usernames
  if (employees.find(e => e.username === username)) return res.status(400).json({ error: 'Username already exists' });
  const id = Date.now().toString();
  const hashed = bcrypt.hashSync(String(password), 8);
  const employee = { id, username, name: name || '', role: role || 'employee', hashedPassword: hashed };
  employees.push(employee);
  writeJSON(employeesFile, employees);
  // return without hashedPassword
  const { hashedPassword, ...out } = employee;
  res.status(201).json(out);
});

// Employee login - returns a token
app.post('/api/employees/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const employees = readJSON(employeesFile);
  const emp = employees.find(e => e.username === username);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  if (!emp.hashedPassword) return res.status(400).json({ error: 'Employee has no password set' });
  const ok = bcrypt.compareSync(String(password), emp.hashedPassword);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = makeToken();
  employeeTokens.set(token, emp.id);
  // include role so frontend can enforce driver-only actions
  res.json({ token, employee: { id: emp.id, username: emp.username, name: emp.name, role: emp.role || 'employee' } });
});

// Admin can update existing employee (password and role)
app.patch('/api/employees/:id', (req, res) => {
  const pass = req.get('x-admin-pass');
  if (!pass || pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.params.id;
  const { password, role, name } = req.body;
  const employees = readJSON(employeesFile);
  const emp = employees.find(e => e.id === id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  if (password) emp.hashedPassword = bcrypt.hashSync(String(password), 8);
  if (role) emp.role = role;
  if (name) emp.name = name;
  writeJSON(employeesFile, employees);
  const { hashedPassword, ...out } = emp;
  res.json(out);
});

// Admin can fix employees without passwords (for backward compat)
app.post('/api/admin/fix-employees', (req, res) => {
  const pass = req.get('x-admin-pass');
  if (!pass || pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const { passwords } = req.body; // { employeeId: password, ... }
  if (!passwords || typeof passwords !== 'object') return res.status(400).json({ error: 'Invalid passwords object' });
  const employees = readJSON(employeesFile);
  let count = 0;
  for (const [empId, pwd] of Object.entries(passwords)) {
    const emp = employees.find(e => e.id === empId);
    if (emp && pwd) {
      emp.hashedPassword = bcrypt.hashSync(String(pwd), 8);
      count++;
    }
  }
  writeJSON(employeesFile, employees);
  res.json({ fixed: count });
});

// Admin login (returns a temporary token)
// Admin login: validate password. We no longer issue tokens; client should store the admin
// password in localStorage and include it with admin requests via the `x-admin-pass` header.
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Missing password' });
  if (password !== ADMIN_PASS) return res.status(401).json({ error: 'Invalid password' });
  console.log('[admin] login success');
  res.json({ ok: true });
});

// Validate admin token
app.get('/api/admin/validate', (req, res) => {
  const pass = req.get('x-admin-pass');
  console.log(`[admin] validate pass=${pass ? '***' : 'missing'}`);
  if (!pass || pass !== ADMIN_PASS) return res.status(401).json({ error: 'Invalid or missing admin password' });
  res.json({ ok: true });
});

// Admin logout (invalidate token)
app.post('/api/admin/logout', (req, res) => {
  // With password-based auth there's nothing to invalidate server-side.
  console.log('[admin] logout');
  res.json({ ok: true });
});

// Reports endpoint: monthly report
// GET /api/reports?month=YYYY-MM
// Reports endpoint: supports period=day|week|month|all
// Examples:
// GET /api/reports?period=day&date=2025-11-27
// GET /api/reports?period=week&date=2025-11-23   (date within week)
// GET /api/reports?period=month&month=2025-11
// GET /api/reports?period=all
app.get('/api/reports', (req, res) => {
  const period = req.query.period || 'month';
  const dateParam = req.query.date; // YYYY-MM-DD
  const monthParam = req.query.month; // YYYY-MM
  const orders = readJSON(ordersFile);

  let start = null;
  let end = null;
  const now = new Date();

  if (period === 'all') {
    // no filtering
  } else if (period === 'day') {
    const d = dateParam ? new Date(dateParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else if (period === 'week') {
    const d = dateParam ? new Date(dateParam) : now;
    // find Monday of the week
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const diff = (day === 0) ? -6 : (1 - day); // shift so Monday
    start = new Date(d);
    start.setDate(d.getDate() + diff);
    start.setHours(0,0,0,0);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else { // month
    const m = monthParam || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const parts = m.split('-');
    const y = Number(parts[0]), mo = Number(parts[1]) - 1;
    start = new Date(y, mo, 1);
    end = new Date(y, mo + 1, 1);
  }

  let filtered = orders;
  if (start && end) {
    filtered = orders.filter(o => {
      const t = o.createdAt ? new Date(o.createdAt) : null;
      if (!t) return false;
      return t >= start && t < end;
    });
  }


  // Only count orders that are not refused or returned for revenue and breakdowns
  const revenueOrders = filtered.filter(o => o.status !== 'refused' && o.status !== 'returned');
  const totalRevenue = revenueOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const byEmployee = {};
  const byDestination = {};
  const statusCounts = {};
  filtered.forEach(o => {
    const st = o.status || 'at_base';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
    // Only count for revenue if not refused/returned
    if (o.status !== 'refused' && o.status !== 'returned') {
      const eId = o.employeeId || 'unknown';
      if (!byEmployee[eId]) byEmployee[eId] = { employeeId: eId, employeeName: o.employeeName || '', total: 0, orders: 0 };
      byEmployee[eId].total += Number(o.total) || 0;
      byEmployee[eId].orders += 1;

      const dest = o.destination || 'unknown';
      if (!byDestination[dest]) byDestination[dest] = { destination: dest, total: 0, orders: 0 };
      byDestination[dest].total += Number(o.total) || 0;
      byDestination[dest].orders += 1;
    }
  });
  res.json({ period, start: start ? start.toISOString() : null, end: end ? end.toISOString() : null, totalRevenue, byEmployee: Object.values(byEmployee), byDestination: Object.values(byDestination), statusCounts });
});

// Orders endpoints
app.get('/api/orders', (req, res) => {
  const orders = readJSON(ordersFile);
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  // require valid employee token
  const empToken = req.get('x-employee-token');
  if (!empToken || !employeeTokens.has(empToken)) return res.status(401).json({ error: 'Unauthorized' });
  const employeeId = employeeTokens.get(empToken);
  const { productId, quantity, destination } = req.body;
  if (!productId || quantity == null || !destination) return res.status(400).json({ error: 'Missing fields' });
  const products = readJSON(productsFile);
  const product = products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' });
  if (product.quantity < qty) return res.status(400).json({ error: 'Insufficient stock' });

  const employees = readJSON(employeesFile);
  const employee = employees.find(e => e.id === employeeId);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  // decrement product quantity
  product.quantity = product.quantity - qty;
  writeJSON(productsFile, products);

  const total = Number((product.price * qty).toFixed(2));
  const order = {
    id: Date.now().toString(),
    productId: product.id,
    productName: product.name,
    unitPrice: product.price,
    quantity: qty,
    total,
    employeeId: employee.id,
    employeeName: employee.username || employee.name || 'unknown',
    destination,
    status: 'at_base',
    statusUpdatedBy: null,
    statusUpdatedAt: null,
    createdAt: new Date().toISOString()
  };
  const orders = readJSON(ordersFile);
  orders.push(order);
  writeJSON(ordersFile, orders);

  res.status(201).json(order);
});

// Update order status
app.patch('/api/orders/:id/status', (req, res) => {
  const empToken = req.get('x-employee-token');
  if (!empToken || !employeeTokens.has(empToken)) return res.status(401).json({ error: 'Unauthorized' });
  const employeeId = employeeTokens.get(empToken);
  const employees = readJSON(employeesFile);
  const acting = employees.find(e => e.id === employeeId);
  if (!acting) return res.status(404).json({ error: 'Employee not found' });

  const id = req.params.id;
  const { status } = req.body;
  const allowed = ['at_base', 'shipping', 'shipped', 'returned', 'refused'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  // Only drivers may change order status
  if (acting.role !== 'driver') return res.status(403).json({ error: 'Only drivers can update order status' });

  const orders = readJSON(ordersFile);
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Prevent changing terminal statuses
  const terminal = ['shipped', 'returned', 'refused'];
  if (terminal.includes(order.status)) return res.status(400).json({ error: 'Cannot change status of a finalized order' });

  // Apply status change
  order.status = status;
  order.statusUpdatedBy = employeeId;
  order.statusUpdatedAt = new Date().toISOString();

  // If returned or refused, add quantity back to product stock
  if (status === 'returned' || status === 'refused') {
    const products = readJSON(productsFile);
    const prod = products.find(p => p.id === order.productId);
    if (prod) {
      prod.quantity = Number(prod.quantity || 0) + Number(order.quantity || 0);
      writeJSON(productsFile, products);
    }
  }

  writeJSON(ordersFile, orders);
  res.json(order);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
