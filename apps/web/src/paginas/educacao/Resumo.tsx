// Resumo do caderno de Educação: seis perguntas, cada uma com um número e o link para a aba. Os números vêm prontos das
// outras abas, na rede pública, ou na rede que a fonte tem, sempre escrita. Sem a fonte, só aquele cartão muda.
// O corpo de cada cartão diz só o número, uma frase curta e as setas; rede, SC e Brasil por extenso, ressalvas e
// fontes ficam no `Detalhes`, no pé, ao lado do link para a aba.
import {
  educacaoResumoSchema,
  type EducacaoResumo,
  type FonteDoBloco,
  type Rede,
  type ValoresDaRede,
} from '@orleans-em-dados/contracts';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { useApi } from '../../api';
import { Estado } from '../../components';
import { formatarValor, rotuloDaRede, type UnidadeDaComparacao } from '../../educacao';
import { BlocoDoCaderno, CabecalhoDoCaderno, Detalhes, SetasDiante, type SentidoBom } from '../../educacao/componentes';
import { moeda, numero } from '../../format';
import { Selo } from '../../selo';
import { SELO_CONFERIDO_COM_A_BETHA, SELO_FONTE_UNICA, type DadosDoSelo } from '../../selos';
import './Resumo.css';

const emTexto = formatarValor;
const CASAS_DO_CENSO = 2;
const emMilhoesComCentavos = (valor: number) =>
  `R$ ${(valor / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;

// "sem dado", nunca travessão: a linha é uma frase, e não uma tabela.
function deSCeDoBrasil(valores: ValoresDaRede, texto: (valor: number) => string) {
  const lugar = (nome: string, valor: number | null) => `${nome} ${valor === null ? 'sem dado' : texto(valor)}`;
  return `${lugar('SC', valores.santaCatarina)} · ${lugar('Brasil', valores.brasil)}`;
}

function Setas({
  valores,
  unidade,
  sentidoBom,
}: {
  valores: ValoresDaRede;
  unidade: UnidadeDaComparacao;
  sentidoBom: SentidoBom;
}) {
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

function LinhaDaFonte({
  fonte,
  ano,
  antes = 'Fonte:',
}: {
  fonte: FonteDoBloco;
  ano?: string | number;
  antes?: string;
}) {
  return (
    <p className="bloco-fonte">
      {antes && `${antes} `}
      <a href={fonte.url} target="_blank" rel="noreferrer">
        {fonte.nome}
      </a>
      {ano !== undefined && ` · ${ano}`}
    </p>
  );
}

function Cartao({
  pergunta,
  aba,
  nomeDaAba,
  temDado,
  selo = SELO_FONTE_UNICA,
  numeroPrincipal,
  frase,
  setas,
  linhaCurta,
  detalhes,
}: {
  pergunta: string;
  aba: string;
  nomeDaAba: string;
  temDado: boolean;
  selo?: DadosDoSelo | null;
  numeroPrincipal?: string | null;
  frase?: ReactNode;
  setas?: ReactNode;
  linhaCurta?: ReactNode;
  detalhes?: ReactNode;
}) {
  const id = useId();
  return (
    <article className="edu-resumo-cartao" aria-labelledby={id}>
      <div className="edu-resumo-pergunta">
        <h2 id={id}>{pergunta}</h2>
        {temDado && selo && <Selo selo={selo} />}
      </div>
      {temDado ? (
        <div className="edu-resumo-resposta">
          {numeroPrincipal && <span className="edu-resumo-numero">{numeroPrincipal}</span>}
          {frase && <p className="edu-resumo-frase">{frase}</p>}
          {setas}
          {linhaCurta}
        </div>
      ) : (
        <p className="edu-resumo-sem-dado">Ainda sem dado coletado para esta pergunta.</p>
      )}
      <div className="edu-resumo-rodape">
        <a href={aba} className="edu-resumo-link">
          Ver {nomeDaAba} →
        </a>
        {temDado && detalhes && <Detalhes>{detalhes}</Detalhes>}
      </div>
    </article>
  );
}

const inteiro = (valor: number) => emTexto(valor, '%', 0);

function metaEmTexto(meta: number | string) {
  return typeof meta === 'number' ? inteiro(meta) : `${meta}%`;
}

// SC e o Brasil costumam estar na mesma rede; se não estiverem, cada um diz a sua.
function comparacaoDaAlfabetizacao({ valores, redes }: NonNullable<EducacaoResumo['alfabetizacao']>) {
  const { santaCatarina: sc, brasil } = redes;
  if (sc === brasil) {
    const rede = sc ? ` (${rotuloDaRede(sc)})` : '';
    return `${deSCeDoBrasil(valores, inteiro)}${rede}`;
  }
  const noLugar = (nome: string, valor: number | null, rede: Rede | null) =>
    `${nome} ${valor === null ? 'sem dado' : inteiro(valor)}${rede ? ` (${rotuloDaRede(rede)})` : ''}`;
  return `${noLugar('SC', valores.santaCatarina, sc)} · ${noLugar('Brasil', valores.brasil, brasil)}`;
}

function CartaoDaLeitura({ bloco }: { bloco: EducacaoResumo['alfabetizacao'] }) {
  const redeDeOrleans = bloco?.redes.orleans ?? 'municipal';
  const outraRede = bloco && [bloco.redes.santaCatarina, bloco.redes.brasil].some((r) => r && r !== redeDeOrleans);
  return (
    <Cartao
      pergunta="As crianças aprendem a ler na idade certa?"
      aba="#educacao-aprendizado"
      nomeDaAba="aprendizado"
      temDado={bloco !== null}
      numeroPrincipal={bloco && inteiro(bloco.valores.orleans as number)}
      frase={bloco && `dos alunos do 2º ano estavam alfabetizados em ${bloco.ano}.`}
      setas={bloco && <Setas valores={bloco.valores} unidade="%" sentidoBom="maior" />}
      detalhes={
        bloco && (
          <>
            <p>
              Orleans: {rotuloDaRede(redeDeOrleans)}; {comparacaoDaAlfabetizacao(bloco)}.
            </p>
            {outraRede && <p>A seta compara redes diferentes, como a fonte as publica.</p>}
            {bloco.metaDeOrleans !== null && (
              <p>
                Meta de Orleans para {bloco.ano}: {metaEmTexto(bloco.metaDeOrleans)}.
              </p>
            )}
            <LinhaDaFonte fonte={bloco.fonte} ano={bloco.ano} />
          </>
        )
      }
    />
  );
}

function CartaoDaCreche({
  bloco,
  procura,
}: {
  bloco: EducacaoResumo['creche'];
  procura: EducacaoResumo['procuraPorCreche'];
}) {
  const emPct = (valor: number) => emTexto(valor, '%', CASAS_DO_CENSO);
  return (
    <Cartao
      pergunta="Os pequenos têm vaga na creche?"
      aba="#educacao-acesso"
      nomeDaAba="acesso"
      temDado={bloco !== null}
      numeroPrincipal={bloco && emPct(bloco.valores.orleans as number)}
      frase={bloco && `das crianças de 0 a 3 anos frequentavam creche em ${bloco.ano}.`}
      setas={bloco && <Setas valores={bloco.valores} unidade="%" sentidoBom="maior" />}
      detalhes={
        bloco && (
          <>
            {bloco.orleansNoAnoAnterior !== null && (
              <p>
                Em {bloco.anoAnterior} eram {emTexto(bloco.orleansNoAnoAnterior, '%')}.
              </p>
            )}
            <p>
              {deSCeDoBrasil(bloco.valores, emPct)} ({rotuloDaRede(bloco.rede)}: o Censo não abre rede).
            </p>
            {procura?.solicitacoesNaoAtendidas && (
              <p>
                Pedidos de vaga não atendidos: “{procura.solicitacoesNaoAtendidas}”, a Prefeitura informou ao MEC em{' '}
                {procura.ano}. Não há número público da fila.
              </p>
            )}
            <LinhaDaFonte
              fonte={bloco.fonte}
              ano={`${bloco.ano}; ${bloco.anoAnterior}: cálculo a partir do Censo ${bloco.anoAnterior}`}
            />
            {procura?.solicitacoesNaoAtendidas && <LinhaDaFonte fonte={procura.fonte} ano={procura.ano} />}
          </>
        )
      }
    />
  );
}

function CartaoDaPermanencia({ bloco }: { bloco: EducacaoResumo['abandono'] }) {
  const emPct = (valor: number) => emTexto(valor, '%');
  const deOrleans = (valores: ValoresDaRede | null) => valores?.orleans ?? null;
  const iniciais = bloco && deOrleans(bloco.anosIniciais);
  const finais = bloco && deOrleans(bloco.anosFinais);
  const trechos = [
    iniciais != null ? `nos anos iniciais, ${emPct(iniciais)}` : null,
    finais != null ? `nos anos finais, ${emPct(finais)}` : null,
  ].filter((t) => t !== null);
  const fundamental = trechos.join('; ');
  return (
    <Cartao
      pergunta="Os alunos ficam na escola até o fim do ano?"
      aba="#educacao-permanencia"
      nomeDaAba="permanência"
      temDado={bloco !== null}
      numeroPrincipal={bloco && emPct(bloco.valores.orleans as number)}
      frase={bloco && `dos alunos do ensino médio deixaram a escola durante ${bloco.ano}.`}
      setas={bloco && <Setas valores={bloco.valores} unidade="%" sentidoBom="menor" />}
      detalhes={
        bloco && (
          <>
            <p>
              {deSCeDoBrasil(bloco.valores, emPct)} ({rotuloDaRede(bloco.rede)}).
            </p>
            {fundamental && <p>{`No fundamental: ${fundamental.charAt(0).toUpperCase()}${fundamental.slice(1)}.`}</p>}
            <LinhaDaFonte fonte={bloco.fonte} ano={bloco.ano} />
          </>
        )
      }
    />
  );
}

function CartaoDasNotas({ bloco }: { bloco: EducacaoResumo['ideb'] }) {
  const noIndice = (valor: number) => emTexto(valor, 'indice');
  return (
    <Cartao
      pergunta="Como estão as notas?"
      aba="#educacao-aprendizado"
      nomeDaAba="aprendizado"
      temDado={bloco !== null}
      numeroPrincipal={bloco && noIndice(bloco.valores.orleans as number)}
      frase={bloco && `é o IDEB dos anos iniciais em ${bloco.ano}, numa escala de 0 a 10.`}
      setas={bloco && <Setas valores={bloco.valores} unidade="indice" sentidoBom="maior" />}
      detalhes={
        bloco && (
          <>
            <p>Anos iniciais: 1º ao 5º ano.</p>
            <p>
              {deSCeDoBrasil(bloco.valores, noIndice)} ({rotuloDaRede(bloco.rede)}).
            </p>
            <LinhaDaFonte fonte={bloco.fonte} ano={bloco.ano} />
          </>
        )
      }
    />
  );
}

function CartaoDeQuemDaAula({
  bloco,
  turmas,
}: {
  bloco: EducacaoResumo['docentesSuperior'];
  turmas: EducacaoResumo['turmas'];
}) {
  const emPct = (valor: number) => emTexto(valor, '%');
  const porTurma = (valor: number) => emTexto(valor, 'indice');
  return (
    <Cartao
      pergunta="Quem dá aula?"
      aba="#educacao-professores"
      nomeDaAba="professores e turmas"
      temDado={bloco !== null}
      numeroPrincipal={bloco && emPct(bloco.valores.orleans as number)}
      frase={bloco && `dos docentes dos anos iniciais têm curso superior, em ${bloco.ano}.`}
      setas={bloco && <Setas valores={bloco.valores} unidade="%" sentidoBom="maior" />}
      detalhes={
        bloco && (
          <>
            <p>
              {deSCeDoBrasil(bloco.valores, emPct)} ({rotuloDaRede(bloco.rede)}).
            </p>
            <LinhaDaFonte fonte={bloco.fonte} ano={bloco.ano} />
            {turmas && (
              <>
                <p>
                  Turmas: {porTurma(turmas.valores.orleans as number)} alunos em média, nos anos iniciais.{' '}
                  {deSCeDoBrasil(turmas.valores, porTurma)}.
                </p>
                <LinhaDaFonte fonte={turmas.fonte} ano={turmas.ano} />
              </>
            )}
          </>
        )
      }
    />
  );
}

function AvisoDoSiconfi({ minimo }: { minimo: NonNullable<EducacaoResumo['minimo']> }) {
  const { siconfi, percentual, difereDoSiconfi } = minimo;
  if (!difereDoSiconfi || !siconfi) return null;
  const emPct = (valor: number | null) => emTexto(valor, '%', 2);
  const texto =
    siconfi.percentual === percentual
      ? `O SICONFI registra o mesmo percentual e ${moeda(siconfi.valor)}, e o SIOPE, ${moeda(minimo.aplicado)}.`
      : `O SICONFI registra ${emPct(siconfi.percentual)}.`;
  return (
    <p>
      {texto} <a href="#discrepancias">Ver a diferença em Discrepâncias</a>
    </p>
  );
}

const seloDoGasto = (gasto: NonNullable<EducacaoResumo['gasto']>) =>
  gasto.conferencia === 'conferido' ? SELO_CONFERIDO_COM_A_BETHA : SELO_FONTE_UNICA;

function CartaoDoDinheiro({ gasto, minimo }: { gasto: EducacaoResumo['gasto']; minimo: EducacaoResumo['minimo'] }) {
  return (
    <Cartao
      pergunta="Quanto a Prefeitura gasta com educação?"
      aba="#educacao-dinheiro"
      nomeDaAba="dinheiro"
      temDado={gasto !== null || minimo !== null}
      selo={gasto && seloDoGasto(gasto)}
      numeroPrincipal={gasto && emMilhoesComCentavos(gasto.liquidado)}
      frase={gasto && `liquidados em ${gasto.ano}, em reais nominais.`}
      linhaCurta={
        minimo && (
          <p className="edu-resumo-minimo">
            {emTexto(minimo.percentual, '%', 2)} da receita de impostos aplicados em {minimo.ano}; a lei exige{' '}
            {inteiro(minimo.minimo)}. <Selo selo={SELO_FONTE_UNICA} />
          </p>
        )
      }
      detalhes={
        <>
          {gasto && (
            <>
              <p>
                {moeda(gasto.liquidado)} liquidados em {gasto.ano}, sem correção pela inflação.
                {gasto.igualAoAnexo8 && ' O Anexo 8 do SIOPE traz o mesmo valor.'}
              </p>
              <LinhaDaFonte fonte={gasto.fonte} ano={gasto.ano} />
            </>
          )}
          {minimo && (
            <>
              <AvisoDoSiconfi minimo={minimo} />
              <LinhaDaFonte fonte={minimo.fonte} ano={minimo.ano} antes="Mínimo legal:" />
            </>
          )}
        </>
      }
    />
  );
}

const rotuloDoDivisor = ({ ano, populacao, tipo }: NonNullable<NonNullable<EducacaoResumo['gasto']>['divisor']>) =>
  `IBGE, ${tipo === 'censo' ? 'Censo' : 'estimativa'} ${ano}: ${numero(populacao)} moradores`;

function NumeroDoResumo({
  valor,
  rotulo,
  selo,
  detalhes,
}: {
  valor: string;
  rotulo: string;
  selo: DadosDoSelo;
  detalhes: ReactNode;
}) {
  return (
    <li>
      <span className="edu-resumo-pouco">{valor}</span>
      <span>{rotulo}</span>
      <span className="edu-resumo-detalhe">
        <Selo selo={selo} />
        <Detalhes>{detalhes}</Detalhes>
      </span>
    </li>
  );
}

function EmPoucosNumeros({
  matriculas,
  gasto,
  moradores,
}: {
  matriculas: EducacaoResumo['matriculas'];
  gasto: EducacaoResumo['gasto'];
  moradores: EducacaoResumo['alfabetizacaoDosMoradores'];
}) {
  const porMorador = gasto?.porMorador ?? null;
  if (!matriculas && porMorador === null && !moradores) return null;
  return (
    <BlocoDoCaderno titulo="Em poucos números" selo={null}>
      <ul className="edu-resumo-poucos">
        {matriculas && (
          <NumeroDoResumo
            valor={numero(matriculas.total)}
            rotulo={`matrículas da creche ao ensino médio em ${matriculas.ano}`}
            selo={SELO_FONTE_UNICA}
            detalhes={
              <p>
                Todas as redes.{' '}
                <a href={matriculas.fonte.url} target="_blank" rel="noreferrer">
                  {matriculas.fonte.nome}
                </a>{' '}
                · {matriculas.ano}
              </p>
            }
          />
        )}
        {gasto && porMorador !== null && (
          <NumeroDoResumo
            valor={moeda(porMorador)}
            rotulo={`de gasto com educação por morador, em ${gasto.ano}`}
            selo={seloDoGasto(gasto)}
            detalhes={
              <>
                {gasto.divisor && (
                  <p>
                    Gasto de {gasto.ano} dividido pelos moradores: {rotuloDoDivisor(gasto.divisor)}.
                  </p>
                )}
                <LinhaDaFonte fonte={gasto.fonte} ano={gasto.ano} />
              </>
            }
          />
        )}
        {moradores && (
          <NumeroDoResumo
            valor={emTexto(moradores.valores.orleans, '%', CASAS_DO_CENSO)}
            rotulo={`dos moradores com 15 anos ou mais sabem ler e escrever, no Censo ${moradores.ano}`}
            selo={SELO_FONTE_UNICA}
            detalhes={<LinhaDaFonte fonte={moradores.fonte} ano={moradores.ano} antes="" />}
          />
        )}
      </ul>
    </BlocoDoCaderno>
  );
}

const NOMES_DE_QUEM = { municipal: 'Prefeitura', estadual: 'Estado', federal: 'União', privada: 'escolas privadas' };
const REDES_DE_QUEM = ['municipal', 'estadual', 'federal', 'privada'] as const;
const LINHAS_DE_QUEM = [
  { nome: 'Creche e pré-escola', etapas: ['creche', 'pre_escola'] },
  { nome: 'Ensino fundamental', etapas: ['fundamental'] },
  { nome: 'Ensino médio', etapas: ['medio'] },
];

const emLista = (itens: readonly string[]) =>
  new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(itens);

// Quem tem matrícula na etapa. Com a lista mais longa, fica "Prefeitura, Estado e escolas privadas".
function quemAtende(etapas: NonNullable<EducacaoResumo['matriculas']>['etapas'], nomes: readonly string[]) {
  const daLinha = etapas.filter((e) => nomes.includes(e.etapa));
  const redes = REDES_DE_QUEM.filter((rede) => daLinha.some((e) => (e[rede] ?? 0) > 0));
  return redes.length ? emLista(redes.map((rede) => NOMES_DE_QUEM[rede])) : null;
}

function QuemCuida({
  matriculas,
  superior,
}: {
  matriculas: EducacaoResumo['matriculas'];
  superior: EducacaoResumo['superior'];
}) {
  const linhas = matriculas
    ? LINHAS_DE_QUEM.flatMap(({ nome, etapas }) => {
        const quem = quemAtende(matriculas.etapas, etapas);
        return quem ? [{ nome, quem }] : [];
      })
    : [];
  if (!linhas.length && !superior) return null;
  const doSuperior = superior && [superior.instituicao, superior.natureza].filter(Boolean).join(', ');
  return (
    <BlocoDoCaderno titulo="Quem cuida de quê">
      <dl className="edu-resumo-quem">
        {linhas.map(({ nome, quem }) => (
          <div key={nome}>
            <dt>{nome}</dt>
            <dd>{quem}</dd>
          </div>
        ))}
        {superior && (
          <div>
            <dt>Ensino superior presencial</dt>
            <dd>{doSuperior}</dd>
          </div>
        )}
      </dl>
      <div className="edu-resumo-quem-pe">
        <p>Nada aqui é mostrado por escola.</p>
        <Detalhes>
          <p>
            Rede com rede onde a fonte abre a rede: a municipal com as municipais, a estadual com as estaduais. A
            alfabetização compara a rede municipal de Orleans com a pública de SC e do Brasil, e o Censo não abre rede.
          </p>
          {matriculas && <LinhaDaFonte fonte={matriculas.fonte} ano={matriculas.ano} antes="Matrículas:" />}
          {superior && <LinhaDaFonte fonte={superior.fonte} ano={superior.ano} antes="Ensino superior:" />}
        </Detalhes>
      </div>
    </BlocoDoCaderno>
  );
}

function Conteudo({ dados }: { dados: EducacaoResumo }) {
  return (
    <>
      <p className="edu-resumo-csv">
        <a href="/api/educacao/resumo.csv" className="botao-link">
          Baixar CSV ↓
        </a>
      </p>
      <div className="edu-resumo-cartoes">
        <CartaoDaLeitura bloco={dados.alfabetizacao} />
        <CartaoDaCreche bloco={dados.creche} procura={dados.procuraPorCreche} />
        <CartaoDaPermanencia bloco={dados.abandono} />
        <CartaoDasNotas bloco={dados.ideb} />
        <CartaoDeQuemDaAula bloco={dados.docentesSuperior} turmas={dados.turmas} />
        <CartaoDoDinheiro gasto={dados.gasto} minimo={dados.minimo} />
      </div>
      <EmPoucosNumeros matriculas={dados.matriculas} gasto={dados.gasto} moradores={dados.alfabetizacaoDosMoradores} />
      <QuemCuida matriculas={dados.matriculas} superior={dados.superior} />
    </>
  );
}

export default function Resumo() {
  const { dados, carregando, erro } = useApi('/api/educacao/resumo', educacaoResumoSchema);
  return (
    <>
      <CabecalhoDoCaderno titulo="Como vai a educação em Orleans" semLegenda>
        Seis perguntas para começar. Onde há comparação, a seta diz como Orleans está diante de Santa Catarina e do
        Brasil, e cada resposta leva para a aba com os detalhes.
      </CabecalhoDoCaderno>
      <Estado carregando={carregando} erro={erro} />
      {dados && !dados.disponivel && <p className="aviso">Os dados desta aba ainda não foram coletados.</p>}
      {dados?.disponivel && <Conteudo dados={dados} />}
    </>
  );
}
