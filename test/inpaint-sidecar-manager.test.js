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
