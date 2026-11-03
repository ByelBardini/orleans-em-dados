import { defineConfig } from 'vitest/config';
import { URL_TESTE } from './packages/db/test/support/url';

const SPECS = 'test/**/*.spec.{js,jsx,ts,tsx}';

// Unit por workspace (pnpm test); integração num projeto à parte, contra o Postgres descartável.
// O nome do projeto é o `name` do package.json.
const unidade = (pasta: string, nome = pasta.split('/').at(-1)) => ({
  test: {
    name: `@orleans-em-dados/${nome}`,
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
      unidade('packages/importadores/nucleo', 'importador-nucleo'),
      unidade('packages/importadores/betha', 'importador-betha'),
      unidade('packages/importadores/tcesc', 'importador-tcesc'),
      unidade('packages/importadores/ibge', 'importador-ibge'),
      unidade('packages/importadores/siconfi', 'importador-siconfi'),
      unidade('apps/api'),
      unidade('apps/worker'),
      {
        extends: './apps/web/vite.config.js',
        test: {
          ...unidade('apps/web').test,
          environment: 'jsdom',
          setupFiles: ['./test/setup.ts'],
        },
      },
      {
        test: {
          name: 'integracao',
          include: ['{apps,packages}/**/test/integration/**/*.spec.{js,ts}'],
          exclude: ['**/node_modules/**'],
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
