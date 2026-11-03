// O retrato da cidade pelo IBGE. Cada número traz o próprio ano e o selo de fonte única: não há
// outra fonte para conferir. Só o dinheiro fica em cartão; o resto é uma lista. O que é comparável diz quanto
// está acima ou abaixo de Santa Catarina e do Brasil, no mesmo ano. A página não usa o filtro de exercício nem o de entidade.
import {
  municipioSchema,
  type Comparacao,
  type IndicadoresDoLugar,
  type MunicipioDisponivel,
} from '@orleans-em-dados/contracts';
import { useState, type ReactNode } from 'react';
import { useApi } from '../api';
import { posicao, SETA } from '../comparacao';
import { BarraDividida, Estado, Numero, Numeros, Piramide } from '../components';
import { dataHora, decimal, moeda, numero, porExtenso } from '../format';
import { Selo } from '../selo';
import { SELO_FONTE_UNICA } from '../selos';

const seloDeFonteUnica = <Selo compacto selo={SELO_FONTE_UNICA} />;
const rotuloDoTipo = (tipo: 'censo' | 'estimativa', ano: number) =>
  tipo === 'censo' ? `Censo ${ano}` : `estimativa ${ano}`;
const umaCasa = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const emReais = (milReais: number) => milReais * 1000;

export default function ConhecaOrleans() {
  const { dados, carregando, erro } = useApi('/api/municipio', municipioSchema);
  return (
    <>
      <Estado carregando={carregando} erro={erro} />
      {dados && !dados.disponivel && (
        <p className="aviso">Os dados do IBGE ainda não foram coletados. Faltam: {dados.faltando.join(', ')}.</p>
      )}
      {dados?.disponivel && <Conteudo dados={dados} />}
    </>
  );
}

function Crescimento({ serie }: { serie: MunicipioDisponivel['populacao']['serie'] }) {
  const censos = serie.filter((p) => p.tipo === 'censo');
  const [antes, depois] = censos.slice(-2);
  if (!antes || !depois) return null;
  const variacao = ((depois.populacao - antes.populacao) / antes.populacao) * 100;
  return (
    <p className="capitular">
      Entre os censos de {antes.ano} e {depois.ano}, a população passou de {numero(antes.populacao)} para{' '}
      {numero(depois.populacao)} moradores: {umaCasa(variacao)}% em {depois.ano - antes.ano} anos. As estimativas dos
      outros anos são projeções do IBGE, e aparecem marcadas como estimativa.
    </p>
  );
}

const comSinal = (v: number) => `${v > 0 ? '+' : ''}${umaCasa(v)}%`;
const emPorcento = (v: number) => `${umaCasa(v)}%`;

const LUGARES = [
  { chave: 'santaCatarina', de: 'de Santa Catarina', a: 'a Santa Catarina' },
  { chave: 'brasil', de: 'do Brasil', a: 'ao Brasil' },
] as const;

function DianteDosLugares({
  comparacao,
  indicador,
  formatar,
  em,
  maiorEBom,
}: {
  comparacao: Comparacao;
  indicador: (lugar: IndicadoresDoLugar) => number | null;
  formatar: (valor: number) => string;
  em: 'percentual' | 'pontos';
  maiorEBom?: boolean;
}) {
  const orleans = indicador(comparacao.orleans);
  return (
    <ul className="diante-dos-lugares">
      {LUGARES.map(({ chave, de, a }) => {
        const valor = indicador(comparacao[chave]);
        const onde = posicao(orleans, valor, { em, maiorEBom });
        if (!onde || valor === null) return null;
        return (
          <li key={chave} className={onde.tom ?? undefined}>
            <span aria-hidden="true">{SETA[onde.sentido]}</span>{' '}
            {onde.sentido === 'igual' ? `igual ${a}` : `${onde.texto} ${onde.sentido} ${de}`} ({formatar(valor)})
          </li>
        );
      })}
    </ul>
  );
}

const ANOS_RECENTES = 5;

// Fechada, a série mostra os anos mais recentes e os censos: o crescimento é dito entre censos, e as estimativas
// antigas só alongariam a coluna. A escala do trilho é a da série inteira: abrir não muda o tamanho das barras.
function SerieDaPopulacao({ serie }: { serie: MunicipioDisponivel['populacao']['serie'] }) {
  const [aberta, setAberta] = useState(false);
  const todos = [...serie].reverse();
  const resumo = todos.filter((p, i) => i < ANOS_RECENTES || p.tipo === 'censo');
  const escondidos = todos.length - resumo.length;
  const maior = Math.max(...serie.map((p) => p.populacao), 1);
  return (
    <>
      <div className="tabela-rolagem">
        <table aria-label="População de Orleans por ano" className="tabela-populacao">
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col" className="num">
                Moradores
              </th>
              <th scope="col">Dado</th>
            </tr>
          </thead>
          <tbody>
            {(aberta ? todos : resumo).map((p) => (
              <tr key={p.ano} className={p.tipo === 'censo' ? 'linha-censo' : undefined}>
                <th scope="row">{p.ano}</th>
                <td className="num">
                  {numero(p.populacao)}
                  <div className="trilho" aria-hidden="true">
                    <span style={{ width: `${(p.populacao / maior) * 100}%` }} />
                  </div>
                </td>
                <td>{p.tipo === 'censo' ? 'Censo' : 'Estimativa'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {escondidos > 0 && (
        <button type="button" className="botao-texto" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
          {aberta ? 'Ver menos' : `Ver mais ${escondidos} ${escondidos === 1 ? 'ano' : 'anos'}`}
        </button>
      )}
    </>
  );
}

type ItemDoRetrato = { nome: string; valor: string; unidade?: string; comparar?: ReactNode };

function ListaDoRetrato({ classe, itens }: { classe: string; itens: ItemDoRetrato[] }) {
  if (!itens.length) return null;
  return (
    <ul className={`lista-retrato ${classe}`}>
      {itens.map(({ nome, valor, unidade, comparar }) => (
        <li key={nome}>
          <span className="lista-retrato-nome">{nome}</span>
          <span className="lista-retrato-valor">
            <span>{valor}</span>
            {unidade && <span className="lista-retrato-unidade"> {unidade}</span>}
          </span>
          {comparar}
        </li>
      ))}
    </ul>
  );
}

function Conteudo({ dados }: { dados: MunicipioDisponivel }) {
  const { populacao, territorio, situacao, piramide, rendimento, pib, comparacao, meta } = dados;
  const recente = populacao.serie.at(-1);
  const censo = populacao.serie.findLast((p) => p.tipo === 'censo');
  const pibRecente = pib.serie.at(-1);
  const pibDaComposicao = pib.serie.find((p) => p.ano === pib.ultimoAnoDaComposicao);
  const composicao = pibDaComposicao?.composicao;
  const itens: ItemDoRetrato[] = [
    ...(recente
      ? [
          {
            nome: `População, ${rotuloDoTipo(recente.tipo, recente.ano)}`,
            valor: numero(recente.populacao),
            unidade: 'moradores',
          },
        ]
      : []),
    ...(censo ? [{ nome: `População, Censo ${censo.ano}`, valor: numero(censo.populacao), unidade: 'moradores' }] : []),
    { nome: `Área, Censo ${territorio.ano}`, valor: umaCasa(territorio.areaKm2), unidade: 'km²' },
    {
      nome: `Densidade, Censo ${territorio.ano}`,
      valor: decimal(territorio.densidade),
      unidade: 'moradores por km²',
      comparar: comparacao && (
        <DianteDosLugares comparacao={comparacao} indicador={(l) => l.densidade} formatar={decimal} em="percentual" />
      ),
    },
    ...(comparacao
      ? [
          {
            nome: `Moradores na área urbana, Censo ${comparacao.anoDoCenso}`,
            valor: emPorcento(comparacao.orleans.urbana),
            comparar: (
              <DianteDosLugares comparacao={comparacao} indicador={(l) => l.urbana} formatar={emPorcento} em="pontos" />
            ),
          },
          {
            nome: `Crescimento da população, ${comparacao.anoDoCensoAnterior} a ${comparacao.anoDoCenso}`,
            valor: comparacao.orleans.crescimento === null ? '—' : comSinal(comparacao.orleans.crescimento),
            comparar: (
              <DianteDosLugares
                comparacao={comparacao}
                indicador={(l) => l.crescimento}
                formatar={comSinal}
                em="pontos"
              />
            ),
          },
          {
            nome: `Moradores com até 14 anos, Censo ${comparacao.anoDoCenso}`,
            valor: emPorcento(comparacao.orleans.ate14Anos),
            comparar: (
              <DianteDosLugares
                comparacao={comparacao}
                indicador={(l) => l.ate14Anos}
                formatar={emPorcento}
                em="pontos"
              />
            ),
          },
          {
            nome: `Moradores com 60 anos ou mais, Censo ${comparacao.anoDoCenso}`,
            valor: emPorcento(comparacao.orleans.aPartirDe60Anos),
            comparar: (
              <DianteDosLugares
                comparacao={comparacao}
                indicador={(l) => l.aPartirDe60Anos}
                formatar={emPorcento}
                em="pontos"
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          {recente ? (
            <>
              Orleans tem <em>{numero(recente.populacao)} moradores</em>, pela {rotuloDoTipo(recente.tipo, recente.ano)}{' '}
              do IBGE.
            </>
          ) : (
            <>Quem mora em Orleans.</>
          )}
        </h1>
        <div className="abertura-lado">
          <Crescimento serie={populacao.serie} />
        </div>
      </div>

      <Numeros rotulo="Renda e produção">
        <Numero
          rotulo={`Rendimento médio por pessoa, Censo ${rendimento.ano}`}
          detalhe="por mês, no domicílio"
          comparacao={
            comparacao && (
              <DianteDosLugares
                comparacao={comparacao}
                indicador={(l) => l.rendimentoMedio}
                formatar={moeda}
                em="percentual"
                maiorEBom
              />
            )
          }
          selo={seloDeFonteUnica}
        >
          {moeda(rendimento.medio)}
        </Numero>
        <Numero
          rotulo={`Rendimento mediano por pessoa, Censo ${rendimento.ano}`}
          detalhe="metade dos moradores fica abaixo"
          comparacao={
            comparacao && (
              <DianteDosLugares
                comparacao={comparacao}
                indicador={(l) => l.rendimentoMediano}
                formatar={moeda}
                em="percentual"
                maiorEBom
              />
            )
          }
          selo={seloDeFonteUnica}
        >
          {moeda(rendimento.mediano)}
        </Numero>
        {pibRecente && (
          <Numero
            rotulo={`PIB per capita, ${pibRecente.ano}`}
            detalhe={
              pibRecente.divisor
                ? `PIB ÷ ${numero(pibRecente.divisor.populacao)} moradores (IBGE, ${rotuloDoTipo(pibRecente.divisor.tipo, pibRecente.divisor.ano)})`
                : undefined
            }
            comparacao={
              comparacao?.anoDoPib === pibRecente.ano && (
                <DianteDosLugares
                  comparacao={comparacao}
                  indicador={(l) => l.pibPerCapita}
                  formatar={moeda}
                  em="percentual"
                  maiorEBom
                />
              )
            }
            selo={seloDeFonteUnica}
          >
            {moeda(pibRecente.perCapita)}
          </Numero>
        )}
      </Numeros>

      <section className="secao dupla">
        <div className="secao-cab">
          <h2 className="secao-titulo">Orleans em números</h2>
          {seloDeFonteUnica}
        </div>
        <ListaDoRetrato classe="sem-comparacao" itens={itens.filter((item) => !item.comparar)} />
        <ListaDoRetrato classe="com-comparacao" itens={itens.filter((item) => item.comparar)} />
        {comparacao && (
          <p className="nota nota-da-comparacao">
            Santa Catarina e Brasil aparecem pelo total do estado e do país, não a média simples dos municípios: o
            número vale para todos os moradores juntos, e uma cidade grande pesa mais que uma pequena. Quem já é
            percentual compara em pontos. Verde e vermelho só aparecem no dinheiro, onde mais é melhor; nos outros
            números, ficar acima ou abaixo não é bom nem ruim por si só.
          </p>
        )}
      </section>

      <div className="colunas">
        <section className="secao larga">
          <h2 className="secao-titulo">Como é a população</h2>
          <p className="legenda-secao">Homens e mulheres por faixa de idade, no Censo {piramide.ano}</p>
          <Piramide
            faixas={piramide.faixas}
            descricao={`Pirâmide etária de Orleans no Censo ${piramide.ano}, com ${numero(piramide.total)} moradores.`}
          />
          <h3 className="rotulo piramide-titulo">Onde as pessoas moram</h3>
          <BarraDividida
            total={situacao.total}
            descricao={`Situação do domicílio no Censo ${situacao.ano}: ${numero(situacao.urbana)} na área urbana e ${numero(situacao.rural)} na área rural.`}
            formatar={numero}
            partes={[
              { nome: 'Área urbana', valor: situacao.urbana },
              { nome: 'Área rural', valor: situacao.rural, classe: 'vermelho' },
            ]}
          />
        </section>

        <section className="secao estreita">
          <h2 className="secao-titulo">A cidade está crescendo?</h2>
          <SerieDaPopulacao serie={populacao.serie} />
        </section>
      </div>

      <section className="secao dupla">
        <div className="secao-cab">
          <h2 className="secao-titulo">Como é a economia</h2>
          {pibRecente && (
            <span className="legenda-secao">
              PIB de {porExtenso(emReais(pibRecente.pib))} em {pibRecente.ano}, em valores correntes
            </span>
          )}
        </div>
        <p className="nota-serif">
          PIB per capita não é a renda do morador: ele divide pela população tudo o que é produzido na cidade, e pode
          refletir uma atividade concentrada. O que as famílias recebem é o rendimento domiciliar do Censo, ao lado.
        </p>
        {composicao && pibDaComposicao && (
          <>
            <h3 className="rotulo piramide-titulo">Composição do PIB em {pibDaComposicao.ano}</h3>
            {pibRecente && pibRecente.ano !== pibDaComposicao.ano && (
              <p className="nota">
                As fatias abaixo são de {pibDaComposicao.ano}, quando o PIB foi de{' '}
                {porExtenso(emReais(pibDaComposicao.pib))}, e não descrevem {pibRecente.ano}: depois de{' '}
                {pibDaComposicao.ano}, o IBGE só publicou o total do PIB.
              </p>
            )}
            <BarraDividida
              total={Object.values(composicao).reduce((total, v) => total + v, 0)}
              descricao={`Composição do PIB em ${pibDaComposicao.ano}, em mil reais, por setor.`}
              formatar={(v) => porExtenso(emReais(v))}
              partes={[
                { nome: 'Serviços', valor: composicao.servicos },
                { nome: 'Indústria', valor: composicao.industria, classe: 'vermelho' },
                { nome: 'Agropecuária', valor: composicao.agropecuaria, classe: 'listrada' },
                { nome: 'Administração pública', valor: composicao.administracao, classe: 'cinza' },
                { nome: 'Impostos', valor: composicao.impostos, classe: 'cinza' },
              ]}
            />
          </>
        )}
      </section>

      <details className="fonte">
        <summary>
          Fonte: {meta.fonte} · coletado em {dataHora(meta.coletadoEm)}
        </summary>
        <dl>
          <dt>Consulta</dt>
          <dd>
            <a href={meta.urlOrigem} target="_blank" rel="noreferrer">
              API de agregados do IBGE
            </a>
          </dd>
          <dt>Conferência</dt>
          <dd>Fonte única. Na coleta, as partes de cada tabela são conferidas com o total da própria tabela.</dd>
        </dl>
      </details>
    </>
  );
}
