const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readJsonWithRecovery, writeJsonAtomic } = require('../lib/atomic-json');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comic-translator-'));
  return { dir, file: path.join(dir, 'page.json') };
}

test('atomic write replaces JSON and keeps the previous valid version as .bak', () => {
  const { dir, file } = tempFile();
  try {
    fs.writeFileSync(file, JSON.stringify({ version: 1 }), 'utf8');
    writeJsonAtomic(file, { version: 2 });

    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { version: 2 });
    assert.deepEqual(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8')), { version: 1 });
    assert.equal(fs.existsSync(`${file}.tmp`), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('read recovers a corrupt primary file from a valid backup', () => {
  const { dir, file } = tempFile();
  try {
    fs.writeFileSync(file, '{broken', 'utf8');
    fs.writeFileSync(`${file}.bak`, JSON.stringify({ recovered: true }), 'utf8');

    const result = readJsonWithRecovery(file, {});

    assert.deepEqual(result, { recovered: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { recovered: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('read returns fallback when neither primary nor backup is valid', () => {
  const { dir, file } = tempFile();
  try {
    fs.writeFileSync(file, '{broken', 'utf8');
    assert.deepEqual(readJsonWithRecovery(file, { empty: true }), { empty: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
