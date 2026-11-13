module.exports = { preset: 'ts-jest', testEnvironment: 'node', testMatch: ['**/test/**/*.test.ts'], testTimeout: 30000, setupFiles: ['<rootDir>/test/env.cjs'] };
