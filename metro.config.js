const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Allow expo-sqlite web (wa-sqlite) to load its .wasm asset
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './global.css' });
