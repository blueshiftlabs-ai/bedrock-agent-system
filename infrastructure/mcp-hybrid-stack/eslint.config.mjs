// @ts-check
import baseConfig from '@repo/eslint-config/base';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Infrastructure specific rules
      'no-new': 'off', // CDK uses 'new' for constructs
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_|^cdk$',
        },
      ],
    },
  },
  {
    ignores: ['cdk.out/**', 'dist/**', 'node_modules/**'],
  },
];