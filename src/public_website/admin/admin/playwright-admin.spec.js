const path = require('path');
const { test, expect } = require('@playwright/test');

const adminUrl = `file://${path.join(__dirname, 'index.html')}`;
const cfBase = 'https://asia-south1-fir-bestpg.cloudfunctions.net';

const viewports = [
  { name: 'desktop', viewport: { width: 1280, height: 720 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
];

test.describe.configure({ mode: 'serial' });

for (const device of viewports) {
  test.describe(`${device.name} admin`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(device.viewport);

      const mockTenants = [
        {
          mobile: '919999888877',
          nickname: 'Demo Tenant',
          authMode: 'whatsapp',
          manualOtp: '',
          manualOtpCreatedAt: null,
        },
      ];

      await page.route(`${cfBase}/*`, async (route) => {
        const url = route.request().url();
        const method = route.request().method();
        let body = { ok: true };
        if (url.includes('manageWhitelist')) {
          if (method === 'GET') {
            body = { tenants: mockTenants };
          } else if (method === 'POST') {
            const payload = JSON.parse(route.request().postData() || '{}');
            mockTenants.push({
              mobile: payload.mobile,
              nickname: payload.nickname || 'tenant',
              authMode: 'whatsapp',
              manualOtp: '',
              manualOtpCreatedAt: null,
            });
            body = { tenant: mockTenants.at(-1) };
          } else if (method === 'PATCH') {
            const payload = JSON.parse(route.request().postData() || '{}');
            const entry = mockTenants.find((t) => t.mobile === payload.mobile);
            if (entry && payload.authMode) {
              entry.authMode = payload.authMode;
              if (payload.authMode === 'whatsapp') {
                entry.manualOtp = '';
                entry.manualOtpCreatedAt = null;
              }
            }
            body = { tenant: entry || null };
          } else if (method === 'DELETE') {
            const payload = JSON.parse(route.request().postData() || '{}');
            const index = mockTenants.findIndex((t) => t.mobile === payload.mobile);
            if (index >= 0) mockTenants.splice(index, 1);
            body = { removed: payload.mobile };
          }
        } else if (url.includes('storeTenantPassword')) {
          const payload = JSON.parse(route.request().postData() || '{}');
          const entry = mockTenants.find((t) => t.mobile === payload.mobile);
          if (entry) {
            entry.manualOtp = payload.password;
            entry.manualOtpCreatedAt = new Date().toISOString();
            entry.authMode = 'manual';
          }
          body = { status: 'saved' };
        } else if (url.includes('listComplianceReports')) {
          if (method === 'GET') {
            body = {
              reports: [
                {
                  name: 'session_report_20251214.csv',
                  date: '2025-12-14',
                  size: 20480,
                  updated: new Date().toISOString(),
                  downloadUrl: 'https://example.com/report1',
                },
                {
                  name: 'session_report_20251213.csv',
                  date: '2025-12-13',
                  size: 10240,
                  updated: new Date().toISOString(),
                  downloadUrl: 'https://example.com/report2',
                },
              ],
            };
          }
        } else if (url.includes('cctvConfig')) {
          if (method === 'GET') {
            body = { nvrIp: '192.168.1.64' };
          } else if (method === 'POST') {
            const payload = JSON.parse(route.request().postData() || '{}');
            body = { nvrIp: payload.nvrIp };
          }
        } else if (url.includes('saveWhatsappKey')) body = { stored: true };
        else if (url.includes('triggerLogUpload')) body = { status: 'ok' };
        else if (url.includes('logStatus')) body = { status: { lastUpload: new Date().toISOString(), status: 'ok' } };
        else if (url.includes('checkVlanHealth')) body = { note: 'VLAN healthy' };
        else if (url.includes('triggerSessionReport')) body = { file: 'gs://bucket/report.csv' };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      });

      await page.addInitScript(() => {
        window.alert = () => {};
        window.confirm = () => true;
        window.__lastOpenedUrl = null;
        window.open = (url) => {
          window.__lastOpenedUrl = url;
        };
      });
    });

    test('whitelist management and settings', async ({ page }) => {
      await page.goto(adminUrl);

      await expect(page.locator('.tab-button[data-tab="wifi"]')).toHaveClass(/is-active/);
      await expect(page.locator('#tenant-status')).toContainText('1 tenant');
      await expect(page.locator('#tenant-status')).toContainText('tenant');

      // Open WhatsApp settings and save
      await page.click('#whatsapp-settings-btn');
      await page.fill('#whatsapp-auth-key', 'token');
      await page.fill('#whatsapp-phone-id', 'phone123');
      await page.fill('#whatsapp-sender-number', '+911234567890');
      await page.fill('#whatsapp-template-name', 'pg_wifi_otp');
      await page.fill('#whatsapp-template-lang', 'en');
      await page.click('#save-whatsapp-key');

      // Add a tenant via modal
      await page.click('#add-tenant-btn');
      await page.fill('#tenant-mobile', '919111222233');
      await page.fill('#tenant-nickname', 'Room 1');
      await page.click('#tenant-form button[type="submit"]');
      await expect(page.locator('#tenant-status')).toContainText('2 tenant');

      // Change mode to manual and generate OTP
      const modeSelect = page.locator('.mode-select').first();
      await modeSelect.selectOption('manual');
      const generateBtn = page.locator('button[data-action="generate"]').first();
      await generateBtn.click();
      await page.click('#otp-modal-generate');
      await expect(page.locator('#otp-modal-result')).not.toHaveText('Failed');
      await page.locator('#otp-modal .modal-close').click();

      // Remove tenant
      await page.click('button[data-action="remove"]');
      await expect(page.locator('#tenant-status')).toContainText('1 tenant');

      // Compliance panel interactions (switch sub-tab)
      await page.click('.sub-tab[data-subtab="compliance"]');
      await expect(page.locator('#report-status')).toContainText('report');
      await page.fill('#report-start', '2025-12-01');
      await page.click('#refresh-reports');
      await expect(page.locator('#report-table-body tr')).toHaveCount(2);
      await page.click('#report-select-all');
      await page.click('#download-selected');
      await page.click('.sub-tab[data-subtab="tenants"]');

      // CCTV tab
      await page.click('.tab-button[data-tab="cctv"]');
      await expect(page.locator('#open-cctv')).toBeVisible();
      await page.fill('#cctv-ip', '10.0.0.10');
      await page.click('#save-cctv-ip');
      await page.click('#open-cctv');
      await page.click('#check-vlan');

      // Back to Wi-Fi tab
      await page.click('.tab-button[data-tab="wifi"]');
      await expect(page.locator('#tenant-status')).toContainText('tenant');

      const openedUrl = await page.evaluate(() => window.__lastOpenedUrl);
      expect(openedUrl).toBe('http://10.0.0.10');
    });
  });
}
