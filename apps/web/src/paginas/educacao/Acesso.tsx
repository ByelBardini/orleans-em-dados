// Aba Acesso do caderno de Educação: quem está na escola. Cada bloco traz o próprio ano, fonte e selo, e o bloco sem
// coleta some, com o resto seguindo. É a aba que as outras copiam: `useApi`, `Estado`, blocos e CSS com o prefixo da aba.
import { educacaoAcessoSchema, type EducacaoAcesso, type NivelDeGestao } from '@orleans-em-dados/contracts';
import { BarrasEmpilhadas, BlocoDoCaderno, CabecalhoDoCaderno, Comparacao, Detalhes } from '../../educacao/componentes';
import { useApi } from '../../api';
import { Estado } from '../../components';
import { escalaDaComparacao, formatarValor, NOMES_DE_ETAPA } from '../../educacao';
import { numero } from '../../format';
import { useState } from 'react';
import './Acesso.css';

const LEI_DO_PNE = 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/L15388.htm';
const SEM_DADO = 'Sem dado';
const CASAS_DO_CENSO = 2;

const CURTO: Record<string, string> = { '4 a 5 anos': '4 e 5 anos' };
const IDADE_DE: Record<string, string> = {
  '0 a 3 anos': 'idade de creche',
  '4 a 5 anos': 'idade de pré-escola',
  '6 a 14 anos': 'idade do fundamental',
  '15 a 17 anos': 'idade do ensino médio',
};
const nomeCurto = (faixa: string) => CURTO[faixa] ?? faixa;
const nomeDaFaixa = (faixa: string) =>
  IDADE_DE[faixa] ? `${nomeCurto(faixa)} (${IDADE_DE[faixa]})` : nomeCurto(faixa);

const emLista = (itens: readonly string[]) =>
  new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(itens);
const contagem = (valor: number | null) => (valor === null ? '—' : numero(valor));

type Frequencia = NonNullable<EducacaoAcesso['frequencia']>;

// A frase sai dos dados, sem adjetivo: quem fica abaixo mostra os dois números.
function fraseDaFrequencia({ faixas }: Frequencia) {
  const emTexto = (valor: number) => formatarValor(valor, '%', CASAS_DO_CENSO);
  const acima: string[] = [];
  const abaixo: string[] = [];
  const entre: string[] = [];
  for (const { faixa, comparacao } of faixas) {
    const valores = comparacao.porRede.todas;
    if (!valores) continue;
    const { orleans, santaCatarina, brasil } = valores;
    if (orleans === null || santaCatarina === null || brasil === null) continue;
    if (orleans > santaCatarina && orleans > brasil) acima.push(nomeCurto(faixa));
    else if (orleans < santaCatarina && orleans < brasil)
      abaixo.push(`${nomeCurto(faixa)} (${emTexto(orleans)} × ${emTexto(santaCatarina)} em SC)`);
    else entre.push(nomeCurto(faixa));
  }
  const OS_DOIS = 'Santa Catarina e do Brasil';
  const trechos = [
    acima.length ? `acima de ${OS_DOIS} em ${emLista(acima)}` : null,
    abaixo.length ? `abaixo ${acima.length ? 'dos dois' : `de ${OS_DOIS}`} em ${emLista(abaixo)}` : null,
    entre.length ? `entre os dois em ${emLista(entre)}` : null,
  ].filter((trecho) => trecho !== null);
  if (!trechos.length) return null;
  return trechos.map((trecho, i) => `${i === 0 ? 'Orleans fica' : 'Fica'} ${trecho}.`).join(' ');
}

function BlocoDaFrequencia({ bloco }: { bloco: Frequencia }) {
  const frase = fraseDaFrequencia(bloco);
  const emAnterior = (valor: number | null) => formatarValor(valor, '%');
  return (
    <BlocoDoCaderno
      titulo="Frequência à escola, por idade"
      fonte={bloco.fonte}
      ano={`${bloco.ano}; ${bloco.anoAnterior}: cálculo a partir do Censo ${bloco.anoAnterior}`}
      nota={
        <>
          <p>A linha tracejada é a meta do PNE. A meta é nacional, e o dado é de {bloco.ano}, anterior à lei.</p>
          <details className="edu-acesso-como-ler">
            <summary>Como ler</summary>
            <p>
              A frequência conta quem vai à escola naquela idade, em qualquer etapa. A meta é a do Plano Nacional de
              Educação (PNE,{' '}
              <a href={LEI_DO_PNE} target="_blank" rel="noreferrer">
                Lei 15.388/2026
              </a>
              , publicada em 15/04/2026, com vigência de 10 anos).
            </p>
            <ul>
              <li>
                De 0 a 3 anos: atender toda a demanda manifesta por creche e, em nível nacional, ao menos 60% das
                crianças, até o fim da vigência.
              </li>
              <li>De 4 e 5 anos: universalizar a pré-escola até o 2º ano de vigência.</li>
              <li>
                De 6 a 17 anos: universalizar o acesso à escola até o 3º ano de vigência. É uma meta só, sem separar 6 a
                14 de 15 a 17, por isso a linha de 100% aparece nas duas faixas.
              </li>
              <li>De 18 a 24 anos, não há linha de meta.</li>
            </ul>
          </details>
        </>
      }
    >
      {frase && <p className="edu-acesso-frase">{frase}</p>}
      <div className="edu-acesso-faixas">
        {bloco.faixas.map(({ faixa, comparacao, noAnoAnterior }) => (
          <div key={faixa} className="edu-acesso-faixa">
            <Comparacao
              comparacao={comparacao}
              rede="todas"
              rotulo={nomeDaFaixa(faixa)}
              casas={CASAS_DO_CENSO}
              sentidoBom="maior"
            />
            <p className="edu-acesso-anterior">
              Em {bloco.anoAnterior}: Orleans {emAnterior(noAnoAnterior.orleans)}, SC{' '}
              {emAnterior(noAnoAnterior.santaCatarina)}, Brasil {emAnterior(noAnoAnterior.brasil)}.
            </p>
          </div>
        ))}
      </div>
    </BlocoDoCaderno>
  );
}

type Matriculas = NonNullable<EducacaoAcesso['matriculas']>;

const NOMES_DAS_REDES = [
  ['municipal', 'Municipal'],
  ['estadual', 'Estadual'],
  ['federal', 'Federal'],
  ['privada', 'Privada'],
] as const;

function fraseDaRedeMunicipal({ etapas }: Matriculas) {
  const nome = (etapa: string) => (NOMES_DE_ETAPA[etapa] ?? etapa).toLowerCase();
  const comRede = etapas.filter((e) => e.municipal !== null).map((e) => nome(e.etapa));
  const semRede = etapas.filter((e) => e.municipal === null).map((e) => nome(e.etapa));
  return [
    comRede.length ? `A rede municipal tem matrículas em ${emLista(comRede)}.` : null,
    semRede.length ? `A fonte não registra matrícula municipal em ${emLista(semRede)}.` : null,
  ]
    .filter((frase) => frase !== null)
    .join(' ');
}

function BlocoDasMatriculas({ bloco }: { bloco: Matriculas }) {
  // Rede que não aparece em etapa nenhuma não vira coluna; a que aparece em alguma, fica com travessão nas outras.
  const redes = NOMES_DAS_REDES.filter(([rede]) => bloco.etapas.some((e) => e[rede] !== null));
  return (
    <BlocoDoCaderno titulo={`Matrículas em ${bloco.ano}, por rede`} fonte={bloco.fonte} ano={bloco.ano}>
      <p className="edu-acesso-frase">
        Em {bloco.ano}, Orleans tem {contagem(bloco.total)} matrículas. {fraseDaRedeMunicipal(bloco)}
      </p>
      <BarrasEmpilhadas
        descricao={`Matrículas por rede em ${bloco.ano}`}
        formatar={numero}
        linhas={bloco.etapas.map((etapa) => ({
          rotulo: `${NOMES_DE_ETAPA[etapa.etapa] ?? etapa.etapa}: ${contagem(etapa.total)} matrículas`,
          partes: redes.map(([rede, nome]) => ({ nome, valor: etapa[rede] })),
        }))}
      />
    </BlocoDoCaderno>
  );
}

function BlocoDasEscolas({ bloco }: { bloco: Matriculas }) {
  return (
    <BlocoDoCaderno
      titulo="Escolas e docentes em Orleans"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota="Uma escola pode atender mais de uma etapa, e um docente pode dar aula em mais de uma etapa: os números não se somam."
    >
      <ul className="edu-acesso-cartoes">
        {bloco.escolasEDocentes.map(({ etapa, escolas, docentes }) => (
          <li key={etapa}>
            <span className="edu-acesso-cartao-nome">{NOMES_DE_ETAPA[etapa] ?? etapa}</span>
            <span className="edu-acesso-cartao-numeros">
              <span>
                <span className="edu-acesso-numero">{contagem(escolas)}</span> escolas
              </span>
              <span>
                <span className="edu-acesso-numero">{contagem(docentes)}</span> docentes
              </span>
            </span>
          </li>
        ))}
      </ul>
    </BlocoDoCaderno>
  );
}

const ESCALA_DA_OUTRA_CIDADE = { min: 0, max: 20 };

function BlocoDaOutraCidade({ bloco }: { bloco: NonNullable<EducacaoAcesso['outroMunicipio']> }) {
  const { max } = escalaDaComparacao(bloco.comparacao, ESCALA_DA_OUTRA_CIDADE);
  return (
    <BlocoDoCaderno
      titulo="Estudar em outra cidade"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota={`${contagem(bloco.emOutroMunicipio)} de ${contagem(bloco.estudantes)} estudantes moradores de Orleans. Escala de 0 a ${numero(max)}%.`}
    >
      <Comparacao
        comparacao={bloco.comparacao}
        rede="todas"
        rotulo="Estudantes que estudam em outro município"
        escala={ESCALA_DA_OUTRA_CIDADE}
      />
    </BlocoDoCaderno>
  );
}

const NOME_DO_NIVEL: Record<NivelDeGestao, string> = {
  inicial: 'Inicial',
  elementar: 'Elementar',
  basico: 'Básico',
  avancado: 'Avançado',
};

type Retrato = NonNullable<EducacaoAcesso['retrato']>;

const rotuloDoNivel = (i: number, nivel: NivelDeGestao) => `Nível ${i + 1} · ${NOME_DO_NIVEL[nivel]}`;

// A abertura diz de onde vem a classificação. O relatório do MEC não traz o que cada nível exige: o painel não
// define nível nenhum, só diz o nome e quantos municípios de SC estão nele.
function AberturaDosNiveis({ retrato: { nivelDeOrleans, distribuicaoEmSc } }: { retrato: Retrato }) {
  const primeiro = distribuicaoEmSc[0];
  const ultimo = distribuicaoEmSc.at(-1);
  const posicao = distribuicaoEmSc.findIndex((d) => d.nivel === nivelDeOrleans) + 1;
  const presentes = distribuicaoEmSc.flatMap((d) => (d.municipios === null ? [] : [d.municipios]));
  const noNivel = distribuicaoEmSc.find((d) => d.nivel === nivelDeOrleans)?.municipios ?? null;
  const fechou = presentes.length === distribuicaoEmSc.length && noNivel !== null;
  return (
    <p className="edu-acesso-frase-nivel">
      O MEC classificou cada município em quatro níveis
      {primeiro &&
        ultimo &&
        `, de 1 (${NOME_DO_NIVEL[primeiro.nivel]}) a ${distribuicaoEmSc.length} (${NOME_DO_NIVEL[ultimo.nivel]})`}
      , com base no que a própria Prefeitura respondeu sobre como cuida da procura por vaga em creche.
      {nivelDeOrleans && posicao > 0 && ` Orleans ficou no nível ${posicao} (${NOME_DO_NIVEL[nivelDeOrleans]})`}
      {nivelDeOrleans &&
        posicao > 0 &&
        (fechou
          ? `, como ${numero(noNivel)} dos ${numero(presentes.reduce((a, b) => a + b, 0))} municípios de SC.`
          : '.')}
    </p>
  );
}

// Cada nível abre a dica no mouse ou no foco; o vermelho fica só no nível de Orleans.
function NiveisDeGestao({ retrato }: { retrato: Retrato }) {
  const maior = Math.max(...retrato.distribuicaoEmSc.map((d) => d.municipios ?? 0), 1);
  const [ativo, setAtivo] = useState<NivelDeGestao | null>(null);
  return (
    <div className="edu-acesso-gestao">
      <p className="edu-acesso-eixo">Municípios de SC em cada nível</p>
      <ol className="edu-acesso-niveis" aria-label="Municípios de SC em cada nível">
        {retrato.distribuicaoEmSc.map(({ nivel, municipios }, i) => {
          const deOrleans = nivel === retrato.nivelDeOrleans;
          const abrir = () => setAtivo(nivel);
          const fechar = () => setAtivo((atual) => (atual === nivel ? null : atual));
          const classes = [deOrleans && 'edu-acesso-de-orleans', ativo === nivel && 'is-ativo'].filter(Boolean);
          return (
            <li
              key={nivel}
              className={classes.length ? classes.join(' ') : undefined}
              tabIndex={0}
              onMouseEnter={abrir}
              onMouseLeave={fechar}
              onFocus={abrir}
              onBlur={fechar}
            >
              <span className="edu-acesso-nivel-valor">{contagem(municipios)}</span>
              <span
                className="edu-acesso-nivel-barra"
                aria-hidden="true"
                style={{ height: `${((municipios ?? 0) / maior) * 100}%` }}
              />
              <span className="edu-acesso-nivel-nome">{rotuloDoNivel(i, nivel)}</span>
              {deOrleans && <span className="edu-acesso-nivel-orleans">Orleans</span>}
              {ativo === nivel && (
                <span
                  className={`bpa-dica edu-acesso-nivel-dica${i >= retrato.distribuicaoEmSc.length / 2 ? ' a-esquerda' : ''}`}
                  aria-hidden="true"
                >
                  <strong>{rotuloDoNivel(i, nivel)}</strong>
                  <span className="bpa-dica-valor edu-acesso-nivel-dica-valor">
                    {municipios === null ? 'Sem dado' : `${numero(municipios)} municípios de SC`}
                  </span>
                  {deOrleans && <span className="edu-acesso-nivel-dica-orleans">Orleans está neste nível.</span>}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function BlocoDoRetrato({ bloco }: { bloco: Retrato }) {
  const respostas: readonly [string, string][] = [
    [
      'Pedidos de vaga não atendidos',
      bloco.solicitacoesNaoAtendidas === null
        ? SEM_DADO
        : `“${bloco.solicitacoesNaoAtendidas}”, a Prefeitura informou ao MEC`,
    ],
    [
      'Quantas crianças na lista de espera',
      bloco.quantidadeNaLista === null ? SEM_DADO : numero(bloco.quantidadeNaLista),
    ],
    ['Lista única para todo o município', bloco.listaUnificada ?? SEM_DADO],
    ['Lista divulgada ao público', bloco.listasDivulgadas ?? SEM_DADO],
    ['Critério para chamar', bloco.criteriosDePrioridade ?? SEM_DADO],
    ['Idade em que a creche começa a atender', bloco.idadeInicial ?? SEM_DADO],
    ['Crianças fora da pré-escola por falta de vaga', bloco.foraDaPreEscola ?? SEM_DADO],
  ];
  return (
    <BlocoDoCaderno titulo="Procura por creche" fonte={bloco.fonte} ano={bloco.ano}>
      <p className="edu-acesso-frase">
        Este bloco traz o que a Prefeitura informou ao MEC, e não uma contagem de crianças. O painel não tem outro dado
        sobre fila de espera.
      </p>
      <h3 className="edu-acesso-titulo-niveis">Como o MEC classificou a organização da fila de creche</h3>
      <AberturaDosNiveis retrato={bloco} />
      <div className="edu-acesso-retrato">
        <NiveisDeGestao retrato={bloco} />
        <div className="edu-acesso-base">
          <h4>O que a Prefeitura respondeu</h4>
          <p className="edu-acesso-apoio">Algumas das respostas que entram na classificação.</p>
          <dl className="edu-acesso-respostas">
            {respostas.map(([pergunta, resposta]) => (
              <div key={pergunta}>
                <dt>{pergunta}</dt>
                <dd>{resposta}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <Detalhes>
        <p>A classificação é do MEC; o painel não publica aqui a regra de cada nível.</p>
        <p>
          <a href={bloco.fonte.url}>Retrato da Educação Infantil {bloco.ano}, MEC</a>
        </p>
      </Detalhes>
    </BlocoDoCaderno>
  );
}

function Conteudo({ dados }: { dados: EducacaoAcesso }) {
  return (
    <>
      <p className="edu-acesso-csv">
        <a href="/api/educacao/acesso.csv" className="botao-link">
          Baixar CSV ↓
        </a>
      </p>
      {dados.frequencia && <BlocoDaFrequencia bloco={dados.frequencia} />}
      {dados.matriculas && <BlocoDasMatriculas bloco={dados.matriculas} />}
      <div className="edu-acesso-dupla">
        {dados.matriculas && <BlocoDasEscolas bloco={dados.matriculas} />}
        {dados.outroMunicipio && <BlocoDaOutraCidade bloco={dados.outroMunicipio} />}
      </div>
      {dados.retrato && <BlocoDoRetrato bloco={dados.retrato} />}
    </>
  );
}

export default function Acesso() {
  const { dados, carregando, erro } = useApi('/api/educacao/acesso', educacaoAcessoSchema);
  return (
    <>
      <CabecalhoDoCaderno titulo="Quem está na escola">
        Quantas crianças e jovens frequentam a escola em cada idade, em que rede estão matriculados e como é a procura
        por creche.
      </CabecalhoDoCaderno>
      <Estado carregando={carregando} erro={erro} />
      {dados && !dados.disponivel && <p className="aviso">Os dados desta aba ainda não foram coletados.</p>}
      {dados?.disponivel && <Conteudo dados={dados} />}
    </>
  );
}
