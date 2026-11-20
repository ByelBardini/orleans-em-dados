# Uma imagem para os três serviços do docker-compose.prod.yml: migração, site (API + build do web) e worker.
# O código roda em TypeScript pelo tsx, como em desenvolvimento: não há etapa de compilação do servidor.
FROM node:22-bookworm-slim

# O pnpm da versão do `packageManager` fica na imagem (COREPACK_HOME), e não é baixado a cada subida.
ENV CI=true \
    NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_HOME=/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

# Dependências primeiro: o `pnpm fetch` só depende do lockfile, e a camada fica em cache entre deploys.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch

COPY . .
# Com as devDependencies: o tsx e o Vite rodam aqui.
RUN pnpm install --offline --frozen-lockfile --prod=false \
 && pnpm build \
 && chown -R node:node /app /corepack

USER node
ENV PORT=3000 \
    WEB_DIST=/app/apps/web/dist
EXPOSE 3000

# O padrão é o site; o compose troca o comando para a migração e o worker.
CMD ["pnpm", "start"]
