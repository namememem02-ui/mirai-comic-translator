const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn: nodeSpawn, spawnSync } = require('node:child_process');

function defaultCandidates(projectRoot, homeDir = os.homedir()) {
  const candidates = [
    process.env.MIRAI_PYTHON,
    path.join(projectRoot, '.venv', 'Scripts', 'python.exe'),
    path.join(projectRoot, 'venv', 'Scripts', 'python.exe'),
    path.join(homeDir, 'ct_venv', 'Scripts', 'python.exe'),
    path.join(homeDir, '.venv', 'Scripts', 'python.exe'),
    path.join(homeDir, 'venv', 'Scripts', 'python.exe'),
  ];

  const devRepoRoot = 'C:\\Users\\suppo\\OneDrive\\Desktop\\Mirai HUB\\ComicTranslator';
  candidates.push(path.join(devRepoRoot, '.venv', 'Scripts', 'python.exe'));
  candidates.push(path.join(devRepoRoot, 'venv', 'Scripts', 'python.exe'));

  const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
  for (const pyVer of ['Python312', 'Python311', 'Python310', 'Python39', 'Python38']) {
    candidates.push(path.join(localAppData, 'Programs', 'Python', pyVer, 'python.exe'));
    candidates.push(path.join('C:\\', pyVer, 'python.exe'));
  }

  candidates.push('py');
  candidates.push('python');
  return candidates.filter(Boolean);
}

async function defaultProbe() {
  try {
    const response = await fetch('http://127.0.0.1:5000/health', {
      signal: AbortSignal.timeout(1200),
    });
    const body = await response.json();
    const state = body.state === 'ready' ? 'ready' : body.state === 'loading' ? 'starting' : 'unavailable';
    return {
      state,
      backend: body.backend,
      componentVersion: body.componentVersion,
      errorCode: body.errorCode || null,
      message: body.message || '',
      reachable: true,
    };
  } catch {
    return { state: 'unavailable', message: 'ไม่พบเซิร์ฟเวอร์ AI รีทัช' };
  }
}

function defaultProbePython(candidate) {
  if (candidate.includes(path.sep) && !fs.existsSync(candidate)) return false;
  const args = candidate === 'py' ? ['-3', '--version'] : ['--version'];
  return spawnSync(candidate, args, { windowsHide: true, timeout: 3000 }).status === 0;
}

function defaultSpawn(candidate, sidecarPath, opts = {}) {
  const args = candidate === 'py' ? ['-3', sidecarPath] : [sidecarPath];
  const env = { ...process.env, ...opts.env };
  return nodeSpawn(candidate, args, { windowsHide: true, stdio: 'ignore', env });
}

function createInpaintSidecarManager(options = {}) {
  const projectRoot = options.projectRoot || path.join(__dirname, '..');
  const launchDescriptor = options.launchDescriptor || null;
  const candidates = launchDescriptor
    ? [launchDescriptor.pythonPath]
    : options.candidates || defaultCandidates(projectRoot);
  
  let rawSidecarPath = launchDescriptor?.serverPath || options.sidecarPath || path.join(projectRoot, 'sidecar', 'inpaint_server.py');
  if (rawSidecarPath.includes('app.asar') && !rawSidecarPath.includes('app.asar.unpacked')) {
    const unpackedCandidate = rawSidecarPath.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpackedCandidate)) {
      rawSidecarPath = unpackedCandidate;
    } else {
      try {
        const userDataDir = options.userDataDir || path.join(os.homedir(), 'AppData', 'Roaming', 'comic-translator');
        const managedSidecarDir = path.join(userDataDir, 'sidecar');
        if (!fs.existsSync(managedSidecarDir)) {
          fs.mkdirSync(managedSidecarDir, { recursive: true });
        }
        const targetScript = path.join(managedSidecarDir, 'inpaint_server.py');
        fs.copyFileSync(rawSidecarPath, targetScript);
        rawSidecarPath = targetScript;
      } catch {}
    }
  }
  const sidecarPath = rawSidecarPath;
  const probe = options.probe || defaultProbe;
  const probePython = options.probePython || defaultProbePython;
  const spawn = options.spawn || defaultSpawn;
  const wait = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const maxPolls = options.maxPolls || 90;
  const pollInterval = options.pollInterval || 1000;
  const onStatus = options.onStatus || (() => {});
  let status = {
    state: 'unavailable',
    backend: launchDescriptor?.backend || null,
    componentVersion: launchDescriptor?.componentVersion || null,
    errorCode: null,
    message: 'ยังไม่ได้เริ่ม AI รีทัช',
  };
  let startup = null;
  let ownedChild = null;

  function setStatus(next) {
    status = {
      state: next.state,
      backend: next.backend ?? launchDescriptor?.backend ?? status.backend ?? null,
      componentVersion: next.componentVersion ?? launchDescriptor?.componentVersion ?? status.componentVersion ?? null,
      errorCode: next.errorCode ?? null,
      message: next.message || '',
    };
    onStatus(status);
    return status;
  }

  async function start() {
    setStatus({ state: 'starting', message: 'กำลังตรวจสอบ AI รีทัช' });
    const existing = await probe();
    if (existing.state === 'ready') return setStatus(existing);
    if (existing.state === 'starting' && existing.reachable) {
      for (let attempt = 0; attempt < maxPolls; attempt += 1) {
        setStatus(existing);
        await wait(pollInterval);
        const current = await probe();
        if (current.state === 'ready') return setStatus(current);
        if (current.state === 'unavailable' && current.reachable) return setStatus(current);
      }
      return setStatus({ state: 'unavailable', message: 'AI รีทัชที่เปิดอยู่ใช้เวลาโหลดนานเกินกำหนด' });
    }
    if (existing.reachable) return setStatus(existing);

    let python = null;
    for (const candidate of candidates) {
      if (await probePython(candidate)) { python = candidate; break; }
    }
    if (!python) return setStatus({ state: 'unavailable', message: 'ไม่พบ Python ที่ใช้เปิด AI รีทัช' });

    const spawnEnv = {
      LAMA_BACKEND: launchDescriptor?.backend || process.env.LAMA_BACKEND || 'cuda',
      LAMA_MODEL: launchDescriptor?.modelPath || '',
      LAMA_VERSION: launchDescriptor?.componentVersion || '',
    };

    try {
      ownedChild = spawn(python, sidecarPath, { env: spawnEnv });
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
