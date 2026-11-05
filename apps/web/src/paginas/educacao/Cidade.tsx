// Aba Cidade e ensino superior do caderno de Educação: dois assuntos, e o título diz isso. Os moradores vêm do Censo de
// 2022, e a oferta, do INEP de 2024: públicos e anos diferentes, sempre lado a lado e nunca somados.
import {
  educacaoCidadeSchema,
  type ComparacaoDeEducacao,
  type EducacaoCidade,
  type NivelDeInstrucao,
} from '@orleans-em-dados/contracts';
import { useState } from 'react';
import { useApi } from '../../api';
import { Estado } from '../../components';
import {
  BarrasEmpilhadas,
  BlocoDoCaderno,
  CabecalhoDoCaderno,
  Comparacao,
  Detalhes,
  Quadros,
  SetasDiante,
  type SentidoBom,
} from '../../educacao/componentes';
import { formatarValor, LUGARES, posicaoNaEscala } from '../../educacao';
import { numero } from '../../format';
import './Cidade.css';

type Alfabetizacao = NonNullable<EducacaoCidade['alfabetizacao']>;
type Escolaridade = NonNullable<EducacaoCidade['escolaridade']>;
type Moradores = NonNullable<EducacaoCidade['moradores']>;
type Oferta = NonNullable<EducacaoCidade['oferta']>;
type Igc = NonNullable<EducacaoCidade['igc']>;
type Cursos = NonNullable<EducacaoCidade['cursos']>;

const CASAS_DO_CENSO = 2;
const ESCALA_DOS_ANOS = { min: 0, max: 14 };
const FAIXAS_DO_IGC = [1, 2, 3, 4, 5];

/** Número com ponto de milhar; `menos de 5` como a fonte grava; sem dado, travessão. */
const contar = (valor: number | string | null) => {
  if (valor === null) return '—';
  return typeof valor === 'number' ? numero(valor) : valor;
};
const emPct = (valor: number | null) => formatarValor(valor, '%');

type ItemDaBarra = {
  rotulo: string;
  valor: number | null;
  /** O valor como fica escrito: "88,0%", "230 matrículas", "menos de 5 matrículas". */
  texto: string;
  /** Linha à vista, debaixo do rótulo. */
  apoio?: string;
  /** Números do item, um por bloco, abaixo da barra: entraram, formaram, o corte. */
  numeros?: readonly string[];
  /** Linha a mais, só na dica. */
  detalhe?: string;
  /** Orleans (o ponto, a faixa): a barra é vermelha sempre. */
  classe?: string;
};

// Barras horizontais da aba: rótulo e valor na mesma linha, a barra entre os dois. Hover e foco abrem a dica.
// `vermelhoNoHover` quando o dado é de Orleans (cursos, perfil); quando é de SC, o destaque fica na tinta.
function BarrasDaCidade({
  itens,
  descricao,
  maximo,
  vermelhoNoHover = false,
}: {
  itens: readonly ItemDaBarra[];
  descricao: string;
  maximo: number;
  vermelhoNoHover?: boolean;
}) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const faixa = { min: 0, max: Math.max(maximo, ...itens.flatMap((i) => (i.valor === null ? [] : [i.valor]))) };
  return (
    <ul className="edu-cidade-barras" aria-label={descricao}>
      {itens.map((item) => {
        const { rotulo, valor } = item;
        const classes = [
          'edu-cidade-item',
          item.classe,
          vermelhoNoHover ? 'vermelho-no-hover' : null,
          ativo === rotulo ? 'is-ativa' : null,
        ].filter(Boolean);
        const largura = valor === null ? null : posicaoNaEscala(valor, faixa);
        const eventos =
          valor === null
            ? {}
            : {
                tabIndex: 0,
                onMouseEnter: () => setAtivo(rotulo),
                onMouseLeave: () => setAtivo((a) => (a === rotulo ? null : a)),
                onFocus: () => setAtivo(rotulo),
                onBlur: () => setAtivo((a) => (a === rotulo ? null : a)),
              };
        return (
          <li
            key={rotulo}
            className={[...classes, item.numeros ? 'com-numeros' : null].filter(Boolean).join(' ')}
            {...eventos}
          >
            <span className="edu-cidade-nome">
              <span className="edu-cidade-rotulo-barra">{rotulo}</span>
              {item.apoio && (
                <>
                  {' '}
                  <span className="edu-cidade-apoio-barra">{item.apoio}</span>
                </>
              )}
            </span>{' '}
            <span className="edu-cidade-faixa" aria-hidden="true">
              {largura !== null && <span className="edu-cidade-barra" style={{ width: largura }} />}
            </span>{' '}
            <span className="edu-cidade-valor">{item.texto}</span>
            {item.numeros && item.numeros.length > 0 && (
              <span className="edu-cidade-numeros-do-curso">
                {item.numeros.map((n) => (
                  <span key={n} className="edu-cidade-numero-do-curso">
                    {n}
                  </span>
                ))}
              </span>
            )}
            {ativo === rotulo && largura !== null && (
              <div className="bpa-dica edu-cidade-dica" aria-hidden="true">
                <strong>{rotulo}</strong>
                <span className="edu-cidade-dica-valor">{item.texto}</span>
                {item.apoio && <span>{item.apoio}</span>}
                {item.detalhe && <span>{item.detalhe}</span>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Orleans, SC e Brasil numa comparação, em três barras de 0 a 100%: Orleans é a vermelha. Com `sentidoBom`, a seta
// diz onde Orleans fica diante dos outros dois.
function TresLugares({
  comparacao,
  descricao,
  sentidoBom,
}: {
  comparacao: ComparacaoDeEducacao;
  descricao: string;
  sentidoBom?: SentidoBom;
}) {
  const valores = comparacao.porRede.todas;
  const barras = (
    <BarrasDaCidade
      descricao={descricao}
      maximo={100}
      itens={LUGARES.map((l) => {
        const valor = valores?.[l.chave] ?? null;
        return { rotulo: l.nome, valor, texto: emPct(valor), classe: l.classe };
      })}
    />
  );
  if (!sentidoBom) return barras;
  return (
    <>
      {barras}
      <Setas valores={valores} unidade={comparacao.unidade} sentidoBom={sentidoBom} />
    </>
  );
}

function Setas({
  valores,
  unidade,
  sentidoBom,
}: {
  valores: ComparacaoDeEducacao['porRede']['todas'];
  unidade: ComparacaoDeEducacao['unidade'];
  sentidoBom: SentidoBom;
}) {
  if (!valores) return null;
  return (
    <SetasDiante
      orleans={valores.orleans}
      santaCatarina={valores.santaCatarina}
      brasil={valores.brasil}
      unidade={unidade}
      sentidoBom={sentidoBom}
    />
  );
}

const NOME_DO_GRUPO: Record<string, string> = { Urbana: 'Área urbana', Rural: 'Área rural' };

// As faixas em dois quadros, por grupo e por idade: Orleans, SC e Brasil lado a lado, e a seta de cada faixa debaixo
// do nome. Saber ler e escrever: mais é melhor.
function QuadrosDaAlfabetizacao({ bloco }: { bloco: Alfabetizacao }) {
  const emTexto = (valor: number | null) => formatarValor(valor, '%', CASAS_DO_CENSO);
  const linha = (rotulo: string, comparacao: ComparacaoDeEducacao) => {
    const valores = comparacao.porRede.todas;
    return {
      nome: rotulo,
      apoio: <Setas valores={valores} unidade={comparacao.unidade} sentidoBom="maior" />,
      celulas: LUGARES.map((l) => emTexto(valores?.[l.chave] ?? null)),
    };
  };
  return (
    <Quadros
      rotulo={`Sabem ler e escrever, ${bloco.ano}`}
      colunas={LUGARES.map((l) => ({ nome: l.curto, destaque: l.chave === 'orleans' }))}
      grupos={[
        {
          titulo: 'Por grupo',
          linhas: bloco.porGrupo.map((g) => linha(NOME_DO_GRUPO[g.grupo] ?? g.grupo, g.comparacao)),
        },
        { titulo: 'Por idade', linhas: bloco.porIdade.map((g) => linha(g.grupo, g.comparacao)) },
      ]}
    />
  );
}

function BlocoDaAlfabetizacao({ bloco }: { bloco: Alfabetizacao }) {
  const emTexto = (valor: number | null) => formatarValor(valor, '%', CASAS_DO_CENSO);
  const total = bloco.total.porRede.todas;
  const idades = bloco.porIdade.flatMap(({ grupo, comparacao }) => {
    const orleans = comparacao.porRede.todas?.orleans ?? null;
    return orleans === null ? [] : [{ grupo, orleans }];
  });
  const menor = idades.reduce<(typeof idades)[number] | null>((m, i) => (!m || i.orleans < m.orleans ? i : m), null);
  return (
    <BlocoDoCaderno
      titulo="Saber ler e escrever"
      fonte={bloco.fonte}
      ano={`${bloco.ano}, pessoas com 15 anos ou mais`}
      nota="Os moradores de 75 anos ou mais estão também em 65 anos ou mais: as faixas de idade não se somam."
    >
      {menor && (
        <p className="edu-cidade-frase">
          A menor taxa por idade é a de {menor.grupo}: {emTexto(menor.orleans)}.
        </p>
      )}
      <div className="edu-cidade-numeros">
        <div>
          <p>
            <strong className="edu-cidade-de-orleans-num">{emTexto(total?.orleans ?? null)}</strong> dos moradores com
            15 anos ou mais sabem ler e escrever. SC {emTexto(total?.santaCatarina ?? null)} · Brasil{' '}
            {emTexto(total?.brasil ?? null)}.
          </p>
          <Setas valores={total} unidade={bloco.total.unidade} sentidoBom="maior" />
        </div>
        {bloco.naoAlfabetizados !== null && (
          <p>
            <strong>{numero(bloco.naoAlfabetizados)}</strong> moradores com 15 anos ou mais não sabem ler e escrever.
          </p>
        )}
      </div>
      <QuadrosDaAlfabetizacao bloco={bloco} />
    </BlocoDoCaderno>
  );
}

const NOME_DO_NIVEL: Record<NivelDeInstrucao, string> = {
  medio_ou_mais: 'Ensino médio completo ou mais',
  superior: 'Curso superior completo',
  sem_instrucao: 'Sem instrução ou fundamental incompleto',
};

// Mais gente com médio e superior é melhor; mais gente sem instrução, pior.
const SENTIDO_DO_NIVEL: Record<NivelDeInstrucao, SentidoBom> = {
  medio_ou_mais: 'maior',
  superior: 'maior',
  sem_instrucao: 'menor',
};

function BlocoDaEscolaridade({ bloco }: { bloco: Escolaridade }) {
  return (
    <BlocoDoCaderno
      titulo="Quantos anos estudaram"
      fonte={bloco.fonte}
      ano={`${bloco.ano}, percentuais: cálculo a partir das pessoas`}
      nota={
        <>
          <p>Os níveis não somam 100%: &ldquo;médio completo ou mais&rdquo; já inclui quem tem superior.</p>
          <Detalhes>
            <p>
              Base dos percentuais: {contar(bloco.pessoasDe25AnosOuMais)} moradores com 25 anos ou mais em Orleans, e o
              mesmo grupo em SC e no Brasil.
            </p>
            <p>Quem tem fundamental completo sem médio não aparece aqui.</p>
          </Detalhes>
        </>
      }
    >
      <h3 className="edu-cidade-sub">Anos de estudo, em média</h3>
      <div className="edu-cidade-grade">
        {bloco.anosDeEstudo.map(({ grupo, comparacao }) => (
          <Comparacao
            key={grupo}
            comparacao={comparacao}
            rede="todas"
            rotulo={grupo}
            escala={ESCALA_DOS_ANOS}
            sentidoBom="maior"
          />
        ))}
      </div>
      <h3 className="edu-cidade-sub">Até onde chegaram, com 25 anos ou mais</h3>
      <div className="edu-cidade-tres">
        {bloco.niveis.map(({ nivel, comparacao }) => (
          <div key={nivel}>
            <h4 className="edu-cidade-nivel">{NOME_DO_NIVEL[nivel]}</h4>
            <TresLugares
              comparacao={comparacao}
              descricao={`${NOME_DO_NIVEL[nivel]}, ${comparacao.ano}`}
              sentidoBom={SENTIDO_DO_NIVEL[nivel]}
            />
          </div>
        ))}
      </div>
    </BlocoDoCaderno>
  );
}

// A nota só existe quando há o que explicar, e mostra a conta com os números da tabela.
function notaDoArredondamento({ graduacao, emOrleans, emOutroMunicipio, noExterior }: Moradores) {
  if (graduacao === null || emOrleans === null || emOutroMunicipio === null) return null;
  const partes = [emOrleans, emOutroMunicipio, ...(noExterior ? [noExterior] : [])];
  const soma = partes.reduce((a, b) => a + b, 0);
  if (soma === graduacao) return null;
  return `${partes.map(numero).join(' + ')} = ${numero(soma)}, e o total é ${numero(graduacao)}: o Censo é amostra, e cada número vem arredondado.`;
}

function BlocoDosMoradores({ bloco }: { bloco: Moradores }) {
  const nota = notaDoArredondamento(bloco);
  return (
    <BlocoDoCaderno
      titulo="Moradores que fazem faculdade"
      fonte={bloco.fonte}
      ano={`${bloco.ano}, moradores de Orleans`}
      nota={nota}
    >
      <div className="edu-cidade-duas">
        <ul className="edu-cidade-lista">
          <li>
            <strong>{contar(bloco.graduacao)}</strong> moradores cursam graduação
          </li>
          <li>
            <strong>{contar(bloco.emOrleans)}</strong> fazem a graduação em Orleans
          </li>
          <li>
            <strong>{contar(bloco.emOutroMunicipio)}</strong> fazem em outro município
          </li>
          {Boolean(bloco.noExterior) && (
            <li>
              <strong>{contar(bloco.noExterior)}</strong> fazem em outro país
            </li>
          )}
          <li>
            <strong>{contar(bloco.posGraduacao)}</strong> fazem especialização, mestrado ou doutorado (
            {contar(bloco.posEmOutroMunicipio)} em outro município)
          </li>
        </ul>
        <div>
          <h3 className="edu-cidade-sub">Fazem a graduação em outro município</h3>
          <TresLugares
            comparacao={bloco.foraDoMunicipio}
            descricao={`Dos moradores na graduação, os que estudam em outro município, ${bloco.foraDoMunicipio.ano}`}
          />
        </div>
      </div>
    </BlocoDoCaderno>
  );
}

function LadoALado({ moradores, oferta }: { moradores: Moradores; oferta: Oferta }) {
  return (
    <BlocoDoCaderno
      titulo="Moradores e oferta não se somam"
      nota="Um morador pode estudar fora, e quem estuda aqui pode morar em outra cidade. Os públicos e os anos são diferentes."
    >
      <div className="edu-cidade-lado">
        <div className="edu-cidade-cartao">
          <span className="edu-cidade-rotulo">Moradores de Orleans na graduação</span>
          <strong>{contar(moradores.graduacao)}</strong>
          <span>
            {moradores.fonte.nome}, {moradores.ano}: quem mora aqui, estude onde estudar.
          </span>
        </div>
        <div className="edu-cidade-cartao">
          <span className="edu-cidade-rotulo">Matrículas nos cursos presenciais em Orleans</span>
          <strong>{contar(oferta.matriculas)}</strong>
          <span>
            {oferta.fonte.nome}, {oferta.ano}: quem estuda aqui, more onde morar.
          </span>
        </div>
      </div>
    </BlocoDoCaderno>
  );
}

const NOME_DO_PERFIL: Record<Oferta['perfil'][number]['recorte'], string> = {
  noturno: 'Estudam à noite',
  escola_publica: 'Vieram de escola pública',
  de_18_a_24: 'Têm de 18 a 24 anos',
  mulheres: 'São mulheres',
  prouni: 'Têm bolsa do Prouni',
  fies: 'Têm FIES',
};

function PerfilDosAlunos({ oferta }: { oferta: Oferta }) {
  return (
    <BarrasDaCidade
      descricao={`Quem estuda nos cursos presenciais, ${oferta.ano}`}
      maximo={100}
      vermelhoNoHover
      itens={oferta.perfil.map(({ recorte, pessoas, percentual }) => ({
        rotulo: NOME_DO_PERFIL[recorte],
        valor: percentual,
        texto: emPct(percentual),
        apoio: `${contar(pessoas)} de ${contar(oferta.matriculas)}`,
      }))}
    />
  );
}

function BlocoDaOferta({ bloco }: { bloco: Oferta }) {
  const { docentes, ead } = bloco;
  const totais: readonly [number | null, string][] = [
    [bloco.cursos, 'cursos'],
    [bloco.vagas, 'vagas'],
    [bloco.ingressantes, 'ingressantes'],
    [bloco.matriculas, 'matrículas'],
    [bloco.concluintes, 'concluintes'],
  ];
  const quemOferece =
    bloco.instituicao &&
    `Oferta presencial na cidade: ${bloco.instituicao}${bloco.natureza ? `, instituição ${bloco.natureza.toLowerCase()}` : ''}.`;
  return (
    <BlocoDoCaderno
      titulo="Cursos oferecidos em Orleans"
      fonte={bloco.fonte}
      ano={`${bloco.ano}, cursos presenciais; perfil: cálculo`}
      nota={
        <p>
          Ensino a distância: {contar(ead.matriculas)} matrículas, em {contar(ead.instituicoes)} instituições. O dado
          por município é limitado, segundo o INEP: por isso, só o total, sem abrir por curso e fora dos números acima.
        </p>
      }
    >
      <p className="edu-cidade-frase">{quemOferece} Estes números contam todos os alunos, morem ou não em Orleans.</p>
      <ul className="edu-cidade-totais">
        {totais.map(([valor, nome]) => (
          <li key={nome}>
            <strong>{contar(valor)}</strong> {nome}
          </li>
        ))}
      </ul>
      <div className="edu-cidade-duas">
        <div>
          <h3 className="edu-cidade-sub">Quem estuda</h3>
          <PerfilDosAlunos oferta={bloco} />
        </div>
        <div>
          <h3 className="edu-cidade-sub">Professores</h3>
          <BarrasEmpilhadas
            descricao={`Titulação dos docentes em ${bloco.ano}`}
            formatar={numero}
            linhas={[
              {
                rotulo: `${contar(docentes.total)} docentes`,
                partes: [
                  { nome: 'Doutores', valor: docentes.doutores },
                  { nome: 'Mestres', valor: docentes.mestres },
                  { nome: 'Especialistas', valor: docentes.especialistas },
                ],
              },
            ]}
          />
          {docentes.tempoIntegral !== null && (
            <p className="edu-cidade-apoio">{numero(docentes.tempoIntegral)} docentes em tempo integral.</p>
          )}
        </div>
      </div>
    </BlocoDoCaderno>
  );
}

function fraseDoIgc({ ano, continuo, faixa, distribuicaoEmSc, instituicoesEmSc }: Igc) {
  if (faixa === null) return `Sem conceito no IGC de ${ano}.`;
  const nota = continuo === null ? '' : ` (nota ${formatarValor(continuo, 'nota')})`;
  const naFaixa = distribuicaoEmSc.find((d) => d.faixa === faixa);
  const emSc =
    naFaixa && instituicoesEmSc !== null
      ? ` Em SC, ${numero(naFaixa.instituicoes)} das ${numero(instituicoesEmSc)} instituições com nota estão nessa mesma faixa.`
      : '';
  return `Faixa ${numero(faixa)} de ${FAIXAS_DO_IGC.length}${nota} no IGC de ${ano}.${emSc}`;
}

const instituicoes = (n: number) => `${numero(n)} ${n === 1 ? 'instituição' : 'instituições'}`;

function BlocoDoIgc({ bloco }: { bloco: Igc }) {
  const distribuicao = [...bloco.distribuicaoEmSc].sort((a, b) => a.faixa - b.faixa);
  return (
    <BlocoDoCaderno titulo="Nota da instituição" fonte={bloco.fonte} ano={bloco.ano}>
      <p className="edu-cidade-frase">{fraseDoIgc(bloco)}</p>
      <div className="edu-cidade-duas">
        <div>
          <h3 className="edu-cidade-sub">A faixa de Orleans</h3>
          <ol className="edu-cidade-faixas" aria-label={`Faixas do IGC, de 1 a ${FAIXAS_DO_IGC.length}`}>
            {FAIXAS_DO_IGC.map((faixa) => (
              <li
                key={faixa}
                className={faixa === bloco.faixa ? 'edu-cidade-de-orleans' : undefined}
                aria-current={faixa === bloco.faixa ? 'true' : undefined}
              >
                {faixa}
              </li>
            ))}
          </ol>
        </div>
        {distribuicao.length > 0 && (
          <div>
            <h3 className="edu-cidade-sub">
              Instituições de SC com nota, por faixa
              {bloco.instituicoesEmSc !== null && ` (${numero(bloco.instituicoesEmSc)} ao todo)`}
            </h3>
            <BarrasDaCidade
              descricao={`Instituições de SC com nota, por faixa, IGC ${bloco.ano}`}
              maximo={0}
              itens={distribuicao.map(({ faixa, instituicoes: n }) => ({
                rotulo: `Faixa ${numero(faixa)}`,
                valor: n,
                texto: instituicoes(n),
                ...(faixa === bloco.faixa ? { apoio: 'a da instituição de Orleans', classe: 'orleans' } : {}),
              }))}
            />
          </div>
        )}
      </div>
    </BlocoDoCaderno>
  );
}

// O arquivo do INEP grava `tecnologico`, sem acento.
const nomeDoCurso = (curso: string) => curso.replace('(tecnologico)', '(tecnológico)');

function numerosDoCurso(c: Cursos['lista'][number]): string[] {
  return [
    `${contar(c.ingressantes)} entraram`,
    `${contar(c.concluintes)} formaram`,
    ...(c.mulheres !== null ? [`${contar(c.mulheres)} mulheres`] : []),
    ...(c.noturno !== null ? [`${contar(c.noturno)} à noite`] : []),
  ];
}

function BlocoDosCursos({ bloco }: { bloco: Cursos }) {
  const itens: ItemDaBarra[] = bloco.lista.map((c) => ({
    rotulo: nomeDoCurso(c.curso),
    valor: typeof c.matriculas === 'number' ? c.matriculas : null,
    texto: `${contar(c.matriculas)} matrículas`,
    numeros: numerosDoCurso(c),
    ...(c.vagas !== null ? { detalhe: `${numero(c.vagas)} vagas` } : {}),
  }));
  return (
    <BlocoDoCaderno
      titulo="Matrículas por curso"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota="Curso com menos de 10 matrículas não mostra o corte por sexo e turno. Contagem de 1 a 4 pessoas aparece como “menos de 5”."
    >
      <BarrasDaCidade descricao={`Matrículas por curso, ${bloco.ano}`} maximo={0} vermelhoNoHover itens={itens} />
    </BlocoDoCaderno>
  );
}

function Conteudo({ dados }: { dados: EducacaoCidade }) {
  return (
    <>
      <p className="edu-cidade-csv">
        <a href="/api/educacao/cidade.csv" className="botao-link">
          Baixar CSV ↓
        </a>
      </p>
      {dados.alfabetizacao && <BlocoDaAlfabetizacao bloco={dados.alfabetizacao} />}
      {dados.escolaridade && <BlocoDaEscolaridade bloco={dados.escolaridade} />}
      {dados.moradores && <BlocoDosMoradores bloco={dados.moradores} />}
      {dados.moradores && dados.oferta && <LadoALado moradores={dados.moradores} oferta={dados.oferta} />}
      {dados.oferta && <BlocoDaOferta bloco={dados.oferta} />}
      {dados.igc && <BlocoDoIgc bloco={dados.igc} />}
      {dados.cursos && <BlocoDosCursos bloco={dados.cursos} />}
    </>
  );
}

export default function Cidade() {
  const { dados, carregando, erro } = useApi('/api/educacao/cidade', educacaoCidadeSchema);
  return (
    <>
      <CabecalhoDoCaderno titulo="Dois assuntos: quanto estudou a população e a faculdade na cidade">
        Esta aba junta o que os moradores de Orleans estudaram (Censo de 2022) e os cursos de faculdade oferecidos na
        cidade (INEP, 2024). Moradores e oferta são contados separados e não se somam.
      </CabecalhoDoCaderno>
      <Estado carregando={carregando} erro={erro} />
      {dados && !dados.disponivel && <p className="aviso">Os dados desta aba ainda não foram coletados.</p>}
      {dados?.disponivel && <Conteudo dados={dados} />}
    </>
  );
}
