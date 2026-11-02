# Dashboard

Dashboard público em React 19 + Vite 6, JSX sem TypeScript. Vive em `frontend/src/` (pacote `@orleans-em-dados/frontend`); o Vite faz proxy de `/api` para `localhost:3000`.

## Estrutura

- `frontend/src/App.jsx` — abas (`ABAS`) navegadas pelo hash da URL, filtros de ano e entidade, "Atualizado em" do exercício (de `/api/anos`).
- `frontend/src/paginas/` — `VisaoGeral`, `Receitas`, `Despesas`, `Conferencia`, `Metodologia`.
- `frontend/src/components.jsx` — componentes compartilhados.
- `frontend/src/selos.jsx` — selos de conferência Betha × TCE-SC.
- `frontend/src/styles.css` — visual de "caderno de jornal" com tokens em `:root` (papel, tinta, vermelho, três famílias de fonte), tema claro/escuro por `data-theme`. Referência visual: `docs/screens/`.

## Funções e utilitários

- `getJSON(caminho)`, `useApi(caminho)` (`api.js`) — busca JSON; erro do servidor vira a mensagem `erro` do corpo; `useApi(null)` não busca.
- `format.js` — `moeda` (travessão para nulo, sinal preservado), `moedaCompacta`, `numero`, `decimal`, `percentual` (sem casas forçadas), `pct` (casas fixas, padrão 1), `milhoes`/`emMilhoes`/`porExtenso`, `data`/`dataHora`/`dataCurta`, `MESES`, `MESES_LONGOS`, `nomeProprio` (caixa alta da Betha → nome próprio, mantendo siglas).
- `referencias.js` — `populacao(ano)` (IBGE, ano anterior mais próximo), `ORIGEM_CIDADAO`, `ORIGENS_DE_FORA`, `GLOSSARIO`, `sujeito(entidade)`.
- `useConferencia(ano)`, `Selo`, `seloReceita`, `seloEmpenhos`, `seloDespesa`, `seloRubrica`, `seloEmpenho` (`selos.jsx`) — selo `confere` | `diverge` | `pendente` com título e motivo.

## Componentes/Módulos

- `Estado`, `Numero`, `Numeros`, `Mi`, `ListaPontos`, `BarrasMensais`, `LinhaAcumulada`, `BarraDividida`, `SeletorTema`, `Alternador`, `Filtros`, `Fonte` (`components.jsx`); `escala(maximo, linhas)` calcula a régua dos gráficos.

## Regras de negócio

- Todo número exibido diz fonte e conferência (`Fonte`, `Selo`); a Câmara aparece à parte, com a abrangência explícita.
- No ano em curso, o atraso do TCE-SC é pendência, não divergência; a linguagem dos selos é "provável"/"possível" quando a causa não foi comprovada.

## Testes

- Specs em `frontend/test/` espelhando `src/`, sem DOM por enquanto (`format.spec.js`). Componente exige Testing Library + jsdom, ainda não instalados.

## Armadilhas

- `Intl` do `pt-BR` separa `R$` do número com espaço não separável (`U+00A0`): esperado de teste usa o caractere certo.
- `react-hooks/set-state-in-effect` está como aviso: `api.js`, `App.jsx` e `paginas/Despesas.jsx` chamam `setState` dentro de `useEffect`.
