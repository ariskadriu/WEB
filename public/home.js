// Simple SPA navigation for home.html
const pages = {
  addStock: document.getElementById('page-add-stock'),
  viewStock: document.getElementById('page-view-stock'),
  trackOrders: document.getElementById('page-track-orders'),
  welcome: document.getElementById('page-welcome'),
};
function showPage(page) {
  Object.values(pages).forEach(p => p.style.display = 'none');
  if (pages[page]) pages[page].style.display = 'block';
}
document.getElementById('nav-add-stock').onclick = () => showPage('addStock');
document.getElementById('nav-view-stock').onclick = () => showPage('viewStock');
document.getElementById('nav-track-orders').onclick = () => showPage('trackOrders');
document.getElementById('nav-logout').onclick = () => {
  localStorage.removeItem('employeeToken');
  localStorage.removeItem('currentEmployee');
  window.location.href = '/login.html';
};
// Show welcome by default
showPage('welcome');
// Display user info
const userInfo = document.getElementById('user-info');
try {
  const emp = JSON.parse(localStorage.getItem('currentEmployee') || '{}');
  userInfo.textContent = emp.username ? `Logged in as: ${emp.username} (${emp.role})` : '';
} catch {}
// TODO: Implement add/view stock and track orders logic in each page
