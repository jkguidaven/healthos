const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Allow expo-sqlite web (wa-sqlite) to load its .wasm asset
config.resolver.assetExts.push('wasm');

// Allow drizzle to import raw .sql migration files
config.resolver.sourceExts.push('sql');

// expo-sqlite on web (wa-sqlite) uses SharedArrayBuffer, which is only
// available in cross-origin-isolated contexts. The dev server needs to
// send COOP + COEP headers so the browser allows it.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      return middleware(req, res, next);
    };
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
