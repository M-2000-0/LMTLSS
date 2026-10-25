// AsyncStorage ships an official in-memory Jest mock; without it the native
// module is unavailable under Node and every persistence test would throw.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The real provider waits for native insets before rendering children, so a
// test tree would render nothing. This is the package's own mock.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// The keychain/keystore is native. Tests get a real in-memory implementation
// so the auth context exercises the same read/write/delete path as the phone.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    __store: store,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});

// OAuth and file sharing are native flows with no UI under Node. The buttons
// are only rendered when these report themselves available, so a disabled
// mock is also the honest test of the "unavailable" path.
jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: () => [
    null,
    null,
    jest.fn(async () => ({ type: 'cancel' })),
  ],
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(async () => ({ identityToken: null })),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system', () => {
  class MockFile {
    constructor(...parts) {
      this.uri = parts.map(String).join('/');
    }
    create() {}
    async write() {}
    async text() {
      return '';
    }
    async bytes() {
      return new Uint8Array();
    }
  }
  return {
    File: MockFile,
    Paths: { cache: '/cache', document: '/documents' },
    Directory: class {},
  };
});

// No test is allowed to reach the network by accident. A test that wants a
// response installs its own fetch mock.
const offline = jest.fn(async () => {
  throw new Error('network disabled in tests');
});
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: offline,
});

