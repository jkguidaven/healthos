import '@testing-library/jest-native/extend-expect'

// MSW server is NOT auto-loaded here because msw v2 has ESM transitive
// dependencies that Jest 29 cannot transform without significant config.
// Tests that need to mock the Gemini API should import the helper from
// './msw-server-setup' and call it inside their describe block. See that
// file for usage.
