const FORMAT_VERSION = 1;

function createSecureApiKeyStore({ configPath, safeStorage, readJson, writeJson }) {
  const read = () => readJson(configPath, {});

  function resolveKey() {
    const config = read();
    if (config.apiKeyEncrypted) {
      return {
        key: safeStorage.decryptString(Buffer.from(config.apiKeyEncrypted, 'base64')),
        keyState: 'secure',
      };
    }

    const legacyKey = String(config.apiKey || '').trim();
    if (!legacyKey) return { key: '', keyState: 'needsKey' };
    if (!safeStorage.isEncryptionAvailable()) {
      return { key: legacyKey, keyState: 'legacyUnsecured' };
    }

    try {
      const migrated = { ...config };
      migrated.apiKeyEncrypted = safeStorage.encryptString(legacyKey).toString('base64');
      migrated.apiKeyFormatVersion = FORMAT_VERSION;
      delete migrated.apiKey;
      writeJson(configPath, migrated);
      return { key: legacyKey, keyState: 'secure' };
    } catch {
      return { key: legacyKey, keyState: 'legacyUnsecured' };
    }
  }

  function getKey() {
    return resolveKey().key;
  }

  function getMetadata() {
    try {
      const { key, keyState } = resolveKey();
      return key
        ? { hasKey: true, apiKeyMasked: `${key.slice(0, 6)}…`, keyState }
        : { hasKey: false, apiKeyMasked: '', keyState: 'needsKey' };
    } catch {
      return { hasKey: false, apiKeyMasked: '', keyState: 'reentryRequired' };
    }
  }

  function saveKey(value) {
    const key = String(value || '').trim();
    if (!key) throw new Error('กรุณากรอก Gemini API Key');
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('ระบบเข้ารหัสของ Windows ยังไม่พร้อม');
    }

    const config = read();
    config.apiKeyEncrypted = safeStorage.encryptString(key).toString('base64');
    config.apiKeyFormatVersion = FORMAT_VERSION;
    delete config.apiKey;
    writeJson(configPath, config);
    return getMetadata();
  }

  function deleteKey() {
    const config = read();
    delete config.apiKey;
    delete config.apiKeyEncrypted;
    delete config.apiKeyFormatVersion;
    writeJson(configPath, config);
    return getMetadata();
  }

  return { getKey, getMetadata, saveKey, deleteKey };
}

module.exports = { FORMAT_VERSION, createSecureApiKeyStore };
