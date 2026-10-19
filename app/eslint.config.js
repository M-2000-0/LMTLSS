const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', 'android/*', 'ios/*'],
  },
  {
    // Jest's globals are available in the setup file; flat config does not
    // accept `/* eslint-env jest */` comments.
    files: ['jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);