/* MAILIX Dashboard - Frontend Application */
const API_BASE = '/api/v1';

const state = {
  currentPage: 'dashboard',
  authToken: localStorage.getItem('mailix_token') || null,
  currentUser: null,
  projects: [],
  currentProject: null,
};

let stats = null;
let provider = null;

async function init() {
  await loadCurrentUser();
  await loadStats();
  setupEventListeners();
  showPage('dashboard');
  updateActiveNav('dashboard');
  // Load real recent activity after dashboard renders
  loadRecentActivity().catch(() => {});
}

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (state.authToken) {
    headers['Authorization'] = `Bearer ${state.authToken}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    state.authToken = null;
    localStorage.removeItem('mailix_token');
    showToast('Please log in', 'info');
    return null;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || 'API request failed';
    showToast(message, 'error');
    throw new Error(message);
  }
  return data;
}

async function loadCurrentUser() {
  if (!state.authToken) return;
  try {
    const data = await apiFetch('/auth/me');
    if (data?.user) state.currentUser = data.user;
  } catch (err) {
    console.warn('Not authenticated');
  }
}

async function loadStats() {
  try {
    const data = await apiFetch('/stats/summary');
    if (data) {
      stats = data;
      updateDashboardMetrics();
      updateProviderHealth();
    }
  } catch (err) {
    // Stats endpoint requires auth; will fail silently if not logged in
    console.warn('Stats not available:', err.message);
  }
}

function updateDashboardMetrics() {
  if (!stats) return;
  const m = stats.totals;
  document.getElementById('emailsSent').textContent = formatNumber(m.sent + m.delivered);
  document.getElementById('delivered').textContent = formatNumber(m.delivered);
  document.getElementById('bounced').textContent = formatNumber(m.bounced);
  document.getElementById('clicked').textContent = formatNumber(0);
  document.getElementById('opened').textContent = formatNumber(0);
  document.getElementById('totalSent').textContent = formatNumber(m.sent);
  document.getElementById('totalDelivered').textContent = formatNumber(m.delivered);
  document.getElementById('totalOpened').textContent = formatNumber(0);
  document.getElementById('totalClicked').textContent = formatNumber(0);
  document.getElementById('queueDepth').textContent = formatNumber(m.queued);
  document.getElementById('subscriberCount').textContent = formatNumber(stats.resources.subscribers);
  document.getElementById('domainCount').textContent = formatNumber(stats.resources.domains);
  document.getElementById('templateCount').textContent = formatNumber(stats.resources.templates);
}

function updateProviderHealth() {
  if (!stats?.provider) return;
  const el = document.getElementById('providerHealth');
  if (!el) return;
  if (stats.provider.healthy) {
    el.textContent = `Provider ${stats.provider.name}: OK`;
    el.className = 'health-pill ok';
  } else {
    el.textContent = `Provider ${stats.provider.name}: ${stats.provider.message || 'Down'}`;
    el.className = 'health-pill warn';
  }
}

function formatNumber(n) {
  return new Intl.NumberFormat().format(n || 0);
}

function setupEventListeners() {
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      showPage(page);
      updateActiveNav(page);
    });
  });

  document.querySelectorAll('.modal-close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
      closeBtn.closest('.modal').classList.remove('active');
    });
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // Form submissions
  const forms = {
    'loginForm': handleLogin,
    'companyForm': handleCompanySubmit,
    'projectForm': handleProjectSubmit,
    'subscriberForm': handleSubscriberSubmit,
    'campaignForm': handleCampaignSubmit,
    'templateForm': handleTemplateSubmit,
  };
  for (const [id, handler] of Object.entries(forms)) {
    const form = document.getElementById(id);
    if (form) form.addEventListener('submit', handler);
  }
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId + 'Page');
  if (page) page.classList.add('active');
  state.currentPage = pageId;

  // Load page-specific data
  if (pageId === 'logs') loadLogs();
  if (pageId === 'subscribers') loadSubscribers();
  if (pageId === 'newsletter') loadCampaigns();
  if (pageId === 'domains') loadDomains();
  if (pageId === 'projects') loadProjects();
  if (pageId === 'analytics') loadAnalytics();
  if (pageId === 'branding') loadCompany();
  if (pageId === 'templates') loadTemplates();
  if (pageId === 'messages') loadMessages();
  if (pageId === 'suppressions') loadSuppressions();
}

function updateActiveNav(page) {
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    if (link.dataset.page === page) link.classList.add('active');
    else link.classList.remove('active');
  });
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  toast.textContent = `${icons[type] || 'ℹ'} ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showLoading(el) {
  el.innerHTML = '<div class="state-loading">Loading…</div>';
}

function showEmpty(el, message) {
  el.innerHTML = `<div class="state-empty">${message}</div>`;
}

function showError(el, message) {
  el.innerHTML = `<div class="state-error">${message}</div>`;
}

// Auth
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Login failed');
    state.authToken = data.token;
    state.currentUser = data.user;
    localStorage.setItem('mailix_token', data.token);
    document.getElementById('loginModal').classList.remove('active');
    showToast('Logged in', 'success');
    await loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Projects
async function loadProjects() {
  const list = document.getElementById('projectsList');
  showLoading(list);
  try {
    const data = await apiFetch('/projects');
    state.projects = data.projects || [];
    if (state.projects.length === 0) {
      showEmpty(list, 'No projects yet. Click "Create Project" to add one.');
      return;
    }
    list.innerHTML = state.projects.map(p => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <div class="item-meta">${escapeHtml(p.id)}</div>
        </div>
        <div>
          <button class="btn btn-link" onclick="showToast('Switched to ${escapeHtml(p.name)}')">Switch</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showError(list, 'Failed to load projects');
  }
}

async function handleProjectSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('projectName').value.trim();
  if (!name) return;
  try {
    await apiFetch('/projects', { method: 'POST', body: JSON.stringify({ name }) });
    document.getElementById('projectModal').classList.remove('active');
    showToast('Project created', 'success');
    await loadProjects();
  } catch (err) { /* error shown via apiFetch */ }
}

// Company
async function loadCompany() {
  try {
    const data = await apiFetch('/company');
    if (!data) return;
    const c = data.company;
    document.getElementById('companyName').value = c.name || '';
    document.getElementById('companyWebsite').value = c.website || '';
    document.getElementById('primaryColor').value = c.primaryColor || '#6366F1';
    document.getElementById('secondaryColor').value = c.secondaryColor || '#8B5CF6';
    document.getElementById('senderName').value = c.senderName || '';
    document.getElementById('senderEmail').value = c.senderEmail || '';
    document.getElementById('replyTo').value = c.replyTo || '';
    updateCompanyPreview(c);
  } catch (err) { /* handled */ }
}

function updateCompanyPreview(c) {
  const previewCompany = document.getElementById('previewCompany');
  const previewCode = document.getElementById('previewCode');
  if (previewCompany) previewCompany.textContent = c.name || 'Acme';
  if (previewCode) previewCode.textContent = '583921';
  document.documentElement.style.setProperty('--primary', c.primaryColor || '#6366F1');
  document.documentElement.style.setProperty('--secondary', c.secondaryColor || '#8B5CF6');
}

async function handleCompanySubmit(event) {
  event.preventDefault();
  const body = {
    name: document.getElementById('companyName').value,
    website: document.getElementById('companyWebsite').value,
    primaryColor: document.getElementById('primaryColor').value,
    secondaryColor: document.getElementById('secondaryColor').value,
    senderName: document.getElementById('senderName').value,
    senderEmail: document.getElementById('senderEmail').value,
    replyTo: document.getElementById('replyTo').value,
  };
  try {
    await apiFetch('/company', { method: 'POST', body: JSON.stringify(body) });
    showToast('Company branding updated', 'success');
  } catch (err) { /* */ }
}

// Subscribers
async function loadSubscribers() {
  const list = document.getElementById('subscribersListPage');
  showLoading(list);
  try {
    const data = await apiFetch('/subscribers');
    const subs = data.subscribers || [];
    if (subs.length === 0) {
      showEmpty(list, 'No subscribers yet.');
      return;
    }
    list.innerHTML = `
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
        <tbody>${subs.map(s => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.email)}</td>
            <td><span class="status-pill status-${escapeHtml(s.status)}">${escapeHtml(s.status)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    showError(list, 'Failed to load subscribers');
  }
}

async function handleSubscriberSubmit(event) {
  event.preventDefault();
  const body = {
    name: document.getElementById('subscriberName').value,
    email: document.getElementById('subscriberEmail').value,
    status: document.getElementById('subscriberStatus').value,
  };
  try {
    await apiFetch('/subscribers', { method: 'POST', body: JSON.stringify(body) });
    document.getElementById('subscriberModal').classList.remove('active');
    showToast('Subscriber added', 'success');
    if (state.currentPage === 'subscribers') loadSubscribers();
  } catch (err) { /* */ }
}

// Domains
async function loadDomains() {
  const list = document.getElementById('domainsList');
  showLoading(list);
  try {
    const data = await apiFetch('/domains');
    const domains = data.domains || [];
    if (domains.length === 0) {
      showEmpty(list, 'No domains added. Add one above.');
      return;
    }
    list.innerHTML = domains.map(d => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(d.domain)}</strong>
          <div class="item-meta">Status: ${escapeHtml(d.status || 'pending')}</div>
          <div class="item-meta">SPF: ${d.spf_status ? '✓' : '✗'} · DKIM: ${d.dkim_status ? '✓' : '✗'} · DMARC: ${d.dmarc_status ? '✓' : '✗'}</div>
        </div>
        <div>
          <button class="btn btn-secondary" onclick="verifyDomain('${escapeHtml(d.id)}')">Verify</button>
          <button class="btn btn-link" onclick="removeDomain('${escapeHtml(d.id)}')">Remove</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showError(list, 'Failed to load domains');
  }
}

async function verifyDomain(id) {
  try {
    await apiFetch(`/domains/${id}/verify`, { method: 'POST' });
    showToast('Verification triggered', 'success');
    loadDomains();
  } catch (err) { /* */ }
}

async function removeDomain(id) {
  if (!confirm('Remove this domain?')) return;
  try {
    await apiFetch(`/domains/${id}`, { method: 'DELETE' });
    showToast('Domain removed', 'success');
    loadDomains();
  } catch (err) { /* */ }
}

// Logs
async function loadLogs() {
  const list = document.getElementById('logsList');
  showLoading(list);

  const type = document.getElementById('logFilterType')?.value || 'all';
  const project = document.getElementById('logFilterProject')?.value || 'all';
  const search = document.getElementById('logSearch')?.value || '';

  const params = new URLSearchParams();
  if (type && type !== 'all') params.set('type', type);
  if (project && project !== 'all') params.set('project', project);
  if (search) params.set('search', search);

  const qs = params.toString() ? '?' + params.toString() : '';

  try {
    const data = await apiFetch('/logs' + qs);
    const logs = data?.logs || [];
    if (logs.length === 0) {
      showEmpty(list, 'No logs match your filters.');
      return;
    }
    list.innerHTML = `
      <table class="table">
        <thead><tr><th>Time</th><th>Event</th><th>Type</th><th>Recipient</th><th>Status</th><th></th></tr></thead>
        <tbody>${logs.map(l => `
          <tr>
            <td>${formatDate(l.timestamp)}</td>
            <td>${escapeHtml(l.event || '')}</td>
            <td>${escapeHtml(l.type || '')}</td>
            <td>${escapeHtml(l.recipient || '')}</td>
            <td><span class="status-pill">${escapeHtml(l.status || '')}</span></td>
            <td><a href="#" onclick="showMessageDetail('${escapeHtml(l.messageId || l.id || '')}')">View</a></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    showError(list, 'Failed to load logs');
  }
}

function filterLogs() {
  loadLogs();
}

function showMessageDetail(id) {
  if (!id) return;
  showPage('messages');
  setTimeout(() => loadMessageDetail(id), 100);
}

// Messages
async function loadMessages() {
  const list = document.getElementById('messagesList');
  showLoading(list);
  try {
    const data = await apiFetch('/messages');
    const messages = data.messages || [];
    if (messages.length === 0) {
      showEmpty(list, 'No messages sent yet.');
      return;
    }
    list.innerHTML = `
      <table class="table">
        <thead><tr><th>Time</th><th>Recipient</th><th>Subject</th><th>Provider</th><th>Status</th><th>Attempts</th></tr></thead>
        <tbody>${messages.map(m => `
          <tr>
            <td>${formatDate(m.created_at)}</td>
            <td>${escapeHtml(m.recipient)}</td>
            <td>${escapeHtml(m.subject)}</td>
            <td>${escapeHtml(m.provider || '')}</td>
            <td><span class="status-pill">${escapeHtml(m.status)}</span></td>
            <td>${m.attempts || 0}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    showError(list, 'Failed to load messages');
  }
}

async function loadMessageDetail(id) {
  const el = document.getElementById('messageDetail');
  showLoading(el);
  try {
    const data = await apiFetch(`/messages/${id}`);
    const m = data.message;
    const events = data.events || [];
    el.innerHTML = `
      <h2>Message ${escapeHtml(m.id)}</h2>
      <div class="detail-grid">
        <div><strong>Recipient:</strong> ${escapeHtml(m.recipient)}</div>
        <div><strong>Sender:</strong> ${escapeHtml(m.sender || '')}</div>
        <div><strong>Subject:</strong> ${escapeHtml(m.subject)}</div>
        <div><strong>Template:</strong> ${escapeHtml(m.template_id || '—')}</div>
        <div><strong>Provider:</strong> ${escapeHtml(m.provider || '')}</div>
        <div><strong>Status:</strong> ${escapeHtml(m.status)}</div>
        <div><strong>Created:</strong> ${formatDate(m.created_at)}</div>
        <div><strong>Last Attempt:</strong> ${formatDate(m.last_attempt)}</div>
        <div><strong>Attempts:</strong> ${m.attempts || 0}</div>
        <div><strong>Next Retry:</strong> ${m.next_retry ? formatDate(m.next_retry) : '—'}</div>
        ${m.last_error ? `<div><strong>Last Error:</strong> ${escapeHtml(m.last_error)}</div>` : ''}
      </div>
      <h3>Events</h3>
      <ul class="events-list">
        ${events.map(e => `<li><strong>${escapeHtml(e.type)}</strong> at ${formatDate(e.created_at)}</li>`).join('')}
      </ul>`;
  } catch (err) {
    showError(el, 'Failed to load message');
  }
}

// Analytics
// Keep references to chart instances to destroy before re-render (prevents memory leaks)
const _analyticsCharts = {};

async function loadAnalytics() {
  const period = document.getElementById('analyticsFilterPeriod')?.value || '30d';
  const analyticsPage = document.getElementById('analyticsPage');
  if (!analyticsPage) return;

  // Show loading state in summary grid
  ['totalSent', 'totalDelivered', 'totalOpened', 'totalClicked'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '…';
  });

  try {
    const data = await apiFetch('/analytics?period=' + period);
    if (!data || !data.data) {
      renderAnalyticsEmpty();
      return;
    }
    const d = data.data;

    // Update summary grid with real values
    const safeSet = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatNumber(val || 0);
    };
    safeSet('totalSent', d.sent);
    safeSet('totalDelivered', d.delivered);
    safeSet('totalOpened', d.opened);
    safeSet('totalClicked', d.clicked);

    // Render charts using Chart.js (loaded from CDN in index.html)
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded — analytics charts skipped');
      return;
    }

    // Helper to create or update a bar chart
    function renderBarChart(canvasId, label, value, color) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      // Destroy previous instance to prevent memory leaks
      if (_analyticsCharts[canvasId]) {
        _analyticsCharts[canvasId].destroy();
        delete _analyticsCharts[canvasId];
      }

      const total = (d.sent || 0) + (d.delivered || 0) + (d.bounced || 0) + (d.opened || 0) + (d.clicked || 0);

      _analyticsCharts[canvasId] = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: [label],
          datasets: [{
            label,
            data: [value || 0],
            backgroundColor: color,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: label + ': ' + formatNumber(value || 0),
              color: '#e2e8f0',
              font: { size: 14, weight: '600' }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: '#94a3b8', precision: 0 },
              grid: { color: 'rgba(148,163,184,0.15)' }
            },
            x: {
              ticks: { color: '#94a3b8' },
              grid: { display: false }
            }
          }
        }
      });
    }

    renderBarChart('sentChart', 'Sent', d.sent, '#6366f1');
    renderBarChart('deliveredChart', 'Delivered', d.delivered, '#22d3ee');
    renderBarChart('bouncedChart', 'Bounced', d.bounced, '#f87171');
    renderBarChart('openedChart', 'Opened', d.opened, '#34d399');
    renderBarChart('clickedChart', 'Clicked', d.clicked, '#fbbf24');

  } catch (err) {
    console.warn('Analytics load failed:', err.message);
    renderAnalyticsEmpty();
  }
}

function renderAnalyticsEmpty() {
  ['totalSent', 'totalDelivered', 'totalOpened', 'totalClicked'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0';
  });
}

// Suppressions
async function loadSuppressions() {
  const list = document.getElementById('suppressionsList');
  showLoading(list);
  try {
    const data = await apiFetch('/suppressions');
    const sups = data.suppressions || [];
    if (sups.length === 0) {
      showEmpty(list, 'No suppressions.');
      return;
    }
    list.innerHTML = sups.map(s => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(s.email)}</strong>
          <div class="item-meta">Reason: ${escapeHtml(s.reason)} · ${escapeHtml(s.source)}</div>
        </div>
        <div><button class="btn btn-link" onclick="removeSuppression('${escapeHtml(s.id)}')">Remove</button></div>
      </div>
    `).join('');
  } catch (err) {
    showError(list, 'Failed to load suppressions');
  }
}

async function removeSuppression(id) {
  if (!confirm('Remove this suppression?')) return;
  try {
    await apiFetch(`/suppressions/${id}`, { method: 'DELETE' });
    loadSuppressions();
  } catch (err) { /* */ }
}

// Newsletters
async function loadCampaigns() {
  const list = document.getElementById('campaignsList');
  showLoading(list);
  try {
    const data = await apiFetch('/newsletter');
    const campaigns = data.campaigns || [];
    if (campaigns.length === 0) {
      showEmpty(list, 'No campaigns yet.');
      return;
    }
    list.innerHTML = campaigns.map(c => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(c.name)}</strong>
          <div class="item-meta">${escapeHtml(c.subject)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showError(list, 'Failed to load campaigns');
  }
}

async function handleCampaignSubmit(event) {
  event.preventDefault();
  const body = {
    name: document.getElementById('campaignName').value,
    subject: document.getElementById('campaignSubject').value,
    fromName: document.getElementById('campaignFromName').value,
    fromEmail: document.getElementById('campaignFromEmail').value,
    replyTo: document.getElementById('campaignReplyTo').value,
    template: document.getElementById('campaignTemplate').value,
  };
  try {
    await apiFetch('/newsletter', { method: 'POST', body: JSON.stringify(body) });
    document.getElementById('campaignModal').classList.remove('active');
    showToast('Campaign created', 'success');
    loadCampaigns();
  } catch (err) { /* */ }
}

// --- Studio (Templates) ---
let studioTemplates = { system: [], user: [] };
let currentStudioMode = 'user';
let currentTemplate = null;
let editorMode = 'visual';

async function loadTemplates() {
  const list = document.getElementById('templatesList');
  showLoading(list);
  try {
    const [userRes, systemRes] = await Promise.all([
      apiFetch('/templates'),
      apiFetch('/studio/system-templates').catch(() => ({ catalog: { templates: [] } }))
    ]);
    
    studioTemplates.user = userRes?.templates || [];
    studioTemplates.system = systemRes?.catalog?.templates || [];
    
    // Update categories filter based on system templates
    const categories = new Set(studioTemplates.system.map(t => t.category).filter(Boolean));
    const catSelect = document.getElementById('studioCategoryFilter');
    if (catSelect && catSelect.options.length === 1) {
      categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
        catSelect.appendChild(opt);
      });
    }
    
    renderStudioLibrary();
  } catch (err) {
    showError(list, 'Failed to load templates');
  }
}

function showMyTemplates() {
  currentStudioMode = 'user';
  document.getElementById('btnMyTemplates').classList.add('active');
  document.getElementById('btnSystemTemplates').classList.remove('active');
  renderStudioLibrary();
}

function showSystemTemplates() {
  currentStudioMode = 'system';
  document.getElementById('btnSystemTemplates').classList.add('active');
  document.getElementById('btnMyTemplates').classList.remove('active');
  renderStudioLibrary();
}

function filterStudioTemplates() {
  renderStudioLibrary();
}

function renderStudioLibrary() {
  const list = document.getElementById('templatesList');
  const search = (document.getElementById('studioSearch')?.value || '').toLowerCase();
  const category = document.getElementById('studioCategoryFilter')?.value || 'all';
  
  let templates = currentStudioMode === 'user' ? studioTemplates.user : studioTemplates.system;
  
  templates = templates.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search) || (t.subject || '').toLowerCase().includes(search);
    const matchCat = category === 'all' || t.category === category || (currentStudioMode === 'user' && t.type === category);
    return matchSearch && matchCat;
  });
  
  if (templates.length === 0) {
    showEmpty(list, currentStudioMode === 'user' ? 'No custom templates found. Try creating one.' : 'No system templates match your filter.');
    return;
  }
  
  list.innerHTML = templates.map(t => `
    <div class="template-card">
      <div class="template-card-header">
        <h3>${escapeHtml(t.name)}</h3>
        <p>${escapeHtml(currentStudioMode === 'user' ? t.type : t.category)}</p>
      </div>
      <div class="template-card-actions">
        <button class="btn btn-primary btn-sm" onclick="openStudioEditor('${escapeHtml(t.id)}', ${currentStudioMode === 'system'})">Open</button>
        ${currentStudioMode === 'system' ? `<button class="btn btn-secondary btn-sm" onclick="duplicateTemplateFromId('${escapeHtml(t.id)}')">Duplicate</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function openStudioEditor(id, isSystem) {
  showPage('studioEditorPage');
  document.getElementById('editorTemplateName').textContent = 'Loading...';
  
  try {
    const endpoint = isSystem ? `/studio/system-templates/${id}` : `/templates/${id}`;
    const data = await apiFetch(endpoint);
    currentTemplate = data.template;
    
    document.getElementById('editorTemplateName').textContent = currentTemplate.name;
    document.getElementById('editorTemplateStatus').textContent = isSystem ? 'System (Read-only)' : 'Custom';
    
    document.getElementById('editorSubject').value = currentTemplate.subject || '';
    document.getElementById('editorName').value = currentTemplate.name || '';
    if (document.getElementById('editorType')) {
      document.getElementById('editorType').value = currentTemplate.type || 'transactional';
    }
    
    const isReadOnly = isSystem;
    document.getElementById('editorSubject').disabled = isReadOnly;
    document.getElementById('editorName').disabled = isReadOnly;
    if (document.getElementById('editorType')) document.getElementById('editorType').disabled = isReadOnly;
    document.getElementById('btnSaveTemplate').style.display = isReadOnly ? 'none' : 'block';
    
    // Render variables
    const varsList = document.getElementById('editorVariablesList');
    const vars = currentTemplate.variables || [];
    varsList.innerHTML = vars.map(v => `<li onclick="navigator.clipboard.writeText('{{${v}}}');showToast('Variable copied','info')">{{${escapeHtml(v)}}}</li>`).join('');
    
    const html = currentTemplate.html || '';
    
    // Setup Code Editor
    document.getElementById('codeEditorTextarea').value = html;
    document.getElementById('codeEditorTextarea').disabled = isReadOnly;
    
    // Setup Visual Editor
    setupVisualEditor(html, isReadOnly);
    
  } catch (err) {
    showToast('Failed to load template', 'error');
    closeStudioEditor();
  }
}

function setupVisualEditor(html, isReadOnly) {
  const iframe = document.getElementById('visualEditorFrame');
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  
  if (!isReadOnly) {
    // Inject lightweight visual editor script
    const script = doc.createElement('script');
    script.textContent = `
      document.body.addEventListener('click', e => {
        if (e.target.tagName.match(/^H[1-6]$|^P$|^SPAN$|^A$|^DIV$/)) {
          e.target.contentEditable = 'true';
          e.target.focus();
        }
      });
      document.body.addEventListener('input', () => {
        window.parent.postMessage({ type: 'html_changed', html: document.documentElement.outerHTML }, '*');
      });
    `;
    doc.head.appendChild(script);
    
    const style = doc.createElement('style');
    style.textContent = `
      [contenteditable="true"] { outline: 2px dashed #6366F1; }
      [contenteditable="true"]:focus { outline: 2px solid #6366F1; }
    `;
    doc.head.appendChild(style);
  }
}

window.addEventListener('message', e => {
  if (e.data?.type === 'html_changed') {
    document.getElementById('codeEditorTextarea').value = e.data.html;
  }
});

function closeStudioEditor() {
  currentTemplate = null;
  showPage('templates');
}

function toggleEditorMode() {
  const btn = document.getElementById('btnEditorMode');
  const vis = document.getElementById('visualEditorContainer');
  const code = document.getElementById('codeEditorContainer');
  
  if (editorMode === 'visual') {
    // Switch to code
    editorMode = 'code';
    btn.textContent = 'Visual Mode';
    vis.style.display = 'none';
    code.style.display = 'block';
  } else {
    // Switch to visual
    editorMode = 'visual';
    btn.textContent = 'Code Mode';
    code.style.display = 'none';
    vis.style.display = 'block';
    
    // Sync code -> visual
    setupVisualEditor(document.getElementById('codeEditorTextarea').value, currentTemplate?.type === 'system');
  }
}

async function saveTemplate() {
  if (!currentTemplate || currentTemplate.type === 'system') return;
  
  const body = {
    name: document.getElementById('editorName').value,
    subject: document.getElementById('editorSubject').value,
    type: document.getElementById('editorType').value,
    html: document.getElementById('codeEditorTextarea').value,
  };
  
  try {
    await apiFetch(`/templates/${currentTemplate.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    showToast('Template saved', 'success');
    loadTemplates();
  } catch (err) { /* */ }
}

async function duplicateTemplate() {
  if (!currentTemplate) return;
  await duplicateTemplateFromId(currentTemplate.id, currentTemplate.type === 'system');
}

async function duplicateTemplateFromId(id, isSystem) {
  try {
    if (isSystem || id.startsWith('sys_') || !id.startsWith('tpl_')) {
      // It's a system template. We fetch it, then POST to /templates
      const data = await apiFetch(`/studio/system-templates/${id}`);
      const t = data.template;
      const newT = await apiFetch('/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: t.name + ' (Copy)',
          type: 'transactional', // Default
          subject: t.subject,
          html: t.html,
          variables: t.variables
        })
      });
      showToast('Template duplicated', 'success');
      loadTemplates();
      openStudioEditor(newT.template.id, false);
    } else {
      // It's a user template, use the duplicate endpoint
      const res = await apiFetch(`/templates/${id}/duplicate`, { method: 'POST' });
      showToast('Template duplicated', 'success');
      loadTemplates();
      openStudioEditor(res.template.id, false);
    }
  } catch (err) {
    showToast('Failed to duplicate', 'error');
  }
}

async function handleTemplateSubmit(event) {
  event.preventDefault();
  const body = {
    name: document.getElementById('newTemplateName')?.value || 'New Template',
    type: document.getElementById('templateType')?.value || 'transactional',
    subject: 'New Email',
    html: '<!DOCTYPE html><html><body><p>Hello World</p></body></html>'
  };
  try {
    const res = await apiFetch('/templates', { method: 'POST', body: JSON.stringify(body) });
    const modal = document.getElementById('createTemplateModal');
    if(modal) modal.classList.remove('active');
    showToast('Template created', 'success');
    loadTemplates();
    openStudioEditor(res.template.id, false);
  } catch (err) { /* */ }
}

function useTemplateInCampaign() {
  if (!currentTemplate) return;
  document.getElementById('campaignTemplate').innerHTML = `<option value="${currentTemplate.id}">${currentTemplate.name}</option>`;
  document.getElementById('campaignTemplate').value = currentTemplate.id;
  document.getElementById('campaignSubject').value = currentTemplate.subject || '';
  
  closeStudioEditor();
  showPage('newsletter');
  
  const modal = document.getElementById('createCampaignModal');
  if(modal) modal.classList.add('active');
}

function previewTemplate() {
  const html = document.getElementById('codeEditorTextarea').value;
  const newWin = window.open('', '_blank');
  newWin.document.write(html);
  newWin.document.close();
}


// Recent Activity (dashboard home)
async function loadRecentActivity() {
  const list = document.getElementById('activityList');
  if (!list) return;
  try {
    const data = await apiFetch('/logs?limit=5');
    const logs = data?.logs || [];
    if (logs.length === 0) {
      list.innerHTML = '<div style="color:var(--text-secondary);font-size:0.875rem;padding:16px;">No activity yet.</div>';
      return;
    }
    list.innerHTML = logs.slice(0, 5).map(l => `
      <div class="activity-item">
        <span>${escapeHtml(l.event || l.type || 'Event')}</span>
        <span class="activity-status">${escapeHtml(l.status || '')}</span>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = '<div style="color:var(--text-secondary);font-size:0.875rem;padding:16px;">Activity unavailable</div>';
  }
}

// Utilities
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"'`=\/]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
  })[c]);
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleString();
}

// Expose global functions referenced from inline HTML onclick handlers
window.escapeHtml = escapeHtml;
window.showMessageDetail = showMessageDetail;
window.verifyDomain = verifyDomain;
window.removeDomain = removeDomain;
window.removeSuppression = removeSuppression;
window.filterLogs = filterLogs;
window.loadAnalytics = loadAnalytics;
window.previewTemplate = previewTemplate;
window.useTemplateInCampaign = useTemplateInCampaign;
window.loadRecentActivity = loadRecentActivity;

init();
