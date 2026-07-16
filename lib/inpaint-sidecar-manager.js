const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn: nodeSpawn, spawnSync } = require('node:child_process');

function defaultCandidates(projectRoot, homeDir = os.homedir()) {
  return [
    process.env.MIRAI_PYTHON,
    path.join(projectRoot, '.venv', 'Scripts', 'python.exe'),
    path.join(homeDir, 'ct_venv', 'Scripts', 'python.exe'),
    path.join(projectRoot, 'venv', 'Scripts', 'python.exe'),
    'py',
    'python',
  ].filter(Boolean);
}

async function defaultProbe() {
  try {
    const response = await fetch('http://127.0.0.1:5000/health', {
      signal: AbortSignal.timeout(1200),
    });
    const body = await response.json();
    return { state: body.state === 'ready' ? 'ready' : 'starting', message: body.message || '' };
  } catch {
    return { state: 'unavailable', message: 'ไม่พบเซิร์ฟเวอร์ AI รีทัช' };
  }
}

function defaultProbePython(candidate) {
  if (candidate.includes(path.sep) && !fs.existsSync(candidate)) return false;
  const args = candidate === 'py' ? ['-3', '--version'] : ['--version'];
  return spawnSync(candidate, args, { windowsHide: true, timeout: 3000 }).status === 0;
}

function defaultSpawn(candidate, sidecarPath) {
  const args = candidate === 'py' ? ['-3', sidecarPath] : [sidecarPath];
  return nodeSpawn(candidate, args, { windowsHide: true, stdio: 'ignore' });
}

function createInpaintSidecarManager(options = {}) {
  const projectRoot = options.projectRoot || path.join(__dirname, '..');
  const candidates = options.candidates || defaultCandidates(projectRoot);
  const sidecarPath = options.sidecarPath || path.join(projectRoot, 'sidecar', 'inpaint_server.py');
  const probe = options.probe || defaultProbe;
  const probePython = options.probePython || defaultProbePython;
  const spawn = options.spawn || defaultSpawn;
  const wait = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const maxPolls = options.maxPolls || 90;
  const pollInterval = options.pollInterval || 1000;
  const onStatus = options.onStatus || (() => {});
  let status = { state: 'unavailable', message: 'ยังไม่ได้เริ่ม AI รีทัช' };
  let startup = null;
  let ownedChild = null;

  function setStatus(next) {
    status = { state: next.state, message: next.message || '' };
    onStatus(status);
    return status;
  }

  async function start() {
    setStatus({ state: 'starting', message: 'กำลังตรวจสอบ AI รีทัช' });
    const existing = await probe();
    if (existing.state === 'ready') return setStatus(existing);

    let python = null;
    for (const candidate of candidates) {
      if (await probePython(candidate)) { python = candidate; break; }
    }
    if (!python) return setStatus({ state: 'unavailable', message: 'ไม่พบ Python ที่ใช้เปิด AI รีทัช' });

    try {
      ownedChild = spawn(python, sidecarPath);
      ownedChild?.once?.('error', error => setStatus({ state: 'unavailable', message: error.message }));
    } catch (error) {
      ownedChild = null;
      return setStatus({ state: 'unavailable', message: error.message });
    }
    for (let attempt = 0; attempt < maxPolls; attempt += 1) {
      await wait(pollInterval);
      const current = await probe();
      if (current.state === 'ready') return setStatus(current);
      if (current.state === 'starting') setStatus(current);
    }
    return setStatus({ state: 'unavailable', message: 'AI รีทัชใช้เวลาเปิดนานเกินกำหนด' });
  }

  function ensureStarted() {
    if (startup) return startup;
    startup = start().finally(() => { startup = null; });
    return startup;
  }

  function shutdown() {
    if (ownedChild) ownedChild.kill();
    ownedChild = null;
  }

  return { ensureStarted, getStatus: () => ({ ...status }), shutdown };
}

module.exports = { createInpaintSidecarManager, defaultCandidates, defaultProbePython };
