document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv.textContent = '';
  if (!username || !password) {
    errorDiv.textContent = 'Username and password required.';
    return;
  }
  try {
    if (username.toLowerCase() === 'admin') {
      // Try admin login
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) throw new Error('Invalid admin password');
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem('adminPass', password);
        window.location.href = '/admin.html';
        return;
      }
      throw new Error('Admin login failed');
    } else {
      // Try employee login
      const res = await fetch('/api/employees/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('Invalid employee credentials');
      const data = await res.json();
      if (data.token && data.employee) {
        localStorage.setItem('employeeToken', data.token);
        localStorage.setItem('currentEmployee', JSON.stringify(data.employee));
        window.location.href = '/home.html';
        return;
      }
      throw new Error('Employee login failed');
    }
  } catch (err) {
    errorDiv.textContent = err.message || 'Login failed.';
  }
});
