# Deploy no Coolify

O painel roda em três serviços de uma imagem só (`Dockerfile`), descritos em `docker-compose.prod.yml`:

| Serviço  | O que faz                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| `migrar` | roda as migrações (`pnpm db:migrar`) e termina; os outros só sobem depois que ela sai com sucesso             |
| `site`   | a API e o build do web no mesmo processo, na porta 3000; healthcheck em `/api/saude`                          |
| `worker` | a agenda diária das coletas e o histórico dos últimos exercícios; na subida, carrega os snapshots de Educação |

O Postgres fica fora do compose, como recurso próprio do Coolify. Não há área de administração: o worker coleta sozinho, e o que não tem API (os snapshots de Educação) entra pelo repositório.

## Primeira vez

1. **Postgres.** No projeto do Coolify, crie um recurso de banco PostgreSQL 17. Anote a URL de conexão interna (`postgres://usuario:senha@host:5432/banco`). Em **Backups**, agende um backup diário (é um `pg_dump`) e, se tiver, um destino S3.
2. **Aplicação.** Crie um recurso **Docker Compose** apontando para este repositório, branch `main`, arquivo `docker-compose.prod.yml`. O Coolify constrói a imagem pelo `Dockerfile`.
3. **Variáveis.** Em **Environment Variables**:

   | Variável                            | Valor                                                        | Obrigatória |
   | ----------------------------------- | ------------------------------------------------------------ | ----------- |
   | `DATABASE_URL`                      | a URL interna do Postgres do passo 1                         | sim         |
   | `SITE_URL`                          | o endereço público, como `https://orleansemdados.com.br`     | sim (busca) |
   | `GOOGLE_SITE_VERIFICATION`          | o código da meta do Search Console, se não verificar por DNS | não         |
   | `PIX_CHAVE`                         | a chave Pix do apoio: prefira aleatória ou e-mail, nunca CPF | não         |
   | `PIX_NOME`, `PIX_CIDADE`            | nome e cidade de quem recebe, como no banco (com a chave)    | com a chave |
   | `ANOS_DE_HISTORICO`                 | exercícios encerrados a manter (padrão 10)                   | não         |
   | `HISTORICO_PAUSA_MS`                | pausa entre um exercício e o seguinte na carga (padrão 5000) | não         |
   | `BETHA_PAGE_SIZE`, `BETHA_PAUSA_MS` | paginação da Betha (padrões 10000 e 300)                     | não         |

4. **Domínio.** No serviço `site`, defina o domínio com a porta 3000 (por exemplo `https://orleansemdados.com.br:3000`; o Coolify cuida do HTTPS). O `worker` e o `migrar` não têm domínio.
5. **Deploy.** Os pushes na `main` passam a disparar o deploy (ative o deploy automático no recurso, se quiser).

## O que esperar na primeira subida

- O `migrar` cria o esquema e termina. O `site` sobe e já responde, mas sem dado: as páginas dizem "Ainda não dá para conferir".
- O `worker` carrega os snapshots de `docs/educacao/snapshots/` em segundos e manda o job `historico` (modo `subida`): Betha, TCE-SC e SICONFI, do exercício mais recente ao mais antigo, um por vez, com pausa. Leva algumas horas. Os anos aparecem no seletor conforme são publicados.
- O TCE-SC só publica receitas de 2018 em diante e empenhos de 2023 em diante. Esses anos aparecem com o aviso "O TCE-SC não publica…", e de 2018 a 2022 só a receita é conferida. O worker não pede ao Farol os anos que ele não tem.
- Acompanhe pelo log do `worker` no Coolify: `[historico] betha 2019: sucesso`, e assim por diante.

## Depois

- **Todo dia**, o worker roda Betha (3h), TCE-SC (4h), IBGE (5h) e SICONFI (6h), no fuso de São Paulo, sobre o exercício corrente e o anterior. Às 2h, o `historico` completa o que ainda faltar (uma fonte fora do ar na véspera, por exemplo).
- **Um deploy novo** reabre o histórico no modo `subida`: tenta de novo o que foi rejeitado, porque o código pode ter mudado.
- **Snapshot novo de Educação ou do SIOPE** (extraído à mão, com `pnpm extrair educacao …` e `pnpm extrair educacao varrer` dizendo 0 achados): commite em `docs/educacao/snapshots/` e faça o push. Na subida, o worker carrega; o que não mudou vira `sem mudança`.
- **Busca:** sem `SITE_URL`, o `site` sobe e avisa no log, mas as páginas saem sem canonical e sem imagem na prévia das redes. Cada página tem endereço próprio (`/financas/receitas`) e head próprio, montado pelo servidor; caminho que não é página responde 404.
- **Apoio por Pix:** com `PIX_CHAVE`, `PIX_NOME` e `PIX_CIDADE` no serviço `site`, aparecem o botão "Apoiar" e a página `/apoiar`, com o QR e o copia e cola; sem a chave, nada disso existe. A chave fica pública no QR: use uma chave aleatória ou um e-mail, nunca o CPF. Config errada (chave inválida, nome faltando) não derruba o site: o apoio fica desligado, e o motivo sai no log. Antes de divulgar, leia o QR com o app de um banco.
- **Saúde:** `GET /api/saude` responde `{ "ok": true }` com o banco de pé e `503` sem ele.

## Conferir antes, na sua máquina

O mesmo smoke que a CI roda, contra o Postgres descartável:

```bash
pnpm db:teste
```

```bash
docker build -t orleans-em-dados:local .
```

```bash
docker run --rm -e DATABASE_URL=postgres://orleans:orleans@host.docker.internal:5434/orleans_teste orleans-em-dados:local pnpm db:migrar
```

```bash
docker run --rm -p 3000:3000 -e DATABASE_URL=postgres://orleans:orleans@host.docker.internal:5434/orleans_teste orleans-em-dados:local
```

Em outro terminal, `http://localhost:3000/api/saude` deve responder `{"ok":true}`, e `http://localhost:3000/` deve abrir o painel.
