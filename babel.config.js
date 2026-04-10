module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
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
    ],
  };
};
