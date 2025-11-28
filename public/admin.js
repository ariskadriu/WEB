// Determine API base so the frontend works whether the page is served from
// the Node server (port 3000), a live-server on another port, or opened via file://
const API_BASE = (function(){
  try {
    // If the page is being served from the Node server on port 3000, use relative URLs.
    if (location.port === '3000') return '';
    // Otherwise (live-server on different port, file://, etc) point to the Node server.
    return 'http://localhost:3000';
  } catch (e) {
    return 'http://localhost:3000';
  }
})();

async function fetchJSON(url, opts) {
  const res = await fetch(API_BASE + url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Request failed');
  }
  return res.json();
}

const loginForm = document.getElementById('admin-login-form');
const adminPass = document.getElementById('admin-pass');
const adminStatus = document.getElementById('admin-status');
const empForm = document.getElementById('admin-employee-form');
const empMsg = document.getElementById('admin-employee-msg');
const reportMonth = document.getElementById('report-month');
const reportDay = document.getElementById('report-day');
const reportWeek = document.getElementById('report-week');
const reportOutput = document.getElementById('report-output');
const periodRadios = document.getElementsByName('period');
const btnReport = document.getElementById('btn-report');

function getToken(){ return localStorage.getItem('adminPass'); }
function setToken(t){ if (t) localStorage.setItem('adminPass', t); else localStorage.removeItem('adminPass'); }

async function renderStatus(){
  const t = getToken();
  if (!t) {
    adminStatus.innerHTML = 'Not logged in';
    return;
  }
  // verify token with server
  try {
    const res = await fetch(API_BASE + '/api/admin/validate', { method: 'GET', headers: { 'x-admin-pass': t } });
    if (!res.ok) throw new Error('Invalid token');
    adminStatus.innerHTML = 'Logged in <button id="admin-logout" style="margin-left:12px;padding:6px 10px;border-radius:6px;background:#ef5350;color:#fff;border:0;cursor:pointer">Logout</button>';
    const btn = document.getElementById('admin-logout');
    if (btn) btn.addEventListener('click', async () => {
      // call server to invalidate token, then clear local token
      try {
        const res = await fetch(API_BASE + '/api/admin/logout', { method: 'POST', headers: { 'x-admin-pass': t } });
        if (!res.ok) {
          // still clear local token if server reports error
          setToken(null);
          renderStatus();
          return;
        }
        const data = await res.json().catch(()=>({}));
        setToken(null);
        renderStatus();
      } catch (err) {
        // network error - clear locally
        setToken(null);
        renderStatus();
      }
    });
  } catch (err) {
    // token invalid on server (stale) — clear it
    setToken(null);
    adminStatus.innerHTML = 'Not logged in';
  }
}

// The admin login form was removed from this page in favor of the main page modal.
// Guard the listener registration so the script doesn't throw when those elements are absent.
  if (loginForm && adminPass) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = adminPass.value;
    try {
      const API_BASE_LOCAL = API_BASE; // keep code clear
      const data = await fetchJSON(API_BASE_LOCAL + '/api/admin/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({password: pass})});
      if (data && data.ok) {
        setToken(pass);
        adminPass.value = '';
        await renderStatus();
      } else {
        adminStatus.innerHTML = '<span style="color:red">Login failed</span>';
      }
    } catch (err) {
      adminStatus.innerHTML = `<span style="color:red">Login failed: ${escapeHtml(err.message || String(err))}</span>`;
    }
  });
}

empForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('a-username').value.trim();
  const name = document.getElementById('a-name').value.trim();
  const password = document.getElementById('a-password').value.trim();
  const role = document.getElementById('a-role').value;
  
  if (!username) return alert('Username is required');
  if (!password) return alert('Password is required');
  
  const token = getToken();
  if (!token) return alert('Please login as admin first');
  try {
    const emp = await fetchJSON('/api/employees', {method:'POST', headers:{'content-type':'application/json','x-admin-pass': token}, body:JSON.stringify({username, name, password, role})});
    empMsg.style.color = 'green';
    empMsg.textContent = 'Employee created: ' + emp.username + ' (role: ' + emp.role + ')';
    empForm.reset();
    refreshEmployeeSelect();
  } catch (err) {
    empMsg.style.color = 'red';
    empMsg.textContent = 'Error: ' + err.message;
  }
});

function getSelectedPeriod(){
  for (const r of periodRadios) if (r.checked) return r.value;
  return 'month';
}

function showControlsForPeriod(){
  const p = getSelectedPeriod();
  reportDay.style.display = p === 'day' ? '' : 'none';
  reportWeek.style.display = p === 'week' ? '' : 'none';
  reportMonth.style.display = p === 'month' ? '' : 'none';
}

for (const r of periodRadios) r.addEventListener('change', showControlsForPeriod);
showControlsForPeriod();

btnReport.addEventListener('click', async () => {
  const p = getSelectedPeriod();
  let url = '/api/reports?period=' + encodeURIComponent(p);
  if (p === 'day') {
    const d = reportDay.value; if (!d) return alert('Pick a day'); url += '&date=' + encodeURIComponent(d);
  } else if (p === 'week') {
    const w = reportWeek.value; if (!w) return alert('Pick a week');
    // week input returns YYYY-Www, but server expects any date in week; send date=YYYY-MM-DD using Monday of week
    // Use the week value directly as date param (server will parse it as Date if valid), but to be safe transform
    const parts = w.split('-W');
    const year = parts[0], weekNum = Number(parts[1]);
    // compute first day of ISO week
    const simple = new Date(Date.UTC(year, 0, 1 + (weekNum - 1) * 7));
    url += '&date=' + simple.toISOString().slice(0,10);
  } else if (p === 'month') {
    const m = reportMonth.value; if (!m) return alert('Pick a month'); url += '&month=' + encodeURIComponent(m);
  }

  try {
    const data = await fetchJSON(url, {method:'GET'});
    renderReport(data);
  } catch (err) {
    reportOutput.innerHTML = `<div style="color:red">Error: ${escapeHtml(err.message)}</div>`;
  }
});

function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function renderReport(data){
  let html = '';
  html += `<div><strong>Period:</strong> ${escapeHtml(data.period || '')}` + (data.start ? ` (from ${escapeHtml(data.start)} to ${escapeHtml(data.end)})` : '') + `</div>`;
  html += `<div style="margin-top:8px"><strong>Total Revenue:</strong> $${(data.totalRevenue||0).toFixed(2)}</div>`;
  // by employee
  html += '<h3 style="margin-top:12px">By Employee</h3>';
  html += '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Employee</th><th>Total</th><th>Orders</th></tr></thead><tbody>';
  (data.byEmployee||[]).forEach(e => {
    html += `<tr><td>${escapeHtml(e.employeeName||e.employeeId)}</td><td>$${(e.total||0).toFixed(2)}</td><td>${e.orders||0}</td></tr>`;
  });
  html += '</tbody></table>';
  // by destination
  html += '<h3 style="margin-top:12px">By Destination</h3>';
  html += '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Destination</th><th>Total</th><th>Orders</th></tr></thead><tbody>';
  (data.byDestination||[]).forEach(d => {
    html += `<tr><td>${escapeHtml(d.destination)}</td><td>$${(d.total||0).toFixed(2)}</td><td>${d.orders||0}</td></tr>`;
  });
  html += '</tbody></table>';
  // status counts (shipped, refused, returned, at_base...)
  if (data.statusCounts) {
    html += '<h3 style="margin-top:12px">Status Counts</h3>';
    html += '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Status</th><th>Count</th></tr></thead><tbody>';
    Object.keys(data.statusCounts).forEach(s => {
      let label = s.replace(/_/g, ' ');
      label = label.charAt(0).toUpperCase() + label.slice(1);
      html += `<tr><td>${escapeHtml(label)}</td><td>${data.statusCounts[s]||0}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  reportOutput.innerHTML = html;
}

renderStatus();

// populate existing employees select for updates
const existingSelect = document.getElementById('a-select-existing');
async function refreshEmployeeSelect(){
  try{
    const list = await fetchJSON('/api/employees');
    existingSelect.innerHTML = '';
    list.forEach(e => {
      const opt = document.createElement('option'); opt.value = e.id; opt.textContent = e.username + (e.name ? ' — ' + e.name : ''); existingSelect.appendChild(opt);
    });
  }catch(err){ console.error(err); }
}
refreshEmployeeSelect();

document.getElementById('a-update-btn').addEventListener('click', async (ev) =>{
  ev.preventDefault();
  const id = existingSelect.value; 
  if(!id) return alert('Select employee');
  const password = document.getElementById('a-password-update').value.trim();
  const role = document.getElementById('a-role-update').value;
  if(!password && !role) return alert('Enter at least a password or select a role to update');
  const token = getToken(); 
  if(!token) return alert('Login as admin first');
  try{
    const payload = {};
    if(password) payload.password = password;
    if(role) payload.role = role;
    const res = await fetch(API_BASE + '/api/employees/' + encodeURIComponent(id), { method: 'PATCH', headers: {'content-type':'application/json','x-admin-pass': token}, body: JSON.stringify(payload) });
    if (!res.ok){ const e = await res.json().catch(()=>({})); throw new Error(e.error || res.statusText); }
    const data = await res.json();
    empMsg.style.color='green'; empMsg.textContent = 'Updated: ' + (data.username||data.id) + ' (role: ' + data.role + ')';
    document.getElementById('a-password-update').value='';
    refreshEmployeeSelect();
  }catch(err){ empMsg.style.color='red'; empMsg.textContent = 'Error: '+err.message; }
});

document.getElementById('a-quick-set-btn').addEventListener('click', async (ev) =>{
  ev.preventDefault();
  const id = existingSelect.value; 
  if(!id) return alert('Select employee');
  const pwd = document.getElementById('a-quick-password').value.trim();
  if(!pwd) return alert('Enter a password');
  const token = getToken(); 
  if(!token) return alert('Login as admin first');
  try{
    const res = await fetch(API_BASE + '/api/employees/' + encodeURIComponent(id), { method: 'PATCH', headers: {'content-type':'application/json','x-admin-pass': token}, body: JSON.stringify({ password: pwd }) });
    if (!res.ok){ const e = await res.json().catch(()=>({})); throw new Error(e.error || res.statusText); }
    const data = await res.json();
    empMsg.style.color='green'; empMsg.textContent = 'Password set for: ' + (data.username||data.id);
    document.getElementById('a-quick-password').value='';
  }catch(err){ empMsg.style.color='red'; empMsg.textContent = 'Error: '+err.message; }
});
