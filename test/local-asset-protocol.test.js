const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createLocalAssetProtocol } = require('../lib/local-asset-protocol');

const root = path.resolve('C:\\comics', 'เรื่องไทย');
const outside = path.resolve('C:\\private', 'secret.png');

function createProtocol() {
  return createLocalAssetProtocol({
    path,
    allowedRoots: () => [root],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.jfif'],
  });
}

test('round-trips an authorized absolute Unicode image path', () => {
  const protocol = createProtocol();
  const imagePath = path.join(root, 'ตอนที่ ๑', 'หน้า 01.PNG');
  const url = protocol.urlForPath(imagePath);

  assert.match(url, /^mirai-asset:\/\/local\/[A-Za-z0-9_-]+$/);
  assert.equal(protocol.resolveRequestUrl(url), path.resolve(imagePath));
});

test('uses the latest roots returned by the dynamic root provider', () => {
  let roots = [];
  const protocol = createLocalAssetProtocol({ path, allowedRoots: () => roots });
  const imagePath = path.join(root, 'page.webp');

  assert.throws(() => protocol.urlForPath(imagePath), /authorized root/);
  roots = [root];
  assert.equal(protocol.resolveRequestUrl(protocol.urlForPath(imagePath)), path.resolve(imagePath));
});

test('rejects paths outside authorized roots and unsupported file types', () => {
  const protocol = createProtocol();

  assert.throws(() => protocol.urlForPath(outside), /authorized root/);
  assert.throws(() => protocol.urlForPath(path.join(root, 'notes.txt')), /extension/);
  assert.throws(() => protocol.urlForPath('relative.png'), /absolute/);
});

test('rejects malformed URLs, wrong hosts, extra segments, and invalid payloads', () => {
  const protocol = createProtocol();

  for (const url of [
    'https://local/abc',
    'mirai-asset://remote/abc',
    'mirai-asset://local/abc/extra',
    'mirai-asset://local/%25%25%25',
    'mirai-asset://local/',
  ]) {
    assert.throws(() => protocol.resolveRequestUrl(url), Error, url);
  }
});

test('does not accept a crafted payload that decodes to an unauthorized path', () => {
  const protocol = createProtocol();
  const payload = Buffer.from(outside, 'utf8').toString('base64url');

  assert.throws(
    () => protocol.resolveRequestUrl(`mirai-asset://local/${payload}`),
    /authorized root/
  );
});
