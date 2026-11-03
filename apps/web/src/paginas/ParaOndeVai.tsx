// A despesa por função, da DCA Anexo I-E. Dois níveis de selo: o total é comparado com o TCE-SC, e a
// divisão por função é fonte única. A Câmara fica à parte, e o exercício é próprio: a DCA só existe depois
// do ano encerrado, então a página não usa os filtros do App.
import { funcoesSchema, funcoesSerieSchema, type Funcoes, type FuncoesSerie } from '@orleans-em-dados/contracts';
import { useState } from 'react';
import { useApi } from '../api';
import { posicao, SETA, umaCasa } from '../comparacao';
import { Alternador, Estado, Fonte } from '../components';
import { emMilhoes, milhoes, moeda, numero, porExtenso } from '../format';
import { linhaDaParticipacao, oQueMudou, reguaDasFuncoes, type Etapa } from '../funcoes';
import { nomeDaFuncao } from '../referencias';
import { Selo } from '../selo';
import { SELO_FONTE_UNICA, seloConferidoComTce } from '../selos';

const ETAPAS: readonly { valor: Etapa; nome: string }[] = [
  { valor: 'empenhado', nome: 'Empenhado' },
  { valor: 'liquidado', nome: 'Liquidado' },
  { valor: 'pago', nome: 'Pago' },
];
const NOME_DA_ETAPA = { empenhado: 'empenhado', liquidado: 'liquidado', pago: 'pago' };
const NO_PLURAL = { empenhado: 'empenhados', liquidado: 'liquidados', pago: 'pagos' };
const LADO = { dca: 'o SICONFI', tce: 'o TCE-SC' };
const MENOR_VALOR_EM_MILHOES = 50000;
const FAIXA_COM_TEXTO = 7;
// O nome inteiro não cabe na faixa da régua.
const NOME_NA_REGUA: Record<string, string> = { '17': 'Saneam.' };

const percentual = (v: number | null) =>
  v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const emUmaCasa = (v: number | null) => (v === null ? '—' : `${umaCasa(v)}%`);
const nomeDaSubfuncao = ({ codigo, nome }: { codigo: string; nome: string }) =>
  codigo.startsWith('FU') ? 'Demais subfunções' : nome;
const rotuloDoDivisor = ({ tipo, ano }: NonNullable<Funcoes['divisor']>) =>
  `IBGE, ${tipo === 'censo' ? 'Censo' : 'estimativa'} ${ano}`;
const emMi = (v: number | null) => (v !== null && v > 0 && v < MENOR_VALOR_EM_MILHOES ? '< 0,1' : milhoes(v));
const seloDoTotal = (conferencia: Funcoes['conferencia']) =>
  conferencia === 'conferido' ? seloConferidoComTce() : SELO_FONTE_UNICA;
const simboloDaConferencia = (conferencia: Funcoes['conferencia']) => (conferencia === 'conferido' ? '✓' : '–');

export default function ParaOndeVai() {
  const serie = useApi('/api/funcoes/serie', funcoesSerieSchema);
  const corrente = new Date().getFullYear();
  // A DCA do exercício é entregue no ano seguinte: só anos encerrados.
  const anos = (serie.dados?.anos ?? [])
    .map((a) => a.ano)
    .filter((a) => a < corrente)
    .sort((a, b) => b - a);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const ano = escolhido ?? anos[0] ?? null;
  const [etapa, setEtapa] = useState<Etapa>('empenhado');
  const doAno = useApi(ano ? `/api/funcoes?ano=${ano}` : null, funcoesSchema);

  return (
    <>
      <Estado carregando={serie.carregando || doAno.carregando} erro={serie.erro ?? doAno.erro} />
      {serie.dados && !anos.length && (
        <p className="aviso">A despesa por função ainda não foi coletada: nenhum exercício foi publicado.</p>
      )}
      {doAno.dados && serie.dados && (
        <Conteudo
          dados={doAno.dados}
          serie={serie.dados}
          anos={anos}
          aoEscolherAno={setEscolhido}
          etapa={etapa}
          aoEscolherEtapa={setEtapa}
          corrente={corrente}
        />
      )}
    </>
  );
}

function DiferencaDoTotal({ dados }: { dados: Funcoes }) {
  if (!dados.diferenca) return null;
  const etapas = dados.diferenca.total.etapas.filter((e) => e.maior);
  if (!etapas.length) return null;
  return (
    <p className="aviso-neutro">
      {etapas.map((e, i) => (
        <span key={e.etapa}>
          {i === 0 ? 'No' : ' No'} {NOME_DA_ETAPA[e.etapa]}, {LADO[e.maior as 'dca' | 'tce']} registra{' '}
          {moeda(Math.abs(e.diferenca))} a mais que {LADO[e.maior === 'dca' ? 'tce' : 'dca']}.
        </span>
      ))}{' '}
      Por isso o total sai como fonte única. <a href="#discrepancias">Ver em Discrepâncias</a>
    </p>
  );
}

function Manchete({ dados, ordenadas, etapa }: { dados: Funcoes; ordenadas: Funcoes['funcoes']; etapa: Etapa }) {
  const [primeira, segunda] = ordenadas;
  const fimDaFrase = `${porExtenso(dados.total[etapa])} ${NO_PLURAL[etapa]} em ${dados.ano}.`;
  if (!primeira) return <h1 className="manchete">Foram {fimDaFrase}</h1>;
  const somaEmCentesimos = [primeira, segunda].reduce(
    (soma, f) => soma + Math.round(Number(f?.participacao[etapa] ?? 0) * 100),
    0,
  );
  const parte = somaEmCentesimos > 5000 ? 'mais da metade' : percentual(somaEmCentesimos / 100);
  return (
    <h1 className="manchete">
      {primeira.nome}
      {segunda ? ` e ${segunda.nome.toLocaleLowerCase('pt-BR')} levaram ` : ' levou '}
      <em>{parte}</em> dos {fimDaFrase}
    </h1>
  );
}

function Regua({ ordenadas, etapa }: { ordenadas: Funcoes['funcoes']; etapa: Etapa }) {
  const faixas = reguaDasFuncoes(
    ordenadas.map((f) => ({ codigo: f.codigo, nome: f.nome, participacao: Number(f.participacao[etapa] ?? 0) })),
  );
  const descricao = faixas.map((f) => `${f.nome} ${percentual(f.participacao)}`).join(', ');
  return (
    <div role="img" aria-label={`Divisão do total: ${descricao}`} className="regua-das-funcoes">
      <div className="regua-faixas">
        {faixas.map((f) => (
          <div
            key={f.chave}
            title={`${f.nome}: ${percentual(f.participacao)}`}
            className={`regua-faixa ${f.tom}`}
            style={{ flexGrow: f.participacao }}
          >
            {f.tom !== 'outras' && f.participacao >= FAIXA_COM_TEXTO && (
              <span>
                {NOME_NA_REGUA[f.chave] ?? f.nome} {Math.round(f.participacao)}%
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="regua-escala" aria-hidden="true">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function TabelaDasFuncoes({
  dados,
  ordenadas,
  etapa,
}: {
  dados: Funcoes;
  ordenadas: Funcoes['funcoes'];
  etapa: Etapa;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const comMorador = dados.porMorador !== null;
  const colunas = comMorador ? 6 : 5;
  const maior = Math.max(...ordenadas.map((f) => Number(f[etapa] ?? 0)), 0) || 1;
  return (
    <table aria-label="Valor por função" className="tabela-funcoes">
      <thead>
        <tr>
          <th scope="col">Função</th>
          <td aria-hidden="true" />
          <th scope="col" className="num">
            R$ mi
          </th>
          <th scope="col" className="num">
            % do total
          </th>
          {comMorador && (
            <th scope="col" className="num">
              Por morador
            </th>
          )}
          <td aria-hidden="true" />
        </tr>
      </thead>
      <tbody>
        {ordenadas.flatMap((f, i) => {
          const { nome, oficial } = nomeDaFuncao(f.codigo, f.nome);
          const participacao = Number(f.participacao[etapa] ?? 0);
          const anterior = ordenadas[i - 1];
          const comecaAsPequenas = anterior && participacao < 1 && Number(anterior.participacao[etapa] ?? 0) >= 1;
          const estaAberta = aberta === f.codigo;
          return [
            ...(comecaAsPequenas
              ? [
                  <tr key="pequenas" className="linha-divisor">
                    <td colSpan={colunas}>Menos de 1% do total cada</td>
                  </tr>,
                ]
              : []),
            <tr key={f.codigo} className={i < 2 ? 'linha-destaque' : undefined}>
              <th scope="row">
                <span className="funcao-nome">{nome}</span>
                {oficial && <span className="funcao-oficial">{oficial}</span>}
              </th>
              <td className="funcao-barra" aria-hidden="true">
                <span style={{ width: `${(Math.max(Number(f[etapa] ?? 0), 0) / maior) * 100}%` }} />
              </td>
              <td className="num funcao-valor" data-rotulo="R$ mi" title={moeda(f[etapa])}>
                {emMi(f[etapa])}
              </td>
              <td className="num" data-rotulo="% do total">
                {percentual(f.participacao[etapa])}
              </td>
              {comMorador && (
                <td className="num" data-rotulo="Por morador">
                  {moeda(f.porMorador?.[etapa])}
                </td>
              )}
              <td className="funcao-abrir">
                <button
                  type="button"
                  aria-expanded={estaAberta}
                  aria-label={`${estaAberta ? 'Fechar' : 'Ver'} subfunções de ${nome}`}
                  onClick={() => setAberta(estaAberta ? null : f.codigo)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                    className={estaAberta ? 'aberta' : ''}
                  >
                    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </button>
              </td>
            </tr>,
            ...(estaAberta
              ? [
                  <tr key={`${f.codigo}-subfuncoes`} className="linha-subfuncoes">
                    <td colSpan={colunas}>
                      <span className="rotulo">Subfunções de {nome}</span>
                      <ul className="subfuncoes">
                        {f.subfuncoes.map((s) => (
                          <li key={s.codigo}>
                            <span>{nomeDaSubfuncao(s)}</span>
                            <span className="lp-pontos" aria-hidden="true" />
                            <span className="mono">{emMilhoes(s[etapa])}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>,
                ]
              : []),
          ];
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">
            Total, sem a Câmara <Selo semLink selo={seloDoTotal(dados.conferencia)} />
          </th>
          <td aria-hidden="true" />
          <td className="num funcao-valor" data-rotulo="R$ mi">
            {milhoes(dados.total[etapa])}
          </td>
          <td className="num" data-rotulo="% do total">
            100%
          </td>
          {comMorador && (
            <td className="num" data-rotulo="Por morador">
              {moeda(dados.porMorador?.[etapa])}
            </td>
          )}
          <td aria-hidden="true" />
        </tr>
      </tfoot>
    </table>
  );
}

function Conteudo({
  dados,
  serie,
  anos,
  aoEscolherAno,
  etapa,
  aoEscolherEtapa,
  corrente,
}: {
  dados: Funcoes;
  serie: FuncoesSerie;
  anos: readonly number[];
  aoEscolherAno: (ano: number) => void;
  etapa: Etapa;
  aoEscolherEtapa: (etapa: Etapa) => void;
  corrente: number;
}) {
  const { ano, total, porMorador, divisor, camara, meta } = dados;
  const ordenadas = [...dados.funcoes].sort((a, b) => Number(b[etapa] ?? 0) - Number(a[etapa] ?? 0));
  const seloDaCamara =
    dados.conferencia === 'conferido' || dados.diferenca?.legislativa.estado === 'conferido'
      ? seloConferidoComTce()
      : SELO_FONTE_UNICA;
  const [reais, centavos] = moeda(porMorador?.[etapa]).split(',');

  return (
    <>
      <div className="barra-filtros">
        <div className="campo">
          <label htmlFor="filtro-exercicio" className="rotulo">
            Exercício
          </label>
          <select id="filtro-exercicio" value={ano} onChange={(e) => aoEscolherAno(Number(e.target.value))}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <Alternador rotulo="Etapa" opcoes={ETAPAS} valor={etapa} aoMudar={aoEscolherEtapa} />
        <span className="rotulo filtros-nota">
          Só exercícios encerrados · {corrente} entra com a DCA, até 30/04/{corrente + 1}
        </span>
      </div>

      <div className="abertura">
        <div className="abertura-principal">
          <Manchete dados={dados} ordenadas={ordenadas} etapa={etapa} />
          <p className="abertura-texto">
            A soma das {numero(dados.funcoes.length)} funções do orçamento, em valores nominais. A Câmara Municipal fica
            de fora da conta, como na aba Despesas.
          </p>
        </div>
        <div className="abertura-lado funcoes-lado">
          {porMorador && divisor && (
            <div className="funcoes-bloco">
              <span className="rotulo">Por morador</span>
              <span className="funcoes-morador">
                {reais}
                <small>,{centavos}</small>
              </span>
              <span className="numero-detalhe">
                {emMilhoes(total[etapa])} ÷ {numero(divisor.populacao)} moradores ({rotuloDoDivisor(divisor)})
              </span>
            </div>
          )}
          {camara && (
            <section className="funcoes-bloco" aria-label="Câmara Municipal, fora do total">
              <span className="rotulo">
                Fora do total · Câmara Municipal <Selo semLink selo={seloDaCamara} />
              </span>
              <span className="funcoes-camara">{moeda(camara[etapa])}</span>
              <span className="numero-detalhe">Função Legislativa. Não entra no total nem nas participações.</span>
            </section>
          )}
        </div>
      </div>

      <DiferencaDoTotal dados={dados} />

      <section className="secao">
        <div className="secao-cab">
          <h2 className="secao-titulo">Para onde foi o dinheiro</h2>
          <Selo semLink selo={SELO_FONTE_UNICA} />
        </div>
        <Regua ordenadas={ordenadas} etapa={etapa} />
        <TabelaDasFuncoes dados={dados} ordenadas={ordenadas} etapa={etapa} />
        <p className="nota nota-das-funcoes">
          Gastar mais numa área não prova serviço melhor: a participação diz quanto foi aplicado, e não o que foi
          entregue. A função Educação não é o índice constitucional de educação: aquele índice tem regra própria de
          cálculo, que este painel não apura.
        </p>
      </section>

      <AnoAAno serie={serie} etapa={etapa} anos={anos} anoEscolhido={ano} />

      <Fonte meta={meta} />
    </>
  );
}

function BarrasDoTotal({
  colunas,
  etapa,
  anoEscolhido,
}: {
  colunas: FuncoesSerie['anos'];
  etapa: Etapa;
  anoEscolhido: number;
}) {
  const maior = Math.max(...colunas.map((a) => Number(a.total[etapa] ?? 0)), 0) || 1;
  const primeira = colunas[0];
  const ultima = colunas.at(-1);
  const comRotulo = (ano: number) => ano === primeira?.ano || ano === ultima?.ano || ano === anoEscolhido;
  if (!primeira || !ultima) return null;
  return (
    <>
      <div
        role="img"
        aria-label={`Total ${NOME_DA_ETAPA[etapa]} por ano, de ${porExtenso(primeira.total[etapa])} em ${primeira.ano} a ${porExtenso(ultima.total[etapa])} em ${ultima.ano}, em valores nominais`}
        className="barras-do-total"
      >
        {colunas.map((a) => (
          <div
            key={a.ano}
            title={`${a.ano}: ${emMilhoes(a.total[etapa])}`}
            className={`barra-do-ano${a.ano === anoEscolhido ? ' selecionado' : ''}`}
          >
            {comRotulo(a.ano) && <span>{milhoes(a.total[etapa])}</span>}
            <i style={{ height: `${(Number(a.total[etapa] ?? 0) / maior) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="anos-do-total" aria-hidden="true">
        {colunas.map((a) => (
          <span key={a.ano}>
            {a.ano}
            <small>{simboloDaConferencia(a.conferencia)}</small>
          </span>
        ))}
      </div>
    </>
  );
}

function AnoAAno({
  serie,
  etapa,
  anos,
  anoEscolhido,
}: {
  serie: FuncoesSerie;
  etapa: Etapa;
  anos: readonly number[];
  anoEscolhido: number;
}) {
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const colunas = serie.anos.filter((a) => anos.includes(a.ano)).sort((a, b) => a.ano - b.ano);
  const primeiro = colunas[0];
  const ultimo = colunas.at(-1);
  const nomes = new Map(colunas.flatMap((a) => a.funcoes.map((f) => [f.codigo, f.nome] as const)));
  const noAno = (coluna: FuncoesSerie['anos'][number] | undefined, codigo: string) =>
    coluna?.funcoes.find((f) => f.codigo === codigo)?.participacao[etapa] ?? null;
  const valorRecente = (codigo: string) => Number(ultimo?.funcoes.find((f) => f.codigo === codigo)?.[etapa] ?? 0);
  const codigos = [...nomes.keys()].sort((a, b) => valorRecente(b) - valorRecente(a));
  const mudancas = oQueMudou(colunas, etapa);

  return (
    <section className="secao dupla">
      <div className="secao-cab">
        <h2 className="secao-titulo">Ano a ano</h2>
        {primeiro && ultimo && (
          <span className="legenda-secao">
            {primeiro.ano} a {ultimo.ano}
          </span>
        )}
      </div>

      <div className="ano-a-ano">
        <div className="ano-a-ano-total">
          <h3 className="rotulo">Total {NOME_DA_ETAPA[etapa]} por ano · R$ mi</h3>
          <BarrasDoTotal colunas={colunas} etapa={etapa} anoEscolhido={anoEscolhido} />
          <p className="nota">
            Valores nominais, sem correção pela inflação. Por isso a comparação entre anos usa a participação de cada
            função no total. ✓ total conferido · – fonte única.
          </p>
        </div>
        {mudancas.length > 0 && (
          <div className="o-que-mudou">
            <h3 className="rotulo">O que mudou</h3>
            {mudancas.map((m) => (
              <p key={m.frase}>
                <em>{m.nome}</em> {m.frase}
              </p>
            ))}
          </div>
        )}
      </div>

      {primeiro && ultimo && (
        <table
          aria-label={`Participação de cada função, de ${primeiro.ano} a ${ultimo.ano}`}
          className="tabela-evolucao"
        >
          <thead>
            <tr>
              <th scope="col">Função</th>
              <th scope="col">
                Participação, {primeiro.ano}–{ultimo.ano}
              </th>
              <th scope="col" className="num">
                {primeiro.ano}
              </th>
              <th scope="col" className="num">
                {ultimo.ano}
              </th>
              <th scope="col" className="num">
                Variação
              </th>
            </tr>
          </thead>
          <tbody>
            {codigos.map((codigo) => {
              const valores = colunas.map((a) => noAno(a, codigo));
              const linha = linhaDaParticipacao(valores);
              const inicio = noAno(primeiro, codigo);
              const fim = noAno(ultimo, codigo);
              const variacao = posicao(fim, inicio, { em: 'pontos' });
              return (
                <tr key={codigo}>
                  <th scope="row">{nomes.get(codigo)}</th>
                  <td
                    className="evolucao-linha"
                    title={colunas.map((a, i) => `${a.ano} ${percentual(valores[i] ?? null)}`).join(' · ')}
                  >
                    <div>
                      <svg viewBox="0 0 200 36" preserveAspectRatio="none" aria-hidden="true">
                        <polyline points={linha.pontos} vectorEffect="non-scaling-stroke" />
                      </svg>
                      {linha.ultimo && (
                        <i
                          style={{ left: `${linha.ultimo.esquerda}%`, top: `${linha.ultimo.topo}%` }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </td>
                  <td className="num sub" data-rotulo={String(primeiro.ano)}>
                    {emUmaCasa(inicio)}
                  </td>
                  <td className="num" data-rotulo={String(ultimo.ano)}>
                    {emUmaCasa(fim)}
                  </td>
                  <td className="num" data-rotulo="Variação">
                    {variacao ? (
                      <>
                        <span aria-hidden="true">{SETA[variacao.sentido]}</span> {variacao.texto}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="evolucao-rodape">
        <span className="nota">
          Cada linha tem a própria escala, com no mínimo 2 pontos de altura. O ponto vermelho é {ultimo?.ano}.
        </span>
        <button
          type="button"
          className="botao-link"
          aria-expanded={tabelaAberta}
          onClick={() => setTabelaAberta(!tabelaAberta)}
        >
          {tabelaAberta ? 'Esconder a tabela completa' : 'Ver a tabela com todos os anos'}
        </button>
      </div>

      {tabelaAberta && (
        <>
          <div className="tabela-rolagem">
            <table aria-label="Participação de cada função por ano" className="tabela-anos">
              <thead>
                <tr>
                  <th scope="col">Função</th>
                  {colunas.map((a) => (
                    <th key={a.ano} scope="col" className="num">
                      {a.ano}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codigos.map((codigo) => {
                  const valores = colunas.map((a) => noAno(a, codigo));
                  const maior = Math.max(...valores.map((v) => v ?? -Infinity));
                  return (
                    <tr key={codigo}>
                      <th scope="row">{nomes.get(codigo)}</th>
                      {colunas.map((a, i) => (
                        <td key={a.ano} className={`num${valores[i] === maior ? ' maior-do-periodo' : ''}`}>
                          {percentual(valores[i] ?? null)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total em reais (valores nominais)</th>
                  {colunas.map((a) => (
                    <td key={a.ano} className="num">
                      {emMilhoes(a.total[etapa])}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Conferência do total</th>
                  {colunas.map((a) => (
                    <td key={a.ano} className="num sub">
                      {a.conferencia === 'conferido' ? 'conferido' : 'fonte única'}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="nota-serif">Em negrito, o ano em que cada função teve sua maior participação.</p>
        </>
      )}
    </section>
  );
}
