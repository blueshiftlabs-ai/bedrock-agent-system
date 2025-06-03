// @ts-check
import nextConfig from '@repo/eslint-config/next';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  ...nextConfig,
  {
    ignores: [
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      '.turbo/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Allow console.log in development
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      
      // Next.js specific overrides
      '@next/next/no-html-link-for-pages': 'off',
      
      // React specific overrides for dashboard
      'react/no-unescaped-entities': 'off',
      'react/jsx-key': 'error',
      
      // TypeScript overrides
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      
      // Import ordering
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '../**',
              group: 'parent',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.{js,jsx,ts,tsx}'],
    rules: {
      // App Router specific rules
      'import/no-default-export': 'off', // App Router requires default exports
    },
  },
  {
    files: ['src/components/**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Component specific rules
      'react/display-name': 'error',
      'react/function-component-definition': [
        'error',
        {
          namedComponents: 'arrow-function',
          unnamedComponents: 'arrow-function',
        },
      ],
    },
  },
  {
    files: ['*.config.{js,mjs,ts}', 'scripts/**/*'],
    rules: {
      // Config files can use console
      'no-console': 'off',
      'import/no-default-export': 'off',
    },
  },
];