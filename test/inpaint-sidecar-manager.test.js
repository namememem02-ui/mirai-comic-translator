const test = require('node:test');
const assert = require('node:assert/strict');
const { createInpaintSidecarManager, defaultCandidates } = require('../lib/inpaint-sidecar-manager');

test('discovers the existing user-level ct_venv before PATH launchers', () => {
  const candidates = defaultCandidates('C:\\project', 'C:\\Users\\reader');
  const managed = 'C:\\Users\\reader\\ct_venv\\Scripts\\python.exe';
  assert.ok(candidates.includes(managed));
  assert.ok(candidates.indexOf(managed) < candidates.indexOf('py'));
});

test('reuses an existing healthy server without spawning', async () => {
  let spawned = 0;
  const manager = createInpaintSidecarManager({
    probe: async () => ({ state: 'ready' }),
    spawn: () => { spawned += 1; },
  });
  assert.equal((await manager.ensureStarted()).state, 'ready');
  assert.equal(spawned, 0);
});

test('waits for an existing loading server instead of spawning a duplicate', async () => {
  let probes = 0;
  let spawned = 0;
  const manager = createInpaintSidecarManager({
    probe: async () => ({ state: ++probes >= 2 ? 'ready' : 'starting', reachable: true }),
    spawn: () => { spawned += 1; },
    wait: async () => {},
    maxPolls: 2,
  });
  assert.equal((await manager.ensureStarted()).state, 'ready');
  assert.equal(spawned, 0);
});

test('deduplicates startup, tries Python candidates, and stops only its child', async () => {
  let probes = 0;
  let spawns = 0;
  let killed = 0;
  const manager = createInpaintSidecarManager({
    candidates: ['bad', 'good'],
    probe: async () => ({ state: ++probes >= 3 ? 'ready' : 'unavailable' }),
    probePython: async candidate => candidate === 'good',
    spawn: () => { spawns += 1; return { kill: () => { killed += 1; } }; },
    wait: async () => {},
    maxPolls: 3,
  });
  const [first, second] = await Promise.all([manager.ensureStarted(), manager.ensureStarted()]);
  assert.equal(first.state, 'ready');
  assert.equal(second.state, 'ready');
  assert.equal(spawns, 1);
  manager.shutdown();
  assert.equal(killed, 1);
});

test('reports timeout and can retry a later successful startup', async () => {
  let healthy = false;
  const manager = createInpaintSidecarManager({
    candidates: ['python'],
    probe: async () => ({ state: healthy ? 'ready' : 'unavailable' }),
    probePython: async () => true,
    spawn: () => ({ kill() {} }),
    wait: async () => {},
    maxPolls: 1,
  });
  assert.equal((await manager.ensureStarted()).state, 'unavailable');
  healthy = true;
  assert.equal((await manager.ensureStarted()).state, 'ready');
});

test('uses launchDescriptor pythonPath exclusively and passes explicit LAMA environment variables', async () => {
  let testedCandidates = [];
  let passedEnv = null;
  let passedPython = null;
  let probeCount = 0;
  const manager = createInpaintSidecarManager({
    launchDescriptor: {
      pythonPath: 'C:\\managed\\python.exe',
      serverPath: 'C:\\managed\\server.py',
      modelPath: 'C:\\managed\\big-lama.pt',
      backend: 'nvidia',
      componentVersion: '1.0.0',
    },
    candidates: ['C:\\system\\python.exe', 'py'],
    probe: async () => ({
      state: ++probeCount >= 2 ? 'ready' : 'unavailable',
      backend: 'nvidia',
      componentVersion: '1.0.0',
      errorCode: null,
      message: 'ready',
    }),
    probePython: async candidate => {
      testedCandidates.push(candidate);
      return true;
    },
    spawn: (python, sidecar, opts) => {
      passedPython = python;
      passedEnv = opts?.env;
      return { kill() {} };
    },
    wait: async () => {},
    maxPolls: 2,
  });

  const status = await manager.ensureStarted();
  assert.equal(status.state, 'ready');
  assert.equal(status.backend, 'nvidia');
  assert.equal(status.componentVersion, '1.0.0');
  assert.deepEqual(testedCandidates, ['C:\\managed\\python.exe']);
  assert.equal(passedPython, 'C:\\managed\\python.exe');
  assert.equal(passedEnv?.LAMA_BACKEND, 'nvidia');
  assert.equal(passedEnv?.LAMA_MODEL, 'C:\\managed\\big-lama.pt');
  assert.equal(passedEnv?.LAMA_VERSION, '1.0.0');
});

test('getStatus returns structured health metadata', async () => {
  const manager = createInpaintSidecarManager({
    probe: async () => ({ state: 'ready', backend: 'cpu', componentVersion: '1.0.0', errorCode: null, message: 'ready' }),
  });
  await manager.ensureStarted();
  const status = manager.getStatus();
  assert.equal(status.state, 'ready');
  assert.equal(status.backend, 'cpu');
  assert.equal(status.componentVersion, '1.0.0');
});

