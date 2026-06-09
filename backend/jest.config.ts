import type {Config} from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // jose ships ESM; transform it so ts-jest can consume it.
  transformIgnorePatterns: ['node_modules/(?!(jose)/)'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'ts-jest',
  },
  // Booting a real app + a disposable Postgres container is slow; give it room.
  testTimeout: 120000,
};

export default config;
