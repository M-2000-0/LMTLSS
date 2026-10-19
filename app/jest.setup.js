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
