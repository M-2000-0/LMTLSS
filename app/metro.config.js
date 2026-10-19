// Metro only watches the app directory by default. The domain lives in
// ../shared (pure TypeScript, no React Native imports) and is imported through
// src/domain.ts, so it must be visible to the bundler:
// https://metrobundler.dev/docs/configuration/ (watchFolders)
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(projectRoot, '..', 'shared')];

module.exports = config;
