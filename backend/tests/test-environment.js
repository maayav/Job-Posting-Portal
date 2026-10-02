import { randomUUID } from 'node:crypto';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DISPOSABLE_NAME = /^vortex_test_[a-f0-9]{32}$/;

function localMongoUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'mongodb:' || !LOOPBACK_HOSTS.has(url.hostname) || url.username || url.password) {
    throw new Error('Tests require an unauthenticated loopback MongoDB instance; remote database URIs are refused.');
  }
  return url;
}

export function createTestDatabaseUri(baseUri = 'mongodb://127.0.0.1:27017') {
  const url = localMongoUrl(baseUri);
  url.pathname = `/vortex_test_${randomUUID().replaceAll('-', '')}`;
  return url.toString();
}

export function assertDisposableTestDatabase(uri) {
  const url = localMongoUrl(uri);
  if (!DISPOSABLE_NAME.test(url.pathname.slice(1))) {
    throw new Error('Refusing to modify a database that was not created for this test run.');
  }
  return url.pathname.slice(1);
}
