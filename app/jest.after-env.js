// Runs after the test framework is installed, so afterEach exists here.
// setupFiles (jest.setup.js) cannot register hooks.

afterEach(() => {
  const secureStore = require('expo-secure-store');
  if (secureStore.__store) secureStore.__store.clear();
  jest.clearAllMocks();
  const offline = jest.fn(async () => {
    throw new Error('network disabled in tests');
  });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: offline,
  });
});
