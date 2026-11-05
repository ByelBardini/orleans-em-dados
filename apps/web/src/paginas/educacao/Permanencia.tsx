// Aba Permanência do caderno de Educação: como termina o ano, por rede. Um alternador só muda todos os blocos juntos.
// Etapa em que Orleans não tem dado na rede sai sem linha: sem zero, e sem SC e Brasil sozinhos.
import {
  educacaoPermanenciaSchema,
  type ComparacaoDeEducacao,
  type EducacaoPermanencia,
  type Rede,
} from '@orleans-em-dados/contracts';
import { useState, type CSSProperties } from 'react';
import { useApi } from '../../api';
import { Estado } from '../../components';
import {
  cercaDe,
  escalaDaComparacao,
  formatarValor,
  NOMES_DE_ETAPA,
  redesComDado,
  rotuloDaRede,
  type Escala,
} from '../../educacao';
import {
  AlternadorDeRede,
  BarrasEmpilhadas,
  BlocoDoCaderno,
  CabecalhoDoCaderno,
  Comparacao,
  Detalhes,
  SetasDiante,
  type SentidoBom,
} from '../../educacao/componentes';
import './Permanencia.css';

type Rendimento = NonNullable<EducacaoPermanencia['rendimento']>;
type Series = NonNullable<EducacaoPermanencia['series']>;
type Serie = Series['series'][number];
type PorEtapa = NonNullable<EducacaoPermanencia['distorcao']>;

const DE_ORLEANS_NA_ETAPA: Record<string, string> = {
  anos_iniciais: 'nos anos iniciais',
  anos_finais: 'nos anos finais',
  medio: 'no ensino médio',
};
const SEM_DADO_DE_ORLEANS = 'Sem dado de Orleans nesta rede.';
const CARTOES = 3;
const REDES: readonly Rede[] = ['publica', 'municipal', 'estadual', 'privada', 'todas'];

const emPercentual = (valor: number | null) => formatarValor(valor, '%');
const naRede = (rede: Rede) => (rede === 'todas' ? 'em todas as redes' : `na ${rotuloDaRede(rede)}`);
const emMaiuscula = (texto: string) => `${texto[0]?.toUpperCase()}${texto.slice(1)}`;
const noEixo = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const deOrleans = (comparacao: ComparacaoDeEducacao, rede: Rede) => comparacao.porRede[rede]?.orleans ?? null;
const comOrleans = (comparacoes: readonly ComparacaoDeEducacao[], rede: Rede) =>
  comparacoes.filter((c) => deOrleans(c, rede) !== null);
// A transição é `2021-2022` na API; na tela, com o traço de intervalo.
const comTraco = (ano: string) => ano.replace('-', '–');
const nomeDaSerie = (etapa: string) => {
  const nome = NOMES_DE_ETAPA[etapa] ?? etapa;
  return etapa.startsWith('serie_') ? `${nome} do médio` : nome;
};

/** Todas as linhas de um bloco na mesma escala, e o eixo não pula quando o alternador troca. */
const escalaDoBloco = (comparacoes: readonly ComparacaoDeEducacao[], base: Escala) =>
  comparacoes.reduce((escala, c) => escalaDaComparacao(c, escala), base);

function fraseDaAprovacao({ ano, etapas }: Rendimento, rede: Rede) {
  const presentes = etapas.flatMap(({ etapa, aprovacao }) => {
    const valor = deOrleans(aprovacao, rede);
    return valor === null ? [] : [{ etapa, valor }];
  });
  const [menor, ...resto] = [...presentes].sort((a, b) => a.valor - b.valor);
  const maior = resto.at(-1) ?? menor;
  if (!menor || !maior) return null;
  const inicio = `${emMaiuscula(naRede(rede))}, em ${ano}, a aprovação em Orleans`;
  const nome = (etapa: string) => DE_ORLEANS_NA_ETAPA[etapa] ?? etapa;
  if (menor.valor !== maior.valor) {
    return `${inicio} vai de ${emPercentual(menor.valor)} ${nome(menor.etapa)} a ${emPercentual(maior.valor)} ${nome(maior.etapa)}.`;
  }
  return presentes.length === 1
    ? `${inicio} é de ${emPercentual(menor.valor)} ${nome(menor.etapa)}.`
    : `${inicio} é de ${emPercentual(menor.valor)} nas ${presentes.length} etapas.`;
}

function BlocoDoRendimento({ bloco, rede }: { bloco: Rendimento; rede: Rede }) {
  const etapas = bloco.etapas.filter((e) =>
    [e.aprovacao, e.reprovacao, e.abandono].some((c) => deOrleans(c, rede) !== null),
  );
  const frase = fraseDaAprovacao(bloco, rede);
  return (
    <BlocoDoCaderno titulo="Como termina o ano letivo" fonte={bloco.fonte} ano={bloco.ano}>
      {frase && <p className="edu-permanencia-frase">{frase}</p>}
      {etapas.length ? (
        <div className="edu-permanencia-rendimento">
          <BarrasEmpilhadas
            descricao={`Como termina o ano em Orleans, ${rotuloDaRede(rede)}, ${bloco.ano}`}
            linhas={etapas.map((e) => {
              const valores = e.aprovacao.porRede[rede];
              return {
                rotulo: NOMES_DE_ETAPA[e.etapa] ?? e.etapa,
                partes: [
                  { nome: 'Aprovados', valor: deOrleans(e.aprovacao, rede) },
                  { nome: 'Reprovados', valor: deOrleans(e.reprovacao, rede) },
                  { nome: 'Abandono', valor: deOrleans(e.abandono, rede) },
                ],
                // A comparação da etapa vai embaixo da barra dela, numa linha só, depois dos valores.
                apoio: (
                  <>
                    <span>
                      Aprovação em SC {emPercentual(valores?.santaCatarina ?? null)} · Brasil{' '}
                      {emPercentual(valores?.brasil ?? null)}.
                    </span>
                    {valores && <SetasDiante {...valores} unidade="%" sentidoBom="maior" />}
                  </>
                ),
              };
            })}
          />
        </div>
      ) : (
        <p className="edu-sem-dado">{SEM_DADO_DE_ORLEANS}</p>
      )}
    </BlocoDoCaderno>
  );
}

const DEFINICOES: readonly [string, string][] = [
  ['Aprovação', 'o aluno termina o ano e passa para a série seguinte'],
  ['Reprovação', 'o aluno termina o ano, mas não passa'],
  ['Abandono', 'o aluno sai da escola durante o ano'],
  ['Evasão', 'o aluno não se matricula no ano seguinte'],
  ['Distorção idade-série', 'o aluno está 2 anos ou mais atrasado para a série'],
];

function BlocoDasDefinicoes() {
  return (
    <BlocoDoCaderno titulo="O que cada palavra quer dizer" selo={null}>
      <dl className="edu-permanencia-definicoes">
        {DEFINICOES.map(([palavra, definicao]) => (
          <div key={palavra}>
            <dt>{palavra}</dt>
            <dd>{definicao}</dd>
          </div>
        ))}
      </dl>
    </BlocoDoCaderno>
  );
}

// Todas as linhas desta aba são de taxas em que menos é melhor (abandono, reprovação, distorção, evasão).
function Linhas({
  comparacoes,
  rede,
  escala,
  sentidoBom = 'menor',
}: {
  comparacoes: readonly ComparacaoDeEducacao[];
  rede: Rede;
  escala: Escala;
  sentidoBom?: SentidoBom;
}) {
  const presentes = comOrleans(comparacoes, rede);
  if (!presentes.length) return <p className="edu-sem-dado">{SEM_DADO_DE_ORLEANS}</p>;
  return (
    <div className="edu-permanencia-linhas">
      {presentes.map((c) => (
        <Comparacao
          key={c.etapa}
          comparacao={{ ...c, ano: comTraco(c.ano) }}
          rede={rede}
          escala={escala}
          sentidoBom={sentidoBom}
        />
      ))}
    </div>
  );
}

function BlocoDaComparacao({ bloco, rede }: { bloco: Rendimento; rede: Rede }) {
  const abandono = bloco.etapas.map((e) => e.abandono);
  const reprovacao = bloco.etapas.map((e) => e.reprovacao);
  const escala = escalaDoBloco([...abandono, ...reprovacao], { min: 0, max: 10 });
  const grupos = [
    ['Abandono', abandono],
    ['Reprovação', reprovacao],
  ] as const;
  return (
    <BlocoDoCaderno
      titulo="Abandono e reprovação, comparados"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota={`Escala de 0 a ${noEixo(escala.max)}%.`}
    >
      <div className="edu-permanencia-dupla">
        {grupos.map(([nome, comparacoes]) => (
          <div key={nome} role="group" aria-label={nome}>
            <h3 className="edu-permanencia-subtitulo">{nome}</h3>
            <Linhas comparacoes={comparacoes} rede={rede} escala={escala} />
          </div>
        ))}
      </div>
    </BlocoDoCaderno>
  );
}

/** As séries de maior taxa em Orleans. Taxa zero fica de fora, e sem matrícula não há o que estimar. */
function maioresTaxas(series: readonly Serie[], rede: Rede, indicador: 'reprovacao' | 'abandono') {
  return series
    .flatMap((serie) => {
      const taxa = deOrleans(serie[indicador], rede);
      const estimativa = cercaDe(taxa, serie.matriculas[rede]);
      return taxa && estimativa ? [{ serie, taxa, estimativa }] : [];
    })
    .sort((a, b) => b.taxa - a.taxa);
}

function BlocoDasSeries({ bloco, rede }: { bloco: Series; rede: Rede }) {
  // As maiores reprovações e, no mesmo formato e na mesma grade, o maior abandono.
  const [maiorAbandono] = maioresTaxas(bloco.series, rede, 'abandono');
  const cartoes = [
    ...maioresTaxas(bloco.series, rede, 'reprovacao')
      .slice(0, CARTOES)
      .map((c) => ({ ...c, indicador: 'reprovacao' as const })),
    ...(maiorAbandono ? [{ ...maiorAbandono, indicador: 'abandono' as const }] : []),
  ];
  return (
    <BlocoDoCaderno titulo="Onde os números pesam mais" fonte={bloco.fonte} ano={bloco.ano}>
      <p className="edu-permanencia-frase">
        São poucos alunos e um ano só: os números não indicam tendência.{' '}
        <Detalhes>
          Algumas séries têm percentuais altos, mas um ano diferente pode mudar bastante esses números. Conta
          aproximada: taxa do INEP × matrículas da série e da rede, da{' '}
          <a href={bloco.fonteDasMatriculas.url} target="_blank" rel="noreferrer">
            {bloco.fonteDasMatriculas.nome}
          </a>
          . Abaixo de 5 alunos, o painel escreve &quot;menos de 5&quot;.
        </Detalhes>
      </p>
      {cartoes.length ? (
        <ul
          className="edu-permanencia-cartoes"
          aria-label={`As séries que mais pesam, ${rotuloDaRede(rede)}`}
          style={{ '--edu-permanencia-colunas': Math.min(cartoes.length, 4) } as CSSProperties}
        >
          {cartoes.map(({ indicador, serie, taxa, estimativa }) => {
            const valores = serie[indicador].porRede[rede];
            return (
              <li key={`${indicador}-${serie.etapa}`}>
                <span className="edu-permanencia-onde">
                  {rotuloDaRede(rede)} · {nomeDaSerie(serie.etapa)}
                  {indicador === 'abandono' && ' · abandono'}
                </span>
                <span className="edu-permanencia-quantos">{estimativa} alunos</span>
                <span className="edu-permanencia-taxa">
                  {indicador === 'abandono' ? 'abandonaram a escola' : 'foram reprovados'} em {bloco.ano} (
                  <strong>{emPercentual(taxa)}</strong>).
                </span>{' '}
                <span className="edu-permanencia-outros-lugares">
                  SC {emPercentual(valores?.santaCatarina ?? null)} · Brasil {emPercentual(valores?.brasil ?? null)}.
                </span>
                {valores && <SetasDiante {...valores} unidade="%" sentidoBom="menor" />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="edu-sem-dado">Sem estimativa de alunos nesta rede em {bloco.ano}.</p>
      )}
    </BlocoDoCaderno>
  );
}

function BlocoDaDistorcao({ bloco, rede }: { bloco: PorEtapa; rede: Rede }) {
  const escala = escalaDoBloco(bloco.etapas, { min: 0, max: 25 });
  return (
    <BlocoDoCaderno
      titulo="Alunos 2 anos ou mais atrasados"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota={`Distorção idade-série. Escala de 0 a ${noEixo(escala.max)}%.`}
    >
      <Linhas comparacoes={bloco.etapas} rede={rede} escala={escala} />
    </BlocoDoCaderno>
  );
}

function AvisoDaEvasao({ bloco, rede }: { bloco: PorEtapa; rede: Rede }) {
  const redes = REDES.filter((r) => comOrleans(bloco.etapas, r).length > 0).map(naRede);
  const onde = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(redes);
  return (
    <p className="aviso">
      O painel não tem a evasão de Orleans {naRede(rede)}
      {redes.length ? `; tem ${onde}.` : '.'}
    </p>
  );
}

function BlocoDaEvasao({ bloco, rede }: { bloco: PorEtapa; rede: Rede }) {
  const [saida, chegada] = bloco.ano.split('-');
  const escala = escalaDoBloco(bloco.etapas, { min: 0, max: 15 });
  return (
    <BlocoDoCaderno
      titulo="Não voltaram no ano seguinte"
      fonte={bloco.fonte}
      ano={comTraco(bloco.ano)}
      nota={
        <>
          Evasão. Escala de 0 a {noEixo(escala.max)}%.{' '}
          <Detalhes>
            De {saida} para {chegada}, o dado mais recente do INEP: é de outro período que os demais blocos.
          </Detalhes>
        </>
      }
    >
      {comOrleans(bloco.etapas, rede).length ? (
        <Linhas comparacoes={bloco.etapas} rede={rede} escala={escala} />
      ) : (
        <AvisoDaEvasao bloco={bloco} rede={rede} />
      )}
    </BlocoDoCaderno>
  );
}

function comparacoesDaAba({ rendimento, series, distorcao, evasao }: EducacaoPermanencia) {
  return [
    ...(rendimento?.etapas.flatMap((e) => [e.aprovacao, e.reprovacao, e.abandono]) ?? []),
    ...(series?.series.flatMap((s) => [s.reprovacao, s.abandono]) ?? []),
    ...(distorcao?.etapas ?? []),
    ...(evasao?.etapas ?? []),
  ];
}

function Conteudo({ dados }: { dados: EducacaoPermanencia }) {
  const [escolhida, setEscolhida] = useState<Rede>('publica');
  const comparacoes = comparacoesDaAba(dados);
  const comDado = redesComDado(comparacoes);
  const rede = comDado.includes(escolhida) ? escolhida : (comDado[0] ?? escolhida);
  return (
    <>
      <p className="edu-permanencia-csv">
        <a href="/api/educacao/permanencia.csv" className="botao-link">
          Baixar CSV ↓
        </a>
      </p>
      <div className="edu-permanencia-alternador">
        <AlternadorDeRede comparacoes={comparacoes} valor={rede} aoMudar={setEscolhida} />
        <p>
          {rede === 'todas'
            ? 'Todas as redes juntas: a média muda com o peso de cada rede.'
            : `Esta página compara rede com rede onde a fonte abre a rede: Orleans, Santa Catarina e o Brasil ${naRede(rede)}.`}
        </p>
      </div>
      <BlocoDasDefinicoes />
      {dados.rendimento && <BlocoDoRendimento bloco={dados.rendimento} rede={rede} />}
      {dados.rendimento && <BlocoDaComparacao bloco={dados.rendimento} rede={rede} />}
      {dados.series && <BlocoDasSeries bloco={dados.series} rede={rede} />}
      <div className="edu-permanencia-dupla">
        {dados.distorcao && <BlocoDaDistorcao bloco={dados.distorcao} rede={rede} />}
        {dados.evasao && <BlocoDaEvasao bloco={dados.evasao} rede={rede} />}
      </div>
    </>
  );
}

export default function Permanencia() {
  const { dados, carregando, erro } = useApi('/api/educacao/permanencia', educacaoPermanenciaSchema);
  return (
    <>
      <CabecalhoDoCaderno titulo="Quem fica na escola até o fim">
        Como termina o ano letivo em cada rede, quantos alunos estão atrasados para a série e quantos não voltam no ano
        seguinte.
      </CabecalhoDoCaderno>
      <Estado carregando={carregando} erro={erro} />
      {dados && !dados.disponivel && <p className="aviso">Os dados desta aba ainda não foram coletados.</p>}
      {dados?.disponivel && <Conteudo dados={dados} />}
    </>
  );
}
