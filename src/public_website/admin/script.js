const WHATSAPP_KEY_URL = 'https://asia-south1-fir-bestpg.cloudfunctions.net/saveWhatsappKey';
const STORE_PASSWORD_URL = 'https://asia-south1-fir-bestpg.cloudfunctions.net/storeTenantPassword';
const WHITELIST_URL = 'https://asia-south1-fir-bestpg.cloudfunctions.net/manageWhitelist';
const LIST_REPORTS_URL = 'https://asia-south1-fir-bestpg.cloudfunctions.net/listComplianceReports';
const CHECK_VLAN_URL = 'https://asia-south1-fir-bestpg.cloudfunctions.net/checkVlanHealth';
const CCTV_CONFIG_URL = 'https://asia-south1-fir-bestpg.cloudfunctions.net/cctvConfig';

// WhatsApp settings modal
const whatsappKeyInput = document.getElementById('whatsapp-auth-key');
const whatsappPhoneIdInput = document.getElementById('whatsapp-phone-id');
const whatsappSenderInput = document.getElementById('whatsapp-sender-number');
const whatsappTemplateInput = document.getElementById('whatsapp-template-name');
const whatsappLangInput = document.getElementById('whatsapp-template-lang');
const saveWhatsappKey = document.getElementById('save-whatsapp-key');
const whatsappSettingsBtn = document.getElementById('whatsapp-settings-btn');
const whatsappModal = document.getElementById('whatsapp-modal');
const whatsappStatusEl = document.getElementById('whatsapp-status');

// Tenant controls
const tenantStatus = document.getElementById('tenant-status');
const tenantTableBody = document.getElementById('tenant-table-body');
const addTenantBtn = document.getElementById('add-tenant-btn');
const tenantModal = document.getElementById('tenant-modal');
const tenantForm = document.getElementById('tenant-form');
const tenantMobileInput = document.getElementById('tenant-mobile');
const tenantNicknameInput = document.getElementById('tenant-nickname');
const otpModal = document.getElementById('otp-modal');
const otpModalDetails = document.getElementById('otp-modal-details');
const otpModalResult = document.getElementById('otp-modal-result');
const otpModalGenerate = document.getElementById('otp-modal-generate');

// Compliance controls
const reportStatus = document.getElementById('report-status');
const reportTableBody = document.getElementById('report-table-body');
const reportSelectAll = document.getElementById('report-select-all');
const downloadSelectedBtn = document.getElementById('download-selected');
const refreshReportsBtn = document.getElementById('refresh-reports');
const reportStartInput = document.getElementById('report-start');
const reportEndInput = document.getElementById('report-end');
const reportTimestamp = document.getElementById('report-timestamp');
const cctvIpInput = document.getElementById('cctv-ip');
const saveCctvIpBtn = document.getElementById('save-cctv-ip');
const cctvStatus = document.getElementById('cctv-status');
const subTabButtons = document.querySelectorAll('.sub-tab');
const subTabPanels = document.querySelectorAll('.sub-panel');
const logoutButton = document.getElementById('logout-btn');

let tenants = [];
let otpTarget = null;
let reports = [];
const selectedReports = new Set();
let currentCctvIp = '';
let initialized = false;
let authReady = false;

function setLogoutVisible(visible) {
  if (!logoutButton) return;
  logoutButton.classList.toggle('is-visible', Boolean(visible));
}

setLogoutVisible(false);

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hours}:${minutes} IST`;
}

function init() {
  if (initialized) return;
  initialized = true;
  setDefaultReportRange();
  updateReportTimestamp();
  bindModalClose();
  bindEvents();
  loadTenants();
  loadReports();
  loadCctvConfig();
  loadWhatsappSettings();
}

const onAuthReady = () => {
  authReady = true;
  setLogoutVisible(true);
  init();
};

if (window.pgAdminAuth?.onReady) {
  window.pgAdminAuth.onReady(onAuthReady);
} else {
  init();
}

async function loadWhatsappSettings() {
  if (!whatsappStatusEl) return;
  whatsappStatusEl.textContent = 'Loading WhatsApp settings…';
  try {
    const response = await requestJson(WHATSAPP_KEY_URL, { method: 'GET' });
    const config = response?.config || {};
    if (whatsappPhoneIdInput) whatsappPhoneIdInput.value = config.phoneId || '';
    if (whatsappSenderInput) whatsappSenderInput.value = config.sender || whatsappSenderInput.value || '';
    if (whatsappTemplateInput) whatsappTemplateInput.value = config.template || whatsappTemplateInput.value || '';
    if (whatsappLangInput) whatsappLangInput.value = config.language || whatsappLangInput.value || 'en';
    if (config.hasCredentials) {
      whatsappStatusEl.textContent = config.updatedAt
        ? `Key stored on ${formatDateTime(config.updatedAt)}`
        : 'WhatsApp key stored securely.';
      if (whatsappKeyInput) whatsappKeyInput.value = '';
    } else {
      whatsappStatusEl.textContent = 'WhatsApp credentials not saved yet.';
    }
  } catch (err) {
    console.error(err);
    whatsappStatusEl.textContent = 'Unable to load WhatsApp settings.';
  }
}

function setDefaultReportRange() {
  if (!reportStartInput || !reportEndInput) return;
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  reportEndInput.value = end;
  reportStartInput.value = start;
}

function bindModalClose() {
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal);
    });
  });
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal')));
  });
}

function bindEvents() {
  subTabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.subtab;
      subTabButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
      subTabPanels.forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.subtabPanel === target);
      });
    });
  });

  addTenantBtn?.addEventListener('click', () => {
    tenantForm?.reset();
    openModal(tenantModal);
  });

  tenantForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const mobile = tenantMobileInput?.value.trim();
    const nickname = tenantNicknameInput?.value.trim() || 'tenant';
    if (!mobile) return;
    tenantStatus.textContent = 'Adding tenant…';
    try {
      await requestJson(WHITELIST_URL, {
        method: 'POST',
        body: JSON.stringify({ mobile, nickname }),
      });
      closeModal(tenantModal);
      await loadTenants();
    } catch (err) {
      console.error(err);
      alert('Failed to add tenant');
      tenantStatus.textContent = 'Failed to add tenant.';
    }
  });

  whatsappSettingsBtn?.addEventListener('click', () => openModal(whatsappModal));

  saveWhatsappKey?.addEventListener('click', async () => {
    const original = saveWhatsappKey.textContent;
    saveWhatsappKey.textContent = 'Saving…';
    try {
      await requestJson(WHATSAPP_KEY_URL, {
        method: 'POST',
        body: JSON.stringify({
          accessToken: whatsappKeyInput?.value || '',
          phoneId: whatsappPhoneIdInput?.value || '',
          sender: whatsappSenderInput?.value || '',
          template: whatsappTemplateInput?.value || '',
          language: whatsappLangInput?.value || '',
        }),
      });
      await loadWhatsappSettings();
      alert('WhatsApp settings saved.');
      closeModal(whatsappModal);
    } catch (err) {
      console.error(err);
      alert('Failed to save WhatsApp settings');
    } finally {
      saveWhatsappKey.textContent = original;
    }
  });

  tenantTableBody?.addEventListener('change', async (event) => {
    const select = event.target.closest('.mode-select');
    if (!select) return;
    const mobile = select.dataset.mobile;
    const newMode = select.value;
    const previous = select.dataset.previous || select.value;
    select.dataset.previous = newMode;
    try {
      await requestJson(WHITELIST_URL, {
        method: 'PATCH',
        body: JSON.stringify({ mobile, authMode: newMode }),
      });
      await loadTenants();
    } catch (err) {
      console.error(err);
      alert('Failed to update mode');
      select.value = previous;
    }
  });

  tenantTableBody?.addEventListener('click', async (event) => {
    const action = event.target.dataset.action;
    if (!action) return;
    const mobile = event.target.dataset.mobile;
    if (!mobile) return;
    if (action === 'remove') {
      if (!window.confirm(`Remove ${mobile} from whitelist?`)) return;
      try {
        await requestJson(WHITELIST_URL, {
          method: 'DELETE',
          body: JSON.stringify({ mobile }),
        });
        await loadTenants();
      } catch (err) {
        console.error(err);
        alert('Failed to remove tenant');
      }
      return;
    }
    if (action === 'generate') {
      const tenant = tenants.find((t) => t.mobile === mobile);
      if (!tenant) return;
      otpTarget = tenant;
      otpModalDetails.textContent = `${tenant.nickname || 'Tenant'} · ${tenant.mobile}`;
      otpModalResult.textContent = tenant.manualOtp || 'No OTP generated yet.';
      openModal(otpModal);
    }
  });

  otpModalGenerate?.addEventListener('click', async () => {
    if (!otpTarget) return;
    const password = randomOtp(6);
    otpModalResult.textContent = 'Saving…';
    try {
      await requestJson(STORE_PASSWORD_URL, {
        method: 'POST',
        body: JSON.stringify({
          mobile: otpTarget.mobile,
          nickname: otpTarget.nickname || 'tenant',
          password,
        }),
      });
      otpModalResult.textContent = password;
      await loadTenants();
    } catch (err) {
      console.error(err);
      otpModalResult.textContent = 'Failed to save OTP.';
    }
  });

  document.getElementById('check-vlan')?.addEventListener('click', async () => {
    try {
      const result = await requestJson(CHECK_VLAN_URL, { method: 'POST' });
      alert(result.note || 'VLAN 50 healthy');
      if (result.nvrIp) {
        cctvStatus.textContent = `NVR IP ${result.nvrIp} reachable from admin network.`;
      }
    } catch (err) {
      console.error(err);
      alert('Failed to check VLAN');
    }
  });

  document.getElementById('open-cctv')?.addEventListener('click', () => {
    if (!currentCctvIp) {
      alert('Set the NVR IP address first.');
      return;
    }
    window.open(`http://${currentCctvIp}`, '_blank');
  });

  refreshReportsBtn?.addEventListener('click', () => loadReports());

  reportSelectAll?.addEventListener('change', (event) => {
    if (!reports.length) return;
    if (event.target.checked) reports.forEach((report) => selectedReports.add(report.name));
    else selectedReports.clear();
    renderReports();
  });

  downloadSelectedBtn?.addEventListener('click', () => {
    if (!selectedReports.size) return;
    reports
      .filter((report) => selectedReports.has(report.name))
      .forEach((report, index) => {
        setTimeout(() => window.open(report.downloadUrl, '_blank'), index * 150);
      });
  });

  reportTableBody?.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.report-select');
    if (!checkbox) return;
    const name = checkbox.dataset.name;
    if (!name) return;
    if (checkbox.checked) selectedReports.add(name);
    else selectedReports.delete(name);
    renderReports();
  });

  reportTableBody?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action="download-report"]');
    if (!btn) return;
    const report = reports.find((r) => r.name === btn.dataset.name);
    if (report?.downloadUrl) window.open(report.downloadUrl, '_blank');
  });

  saveCctvIpBtn?.addEventListener('click', async () => {
    if (!cctvIpInput?.value) {
      alert('Enter a valid NVR IP address.');
      return;
    }
    cctvStatus.textContent = 'Saving NVR IP…';
    try {
      const result = await requestJson(CCTV_CONFIG_URL, {
        method: 'POST',
        body: JSON.stringify({ nvrIp: cctvIpInput.value.trim() }),
      });
      currentCctvIp = result.nvrIp;
      cctvStatus.textContent = `NVR IP saved: ${currentCctvIp}`;
    } catch (err) {
      console.error(err);
      cctvStatus.textContent = 'Failed to save NVR IP.';
      alert('Invalid IP address. Use IPv4 format like 192.168.1.64.');
    }
  });

  document.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.toggle('is-active', btn === button));
      document
        .querySelectorAll('.tab-panel')
        .forEach((panel) => panel.classList.toggle('is-active', panel.dataset.tab === target));
    });
  });

  logoutButton?.addEventListener('click', async () => {
    if (!authReady) return;
    logoutButton.disabled = true;
    setLogoutVisible(false);
    try {
      await window.pgAdminAuth?.signOut?.();
    } finally {
      logoutButton.disabled = false;
    }
  });
}

async function loadTenants() {
  tenantStatus.textContent = 'Loading whitelist…';
  try {
    const response = await requestJson(WHITELIST_URL, { method: 'GET' });
    tenants = (response.tenants || []).sort((a, b) => a.nickname.localeCompare(b.nickname));
    renderTenants();
  } catch (err) {
    console.error(err);
    tenantStatus.textContent = 'Failed to load tenants.';
    tenantTableBody.innerHTML = '<tr><td colspan="5">Could not load tenants.</td></tr>';
  }
}

function renderTenants() {
  if (!tenants.length) {
    tenantStatus.textContent = 'No tenants approved yet.';
    tenantTableBody.innerHTML = '<tr><td colspan="5">No tenants whitelisted yet.</td></tr>';
    return;
  }
  tenantStatus.textContent = `${tenants.length} tenant(s) approved.`;
  tenantTableBody.innerHTML = tenants
    .map((tenant) => {
      const modeSelect = `<select class="mode-select" data-mobile="${tenant.mobile}" data-action="mode" data-previous="${tenant.authMode}">
        <option value="whatsapp" ${tenant.authMode === 'whatsapp' ? 'selected' : ''}>WhatsApp OTP</option>
        <option value="manual" ${tenant.authMode === 'manual' ? 'selected' : ''}>Manual mode</option>
      </select>`;
      const manualInfo =
        tenant.authMode === 'manual'
          ? `<div class="otp-chip">${tenant.manualOtp || 'No manual OTP yet'}${
              tenant.manualOtpCreatedAt ? `<span class="otp-muted"> · ${formatDateTime(tenant.manualOtpCreatedAt)}</span>` : ''
            }</div>`
          : '<span class="otp-muted">WhatsApp</span>';
      return `<tr>
        <td>${tenant.mobile}</td>
        <td>${tenant.nickname || 'tenant'}</td>
        <td>${modeSelect}</td>
        <td>${manualInfo}</td>
        <td class="actions">
          <button type="button" class="btn btn-small btn-ghost" data-action="generate" data-mobile="${tenant.mobile}" ${
            tenant.authMode === 'manual' ? '' : 'disabled'
          }>Manual mode</button>
          <button type="button" class="btn btn-small btn-link" data-action="remove" data-mobile="${tenant.mobile}">Remove</button>
        </td>
      </tr>`;
    })
    .join('');
}

async function loadReports() {
  reportStatus.textContent = 'Loading reports…';
  selectedReports.clear();
  downloadSelectedBtn?.setAttribute('disabled', 'disabled');
  try {
    const params = new URLSearchParams();
    if (reportStartInput?.value) params.set('start', reportStartInput.value);
    if (reportEndInput?.value) params.set('end', reportEndInput.value);
    const url = `${LIST_REPORTS_URL}${params.toString() ? `?${params}` : ''}`;
    const response = await requestJson(url, { method: 'GET' });
    reports = response.reports || [];
    renderReports();
    updateReportTimestamp();
  } catch (err) {
    console.error(err);
    reports = [];
    reportStatus.textContent = 'Failed to load reports.';
    reportTableBody.innerHTML = '<tr><td colspan="6">Could not load reports.</td></tr>';
    updateReportTimestamp();
  }
}

async function loadCctvConfig() {
  if (!cctvStatus) return;
  cctvStatus.textContent = 'Loading CCTV config…';
  try {
    const result = await requestJson(CCTV_CONFIG_URL, { method: 'GET' });
    currentCctvIp = result.nvrIp || '';
    if (cctvIpInput) cctvIpInput.value = currentCctvIp;
    cctvStatus.textContent = currentCctvIp ? `Current NVR IP: ${currentCctvIp}` : 'No NVR IP saved yet.';
  } catch (err) {
    console.error(err);
    cctvStatus.textContent = 'Unable to load the NVR IP. Save it again to refresh.';
  }
}

function renderReports() {
  if (!reports.length) {
    reportStatus.textContent = 'No reports found.';
    reportTableBody.innerHTML = '<tr><td colspan="6">No reports found for the selected dates.</td></tr>';
    downloadSelectedBtn?.setAttribute('disabled', 'disabled');
    if (reportSelectAll) reportSelectAll.checked = false;
    return;
  }
  reportStatus.textContent = `${reports.length} report(s) available.`;
  reportTableBody.innerHTML = reports
    .map((report) => {
      const sizeLabel = report.size ? `${(report.size / 1024).toFixed(1)} KB` : '—';
      const checked = selectedReports.has(report.name) ? 'checked' : '';
      return `<tr>
        <td><input type="checkbox" class="report-select" data-name="${report.name}" ${checked} /></td>
        <td>${report.date ? formatDate(report.date) : '—'}</td>
        <td>${report.name}</td>
        <td>${sizeLabel}</td>
        <td>${report.updated ? formatDateTime(report.updated) : '—'}</td>
        <td><button type="button" class="btn btn-small" data-action="download-report" data-name="${report.name}">Download</button></td>
      </tr>`;
    })
    .join('');
  const selectedCount = selectedReports.size;
  if (selectedCount) downloadSelectedBtn?.removeAttribute('disabled');
  else downloadSelectedBtn?.setAttribute('disabled', 'disabled');
  if (reportSelectAll) {
    reportSelectAll.checked = Boolean(selectedCount) && selectedCount === reports.length;
  }
}

function updateReportTimestamp() {
  if (!reportTimestamp) return;
  const now = new Date();
  reportTimestamp.textContent = formatDateTime(now);
}

function openModal(modal) {
  modal?.classList.add('is-open');
}

function closeModal(modal) {
  modal?.classList.remove('is-open');
}

function randomOtp(length = 6) {
  const digits = '0123456789';
  return Array.from({ length }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
}

async function requestJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (window.pgAdminAuth?.getIdToken) {
    try {
      const token = await window.pgAdminAuth.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      console.warn('Auth token fetch failed', err);
    }
  }
  const opts = { ...options, headers };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
  }
  const response = await fetch(url, opts);
  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    // ignore JSON parse errors for non-JSON responses
  }
  if (!response.ok) {
    const errorMessage = payload?.error || `${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }
  return payload || {};
}
