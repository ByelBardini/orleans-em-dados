// Aba Dinheiro do caderno de Educação: mínimo legal, gasto, repasses e a conta do Fundeb. Só exercício encerrado, em
// reais nominais. Número principal é o SIOPE ou o conferido; a diferença entre fontes só aponta para Discrepâncias.
import { educacaoDinheiroSchema, type EducacaoDinheiro } from '@orleans-em-dados/contracts';
import { useId, useState, type ReactNode } from 'react';
import { useApi } from '../../api';
import { Estado } from '../../components';
import { formatarValor } from '../../educacao';
import {
  Alternador,
  BarrasEmpilhadas,
  BarrasHorizontais,
  BarrasPorAno,
  BlocoDoCaderno,
  CabecalhoDoCaderno,
  Detalhes,
} from '../../educacao/componentes';
import { emMilhoes, moeda, numero, pct, porExtenso } from '../../format';
import { Selo } from '../../selo';
import { SELO_CONFERIDO_COM_A_BETHA, SELO_FONTE_UNICA, seloConferidoComTce, type DadosDoSelo } from '../../selos';
import './Dinheiro.css';

const emPct = (valor: number | null) => formatarValor(valor, '%', 2);
const umaCasa = (valor: number | null) => formatarValor(valor, '%', 1);
const reaisInteiros = (valor: number) => `R$ ${numero(Math.round(valor))}`;
const emLista = (itens: readonly string[]) =>
  new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(itens);

type BlocoDoIndice = NonNullable<EducacaoDinheiro['fundebRemuneracao']>;

// Nominal é o padrão: é o número que confere com as fontes. O corrigido é a leitura ao lado, nunca o principal.
type Valores = 'nominal' | 'corrigido';
type Inflacao = EducacaoDinheiro['inflacao'];
type Correcao = { inflacao: Inflacao; valores: Valores; aoMudar: (valores: Valores) => void };
const OPCOES_DE_VALORES = [
  { valor: 'nominal', nome: 'Nominal' },
  { valor: 'corrigido', nome: 'Corrigido pelo IPCA' },
] as const;

function AlternadorDeValores({ inflacao, valores, aoMudar }: Correcao) {
  if (!inflacao) return null;
  return <Alternador rotulo="Valores" opcoes={OPCOES_DE_VALORES} valor={valores} aoMudar={aoMudar} />;
}

const emReaisDe = (inflacao: Inflacao, valores: Valores) =>
  inflacao && valores === 'corrigido'
    ? `em reais de ${inflacao.anoBase}, corrigidos pelo IPCA médio de cada ano`
    : 'em reais nominais';

function fraseDoCrescimento(crescimento: Gasto['crescimentoReal']) {
  if (!crescimento) return null;
  const { de, ate, percentual } = crescimento;
  const verbo = percentual < 0 ? 'caiu' : 'cresceu';
  return `Descontada a inflação, o gasto com educação ${verbo} ${umaCasa(Math.abs(percentual))} entre ${de} e ${ate}.`;
}
type AnoDoIndice = BlocoDoIndice['anos'][number];

function LinkParaDiscrepancias() {
  return <a href="#discrepancias">Ver em Discrepâncias</a>;
}

function fraseDosAnos(anos: readonly AnoDoIndice[]) {
  const abaixo = anos.filter((a) => a.percentual !== null && a.percentual < a.minimo).map((a) => String(a.ano));
  return abaixo.length
    ? `Orleans ficou acima em todos os anos, menos em ${emLista(abaixo)}.`
    : 'Orleans ficou acima em todos os anos.';
}

const parteDoSiope = ({ percentual, aplicado }: AnoDoIndice) =>
  aplicado === null ? emPct(percentual) : `${emPct(percentual)} (${moeda(aplicado)})`;

// O SIOPE fica como principal. O SICONFI aparece só onde difere, sem dizer qual dos dois está certo.
function AvisoDoSiconfi({ anos }: { anos: readonly AnoDoIndice[] }) {
  const diferentes = anos.filter((a) => a.difereDoSiconfi && a.siconfi);
  if (!diferentes.length) return null;
  return (
    <details className="edu-dinheiro-aviso">
      <summary>SIOPE e SICONFI registram valores diferentes em {emLista(diferentes.map((a) => String(a.ano)))}</summary>
      <p>As duas fontes recebem os dados da Prefeitura.</p>
      <ul>
        {diferentes.map((a) => (
          <li key={a.ano}>
            {a.ano}: SIOPE {parteDoSiope(a)}; SICONFI {emPct(a.siconfi?.percentual ?? null)} ({moeda(a.siconfi?.valor)})
          </li>
        ))}
      </ul>
      <LinkParaDiscrepancias />
    </details>
  );
}

const barrasDoIndice = (anos: readonly AnoDoIndice[]) => anos.map((a) => ({ ano: a.ano, valor: a.percentual }));

// A linha da dica com o valor em reais por trás do percentual; sem o valor, a dica fica no percentual.
const emReaisNaDica = (anos: readonly AnoDoIndice[], depois: string) => (barra: { ano: number | string }) => {
  const aplicado = anos.find((a) => a.ano === barra.ano)?.aplicado ?? null;
  return aplicado === null ? null : `${moeda(aplicado)} ${depois}`;
};

function BlocoDoMinimo({ bloco }: { bloco: NonNullable<EducacaoDinheiro['minimo']> }) {
  const [primeiro] = bloco.anos;
  const abaixoNaEmenda = bloco.anos.some(
    (a) => (a.ano === 2020 || a.ano === 2021) && a.percentual !== null && a.percentual < a.minimo,
  );
  return (
    <BlocoDoCaderno
      titulo="O mínimo de 25%"
      fonte={bloco.fonte}
      ano={`${primeiro?.ano} a ${bloco.anos.at(-1)?.ano}`}
      nota={
        abaixoNaEmenda && (
          <p>
            A Emenda Constitucional 119, de 2022, afastou as penalidades por não aplicar o mínimo em 2020 e 2021.
            {bloco.emenda119 &&
              ` O SIOPE registra ${moeda(bloco.emenda119.diferencaEm2021)} a menos em 2021 e ${moeda(bloco.emenda119.complementadoEm2022)} complementados em 2022.`}
          </p>
        )
      }
    >
      <p className="edu-dinheiro-frase">
        A Constituição exige que o município aplique pelo menos 25% da receita de impostos em educação.{' '}
        {fraseDosAnos(bloco.anos)}
      </p>
      <BarrasPorAno
        barras={barrasDoIndice(bloco.anos)}
        descricao="Percentual aplicado em educação, por ano"
        unidade="%"
        casas={2}
        maximo={35}
        minimo={{ valor: bloco.anos[0]?.minimo ?? 25, rotulo: 'Mínimo legal' }}
        detalhar={emReaisNaDica(bloco.anos, 'aplicados em educação')}
      />
      <AvisoDoSiconfi anos={bloco.anos} />
    </BlocoDoCaderno>
  );
}

function BlocoDoFundeb({ bloco }: { bloco: BlocoDoIndice }) {
  return (
    <BlocoDoCaderno
      titulo="Fundeb na remuneração"
      fonte={bloco.fonte}
      ano={`${bloco.anos[0]?.ano} a ${bloco.anos.at(-1)?.ano}`}
      nota="O traço em cada barra marca o mínimo daquele ano."
    >
      <p className="edu-dinheiro-frase">
        A lei exige que pelo menos 70% do Fundeb vá para a remuneração dos profissionais da educação (em 2020, eram
        60%). {fraseDosAnos(bloco.anos)}
      </p>
      <BarrasPorAno
        barras={bloco.anos.map((a) => ({ ano: a.ano, valor: a.percentual, minimo: a.minimo }))}
        descricao="Fundeb na remuneração, por ano"
        unidade="%"
        casas={2}
        maximo={100}
        detalhar={emReaisNaDica(bloco.anos, 'na remuneração')}
      />
      <AvisoDoSiconfi anos={bloco.anos} />
    </BlocoDoCaderno>
  );
}

type Gasto = NonNullable<EducacaoDinheiro['gasto']>;
type AnoDoGasto = Gasto['anos'][number];

function seloDoGasto(anos: readonly AnoDoGasto[]): DadosDoSelo {
  const conferidos = anos.filter((a) => a.conferencia === 'conferido').map((a) => String(a.ano));
  if (!conferidos.length) return SELO_FONTE_UNICA;
  return {
    estado: 'confere',
    titulo: `conferido com a Betha em ${emLista(conferidos)}`,
    motivo: 'Demais anos: fonte única.',
  };
}

function textoDoDivisor({ divisor }: AnoDoGasto) {
  if (!divisor) return null;
  const origem = divisor.tipo === 'censo' ? `Censo ${divisor.ano}` : `estimativa ${divisor.ano}`;
  return `÷ ${numero(divisor.populacao)} moradores, ${origem}`;
}

// Um cartão por ano: o gasto, com o selo do ano ao lado, e embaixo por morador e participação. O divisor do por
// morador fica na dica. Nenhum dos três tem sentido de melhor ou pior, por isso não há seta.
function CartaoDoAno({ ano }: { ano: AnoDoGasto }) {
  const divisor = textoDoDivisor(ano);
  return (
    <div role="group" aria-label={`Gasto em ${ano.ano}`} className="edu-dinheiro-ano">
      <h3>{ano.ano}</h3>
      <p className="edu-dinheiro-ano-gasto">
        <strong>{moeda(ano.liquidado)}</strong>
        <Selo selo={ano.conferencia === 'conferido' ? SELO_CONFERIDO_COM_A_BETHA : SELO_FONTE_UNICA} />
      </p>
      <div className="edu-dinheiro-ano-razoes">
        <p>
          <strong>{moeda(ano.porMorador)}</strong> por morador
          {divisor && (
            <>
              {' '}
              <Detalhes rotulo="como se calcula">{divisor}</Detalhes>
            </>
          )}
        </p>
        <p>
          <strong>{umaCasa(ano.participacao)}</strong> da despesa total
        </p>
      </div>
    </div>
  );
}

function BlocoDoGasto({ bloco, correcao }: { bloco: Gasto; correcao: Correcao }) {
  const { inflacao, valores } = correcao;
  const crescimento = inflacao && fraseDoCrescimento(bloco.crescimentoReal);
  const outroNoAnexo8 = bloco.anos.filter((a) => a.anexo8 !== null && !a.igualAoAnexo8).map((a) => String(a.ano));
  const igualAoAnexo8 = bloco.anos.filter((a) => a.igualAoAnexo8).map((a) => String(a.ano));
  const porMorador = (barra: { ano: number | string }) => {
    const valor = bloco.anos.find((a) => a.ano === barra.ano)?.porMorador ?? null;
    return valor === null ? null : `${moeda(valor)} por morador`;
  };
  return (
    <BlocoDoCaderno
      titulo="Quanto foi gasto com educação"
      selo={seloDoGasto(bloco.anos)}
      fonte={bloco.fonte}
      ano={`${bloco.anos[0]?.ano} a ${bloco.anos.at(-1)?.ano}`}
      nota={
        <>
          <p>Valor liquidado, {emReaisDe(inflacao, valores)}. Os cartões de cada ano seguem nominais.</p>
          <Detalhes>
            <p>Participação: função 12 ÷ despesa total, sem a função 01, a Câmara.</p>
            {igualAoAnexo8.length > 0 && <p>Em {emLista(igualAoAnexo8)}, o Anexo 8 do SIOPE traz o mesmo valor.</p>}
            {outroNoAnexo8.length > 0 && (
              <p>
                Em {emLista(outroNoAnexo8)}, o Anexo 8 do SIOPE traz outro valor. <LinkParaDiscrepancias />
              </p>
            )}
          </Detalhes>
        </>
      }
    >
      {crescimento && <p className="edu-dinheiro-frase">{crescimento}</p>}
      <AlternadorDeValores {...correcao} />
      <BarrasPorAno
        barras={bloco.anos.map((a) => ({ ano: a.ano, valor: valores === 'corrigido' ? a.corrigido : a.liquidado }))}
        descricao="Gasto com educação, valor liquidado, por ano"
        formatar={emMilhoes}
        detalhar={porMorador}
      />
      <div className="edu-dinheiro-anos">
        {bloco.anos.map((ano) => (
          <CartaoDoAno key={ano.ano} ano={ano} />
        ))}
      </div>
    </BlocoDoCaderno>
  );
}

const NOME_DA_ETAPA = {
  fundamental: 'Fundamental',
  infantil: 'Educação infantil',
  superior: 'Ensino superior',
  outras: 'Outras',
} as const;

function fraseDaEtapa({ anos }: Gasto) {
  const infantil = (ano: AnoDoGasto | undefined) => ano?.etapas.find((e) => e.chave === 'infantil')?.percentual ?? null;
  const [primeiro, ultimo] = [anos[0], anos.at(-1)];
  const de = infantil(primeiro);
  const para = infantil(ultimo);
  if (de === null || para === null || primeiro === ultimo) return null;
  return `A educação infantil passou de ${umaCasa(de)} para ${umaCasa(para)} do gasto entre ${primeiro?.ano} e ${ultimo?.ano}.`;
}

function NotaDasEtapas({ acoes }: { acoes: Gasto['acoesNasEtapas'] }) {
  if (acoes?.transporte == null || acoes.merenda == null) {
    return <>O transporte escolar está todo no fundamental, e a merenda, em Outras.</>;
  }
  return (
    <>
      Em {acoes.ano}, o transporte escolar ({moeda(acoes.transporte)}) está todo no fundamental, e a merenda (
      {moeda(acoes.merenda)}), em Outras.
    </>
  );
}

function BlocoDaEtapa({ bloco }: { bloco: Gasto }) {
  const frase = fraseDaEtapa(bloco);
  return (
    <BlocoDoCaderno
      titulo="Gasto por etapa"
      fonte={bloco.fonte}
      ano={`${bloco.anos[0]?.ano} a ${bloco.anos.at(-1)?.ano}`}
      nota={
        <p>
          Subfunção ÷ função 12. <NotaDasEtapas acoes={bloco.acoesNasEtapas} />
        </p>
      }
    >
      {frase && <p className="edu-dinheiro-frase">{frase}</p>}
      <BarrasEmpilhadas
        descricao="Gasto por etapa"
        linhas={bloco.anos.map((a) => ({
          rotulo: String(a.ano),
          partes: a.etapas.map((e) => ({ nome: NOME_DA_ETAPA[e.chave], valor: e.percentual })),
        }))}
      />
    </BlocoDoCaderno>
  );
}

const NOME_DA_NATUREZA = {
  pessoal: 'Pessoal',
  custeio: 'Custeio',
  investimento: 'Investimento',
  outras: 'Outras',
} as const;

function BlocoDasAcoes({ bloco }: { bloco: NonNullable<EducacaoDinheiro['acoes']> }) {
  const ultimo = bloco.anos.at(-1);
  if (!ultimo) return null;
  const comGasto = ultimo.acoes.filter((a) => (a.liquidado ?? 0) > 0);
  return (
    <BlocoDoCaderno
      titulo={`Em que o dinheiro foi gasto em ${ultimo.ano}`}
      fonte={bloco.fonte}
      ano={ultimo.ano}
      nota={
        <>
          {ultimo.totalConferido && (
            <p>
              Só o total é conferido: os {moeda(ultimo.total)} são iguais à função 12. Cada ação e cada natureza seguem
              fonte única.
            </p>
          )}
          <Detalhes>
            <p>Natureza é o grupo da despesa: 31 pessoal, 33 custeio, 44 investimento.</p>
          </Detalhes>
        </>
      }
    >
      <BarrasHorizontais
        itens={comGasto.map((a) => ({ nome: a.nome, valor: a.liquidado }))}
        descricao={`Gasto por ação em ${ultimo.ano}`}
        formatar={moeda}
        detalhar={(a) => `${pct(a.valor ?? 0, ultimo.total)} do total de ${ultimo.ano}`}
      />
      <h3 className="edu-dinheiro-subtitulo">Natureza da despesa, por ano</h3>
      <BarrasEmpilhadas
        descricao="Natureza da despesa, por ano"
        linhas={bloco.anos.map((a) => ({
          rotulo: String(a.ano),
          partes: a.naturezas.map((n) => ({ nome: NOME_DA_NATUREZA[n.chave], valor: n.percentual })),
        }))}
      />
    </BlocoDoCaderno>
  );
}

const NOME_DA_EQUIVALENCIA = { transporte: 'Transporte escolar', merenda: 'Merenda' } as const;
type Repasses = NonNullable<EducacaoDinheiro['repasses']>;

function Equivalencia({
  chave,
  atual,
  anterior,
  ano,
}: {
  chave: keyof typeof NOME_DA_EQUIVALENCIA;
  atual: Repasses['anos'][number]['equivalencias'][number];
  anterior: { ano: number; percentual: number | null } | null;
  ano: number;
}) {
  const nome = NOME_DA_EQUIVALENCIA[chave];
  if (atual.percentual === null) {
    return <p>{nome}: sem conta, porque um dos repasses ficou fora do conferido ou o gasto não tem dado.</p>;
  }
  return (
    <p>
      <strong>{nome}:</strong> em {ano}, os repasses específicos equivalem a {umaCasa(atual.percentual)} do gasto (
      {moeda(atual.repasses)} de {moeda(atual.gasto)}).
      {anterior?.percentual != null && ` ${anterior.ano}: ${umaCasa(anterior.percentual)}.`}
    </p>
  );
}

function BlocoDosRepasses({ bloco }: { bloco: Repasses }) {
  const ultimo = bloco.anos.at(-1);
  if (!ultimo) return null;
  const penultimo = bloco.anos.at(-2);
  return (
    <BlocoDoCaderno
      titulo={`Repasses recebidos em ${ultimo.ano}`}
      selo={seloConferidoComTce()}
      fonte={bloco.fonte}
      ano={ultimo.ano}
      nota="A equivalência é repasse ÷ gasto da ação, que é fonte única. A conta compara os dois valores e não mostra em que o repasse foi aplicado."
    >
      <p className="edu-dinheiro-frase">
        Rubricas da receita da Prefeitura. O Fundeb é o valor recebido: Orleans também contribui para o fundo, na conta
        abaixo.
      </p>
      <BarrasHorizontais
        itens={ultimo.rubricas.map((r) => ({
          nome: r.nome,
          valor: r.valor,
          semValor: (
            <>
              fora do conferido. <LinkParaDiscrepancias />
            </>
          ),
        }))}
        descricao={`Repasses recebidos em ${ultimo.ano}`}
        formatar={moeda}
        detalhar={() => `Recebido em ${ultimo.ano}`}
      />
      <div className="edu-dinheiro-equivalencias">
        {ultimo.equivalencias.map((e) => {
          const antes = penultimo?.equivalencias.find((x) => x.chave === e.chave);
          return (
            <Equivalencia
              key={e.chave}
              chave={e.chave}
              ano={ultimo.ano}
              atual={e}
              anterior={penultimo && antes ? { ano: penultimo.ano, percentual: antes.percentual } : null}
            />
          );
        })}
      </div>
    </BlocoDoCaderno>
  );
}

type Conta = NonNullable<EducacaoDinheiro['contaDoFundeb']>;
type AnoDaConta = Conta['anos'][number];

function Selado({ conferido }: { conferido: boolean }) {
  return <span className="edu-dinheiro-selo">{conferido && <Selo selo={seloConferidoComTce()} />}</span>;
}

function textoDaDiferenca(diferenca: number | null) {
  if (diferenca === null) return '—';
  if (diferenca === 0) return 'fecha ao centavo';
  return diferenca > 0 ? `+${moeda(diferenca)}` : `−${moeda(-diferenca)}`;
}

// Uma linha da conta: termo, valor alinhado à direita e a coluna do selo, que fica vazia quando não há selo.
function Termo({
  sinal,
  nome,
  children,
  conferido = false,
  className,
}: {
  sinal?: string;
  nome: string;
  children: ReactNode;
  conferido?: boolean;
  className?: string;
}) {
  return (
    <div className={`edu-dinheiro-termo${className ? ` ${className}` : ''}`}>
      <dt>
        {sinal && <span className="edu-dinheiro-sinal">{sinal}</span>}
        {sinal && ' '}
        {nome}
      </dt>
      <dd>
        <span className="edu-dinheiro-valor">{children}</span>
        <Selado conferido={conferido} />
      </dd>
    </div>
  );
}

// A conta armada, como no papel: os sinais ficam escritos nos termos, e o saldo fica acima do resultado oficial.
function ContaDoAno({ ano }: { ano: AnoDaConta }) {
  const id = useId();
  const comDiferenca = ano.diferenca !== null && ano.diferenca !== 0;
  return (
    <div role="group" aria-labelledby={id} className="edu-dinheiro-conta">
      <h3 id={id}>{ano.ano}</h3>
      <dl>
        <Termo sinal="+" nome="Recebido do fundo" conferido>
          {moeda(ano.recebido)}
        </Termo>
        <Termo sinal="−" nome="Contribuição ao fundo" conferido={ano.contribuicaoConferida}>
          {moeda(ano.contribuicao)}
        </Termo>
        <Termo sinal="=" nome="Recebido − contribuição" className="edu-dinheiro-saldo">
          {moeda(ano.conta)}
        </Termo>
        <Termo nome="Resultado oficial" className="edu-dinheiro-oficial">
          {moeda(ano.resultado)}
        </Termo>
        <Termo nome="Diferença" className={comDiferenca ? 'edu-dinheiro-diferenca' : 'edu-dinheiro-fecha'}>
          {textoDaDiferenca(ano.diferenca)}
        </Termo>
      </dl>
    </div>
  );
}

// "2020 a 2023" quando os anos são seguidos; senão, a lista.
function intervaloDosAnos(anos: readonly number[]) {
  const [primeiro] = anos;
  const ultimo = anos.at(-1);
  if (primeiro === undefined || ultimo === undefined) return '';
  if (anos.length === 1) return String(primeiro);
  const seguidos = anos.every((ano, i) => ano === primeiro + i);
  return seguidos ? `${primeiro} a ${ultimo}` : emLista(anos.map(String));
}

// Sem o recebido conferido, a conta não existe: uma linha por ano com o que a fonte traz, e o aviso dito uma vez.
function FaixaSemConta({ anos }: { anos: readonly AnoDaConta[] }) {
  if (!anos.length) return null;
  return (
    <div role="group" aria-label="Anos sem a conta refeita" className="edu-dinheiro-sem-conta">
      <p className="edu-dinheiro-sem-conta-aviso">
        Sem a receita conferida com o TCE-SC em {intervaloDosAnos(anos.map((a) => a.ano))}, a conta não é refeita.
      </p>
      {anos.map((ano) => (
        <div key={ano.ano} role="group" aria-label={String(ano.ano)} className="edu-dinheiro-sem-conta-ano">
          <span className="edu-dinheiro-sem-conta-rotulo" aria-hidden="true">
            {ano.ano}
          </span>
          <dl>
            {/* Sem contribuição publicada, travessão: as colunas dos anos ficam alinhadas. */}
            <Termo nome="Contribuição ao fundo" conferido={ano.contribuicao !== null && ano.contribuicaoConferida}>
              {moeda(ano.contribuicao)}
            </Termo>
            <Termo nome="Resultado oficial">{moeda(ano.resultado)}</Termo>
          </dl>
        </div>
      ))}
    </div>
  );
}

function BlocoDaConta({ bloco }: { bloco: Conta }) {
  const comDiferenca = bloco.anos.filter((a) => a.diferenca !== null && a.diferenca !== 0).map((a) => String(a.ano));
  return (
    <BlocoDoCaderno
      titulo="A conta do Fundeb"
      fonte={bloco.fonte}
      ano={`${bloco.anos[0]?.ano} a ${bloco.anos.at(-1)?.ano}`}
      nota={
        <>
          {comDiferenca.length > 0 && (
            <p>
              Em {emLista(comDiferenca)}, a conta difere do resultado oficial. Os demonstrativos publicados não explicam
              essa diferença.
            </p>
          )}
          <details className="edu-dinheiro-como-ler">
            <summary>Como ler</summary>
            <p>
              O resultado oficial é o do Anexo 8 do SIOPE, em fonte única. O recebido é a rubrica do Fundeb na receita
              conferida com o TCE-SC, e só existe nos anos com essa conferência. A complementação da União fica fora
              desta conta.
            </p>
          </details>
        </>
      }
    >
      <p className="edu-dinheiro-frase">
        O Fundeb é um fundo: a Prefeitura contribui com parte dos impostos e recebe de volta conforme as matrículas. O
        resultado é a diferença entre os dois.
      </p>
      <div className="edu-dinheiro-contas">
        {bloco.anos
          .filter((ano) => ano.recebido !== null)
          .map((ano) => (
            <ContaDoAno key={ano.ano} ano={ano} />
          ))}
      </div>
      <FaixaSemConta anos={bloco.anos.filter((ano) => ano.recebido === null)} />
    </BlocoDoCaderno>
  );
}

const ETAPAS_POR_ALUNO = [
  { chave: 'infantil', nome: 'Educação infantil' },
  { chave: 'fundamental', nome: 'Ensino fundamental' },
  { chave: 'educacaoBasica', nome: 'Educação básica' },
] as const;

function BlocoPorAluno({ bloco, correcao }: { bloco: NonNullable<EducacaoDinheiro['porAluno']>; correcao: Correcao }) {
  const corrigido = correcao.inflacao !== null && correcao.valores === 'corrigido';
  return (
    <BlocoDoCaderno
      titulo="Investimento por aluno"
      fonte={bloco.fonte}
      ano={`${bloco.anos[0]?.ano} a ${bloco.anos.at(-1)?.ano}`}
      nota={`${corrigido ? `Em reais de ${correcao.inflacao?.anoBase}, corrigidos pelo IPCA médio de cada ano` : 'Em reais nominais, como a Prefeitura declarou ao SIOPE'}. Educação básica de 2022 e 2023 não aparece: o SIOPE não recomenda esses dois valores.`}
    >
      <AlternadorDeValores {...correcao} />
      <div className="edu-dinheiro-tres">
        {ETAPAS_POR_ALUNO.map(({ chave, nome }) => (
          <div key={chave}>
            <h3>{nome}</h3>
            <BarrasPorAno
              barras={bloco.anos.map((a) => ({
                ano: a.ano,
                valor: corrigido ? (a.corrigido?.[chave] ?? null) : a[chave],
              }))}
              descricao={`Investimento por aluno, ${nome.toLowerCase()}`}
              formatar={reaisInteiros}
            />
          </div>
        ))}
      </div>
    </BlocoDoCaderno>
  );
}

function Entrada({ dados }: { dados: EducacaoDinheiro }) {
  const gasto = dados.gasto?.anos.at(-1);
  const indice = dados.minimo?.anos.find((a) => a.ano === gasto?.ano);
  return (
    <>
      {gasto && `Em ${gasto.ano}, a Prefeitura gastou ${porExtenso(gasto.liquidado)} com educação`}
      {gasto && indice && ` e aplicou ${emPct(indice.percentual)} da receita de impostos`}
      {gasto && '. '}
      {dados.inflacao
        ? 'Os valores são nominais; o gasto e o investimento por aluno também aparecem corrigidos pelo IPCA.'
        : 'Todos os valores são nominais, sem correção pela inflação.'}
    </>
  );
}

function Conteudo({ dados }: { dados: EducacaoDinheiro }) {
  const [valores, setValores] = useState<Valores>('nominal');
  const correcao: Correcao = { inflacao: dados.inflacao, valores, aoMudar: setValores };
  return (
    <>
      <p className="edu-dinheiro-csv">
        <a href="/api/educacao/dinheiro.csv" className="botao-link">
          Baixar CSV ↓
        </a>
      </p>
      {dados.minimo && <BlocoDoMinimo bloco={dados.minimo} />}
      {dados.fundebRemuneracao && <BlocoDoFundeb bloco={dados.fundebRemuneracao} />}
      {dados.gasto && <BlocoDoGasto bloco={dados.gasto} correcao={correcao} />}
      {dados.gasto && <BlocoDaEtapa bloco={dados.gasto} />}
      {dados.acoes && <BlocoDasAcoes bloco={dados.acoes} />}
      {dados.repasses && <BlocoDosRepasses bloco={dados.repasses} />}
      {dados.contaDoFundeb && <BlocoDaConta bloco={dados.contaDoFundeb} />}
      {dados.porAluno && <BlocoPorAluno bloco={dados.porAluno} correcao={correcao} />}
    </>
  );
}

export default function Dinheiro() {
  const { dados, carregando, erro } = useApi('/api/educacao/dinheiro', educacaoDinheiroSchema);
  return (
    <>
      <CabecalhoDoCaderno titulo="Quanto custa e de onde vem o dinheiro" semLegenda>
        {dados?.disponivel ? <Entrada dados={dados} /> : 'O mínimo legal, o gasto, os repasses e a conta do Fundeb.'}
      </CabecalhoDoCaderno>
      <Estado carregando={carregando} erro={erro} />
      {dados && !dados.disponivel && <p className="aviso">Os dados desta aba ainda não foram coletados.</p>}
      {dados?.disponivel && <Conteudo dados={dados} />}
    </>
  );
}
