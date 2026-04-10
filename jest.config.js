/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  setupFilesAfterEnv: ['./src/test-utils/setup.ts'],
  // Skip parallel-agent worktree directories so Jest doesn't pick up
  // duplicate test files from .claude/worktrees/agent-*. Each worktree
  // is a full repo checkout with its own node_modules and would otherwise
  // multiply the test count by the number of in-flight worktrees.
  testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
  modulePathIgnorePatterns: ['/.claude/'],
  transformIgnorePatterns: [
    // Jest evaluates this regex against every file path via `match()`; files
    // whose path matches are NOT transformed. We whitelist the React Native
    // ecosystem plus any ESM-only transitive deps that msw drags in (rettime
    // ships only as .mjs and must be transformed to run in Jest's CJS env).
    //
    // pnpm stores deps under `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>`,
    // so the regex must treat the nested `/node_modules/` occurrence as a
    // whitelist check too — the alternation below includes rettime so both
    // the top-level `.pnpm/` and the nested `rettime/` segments are allowed.
    '/node_modules/(?!(\\.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|nativewind|react-native-css-interop|msw|@mswjs|@bundled-es-modules|until-async|strict-event-emitter|outvariant|headers-polyfill|graphql|rettime))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
  // jest-expo's preset wires babel-jest for `.[jt]sx?` but NOT `.mjs`. The
  // msw v2 runtime drags in `rettime`, which ships only as .mjs, so Jest
  // falls back to the default CJS loader and chokes on the `import`
  // statement. Adding an .mjs transform rule here merges with the preset
  // map and fixes it without disturbing asset transformers.
  transform: {
    '^.+\\.mjs$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@db/(.*)$': '<rootDir>/src/lib/db/$1',
    '^@ai/(.*)$': '<rootDir>/src/lib/ai/$1',
    '^@formulas/(.*)$': '<rootDir>/src/lib/formulas/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
  },
}
