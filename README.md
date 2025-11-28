# Product Orders Prototype

Simple prototype for registering products, creating orders, and tracking totals.

Run:

1. Install dependencies

```powershell
cd "d:/Apweb posta"
npm install
```

2. Start server

```powershell
npm start
```

3. Open browser: http://localhost:3000

Notes:
- Data is stored in `data/products.json`, `data/orders.json`, and `data/employees.json`.
- Register an employee (username) in the app and login before placing orders.
- When placing an order provide a destination — the order will record which employee sent it and the destination.
- This prototype decrements product quantity when an order is placed and validates stock.
 - Data is stored in `data/products.json`, `data/orders.json`, and `data/employees.json`.
 - Employees are created via the Admin page (`/admin.html`). Admin login password defaults to `admin123` (change via `ADMIN_PASS` env var).
 - After admin creates employees, employees can login on the main page and place orders (destination required).
 - Use the Admin page to view monthly reports (totals per employee and per destination).
 - Employees are created via the Admin page (`/admin.html`). Admin login password defaults to `admin123` (change via `ADMIN_PASS` env var).
 - When creating employees the admin sets a password and role (e.g. `driver`). Drivers can update order status.
 - Employees login on the main page with username/password and receive a token stored locally for actions.
 - Use the Admin page to view reports for Day / Week / Month or All time. Reports are shown as tables (totals by employee and by destination).
