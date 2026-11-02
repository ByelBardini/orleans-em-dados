import { criarApp } from './app';

const PORTA = Number(process.env.PORT ?? 3000);

const app = criarApp({ logger: { level: 'warn' } });
await app.listen({ port: PORTA, host: '0.0.0.0' });
console.log(`API em http://localhost:${PORTA}`);
