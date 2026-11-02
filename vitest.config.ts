import { defineConfig } from 'vitest/config';
import { URL_TESTE } from './packages/db/test/support/url';

const SPECS = 'test/**/*.spec.{js,jsx,ts,tsx}';

// Unit por workspace (pnpm test); integração num projeto à parte, contra o Postgres descartável.
const unidade = (pasta: string) => ({
  test: {
    name: `@orleans-em-dados/${pasta.split('/').at(-1)}`,
    root: pasta,
    include: [SPECS],
    exclude: ['test/integration/**'],
  },
});

export default defineConfig({
  test: {
    projects: [
      unidade('packages/contracts'),
      unidade('packages/db'),
      unidade('packages/importadores'),
      unidade('apps/api'),
      { extends: './apps/web/vite.config.js', ...unidade('apps/web') },
      {
        test: {
          name: 'integracao',
          include: ['{apps,packages}/*/test/integration/**/*.spec.{js,ts}'],
          env: { DATABASE_URL: URL_TESTE },
          globalSetup: ['./packages/db/test/support/banco.ts'],
          setupFiles: ['./packages/db/test/support/setup-integracao.ts'],
          // Os specs dividem o mesmo banco.
          fileParallelism: false,
        },
      },
    ],
    passWithNoTests: true,
  },
});
