const test = require('node:test');
const assert = require('node:assert/strict');

const { createSecureApiKeyStore } = require('../lib/secure-api-key-store');

function createHarness(initialConfig = {}, options = {}) {
  let config = structuredClone(initialConfig);
  const writes = [];
  const safeStorage = {
    isEncryptionAvailable: () => options.encryptionAvailable !== false,
    encryptString: value => Buffer.from(`protected:${value}`, 'utf8'),
    decryptString: value => {
      const text = value.toString('utf8');
      if (!text.startsWith('protected:')) throw new Error('cannot decrypt');
      return text.slice('protected:'.length);
    },
  };
  const store = createSecureApiKeyStore({
    configPath: 'config.json',
    safeStorage,
    readJson: () => structuredClone(config),
    writeJson: (_file, value) => {
      if (options.writeError) throw options.writeError;
      config = structuredClone(value);
      writes.push(structuredClone(value));
    },
  });

  return {
    store,
    writes,
    currentConfig: () => structuredClone(config),
  };
}

test('reports needsKey without exposing a key on a new install', () => {
  const h = createHarness();

  assert.deepEqual(h.store.getMetadata(), {
    hasKey: false,
    apiKeyMasked: '',
    keyState: 'needsKey',
  });
});

test('persists only encrypted key material and returns safe metadata', () => {
  const h = createHarness({ theme: 'dark' });

  const metadata = h.store.saveKey('AIza-secret-value');

  assert.equal(h.writes.at(-1).apiKey, undefined);
  assert.equal(h.writes.at(-1).apiKeyFormatVersion, 1);
  assert.match(h.writes.at(-1).apiKeyEncrypted, /^[A-Za-z0-9+/]+=*$/);
  assert.equal(h.writes.at(-1).theme, 'dark');
  assert.equal(h.store.getKey(), 'AIza-secret-value');
  assert.deepEqual(metadata, {
    hasKey: true,
    apiKeyMasked: 'AIza-s…',
    keyState: 'secure',
  });
});

test('atomically migrates a legacy plaintext key on read', () => {
  const h = createHarness({ apiKey: 'AIza-legacy-secret', theme: 'light' });

  assert.equal(h.store.getKey(), 'AIza-legacy-secret');
  assert.equal(h.writes.length, 1);
  assert.equal(h.currentConfig().apiKey, undefined);
  assert.equal(h.currentConfig().apiKeyFormatVersion, 1);
  assert.equal(h.currentConfig().theme, 'light');
  assert.deepEqual(h.store.getMetadata(), {
    hasKey: true,
    apiKeyMasked: 'AIza-l…',
    keyState: 'secure',
  });
});

test('keeps a legacy plaintext key readable when encryption is unavailable', () => {
  const h = createHarness(
    { apiKey: 'AIza-legacy-secret', theme: 'light' },
    { encryptionAvailable: false },
  );

  assert.equal(h.store.getKey(), 'AIza-legacy-secret');
  assert.equal(h.writes.length, 0);
  assert.deepEqual(h.store.getMetadata(), {
    hasKey: true,
    apiKeyMasked: 'AIza-l…',
    keyState: 'legacyUnsecured',
  });
});

test('keeps plaintext when the migration write fails', () => {
  const h = createHarness(
    { apiKey: 'AIza-legacy-secret', theme: 'light' },
    { writeError: new Error('disk full') },
  );

  assert.equal(h.store.getKey(), 'AIza-legacy-secret');
  assert.equal(h.currentConfig().apiKey, 'AIza-legacy-secret');
  assert.deepEqual(h.store.getMetadata(), {
    hasKey: true,
    apiKeyMasked: 'AIza-l…',
    keyState: 'legacyUnsecured',
  });
});

test('requires key re-entry when encrypted data cannot be decrypted', () => {
  const h = createHarness({
    apiKeyEncrypted: Buffer.from('damaged').toString('base64'),
    apiKeyFormatVersion: 1,
  });

  assert.throws(() => h.store.getKey(), /cannot decrypt/);
  assert.deepEqual(h.store.getMetadata(), {
    hasKey: false,
    apiKeyMasked: '',
    keyState: 'reentryRequired',
  });
});

test('deletes only key fields and preserves unrelated settings', () => {
  const h = createHarness({
    apiKey: 'legacy',
    apiKeyEncrypted: 'encrypted',
    apiKeyFormatVersion: 1,
    cloudOpacity: 85,
  });

  assert.deepEqual(h.store.deleteKey(), {
    hasKey: false,
    apiKeyMasked: '',
    keyState: 'needsKey',
  });
  assert.deepEqual(h.currentConfig(), { cloudOpacity: 85 });
});

test('replaces an existing encrypted key', () => {
  const h = createHarness();
  h.store.saveKey('AIza-first-secret');

  h.store.saveKey('AIza-second-secret');

  assert.equal(h.store.getKey(), 'AIza-second-secret');
  assert.equal(h.writes.length, 2);
});

test('rejects an empty key without changing config', () => {
  const h = createHarness({ theme: 'dark' });

  assert.throws(() => h.store.saveKey('   '), /กรุณากรอก Gemini API Key/);
  assert.deepEqual(h.currentConfig(), { theme: 'dark' });
  assert.equal(h.writes.length, 0);
});

test('rejects secure persistence when Windows encryption is unavailable', () => {
  const h = createHarness({ theme: 'dark' }, { encryptionAvailable: false });

  assert.throws(
    () => h.store.saveKey('AIza-new-secret'),
    /ระบบเข้ารหัสของ Windows ยังไม่พร้อม/,
  );
  assert.deepEqual(h.currentConfig(), { theme: 'dark' });
  assert.equal(h.writes.length, 0);
});
