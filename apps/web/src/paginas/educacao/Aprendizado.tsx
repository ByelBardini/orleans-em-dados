// Aba Aprendizado do caderno de Educação: alfabetização, IDEB, nível socioeconômico e ENEM. Um alternador só muda a série
// e os números juntos. A alfabetização fica fora dele: a fonte não abre a mesma rede nos três lugares.
import {
  educacaoAprendizadoSchema,
  type ComparacaoDeEducacao,
  type EducacaoAprendizado,
  type Rede,
} from '@orleans-em-dados/contracts';
import { useState, type ReactNode } from 'react';
import { useApi } from '../../api';
import { Estado, Numero, Numeros } from '../../components';
import { formatarValor, LUGARES, NOMES_DE_ETAPA, NOMES_DE_REDE, rotuloDaRede, type Lugar } from '../../educacao';
import {
  AlternadorDeRede,
  BlocoDoCaderno,
  CabecalhoDoCaderno,
  Comparacao,
  Detalhes,
  Quadros,
  SerieDoIdeb,
  SetasDiante,
  type LinhaDoQuadro,
  type SentidoBom,
} from '../../educacao/componentes';
import { fraseDaSerie } from '../../educacao/serie';
import { numero } from '../../format';
import './Aprendizado.css';

const REDE_INICIAL: Rede = 'publica';
const ESCALA_DO_IDEB = { min: 3, max: 8 };
const ESCALA_DO_INSE = { min: 1, max: 8 };
const ESCALA_DO_ENEM = { min: 400, max: 800 };
// A alfabetização mora entre 50% e 80%: a escala realça a diferença, e o componente escreve que não começa em zero.
const ESCALA_DA_ALFABETIZACAO = { min: 50, max: 80 };
const MEDIA_DO_ENEM = 'enem_media_5_areas';
const CASAS_DO_INSE = 2;
const CASAS_DO_RENDIMENTO = 2;

const NOME_NA_FRASE: Record<Lugar, string> = { orleans: 'Orleans', santaCatarina: 'SC', brasil: 'Brasil' };

const NOME_DA_AREA: Record<string, string> = {
  enem_media_5_areas: 'Média das 5 áreas',
  enem_natureza: 'Ciências da Natureza',
  enem_humanas: 'Ciências Humanas',
  enem_linguagens: 'Linguagens',
  enem_matematica: 'Matemática',
  enem_redacao: 'Redação',
};

const emLista = (itens: readonly string[]) =>
  new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(itens);
const contagem = (valor: number | null) => (valor === null ? '—' : numero(valor));
const nomeDaEtapa = (etapa: string) => NOMES_DE_ETAPA[etapa] ?? etapa;

// Até uma casa, sem zero à direita: a fonte publica 84% e 87,8%. A meta em texto, `> 80`, só ganha o sinal.
function emPorcento(valor: number | string | null) {
  if (valor === null) return '—';
  if (typeof valor === 'string') return `${valor}%`;
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

type Alfabetizacao = NonNullable<EducacaoAprendizado['alfabetizacao']>;

function fraseDaAlfabetizacao({ ano, serie, metas }: Alfabetizacao) {
  const resultado = serie.find((s) => s.ano === ano)?.valores.orleans ?? null;
  if (resultado === null) return null;
  const meta = metas.find((m) => m.ano === ano)?.orleans ?? null;
  const inicio = `Em ${ano}, Orleans teve ${emPorcento(resultado)}`;
  if (typeof meta !== 'number') return `${inicio}.`;
  if (resultado === meta) return `${inicio}, igual à meta de ${emPorcento(meta)} para o ano.`;
  return `${inicio}, ${resultado < meta ? 'abaixo' : 'acima'} da meta de ${emPorcento(meta)} para o ano.`;
}

function BlocoDaAlfabetizacao({ bloco }: { bloco: Alfabetizacao }) {
  const frase = fraseDaAlfabetizacao(bloco);
  const series = LUGARES.map(({ chave }) => ({
    lugar: chave,
    pontos: bloco.serie.map(({ ano, valores }) => ({ ano: Number(ano), valor: valores[chave] })),
  }));
  // Meta em texto (`> 80`) não tem lugar na figura: fica na tabela.
  const metas = bloco.metas.flatMap(({ ano, orleans }) =>
    typeof orleans === 'number' ? [{ ano: Number(ano), valor: orleans }] : [],
  );
  const redes = LUGARES.flatMap(({ chave, nome }) => {
    const rede = bloco.redes[chave];
    return rede ? [`${nome === 'Orleans' ? `${nome} é` : `${nome},`} ${rotuloDaRede(rede)}`] : [];
  });
  const participacao = LUGARES.map(
    ({ chave }) => `${NOME_NA_FRASE[chave]} ${emPorcento(bloco.participacao[chave])}`,
  ).join(', ');
  const doAno = bloco.serie.find((s) => s.ano === bloco.ano)?.valores;
  return (
    <BlocoDoCaderno titulo="Alfabetização no 2º ano" fonte={bloco.fonte} ano={bloco.ano}>
      <p className="edu-aprendizado-frase">Quantos alunos chegam ao fim do 2º ano sabendo ler e escrever.</p>
      {frase && <p className="edu-aprendizado-frase">{frase}</p>}
      <div className="edu-aprendizado-diante">
        {doAno && <SetasDiante {...doAno} unidade="%" sentidoBom="maior" />}
        <Detalhes>
          <p>
            Os três números não são da mesma rede: {redes.join('; ')}. A meta de cada lugar vale para a rede dele, e a
            comparação não é rede com rede.
          </p>
          <p>
            Participação na avaliação em {bloco.ano}: {participacao}.
          </p>
        </Detalhes>
      </div>
      <div className="edu-aprendizado-dupla">
        <div className="edu-aprendizado-figura">
          <SerieDoIdeb
            series={series}
            meta={{ rotulo: 'Meta de Orleans', pontos: metas }}
            descricao="Alfabetização, ano a ano, em percentual"
            escala={ESCALA_DA_ALFABETIZACAO}
            unidade="%"
            casas={0}
          />
          <p className="edu-aprendizado-apoio">O anel tracejado é a meta de Orleans para o ano.</p>
        </div>
        <div className="edu-aprendizado-metas">
          <Quadros
            rotulo="Alfabetização no 2º ano"
            colunas={COLUNAS_DOS_LUGARES}
            grupos={[
              {
                titulo: 'Metas por ano',
                linhas: bloco.metas.map((meta) => ({
                  nome: meta.ano,
                  celulas: LUGARES.map((l) => emPorcento(meta[l.chave])),
                })),
              },
            ]}
          />
        </div>
      </div>
    </BlocoDoCaderno>
  );
}

type Ideb = NonNullable<EducacaoAprendizado['ideb']>;
type EtapaDoIdeb = Ideb['etapas'][number];
type Pontos = NonNullable<EtapaDoIdeb['series'][Rede]>[Lugar];

const nomeNaDescricao = (etapa: string) =>
  etapa === 'medio' ? 'do ensino médio' : `dos ${nomeDaEtapa(etapa).toLowerCase()}`;
const comValor = (pontos: Pontos) => pontos.some((p) => p.valor !== null);

function SerieDaEtapa({ etapa, rede }: { etapa: EtapaDoIdeb; rede: Rede }) {
  const nome = nomeDaEtapa(etapa.etapa);
  const series = etapa.series[rede];
  if (!series) return <p className="edu-aprendizado-apoio">{nome}: sem dado nesta rede.</p>;

  const frase = fraseDaSerie(series.orleans);
  const lacunas = comValor(series.orleans)
    ? series.orleans.filter((p) => p.valor === null).map((p) => String(p.ano))
    : [];
  const desenhadas = LUGARES.flatMap(({ chave }) =>
    comValor(series[chave]) ? [{ lugar: chave, pontos: series[chave] }] : [],
  );
  const estadualNoLugarDaPublica = etapa.etapa === 'medio' && rede === 'publica' && comValor(series.santaCatarina);
  return (
    <div className="edu-aprendizado-etapa">
      <h3>{nome}</h3>
      <p className="edu-aprendizado-frase-etapa">
        {frase ? `${nome}, ${rotuloDaRede(rede)}: ${frase}` : `${nome}: Orleans não tem IDEB nesta rede.`}
      </p>
      <SerieDoIdeb
        series={desenhadas}
        descricao={`IDEB ${nomeNaDescricao(etapa.etapa)}, ${rotuloDaRede(rede)}`}
        escala={ESCALA_DO_IDEB}
      />
      {lacunas.length > 0 && (
        <p className="edu-aprendizado-apoio">Orleans sem dado em {emLista(lacunas)}: a linha fica interrompida.</p>
      )}
      {estadualNoLugarDaPublica && (
        <p className="edu-aprendizado-apoio">
          Em SC, a rede pública do ensino médio é a linha estadual: a fonte não publica a pública.
        </p>
      )}
    </div>
  );
}

type Parcela = Ideb['parcelas'][number];

// As cinco medidas de uma parcela do IDEB, na ordem da fonte. `sentido` só onde mais é melhor sem discussão: o
// rendimento sai da aprovação, e a seta dela já diz.
const MEDIDAS: readonly {
  nome: string;
  valor: (p: Parcela) => number | null;
  texto: (valor: number | null) => string;
  unidade: '%' | 'indice' | 'nota';
  sentido?: SentidoBom;
}[] = [
  { nome: 'IDEB', valor: (p) => p.ideb, texto: (v) => formatarValor(v, 'indice'), unidade: 'indice', sentido: 'maior' },
  {
    nome: 'Rendimento',
    valor: (p) => p.rendimento,
    texto: (v) => formatarValor(v, 'indice', CASAS_DO_RENDIMENTO),
    unidade: 'indice',
  },
  { nome: 'Aprovação', valor: (p) => p.aprovacao, texto: (v) => formatarValor(v, '%'), unidade: '%', sentido: 'maior' },
  {
    nome: 'Matemática',
    valor: (p) => p.matematica,
    texto: (v) => formatarValor(v, 'nota'),
    unidade: 'nota',
    sentido: 'maior',
  },
  {
    nome: 'Português',
    valor: (p) => p.portugues,
    texto: (v) => formatarValor(v, 'nota'),
    unidade: 'nota',
    sentido: 'maior',
  },
];

const COLUNAS_DOS_LUGARES = LUGARES.map((l) => ({ nome: l.curto, destaque: l.chave === 'orleans' }));
const etapasDe = (linhas: readonly Parcela[]) => [...new Set(linhas.map((l) => l.etapa))];

// Um quadro por etapa, uma linha por medida, Orleans × SC × Brasil na mesma rede; a seta fica embaixo do nome.
function QuadrosDaRede({ rotulo, linhas }: { rotulo: string; linhas: readonly Parcela[] }) {
  const grupos = etapasDe(linhas).map((etapa) => {
    const doLugar = (lugar: Lugar) => linhas.find((l) => l.etapa === etapa && l.lugar === lugar);
    return {
      titulo: nomeDaEtapa(etapa),
      linhas: MEDIDAS.map(({ nome, valor, texto, unidade, sentido }): LinhaDoQuadro => {
        const de = (lugar: Lugar) => {
          const parcela = doLugar(lugar);
          return parcela ? valor(parcela) : null;
        };
        const apoio: ReactNode = sentido && (
          <SetasDiante
            orleans={de('orleans')}
            santaCatarina={de('santaCatarina')}
            brasil={de('brasil')}
            unidade={unidade}
            sentidoBom={sentido}
          />
        );
        return { nome, apoio, celulas: LUGARES.map((l) => texto(de(l.chave))) };
      }),
    };
  });
  return <Quadros rotulo={rotulo} colunas={COLUNAS_DOS_LUGARES} grupos={grupos} />;
}

// Só Orleans: um quadro por etapa, uma coluna por rede que Orleans tem nela. Rede com rede, sem seta.
// Sem a rede municipal, a pública da etapa é só a estadual: os dois números coincidem, e a tela diz por quê.
function notaDaEtapa(daEtapa: readonly Parcela[]) {
  if (daEtapa.some((l) => l.rede === 'municipal')) return undefined;
  const temAsDuas = daEtapa.some((l) => l.rede === 'publica') && daEtapa.some((l) => l.rede === 'estadual');
  return `Sem IDEB da rede municipal nesta etapa.${temAsDuas ? ' Aqui, a rede pública é só a estadual.' : ''}`;
}

function QuadrosDeOrleans({ rotulo, linhas }: { rotulo: string; linhas: readonly Parcela[] }) {
  const etapas = etapasDe(linhas);
  return (
    <div className="edu-aprendizado-por-rede">
      {etapas.map((etapa) => {
        const daEtapa = linhas.filter((l) => l.etapa === etapa);
        return (
          <Quadros
            key={etapa}
            rotulo={rotulo}
            colunas={daEtapa.map((l) => ({ nome: NOMES_DE_REDE[l.rede] }))}
            grupos={[
              {
                titulo: nomeDaEtapa(etapa),
                nota: notaDaEtapa(daEtapa),
                linhas: MEDIDAS.map(({ nome, valor, texto }) => ({
                  nome,
                  celulas: daEtapa.map((l) => texto(valor(l))),
                })),
              },
            ]}
          />
        );
      })}
    </div>
  );
}

function BlocoDoIdeb({ bloco, rede }: { bloco: Ideb; rede: Rede }) {
  const deOrleans = bloco.parcelas.filter((p) => p.lugar === 'orleans');
  const naRede = bloco.parcelas.filter((p) => p.rede === rede);
  return (
    <BlocoDoCaderno
      titulo="IDEB"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota={
        <>
          <p>Fonte única: o IBGE republica o INEP, e os dois não contam como conferência.</p>
          <Detalhes>
            <p>Rendimento vai de 0 a 1 e sai da aprovação; matemática e português são as notas da prova.</p>
            {bloco.fonteDoInep && (
              <p>
                O Brasil, a aprovação e as notas vêm de{' '}
                <a href={bloco.fonteDoInep.url} target="_blank" rel="noreferrer">
                  {bloco.fonteDoInep.nome}
                </a>
                .
              </p>
            )}
          </Detalhes>
        </>
      }
    >
      <p className="edu-aprendizado-frase">
        O IDEB junta a nota da prova e a aprovação, numa escala de 0 a 10. A tabela separa as duas partes.
      </p>
      <div className="edu-aprendizado-series">
        {bloco.etapas.map((etapa) => (
          <SerieDaEtapa key={etapa.etapa} etapa={etapa} rede={rede} />
        ))}
      </div>
      {naRede.length > 0 && (
        <>
          <h3 className="edu-aprendizado-subtitulo">
            Orleans, SC e Brasil, {rotuloDaRede(rede)}, em {bloco.ano}
          </h3>
          <p className="edu-aprendizado-frase">
            Os três lugares na mesma rede, para comparar Orleans com SC e o Brasil.
          </p>
          <QuadrosDaRede rotulo={`Prova e aprovação, ${rotuloDaRede(rede)}, ${bloco.ano}`} linhas={naRede} />
        </>
      )}
      {deOrleans.length > 0 && (
        <>
          <h3 className="edu-aprendizado-subtitulo">Só Orleans, rede por rede, em {bloco.ano}</h3>
          <p className="edu-aprendizado-frase">
            Sem SC nem Brasil: aqui a rede pública de Orleans se abre em municipal (Prefeitura) e estadual (Estado), e a
            pública junta as duas.
          </p>
          <QuadrosDeOrleans rotulo={`IDEB de Orleans por rede, ${bloco.ano}`} linhas={deOrleans} />
        </>
      )}
    </BlocoDoCaderno>
  );
}

function BlocoDoInse({ bloco, rede }: { bloco: NonNullable<EducacaoAprendizado['inse']>; rede: Rede }) {
  return (
    <BlocoDoCaderno
      titulo="Nível socioeconômico dos alunos"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota={`O dado mais recente é de ${bloco.ano}, e não do mesmo ano do IDEB. É a média dos alunos que fizeram a prova, nos níveis de 1 a 8 do INEP.`}
    >
      <div className="edu-aprendizado-estreito">
        <Comparacao
          comparacao={bloco.comparacao}
          rede={rede}
          rotulo="Nível socioeconômico"
          escala={ESCALA_DO_INSE}
          casas={CASAS_DO_INSE}
        />
      </div>
    </BlocoDoCaderno>
  );
}

type Enem = NonNullable<EducacaoAprendizado['enem']>;

function QuemFezAProva({ bloco, rede }: { bloco: Enem; rede: Rede }) {
  const linhaDe = (ano: string) => bloco.anos.find((a) => a.ano === ano)?.redes.find((r) => r.rede === rede);
  const atual = linhaDe(bloco.ano);
  const anterior = bloco.anos.filter((a) => a.ano !== bloco.ano).at(-1)?.ano;
  const antes = anterior ? linhaDe(anterior) : undefined;
  const noAnoAnterior = (texto: string | undefined) => (texto ? `${texto} em ${anterior}` : undefined);
  if (!atual) return <p className="edu-aprendizado-apoio">Rede sem número publicado em Orleans em {bloco.ano}.</p>;
  return (
    <Numeros rotulo={`Quem fez a prova, ${rotuloDaRede(rede)}`}>
      <Numero rotulo={`Inscritos em ${bloco.ano}`} detalhe={noAnoAnterior(antes && contagem(antes.inscritos))}>
        {contagem(atual.inscritos)}
      </Numero>
      <Numero
        rotulo={`Presentes nas quatro provas em ${bloco.ano}`}
        detalhe={noAnoAnterior(antes && contagem(antes.presentes))}
      >
        {contagem(atual.presentes)}
      </Numero>
      <Numero
        rotulo="Presentes ÷ matrículas da 3ª série"
        detalhe={noAnoAnterior(antes && emPorcento(antes.presentesSobreTerceiraSerie))}
      >
        {emPorcento(atual.presentesSobreTerceiraSerie)}
      </Numero>
    </Numeros>
  );
}

// Um quadro por ano, o mais recente primeiro; só o essencial: quantos se inscreveram, quantos foram e a 3ª série.
const COLUNAS_DO_ENEM = [
  { nome: 'Inscritos' },
  { nome: 'Presentes' },
  { nome: '3ª série' },
  { nome: 'Presentes ÷ 3ª série' },
];

function QuadrosDoEnem({ bloco }: { bloco: Enem }) {
  return (
    <Quadros
      rotulo="Quem fez a prova"
      colunas={COLUNAS_DO_ENEM}
      grupos={[...bloco.anos].reverse().map(({ ano, redes }) => ({
        titulo: ano,
        linhas: redes.map((l) => ({
          nome: NOMES_DE_REDE[l.rede],
          celulas: [
            contagem(l.inscritos),
            contagem(l.presentes),
            contagem(l.terceiraSerie),
            emPorcento(l.presentesSobreTerceiraSerie),
          ],
        })),
      }))}
    />
  );
}

function BlocoDoEnem({ bloco, rede }: { bloco: Enem; rede: Rede }) {
  const ultimo = bloco.anos.find((a) => a.ano === bloco.ano);
  // A média das cinco áreas abre a lista; as áreas seguem na ordem da fonte.
  const comparacoes = ultimo
    ? [
        ...ultimo.comparacoes.filter((c) => c.indicador === MEDIA_DO_ENEM),
        ...ultimo.comparacoes.filter((c) => c.indicador !== MEDIA_DO_ENEM),
      ]
    : [];
  return (
    <BlocoDoCaderno
      titulo="ENEM"
      fonte={bloco.fonte}
      ano={bloco.anos.map((a) => a.ano).join(' e ')}
      nota={
        <>
          <p>
            Nada é mostrado por escola: rede com menos de 2 escolas não é publicada, porque seria a nota de uma escola.
          </p>
          <Detalhes>
            <p>A rede é a da escola em que o aluno conclui o ensino médio.</p>
            {bloco.fonteDaTerceiraSerie && (
              <p>
                A 3ª série vem de{' '}
                <a href={bloco.fonteDaTerceiraSerie.url} target="_blank" rel="noreferrer">
                  {bloco.fonteDaTerceiraSerie.nome}
                </a>
                , da mesma rede e do mesmo ano.
              </p>
            )}
          </Detalhes>
        </>
      }
    >
      <p className="edu-aprendizado-frase">
        A prova é voluntária: quem faz não representa todos os alunos. Não existe dado por morador.
      </p>
      <QuemFezAProva bloco={bloco} rede={rede} />
      {ultimo && (
        <>
          <h3 className="edu-aprendizado-subtitulo">
            Média das notas em {ultimo.ano}, {rotuloDaRede(rede)}
          </h3>
          <div className="edu-aprendizado-notas">
            {comparacoes.map((comparacao) => (
              <Comparacao
                key={comparacao.indicador}
                comparacao={comparacao}
                rede={rede}
                rotulo={NOME_DA_AREA[comparacao.indicador] ?? comparacao.indicador}
                escala={ESCALA_DO_ENEM}
                semAvisoDeEscala
                sentidoBom="maior"
              />
            ))}
          </div>
          <p className="edu-escala">
            A escala vai de {ESCALA_DO_ENEM.min} a {ESCALA_DO_ENEM.max}: não começa em zero.
          </p>
        </>
      )}
      <h3 className="edu-aprendizado-subtitulo">Quem fez a prova, por ano e rede</h3>
      <QuadrosDoEnem bloco={bloco} />
    </BlocoDoCaderno>
  );
}

function comparacoesDoAlternador({ ideb, inse, enem }: EducacaoAprendizado): ComparacaoDeEducacao[] {
  return [
    ...(ideb?.etapas.map((e) => e.comparacao) ?? []),
    ...(inse ? [inse.comparacao] : []),
    ...(enem?.anos.find((a) => a.ano === enem.ano)?.comparacoes ?? []),
  ];
}

function Conteudo({ dados }: { dados: EducacaoAprendizado }) {
  const [rede, setRede] = useState<Rede>(REDE_INICIAL);
  const comparacoes = comparacoesDoAlternador(dados);
  return (
    <>
      <p className="edu-aprendizado-csv">
        <a href="/api/educacao/aprendizado.csv" className="botao-link">
          Baixar CSV ↓
        </a>
      </p>
      {dados.alfabetizacao && <BlocoDaAlfabetizacao bloco={dados.alfabetizacao} />}
      {comparacoes.length > 0 && (
        <div className="edu-aprendizado-alternador">
          <AlternadorDeRede comparacoes={comparacoes} valor={rede} aoMudar={setRede} />
          <p className="edu-aprendizado-apoio">A rede escolhida vale para o IDEB, o nível socioeconômico e o ENEM.</p>
        </div>
      )}
      {dados.ideb && <BlocoDoIdeb bloco={dados.ideb} rede={rede} />}
      {dados.inse && <BlocoDoInse bloco={dados.inse} rede={rede} />}
      {dados.enem && <BlocoDoEnem bloco={dados.enem} rede={rede} />}
    </>
  );
}

export default function Aprendizado() {
  const { dados, carregando, erro } = useApi('/api/educacao/aprendizado', educacaoAprendizadoSchema);
  return (
    <>
      <CabecalhoDoCaderno titulo="O que os alunos estão aprendendo">
        Alfabetização no 2º ano, IDEB e ENEM. Cada bloco diz qual rede compara, e o alternador troca a rede do IDEB e do
        ENEM.
      </CabecalhoDoCaderno>
      <Estado carregando={carregando} erro={erro} />
      {dados && !dados.disponivel && <p className="aviso">Os dados desta aba ainda não foram coletados.</p>}
      {dados?.disponivel && <Conteudo dados={dados} />}
    </>
  );
}
