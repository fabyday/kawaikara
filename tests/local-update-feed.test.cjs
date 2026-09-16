const assert = require('node:assert/strict');
const { test } = require('node:test');
const { resolveLocalUpdateFeed } = require('../src/Main/Functional/LocalUpdateFeed.ts');

test('accepts only an explicit loopback update feed', () => {
  assert.equal(resolveLocalUpdateFeed(undefined), undefined);
  assert.equal(resolveLocalUpdateFeed('http://127.0.0.1:18080'), 'http://127.0.0.1:18080/');
  assert.throws(() => resolveLocalUpdateFeed('http://localhost:18080/'), /127\.0\.0\.1/);
  assert.throws(() => resolveLocalUpdateFeed('https://127.0.0.1:18080'), /127\.0\.0\.1/);
  assert.throws(() => resolveLocalUpdateFeed('http://example.com:18080'), /127\.0\.0\.1/);
  assert.throws(() => resolveLocalUpdateFeed('http://user:password@127.0.0.1:18080'), /127\.0\.0\.1/);
  assert.throws(() => resolveLocalUpdateFeed('http://127.0.0.1:18080/?token=x'), /127\.0\.0\.1/);
  assert.throws(() => resolveLocalUpdateFeed('http://127.0.0.1:18080/subdir'), /127\.0\.0\.1/);
});
