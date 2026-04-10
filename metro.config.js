const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Allow expo-sqlite web (wa-sqlite) to load its .wasm asset
config.resolver.assetExts.push('wasm');

// Allow drizzle to import raw .sql migration files
config.resolver.sourceExts.push('sql');

// Wrap with NativeWind first — its wrapper may rebuild parts of the
// config, so we set our server middleware AFTER the wrap to make sure
// COOP/COEP headers actually land on every dev-server response.
const wrappedConfig = withNativeWind(config, { input: './global.css' });

// expo-sqlite on web (wa-sqlite) uses SharedArrayBuffer, which is only
// available in cross-origin-isolated contexts. The dev server must send
// COOP + COEP headers so the browser allows it. Without these, any
// SQLite read on the web build throws "SharedArrayBuffer is not defined".
//
// Note: enhanceMiddleware is fragile across Metro versions. The runtime
// also checks `Platform.OS` and shows a friendly web-fallback in
// app/_layout.tsx, so even if these headers fail to land the app
// won't crash on web — it just degrades.
const HEADER_MIDDLEWARE = (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
};

wrappedConfig.server = {
  ...(wrappedConfig.server || {}),
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      HEADER_MIDDLEWARE(req, res, () => middleware(req, res, next));
    };
  },
};

module.exports = wrappedConfig;
