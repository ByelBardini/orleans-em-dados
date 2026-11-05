// Aba Professores e turmas do caderno de Educação: quem ensina e como são as turmas. O alternador vale para os blocos do
// INEP, rede com rede; alunos por docente é da rede municipal, e o SIOPE, da Prefeitura. Só agregados: nada por pessoa ou escola.
import {
  educacaoProfessoresSchema,
  type ComparacaoDeEducacao,
  type EducacaoProfessores,
  type GrupoDeAdequacao,
  type NivelDeRegularidade,
  type Rede,
} from '@orleans-em-dados/contracts';
import { useState } from 'react';
import { useApi } from '../../api';
import { Estado } from '../../components';
import { formatarValor, LUGARES, NOMES_DE_ETAPA, rotuloDaRede } from '../../educacao';
import {
  AlternadorDeRede,
  BarrasEmpilhadas,
  BarrasPorAno,
  BlocoDoCaderno,
  CabecalhoDoCaderno,
  Comparacao,
  Detalhes,
} from '../../educacao/componentes';
import { moeda, numero } from '../../format';
import './Professores.css';

const REDE_INICIAL: Rede = 'publica';
const ESCALA_DAS_TURMAS = { min: 0, max: 30 };
const ESCALA_DAS_HORAS = { min: 0, max: 10 };
const ETAPAS_DO_ART_62 = ['educacao_infantil', 'anos_iniciais'];

const NOME_DO_GRUPO: Record<GrupoDeAdequacao, string> = {
  grupo_1: 'Grupo 1',
  grupo_2: 'Grupo 2',
  grupo_3: 'Grupo 3',
  grupo_4: 'Grupo 4',
  grupo_5: 'Grupo 5',
};
const NOME_DO_NIVEL: Record<NivelDeRegularidade, string> = {
  baixa: 'Baixa',
  media_baixa: 'Média-baixa',
  media_alta: 'Média-alta',
  alta: 'Alta',
};

const nomeDaEtapa = (etapa: string) => NOMES_DE_ETAPA[etapa] ?? etapa;
const emPct = (valor: number | null) => formatarValor(valor, '%');
const emLista = (itens: readonly string[]) =>
  new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(itens);
const comMaiuscula = (texto: string) => `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;

/** `2026-05` em `mai/26`: curto para caber em sete colunas no celular. É a foto de maio, não o ano. */
const mesCurto = (periodo: string) => `mai/${periodo.slice(2, 4)}`;
const maioDe = (periodo: string) => `maio de ${periodo.slice(0, 4)}`;

const naRede = (rede: Rede) => (rede === 'todas' ? 'Em todas as redes' : `Na ${rotuloDaRede(rede)}`);
const umaCasa = (valor: number | null) => formatarValor(valor, 'indice', 1);

// A frase sai dos dados, sem adjetivo: cada etapa leva os dois números, e a etapa sem par fica de fora.
function fraseDaComparacao(comparacoes: readonly ComparacaoDeEducacao[], rede: Rede, medida: string) {
  const menos: string[] = [];
  const mais: string[] = [];
  const iguais: string[] = [];
  for (const { etapa, porRede } of comparacoes) {
    const valores = porRede[rede];
    if (!valores || valores.orleans === null || valores.santaCatarina === null) continue;
    const { orleans, santaCatarina } = valores;
    const destino = orleans < santaCatarina ? menos : orleans > santaCatarina ? mais : iguais;
    destino.push(`${nomeDaEtapa(etapa).toLowerCase()} (${umaCasa(orleans)} × ${umaCasa(santaCatarina)})`);
  }
  const trechos = [
    menos.length ? `menos ${medida} que Santa Catarina em ${emLista(menos)}` : null,
    mais.length ? `mais ${medida} que Santa Catarina em ${emLista(mais)}` : null,
    iguais.length ? `o mesmo número de ${medida} que Santa Catarina em ${emLista(iguais)}` : null,
  ].filter((t) => t !== null);
  return trechos.length ? `${naRede(rede)}, Orleans tem ${emLista(trechos)}.` : null;
}

function BlocoDasComparacoes({
  titulo,
  bloco,
  rede,
  escala,
  medida,
  nota,
}: {
  titulo: string;
  bloco: NonNullable<EducacaoProfessores['turmas']>;
  rede: Rede;
  escala: { min: number; max: number };
  medida: string;
  nota: string;
}) {
  const frase = fraseDaComparacao(bloco.comparacoes, rede, medida);
  return (
    <BlocoDoCaderno titulo={titulo} fonte={bloco.fonte} ano={bloco.ano} nota={nota}>
      {frase && <p className="edu-professores-frase">{frase}</p>}
      <div className="edu-professores-grade">
        {bloco.comparacoes.map((comparacao) => (
          <Comparacao key={comparacao.etapa} comparacao={comparacao} rede={rede} escala={escala} />
        ))}
      </div>
    </BlocoDoCaderno>
  );
}

type Formacao = NonNullable<EducacaoProfessores['formacao']>;

const valorDoGrupo = (etapa: Formacao['etapas'][number], grupo: GrupoDeAdequacao) =>
  etapa.grupos.find((g) => g.grupo === grupo)?.comparacao;

function fraseDaFormacao({ etapas }: Formacao, rede: Rede) {
  const [primeira] = etapas;
  const valores = primeira && valorDoGrupo(primeira, 'grupo_1')?.porRede[rede];
  if (!primeira || !valores || valores.orleans === null || valores.santaCatarina === null) return null;
  return `${naRede(rede)}, na ${nomeDaEtapa(primeira.etapa).toLowerCase()}, ${emPct(valores.orleans)} das aulas são dadas por professor com licenciatura na área; em Santa Catarina, ${emPct(valores.santaCatarina)}.`;
}

function BlocoDaFormacao({ bloco, rede }: { bloco: Formacao; rede: Rede }) {
  const frase = fraseDaFormacao(bloco, rede);
  return (
    <BlocoDoCaderno
      titulo="Quem dá as aulas"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota="O INEP conta as aulas, não as pessoas: um mesmo professor pode dar aulas em mais de uma situação."
    >
      {frase && <p className="edu-professores-frase">{frase}</p>}
      <h3 className="edu-professores-subtitulo">Aulas dadas por professor com licenciatura na área (grupo 1)</h3>
      <div className="edu-professores-grade">
        {bloco.etapas.flatMap((etapa) => {
          const comparacao = valorDoGrupo(etapa, 'grupo_1');
          return comparacao
            ? [
                <Comparacao
                  key={etapa.etapa}
                  comparacao={comparacao}
                  rede={rede}
                  rotulo={`Aulas com licenciatura na área: ${nomeDaEtapa(etapa.etapa)}`}
                  sentidoBom="maior"
                />,
              ]
            : [];
        })}
      </div>
      <h3 className="edu-professores-subtitulo">Formação de quem dá as aulas, grupo a grupo</h3>
      <div className="edu-professores-dupla">
        {bloco.etapas
          .filter((etapa) => ETAPAS_DO_ART_62.includes(etapa.etapa))
          .map((etapa) => (
            <div key={etapa.etapa}>
              <h4 className="edu-professores-etapa">{nomeDaEtapa(etapa.etapa)}</h4>
              <BarrasEmpilhadas
                descricao={`${nomeDaEtapa(etapa.etapa)}, ${rotuloDaRede(rede)}: percentual de aulas por grupo`}
                linhas={LUGARES.map((lugar) => ({
                  rotulo: lugar.nome,
                  partes: etapa.grupos.map(({ grupo, comparacao }) => ({
                    nome: NOME_DO_GRUPO[grupo],
                    valor: comparacao.porRede[rede]?.[lugar.chave] ?? null,
                  })),
                }))}
              />
            </div>
          ))}
      </div>
      <dl className="edu-professores-grupos">
        <div>
          <dt>Grupo 1</dt>
          <dd>Licenciatura na área da aula.</dd>
        </div>
        <div>
          <dt>Grupo 2</dt>
          <dd>Bacharelado na área da aula, sem licenciatura.</dd>
        </div>
        <div>
          <dt>Grupo 3</dt>
          <dd>Licenciatura em outra área.</dd>
        </div>
        <div>
          <dt>Grupo 4</dt>
          <dd>Outra formação superior.</dd>
        </div>
        <div>
          <dt>Grupo 5</dt>
          <dd>
            Sem curso superior. A LDB (art. 62) admite, como formação mínima, o curso normal de nível médio na educação
            infantil e nos cinco primeiros anos do ensino fundamental. O indicador não separa quem tem esse curso.
          </dd>
        </div>
      </dl>
    </BlocoDoCaderno>
  );
}

function BlocoDosDocentesComSuperior({
  bloco,
  rede,
}: {
  bloco: NonNullable<EducacaoProfessores['docentesSuperior']>;
  rede: Rede;
}) {
  return (
    <BlocoDoCaderno
      titulo="Docentes com curso superior"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota="Este indicador conta pessoas, não aulas: não se compara, número a número, com os grupos do bloco anterior."
    >
      <div className="edu-professores-grade">
        {bloco.comparacoes.map((comparacao) => (
          <Comparacao key={comparacao.etapa} comparacao={comparacao} rede={rede} sentidoBom="maior" />
        ))}
      </div>
    </BlocoDoCaderno>
  );
}

type Regularidade = NonNullable<EducacaoProfessores['regularidade']>;

function fraseDaRegularidade({ niveis }: Regularidade, rede: Rede) {
  const valores = niveis.find((n) => n.nivel === 'baixa')?.comparacao.porRede[rede];
  if (!valores || valores.orleans === null || valores.santaCatarina === null) return null;
  return `${naRede(rede)}, ${emPct(valores.orleans)} das escolas de Orleans estão no nível baixo; em Santa Catarina, ${emPct(valores.santaCatarina)}.`;
}

function BlocoDaRegularidade({ bloco, rede }: { bloco: Regularidade; rede: Rede }) {
  const frase = fraseDaRegularidade(bloco, rede);
  return (
    <BlocoDoCaderno
      titulo="Os professores continuam na mesma escola?"
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota="Se os mesmos professores seguem na escola ao longo dos anos. É o percentual de escolas em cada nível: o INEP não publica a contagem."
    >
      {frase && <p className="edu-professores-frase">{frase}</p>}
      <div className="edu-professores-estreito">
        <BarrasEmpilhadas
          descricao={`Percentual de escolas por nível de regularidade, ${rotuloDaRede(rede)}`}
          linhas={LUGARES.map((lugar) => ({
            rotulo: lugar.nome,
            partes: bloco.niveis.map(({ nivel, comparacao }) => ({
              nome: NOME_DO_NIVEL[nivel],
              valor: comparacao.porRede[rede]?.[lugar.chave] ?? null,
            })),
          }))}
        />
      </div>
    </BlocoDoCaderno>
  );
}

const NA_ETAPA: Record<string, string> = { creche: 'na creche', pre_escola: 'na pré-escola' };
const naEtapa = (etapa: string) => NA_ETAPA[etapa] ?? `em ${nomeDaEtapa(etapa).toLowerCase()}`;

function BlocoDosAlunosPorDocente({ bloco }: { bloco: NonNullable<EducacaoProfessores['alunosPorDocente']> }) {
  const ultimos = bloco.etapas.map(({ etapa, anos }) => ({ etapa, ponto: anos.at(-1) }));
  const ano = ultimos.find((u) => u.ponto)?.ponto?.ano;
  const presentes = ultimos.filter((u) => u.ponto?.alunosPorDocente != null && u.ponto.ano === ano);
  const trechos = presentes.map(
    (u, i) =>
      `${umaCasa(u.ponto?.alunosPorDocente ?? null)}${i === 0 ? ' alunos por docente' : ''} ${naEtapa(u.etapa)}`,
  );
  return (
    <BlocoDoCaderno
      titulo="Alunos por docente na rede municipal"
      fonte={bloco.fonte}
      ano={ano}
      nota={
        <>
          <p>Conta do painel: matrículas ÷ docentes da rede municipal, ano a ano; a conta aparece sobre cada barra.</p>
          <Detalhes>
            Um docente pode contar em mais de uma etapa, por isso as etapas não se somam. Não há conta equivalente para
            Santa Catarina e o Brasil neste bloco.
          </Detalhes>
        </>
      }
    >
      {trechos.length > 0 && (
        <p className="edu-professores-frase">
          Em {ano}, a rede municipal tem {emLista(trechos)}.
        </p>
      )}
      <div className="edu-professores-dupla">
        {bloco.etapas.map(({ etapa, anos }) => (
          <div key={etapa}>
            <h3 className="edu-professores-subtitulo">{comMaiuscula(nomeDaEtapa(etapa))}</h3>
            <BarrasPorAno
              descricao={`Alunos por docente ${naEtapa(etapa)}, rede municipal`}
              casas={1}
              barras={anos.map((a) => ({ ano: a.ano, valor: a.alunosPorDocente }))}
              detalhar={(barra) => {
                const linha = anos.find((a) => a.ano === barra.ano);
                return `${pessoas(linha?.matriculas ?? null)} matrículas ÷ ${pessoas(linha?.docentes ?? null)} docentes`;
              }}
            />
          </div>
        ))}
      </div>
    </BlocoDoCaderno>
  );
}

const pessoas = (valor: number | string | null) =>
  valor === null ? '—' : typeof valor === 'string' ? valor : numero(valor);

type Temporarios = NonNullable<EducacaoProfessores['temporarios']>;

function fraseDosTemporarios({ anos }: Temporarios) {
  const comCarga = anos.filter((a) => a.magisterio.cargaTemporaria !== null);
  const [primeiro] = comCarga;
  const ultimo = comCarga.at(-1);
  if (!primeiro || !ultimo || primeiro === ultimo) return null;
  return `Entre os profissionais declarados, a parte da carga horária do magistério feita por temporários passou de ${emPct(primeiro.magisterio.cargaTemporaria)} em ${maioDe(primeiro.periodo)} para ${emPct(ultimo.magisterio.cargaTemporaria)} em ${maioDe(ultimo.periodo)}.`;
}

function BlocoDosTemporarios({ bloco }: { bloco: Temporarios }) {
  const frase = fraseDosTemporarios(bloco);
  const ultimo = bloco.anos.at(-1);
  const barras = (grupo: 'magisterio' | 'outros') =>
    bloco.anos.map((a) => ({ ano: mesCurto(a.periodo), valor: a[grupo].cargaTemporaria }));
  const declarados = (grupo: 'magisterio' | 'outros') => (barra: { ano: number | string }) => {
    const linha = bloco.anos.find((a) => mesCurto(a.periodo) === barra.ano);
    return linha && `Foto de ${maioDe(linha.periodo)}: ${pessoas(linha[grupo].profissionais)} profissionais declarados`;
  };
  return (
    <BlocoDoCaderno
      titulo="Temporários, entre os profissionais declarados"
      fonte={bloco.fonte}
      ano="maio de cada ano"
      nota={
        <>
          <p>
            Cada barra é a foto de maio daquele ano, com os profissionais que a Prefeitura declarou ao SIOPE, e não o
            exercício inteiro.{ultimo && ` A de ${ultimo.periodo.slice(0, 4)} mostra só maio.`}
          </p>
          <Detalhes>
            Profissionais do magistério declarados:{' '}
            {emLista(bloco.anos.map((a) => `${pessoas(a.magisterio.profissionais)} em ${maioDe(a.periodo)}`))}. Outros
            profissionais da educação:{' '}
            {emLista(bloco.anos.map((a) => `${pessoas(a.outros.profissionais)} em ${maioDe(a.periodo)}`))}.
          </Detalhes>
        </>
      }
    >
      {frase && <p className="edu-professores-frase">{frase}</p>}
      <div className="edu-professores-dupla">
        <div>
          <h3 className="edu-professores-subtitulo">Magistério</h3>
          <BarrasPorAno
            descricao="Carga horária temporária no magistério, foto de maio"
            unidade="%"
            barras={barras('magisterio')}
            maximo={100}
            detalhar={declarados('magisterio')}
          />
        </div>
        <div>
          <h3 className="edu-professores-subtitulo">Outros profissionais da educação</h3>
          <BarrasPorAno
            descricao="Carga horária temporária dos outros profissionais, foto de maio"
            unidade="%"
            barras={barras('outros')}
            maximo={100}
            detalhar={declarados('outros')}
          />
        </div>
      </div>
    </BlocoDoCaderno>
  );
}

type Remuneracao = NonNullable<EducacaoProfessores['remuneracao']>;

function fraseDaRemuneracao({ anos }: Remuneracao) {
  const ultimo = anos.at(-1);
  if (!ultimo || ultimo.magisterio.efetivo === null || ultimo.magisterio.temporario === null) return null;
  return `Em ${maioDe(ultimo.periodo)}, no magistério: ${moeda(ultimo.magisterio.efetivo)} para efetivos e ${moeda(ultimo.magisterio.temporario)} para temporários, por 40 horas semanais.`;
}

const emReaisInteiros = (valor: number) => numero(Math.round(valor));

const GRAFICOS_DA_MEDIANA = [
  ['magisterio', 'efetivo', 'Magistério, efetivos'],
  ['magisterio', 'temporario', 'Magistério, temporários'],
  ['outros', 'efetivo', 'Outros profissionais, efetivos'],
  ['outros', 'temporario', 'Outros profissionais, temporários'],
] as const;

function BlocoDaRemuneracao({ bloco }: { bloco: Remuneracao }) {
  const frase = fraseDaRemuneracao(bloco);
  return (
    <BlocoDoCaderno
      titulo="Salário mediano por 40 horas"
      fonte={bloco.fonte}
      ano="maio de cada ano"
      nota={
        <>
          <p>
            Mediana da remuneração total, em reais nominais, proporcional a 40 horas semanais, entre os profissionais
            declarados, na foto de maio de cada ano: não é a média do ano inteiro.
          </p>
          <Detalhes>
            Grupo com menos de 10 pessoas não tem mediana: fica o travessão, sem barra. Quem é efetivo e temporário no
            mesmo mês fica fora das duas medianas de vínculo.
          </Detalhes>
        </>
      }
    >
      {frase && <p className="edu-professores-frase">{frase}</p>}
      <div className="edu-professores-dupla">
        {GRAFICOS_DA_MEDIANA.map(([grupo, vinculo, nome]) => (
          <div key={nome}>
            <h3 className="edu-professores-subtitulo">
              {nome} <span className="edu-professores-ressalva">em reais, foto de maio</span>
            </h3>
            <BarrasPorAno
              descricao={`Salário mediano por 40 horas: ${nome.toLowerCase()}, foto de maio`}
              formatar={emReaisInteiros}
              barras={bloco.anos.map((a) => ({ ano: mesCurto(a.periodo), valor: a[grupo][vinculo] }))}
              detalhar={(barra) => {
                const linha = bloco.anos.find((a) => mesCurto(a.periodo) === barra.ano);
                const valor = linha?.[grupo][vinculo] ?? null;
                return linha && valor !== null ? `${moeda(valor)} na foto de ${maioDe(linha.periodo)}` : null;
              }}
            />
          </div>
        ))}
      </div>
    </BlocoDoCaderno>
  );
}

const NOME_DA_LINHA_DA_RAIS: Record<NonNullable<EducacaoProfessores['rais']>['linhas'][number]['lugar'], string> = {
  orleans: 'Rede municipal de Orleans',
  santaCatarina: 'Toda a rede pública de SC',
  brasil: 'Redes municipais do Brasil',
};

function BlocoDaRais({ bloco }: { bloco: NonNullable<EducacaoProfessores['rais']> }) {
  return (
    <BlocoDoCaderno
      titulo={`Remuneração média por 40 horas, em ${bloco.ano}`}
      fonte={bloco.fonte}
      ano={bloco.ano}
      nota={
        <>
          <p>
            Esta é outra base: o INEP cruza os docentes com a RAIS, e o último dado é de {bloco.ano}. Por isso não se
            compara com as medianas do SIOPE acima.
          </p>
          <Detalhes>
            Santa Catarina não tem linha municipal neste arquivo: a linha é a de toda a rede pública do estado. Valores
            nominais.
          </Detalhes>
        </>
      }
    >
      <dl className="edu-professores-rais">
        {bloco.linhas.map(({ lugar, mediaPor40h }) => (
          <div key={lugar} className={lugar === 'orleans' ? 'edu-professores-orleans' : undefined}>
            <dt>{NOME_DA_LINHA_DA_RAIS[lugar]}</dt>
            <dd>{moeda(mediaPor40h)}</dd>
          </div>
        ))}
      </dl>
    </BlocoDoCaderno>
  );
}

function Conteudo({ dados }: { dados: EducacaoProfessores }) {
  const [rede, setRede] = useState<Rede>(REDE_INICIAL);
  const comparacoes = [
    ...(dados.turmas?.comparacoes ?? []),
    ...(dados.horas?.comparacoes ?? []),
    ...(dados.formacao?.etapas.flatMap((e) => e.grupos.map((g) => g.comparacao)) ?? []),
    ...(dados.docentesSuperior?.comparacoes ?? []),
    ...(dados.regularidade?.niveis.map((n) => n.comparacao) ?? []),
  ];
  return (
    <>
      <p className="edu-professores-csv">
        <a href="/api/educacao/professores.csv" className="botao-link">
          Baixar CSV ↓
        </a>
      </p>
      {comparacoes.length > 0 && <AlternadorDeRede comparacoes={comparacoes} valor={rede} aoMudar={setRede} />}
      {dados.turmas && (
        <BlocoDasComparacoes
          titulo="Tamanho das turmas"
          bloco={dados.turmas}
          rede={rede}
          escala={ESCALA_DAS_TURMAS}
          medida="alunos por turma"
          nota="Média de alunos por turma. Escala de 0 a 30, que cresce se algum valor passar disso."
        />
      )}
      {dados.horas && (
        <BlocoDasComparacoes
          titulo="Horas de aula por dia"
          bloco={dados.horas}
          rede={rede}
          escala={ESCALA_DAS_HORAS}
          medida="horas de aula por dia"
          nota="Média de horas-aula por dia. Escala de 0 a 10 horas, que cresce se algum valor passar disso."
        />
      )}
      {dados.alunosPorDocente && <BlocoDosAlunosPorDocente bloco={dados.alunosPorDocente} />}
      {dados.formacao && <BlocoDaFormacao bloco={dados.formacao} rede={rede} />}
      {dados.docentesSuperior && <BlocoDosDocentesComSuperior bloco={dados.docentesSuperior} rede={rede} />}
      {dados.regularidade && <BlocoDaRegularidade bloco={dados.regularidade} rede={rede} />}
      {dados.temporarios && <BlocoDosTemporarios bloco={dados.temporarios} />}
      {dados.remuneracao && <BlocoDaRemuneracao bloco={dados.remuneracao} />}
      {dados.rais && <BlocoDaRais bloco={dados.rais} />}
    </>
  );
}

export default function Professores() {
  const { dados, carregando, erro } = useApi('/api/educacao/professores', educacaoProfessoresSchema);
  return (
    <>
      <CabecalhoDoCaderno titulo="Quem ensina e como são as turmas">
        Tamanho das turmas, horas na escola, formação de quem dá aula, temporários e salários. As comparações do INEP
        põem cada rede ao lado da mesma rede em Santa Catarina e no Brasil.
      </CabecalhoDoCaderno>
      <Estado carregando={carregando} erro={erro} />
      {dados && !dados.disponivel && <p className="aviso">Os dados desta aba ainda não foram coletados.</p>}
      {dados?.disponivel && <Conteudo dados={dados} />}
    </>
  );
}
