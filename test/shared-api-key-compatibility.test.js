const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createSecureApiKeyStore: createComicStore } = require('../lib/secure-api-key-store');

const defaultScreenModule = path.resolve(
  __dirname,
  '..',
  '..',
  'Screen Translator',
  'src',
  'secure-api-key-store.js',
);
const screenModule = process.env.SCREEN_TRANSLATOR_SECURE_STORE || defaultScreenModule;

test('both standalone applications read replace and delete the shared schema', {
  skip: !fs.existsSync(screenModule) && 'Screen Translator source is not installed beside ComicTranslator',
}, () => {
  const { createSecureApiKeyStore: createScreenStore } = require(screenModule);
  const state = { config: {} };
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: value => Buffer.from(`dpapi:${value}`, 'utf8'),
    decryptString: value => {
      const text = value.toString('utf8');
      if (!text.startsWith('dpapi:')) throw new Error('cannot decrypt');
      return text.slice('dpapi:'.length);
    },
  };
  const options = {
    configPath: 'shared-config.json',
    safeStorage,
    readJson: () => structuredClone(state.config),
    writeJson: (_file, value) => { state.config = structuredClone(value); },
  };
  const comicStore = createComicStore(options);
  const screenStore = createScreenStore(options);

  comicStore.saveKey('AIza-from-comic');
  assert.equal(screenStore.getKey(), 'AIza-from-comic');
  screenStore.saveKey('AIza-from-screen');
  assert.equal(comicStore.getKey(), 'AIza-from-screen');
  screenStore.deleteKey();
  assert.equal(comicStore.getMetadata().keyState, 'needsKey');
  assert.equal(screenStore.getMetadata().keyState, 'needsKey');
});
