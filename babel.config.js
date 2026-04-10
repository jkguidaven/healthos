module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            '@db': './src/lib/db',
            '@ai': './src/lib/ai',
            '@formulas': './src/lib/formulas',
            '@features': './src/features',
            '@components': './src/components',
          },
        },
      ],
      // react-native-worklets/plugin MUST be last (NativeWind v4 + Reanimated v4 requirement)
      'react-native-worklets/plugin',
    ],
  };
};
