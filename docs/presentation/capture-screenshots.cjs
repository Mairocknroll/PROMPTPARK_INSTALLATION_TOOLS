const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(__dirname, 'images');
const BASE_URL = process.env.CAPTURE_URL || 'http://127.0.0.1:5173';
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sampleSite = {
  id: 'demo-site',
  name: 'SIXT Rama 9',
  system: {
    SERVER_URL: 'https://api-pms.jparkdev.co',
    PARKING_CODE: 'la26010038',
    ADDR: '0.0.0.0:8000',
    CAMERA_USER: 'admin',
    CAMERA_PASS: '',
    MODBUS_PORT: '504',
    MODBUS_TIMEOUT_MS: '2000',
    MODBUS_PULSE_MS: '500',
    MODBUS_SLAVE_ID: '1'
  },
  lanes: [
    { id: 'ent-01', type: 'ENT', number: '01', gateIp: '172.20.9.11', lprIp: '172.20.9.31', licIp: '172.20.9.41', driIp: '172.20.9.51', hasLed: true, ledIp: '172.20.9.61' },
    { id: 'ext-02', type: 'EXT', number: '02', gateIp: '172.20.9.12', lprIp: '172.20.9.32', licIp: '172.20.9.42', driIp: '172.20.9.52', hasLed: false, ledIp: '' }
  ],
  serverConfig: {
    ip: '172.20.9.3',
    username: 'jpark',
    password: '',
    targetPath: '/home/jpark/go_local_proxy_api'
  },
  status: {
    lastDeployAt: '2026-04-28 21:30',
    lastDeployStatus: 'success',
    lastHealthcheckAt: '2026-04-28 21:35',
    lastHealthcheckStatus: 'ok'
  }
};

const remoteEnv = `SERVER_URL=https://api-pms.jparkdev.co
PARKING_CODE=la26010038
ADDR=0.0.0.0:8000

CAMERA_USER=admin
CAMERA_PASS=
MODBUS_PORT=504
MODBUS_TIMEOUT_MS=2000
MODBUS_PULSE_MS=500
MODBUS_SLAVE_ID=1

# --- ENT-01 ---
ENT_GATE_01=172.20.9.11
LPR_IN_01=172.20.9.31
LIC_IN_01=172.20.9.41
DRI_IN_01=172.20.9.51
HIK_LED_MAIN_ENT_01=172.20.9.61
# --- ENT-01 ---

# --- EXT-02 ---
EXT_GATE_02=172.20.9.12
LPR_OUT_02=172.20.9.32
LIC_OUT_02=172.20.9.42
DRI_OUT_02=172.20.9.52
# --- EXT-02 ---`;

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  await page.addInitScript(({ site, env }) => {
    const listeners = {};
    const emit = (name, payload) => (listeners[name] || []).forEach((cb) => cb(payload));
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = (message, fallback = '') => {
      if (String(message).includes('Username')) return 'jpark';
      if (String(message).includes('Password')) return 'demo-password';
      return fallback || 'demo';
    };
    window.runtime = {
      EventsOnMultiple: (name, cb) => {
        listeners[name] = listeners[name] || [];
        listeners[name].push(cb);
        return () => {};
      },
      EventsOff: (name) => { listeners[name] = []; },
      EventsEmit: emit,
      LogPrint: () => {},
      LogTrace: () => {},
      LogDebug: () => {},
      LogInfo: () => {},
      LogWarning: () => {},
      LogError: () => {},
      LogFatal: () => {}
    };

    const okReport = { ok: true, issues: [], warnings: [] };
    const entranceConfig = {
      deviceNameConfig: 'entrance-kiosk-in-01',
      gateConfig: '1',
      plcIpConfig: '172.20.9.21',
      parkingCodeConfig: 'la26010038',
      paymentTicket: 'https://payment.jparkdev.co',
      serverConfig: 'https://api-pms.jparkdev.co',
      localServerConfig: 'http://172.20.9.3:8000',
      vehicleMode: 'Car',
      isSpecialEntrance: 'false',
      paymentApiVersionConfig: 'API Promptpark',
      apiMode: 'V2',
      setTime: '10000',
      zoningMode: 'NORMAL',
      zoningCode: '',
      zoningGateNo: '1'
    };
    const exitConfig = {
      ...entranceConfig,
      deviceNameConfig: 'exit-kiosk-out-01',
      plcIpConfig: '172.20.9.22',
      projectCodeConfig: 'PMPARK',
      nextZoningCode: '',
      nextZoningGateNo: '',
      isCash: 'true',
      isQR: 'true',
      ticketMode: 'NORMAL'
    };

    window.go = {
      main: {
        App: {
          BrowseAPKFile: async () => 'C:\\\\PROMPTPARK\\\\apk\\\\promptpark-kiosk.apk',
          CheckADBAvailability: async () => 'ADB available: Android Debug Bridge version 1.0.41',
          CheckPortInUse: async () => false,
          CheckSSHConnection: async () => 'Success',
          ConfigureHikvisionISAPI: async () => {
            emit('hik-progress', { progress: 35, message: 'Connecting to 172.20.9.31...' });
            emit('hik-progress', { progress: 100, message: 'Camera event target configured successfully.' });
            return 'Configured';
          },
          DeleteInstallationProfile: async () => 'Deleted',
          DeployExitKioskAPK: async () => {
            emit('exit-kiosk-progress', { progress: 100, message: 'Exit kiosk config pushed successfully.' });
            return 'OK';
          },
          DeployKioskAPK: async () => {
            emit('kiosk-progress', { progress: 100, message: 'Entrance kiosk config pushed successfully.' });
            return 'OK';
          },
          DeployToServer: async () => 'Deployed successfully: docker compose is running and /healthz returned OK.',
          DiagnoseADBDevice: async (ip) => [
            { ok: true, name: `ADB ${ip}`, message: 'device connected', detail: 'tcp:5555' },
            { ok: true, name: 'Package', message: 'application found', detail: '' }
          ],
          ListDeploymentHistory: async () => [
            { timestamp: '2026-04-28 21:30', server: '172.20.9.3', targetPath: '/home/jpark/go_local_proxy_api', status: 'success', message: 'Deploy completed' }
          ],
          ListInstallationProfiles: async () => [{ name: site.name, data: site }],
          ReadEntranceKioskConfig: async () => entranceConfig,
          ReadExitKioskConfig: async () => exitConfig,
          ReadRemoteEnv: async () => env,
          RedeployProxy: async () => 'Redeploy completed',
          RestoreLatestProxyEnvBackup: async () => 'Rollback completed',
          RunProxyHealthCheck: async () => ({ ok: true, issues: [] }),
          RunServerPreflight: async () => [
            { ok: true, name: 'SSH', message: 'Connected as jpark', detail: '' },
            { ok: true, name: 'Docker', message: 'Docker and compose plugin available', detail: 'v2' },
            { ok: true, name: 'Project Path', message: 'Target path is writable', detail: '/home/jpark/go_local_proxy_api' },
            { ok: true, name: 'Port 8000', message: 'Ready for local proxy', detail: '' }
          ],
          SaveEnvConfig: async () => 'Saved local .env',
          SaveInstallationProfile: async () => 'Saved',
          SaveRemoteEnv: async () => 'Saved remote .env',
          SendMockCameraEvent: async () => '{\\n  "status": "ok",\\n  "message": "mock LPR event accepted",\\n  "gate_no": "1"\\n}',
          StartProxyLogs: async () => {
            emit('proxy-log-line', { message: 'local-proxy-api  | server started on :8000' });
            emit('proxy-log-line', { message: 'local-proxy-api  | POST /api/v2-202402/order/verify-member 200' });
            return 'started';
          },
          StopProxyLogs: async () => 'stopped',
          UpdateEntranceKioskConfig: async () => 'Saved',
          UpdateExitKioskConfig: async () => 'Saved',
          ValidateEntranceKioskConfig: async () => okReport,
          ValidateExitKioskConfig: async () => okReport,
          ValidateHikvisionConfig: async () => okReport,
          ValidateProxyEnv: async () => okReport
        }
      }
    };
  }, { site: sampleSite, env: remoteEnv });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Local Proxy Sites');

  const shot = async (name) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
    console.log(`captured ${name}`);
  };
  const clickText = async (text) => page.getByText(text, { exact: true }).click();
  const clickMenu = async (text) => page.locator('button').filter({ hasText: text }).click();
  const fillLabel = async (label, value) => {
    await page.locator('label').filter({ hasText: label }).locator('input').fill(value);
  };
  const fillPlaceholder = async (placeholder, value) => {
    await page.locator(`input[placeholder="${placeholder}"]`).fill(value);
  };
  const fillFirstInputAfterText = async (label, value) => {
    await page.evaluate(({ label, value }) => {
      const labels = [...document.querySelectorAll('label')];
      const node = labels.find((item) => item.textContent.includes(label));
      const input = node?.parentElement?.querySelector('input');
      if (!input) throw new Error(`Cannot find input for ${label}`);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { label, value });
  };

  await shot('01-sidebar-overview.png');
  await shot('02-proxy-site-list.png');

  await page.locator('button[title="New install"]').click();
  await fillLabel('Site Nickname', 'SIXT Rama 9');
  await fillLabel('Parking Code', 'la26010038');
  await fillLabel('Camera Password', 'demo-password');
  await shot('03-proxy-step-site-data.png');

  await clickText('Lanes');
  await fillPlaceholder('Gate IP', '172.20.9.11');
  await page.locator('label').filter({ hasText: 'LED' }).locator('input').check();
  await fillPlaceholder('LED IP', '172.20.9.61');
  await page.getByRole('button', { name: 'Add Lane' }).click();
  await page.locator('select').first().selectOption('EXT');
  await fillPlaceholder('01', '02');
  await fillPlaceholder('Gate IP', '172.20.9.12');
  await page.getByRole('button', { name: 'Add Lane' }).click();
  await shot('04-proxy-step-lanes.png');

  await clickText('Server Check');
  await fillLabel('Server IP', '172.20.9.3');
  await fillLabel('SSH Username', 'jpark');
  await fillLabel('SSH Password', 'demo-password');
  await clickText('Run Preflight');
  await page.waitForSelector('text=Project Path');
  await shot('05-proxy-step-server-check.png');

  await clickText('Deploy');
  await page.getByRole('button', { name: 'Deploy', exact: true }).click();
  await page.waitForSelector('text=Deployed successfully');
  await shot('06-proxy-deploy.png');

  await clickText('Logs');
  await clickText('Start Logs');
  await page.waitForSelector('text=server started');
  await shot('07-proxy-logs.png');

  await clickMenu('HIK LPR Config');
  await fillPlaceholder('10.10.11.5', '172.20.9.3');
  await shot('08-hik-main.png');
  await clickText('+ Add Camera');
  await fillPlaceholder('10.10.11.30', '172.20.9.31');
  await shot('09-hik-add-camera.png');
  await page.locator('.fixed').getByRole('button', { name: 'Add Camera' }).click();
  await clickText('Apply to All Cameras');
  await page.waitForSelector('text=Camera event target configured successfully');
  await shot('10-hik-apply.png');

  await clickMenu('Entrance Kiosk Installation');
  await fillFirstInputAfterText('Local Server URL', 'http://172.20.9.3:8000');
  await shot('11-entrance-install.png');
  await clickText('+ Add Device');
  await fillPlaceholder('192.168.1.100', '172.20.9.101');
  await fillPlaceholder('asus-kiosk-sixx-in-01', 'entrance-kiosk-in-01');
  await fillFirstInputAfterText('PLC/Modbus IP', '172.20.9.21');
  await shot('12-entrance-add-device.png');
  await page.locator('.fixed').getByRole('button', { name: 'Add Device' }).click();
  await clickText('ADB Check');
  await page.waitForSelector('text=device connected');
  await shot('13-entrance-deploy.png');
  await clickText('Read & Edit Config');
  await fillPlaceholder('Device IP (e.g. 192.168.1.100)', '172.20.9.101');
  await page.locator('button').filter({ hasText: '+ Add' }).click();
  await clickText('Read Configs');
  await page.waitForSelector('text=entrance-kiosk-in-01');
  await shot('14-entrance-read-edit.png');

  await clickMenu('Exit Kiosk Installation');
  await fillFirstInputAfterText('Local Server URL', 'http://172.20.9.3:8000');
  await shot('15-exit-install.png');
  await clickText('+ Add Device');
  await fillPlaceholder('192.168.1.100', '172.20.9.102');
  await fillPlaceholder('asus-kiosk-sixx-out-01', 'exit-kiosk-out-01');
  await fillFirstInputAfterText('PLC/Modbus IP', '172.20.9.22');
  await shot('16-exit-add-device.png');
  await page.locator('.fixed').getByRole('button', { name: 'Add Device' }).click();
  await clickText('ADB Check');
  await page.waitForSelector('text=device connected');
  await shot('17-exit-deploy.png');
  await clickText('Read & Edit Config');
  await fillPlaceholder('Device IP (e.g. 192.168.1.100)', '172.20.9.102');
  await page.locator('button').filter({ hasText: '+ Add' }).click();
  await clickText('Read Configs');
  await page.waitForSelector('text=exit-kiosk-out-01');
  await shot('18-exit-read-edit.png');

  await clickMenu('Integration Tools');
  await page.locator('button').filter({ hasText: 'Send Mock Event' }).click();
  await page.waitForSelector('text=mock LPR event accepted');
  await shot('19-integration-tools.png');

  await browser.close();
  console.log(`done: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
