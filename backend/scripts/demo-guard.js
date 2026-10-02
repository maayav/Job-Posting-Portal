export function assertLocalDemoDatabase(uri, nodeEnv) {
  if (nodeEnv === 'production' || !/^mongodb:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\/[a-zA-Z0-9_-]+(?:\?.*)?$/.test(uri ?? '')) {
    throw new Error('Demo seeds only run against an unauthenticated local MongoDB database outside production.');
  }
}
