const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeArchiveName,
  decodeJpegDataUrl,
  validateArchiveFiles
} = require('../lib/facebook-archive');

test('sanitizes a user ZIP name and adds its extension', () => {
  assert.equal(sanitizeArchiveName('ตอน 1'), 'ตอน 1.zip');
  assert.equal(sanitizeArchiveName('bad\\name:*?"<>|.zip'), 'badname.zip');
  assert.equal(sanitizeArchiveName('   '), 'facebook-export.zip');
});

test('decodes JPEG data URLs and rejects other payloads', () => {
  const encoded = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
  assert.deepEqual(decodeJpegDataUrl(`data:image/jpeg;base64,${encoded}`), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  assert.throws(() => decodeJpegDataUrl(`data:image/png;base64,${encoded}`), /JPEG/);
});

test('accepts only sequential-style JPEG filenames and non-empty lists', () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8]).toString('base64')}`;
  assert.equal(validateArchiveFiles([{ name: '001.jpg', dataUrl: jpeg }]).length, 1);
  assert.throws(() => validateArchiveFiles([]), /at least one/);
  assert.throws(() => validateArchiveFiles([{ name: '../1.jpg', dataUrl: jpeg }]), /filename/);
});
