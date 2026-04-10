/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  setupFilesAfterEnv: ['./src/test-utils/setup.ts'],
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|nativewind|react-native-css-interop|msw|@mswjs|@bundled-es-modules|until-async|strict-event-emitter|outvariant|headers-polyfill|graphql|rettime))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@db/(.*)$': '<rootDir>/src/lib/db/$1',
    '^@ai/(.*)$': '<rootDir>/src/lib/ai/$1',
    '^@formulas/(.*)$': '<rootDir>/src/lib/formulas/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
  },
}
