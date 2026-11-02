import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // As fixtures dos drivers de .claude/skills violam regras de propósito; docs/screens é mockup exportado (com runtime vendorizado), não código.
  {
    ignores: [
      '**/dist',
      '**/.vite',
      '**/coverage',
      '**/node_modules',
      'data',
      'docs/screens',
      '.claude/skills/*/fixtures',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // `({ id, ...resto }) => resto` é o jeito de omitir um campo.
    rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Aviso, não erro, enquanto api.js, App.jsx e Despesas.jsx não são convertidos:
      // trocar o setState de dentro do efeito muda o ciclo de render e é das fases 17–20
      // do plano docs/plans/2026-11-01-plataforma-de-importadores-em-typescript.md.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['packages/**', 'apps/api/**', 'apps/worker/**', '*.{js,ts}', '.claude/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
