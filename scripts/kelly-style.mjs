import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
const tsParser = tseslint.parser;

// Explicit Kelly rules, independent of the original monorepo and frontend plugins.
export default [
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'src/generated/**'] },
  {
    files: ['apps/api/src/**/*.ts', 'apps/worker/src/**/*.ts', 'packages/backend/src/**/*.ts', 'packages/storage/src/**/*.ts', 'packages/publication/src/**/*.ts', 'packages/database/src/**/*.ts', 'packages/contracts/src/server.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { experimentalDecorators: true },
    },
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/no-tabs': 'error',
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
      '@stylistic/type-annotation-spacing': 'error',
      '@stylistic/keyword-spacing': 'error',
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/arrow-spacing': 'error',
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/space-before-blocks': ['error', 'always'],
      '@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      '@stylistic/max-statements-per-line': ['error', { max: 1 }],
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: ['const', 'let'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
        { blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'switch', 'try', 'block'], next: '*' },
      ],
      '@stylistic/max-len': ['error', { code: 150, tabWidth: 2 }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      '@stylistic/linebreak-style': ['error', 'unix'],
      '@stylistic/eol-last': ['error', 'always'],
      curly: ['error', 'all'],
    },
  },
];
