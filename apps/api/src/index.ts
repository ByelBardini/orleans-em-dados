import { criarApp } from './app';

const PORTA = Number(process.env.PORT ?? 3000);

// Em produção, `WEB_DIST` aponta para o build do web, e o mesmo processo serve o painel e a API.
const app = criarApp({ logger: { level: 'warn' } }, { site: process.env.WEB_DIST });
await app.listen({ port: PORTA, host: '0.0.0.0' });
console.log(`API em http://localhost:${PORTA}`);
