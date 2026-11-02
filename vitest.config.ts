import { defineConfig } from 'vitest/config';
import { URL_TESTE } from './db/test/support/banco.js';

const SPECS = 'test/**/*.spec.{js,jsx,ts,tsx}';

// Unit por workspace (pnpm test); integração num projeto à parte, contra o Postgres descartável.
const unidade = (pasta: string) => ({
  test: { name: `@orleans-em-dados/${pasta}`, root: pasta, include: [SPECS], exclude: ['test/integration/**'] },
});

export default defineConfig({
  test: {
    projects: [
      unidade('db'),
      unidade('collectors'),
      unidade('backend'),
      { extends: './frontend/vite.config.js', ...unidade('frontend') },
      {
        test: {
          name: 'integracao',
          include: ['*/test/integration/**/*.spec.{js,ts}'],
          env: { DATABASE_URL: URL_TESTE },
          globalSetup: ['./db/test/support/banco.js'],
          setupFiles: ['./db/test/support/setup-integracao.js'],
          // Os specs dividem o mesmo banco.
          fileParallelism: false,
        },
      },
    ],
    passWithNoTests: true,
  },
});
