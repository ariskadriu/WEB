async function loadOrders() {
  const ordersTableBody = document.querySelector('#orders-table tbody');
  const orders = await fetch('/api/orders').then(r=>r.json());
  ordersTableBody.innerHTML = '';
  const empRaw = localStorage.getItem('currentEmployee');
  let isDriver = false;
  if (empRaw) {
    try {
      const emp = JSON.parse(empRaw);
      isDriver = emp.role === 'driver';
    } catch {}
  }
  orders.slice().reverse().forEach(o => {
    const tr = document.createElement('tr');
    // Format status label
    let statusLabel = o.status ? o.status.replace(/_/g, ' ') : '';
    statusLabel = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);
    // If driver and order is not finalized, show dropdown to change status
    const terminal = ['shipped', 'returned', 'refused'];
    let statusCell = statusLabel;
    if (isDriver && !terminal.includes(o.status)) {
      const allowed = [
        { value: 'at_base', label: 'At Base' },
        { value: 'shipping', label: 'Shipping' },
        { value: 'shipped', label: 'Shipped' },
        { value: 'returned', label: 'Returned' },
        { value: 'refused', label: 'Refused' }
      ];
      statusCell = `<select data-order-id="${o.id}" class="order-status-select">` +
        allowed.map(opt => `<option value="${opt.value}"${opt.value===o.status?' selected':''}>${opt.label}</option>`).join('') +
        '</select>';
    }
    tr.innerHTML = `<td>${new Date(o.createdAt).toLocaleString()}</td><td>${o.productName}</td><td>${o.quantity}</td><td>$${o.unitPrice.toFixed(2)}</td><td>$${o.total.toFixed(2)}</td><td>${o.employeeName}</td><td>${o.destination}</td><td>${statusCell}</td>`;
    ordersTableBody.appendChild(tr);
  });
  // Add event listeners for status change
  if (isDriver) {
    document.querySelectorAll('.order-status-select').forEach(sel => {
      sel.addEventListener('change', async function() {
        const orderId = this.getAttribute('data-order-id');
        const newStatus = this.value;
        const token = localStorage.getItem('employeeToken');
        if (!token) return alert('Not logged in');
        try {
          const res = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
              'content-type': 'application/json',
              'x-employee-token': token
            },
            body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) {
            const err = await res.json().catch(()=>({}));
            alert('Failed to update status: ' + (err.error || res.statusText));
            return;
          }
          loadOrders();
        } catch (err) {
          alert('Error updating status');
        }
      });
    });
  }
}
loadOrders();
document.getElementById('logout').onclick = function() {
  localStorage.clear();
};
