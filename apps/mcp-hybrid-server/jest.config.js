module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@aws/(.*)$': '<rootDir>/aws/$1',
    '^@memory/(.*)$': '<rootDir>/memory/$1',
    '^@workflows/(.*)$': '<rootDir>/workflows/$1',
    '^@agents/(.*)$': '<rootDir>/agents/$1',
    '^@tools/(.*)$': '<rootDir>/tools/$1',
    '^@integrations/(.*)$': '<rootDir>/integrations/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
  },
};
