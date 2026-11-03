// A capa: o retrato da cidade. Cada número traz o próprio ano; selo, só o de dado fictício. A conferência fica
// nas páginas de cada área. Receita e despesa são sempre do último exercício encerrado: o ano em curso é parcial,
// e não serve de retrato.
import {
  despesasResumoSchema,
  municipioSchema,
  receitasSchema,
  type DespesasResumo,
  type Municipio,
  type Receitas,
  type PontoDaPopulacao,
} from '@orleans-em-dados/contracts';
import { useApi } from '../api';
import { Mi, Numero, Numeros } from '../components';
import { ultimoExercicioEncerrado } from '../exercicio';
import { moeda, numero } from '../format';
import { Selo } from '../selo';
import { SELO_EXEMPLO } from '../selos';
import type { PropsDaPagina } from './props';

const AREAS = [
  {
    nome: 'Finanças',
    destino: '#financas',
    texto: 'Quanto entrou, quanto saiu e o que as fontes confirmam.',
  },
  {
    nome: 'Para onde vai o dinheiro',
    destino: '#para-onde-vai',
    texto: 'A despesa por área, de saúde a transporte, ano a ano.',
  },
  {
    nome: 'Demografia',
    destino: '#conheca-orleans',
    texto: 'Quantos somos, onde moramos e como a população mudou entre os censos.',
  },
  {
    nome: 'Economia',
    destino: '#conheca-orleans',
    texto: 'O PIB, o que ele mede e o rendimento das famílias.',
  },
];

const EM_BREVE = ['Educação', 'Saúde', 'Saneamento'];

const rotuloDoPonto = ({ tipo, ano }: PontoDaPopulacao) => (tipo === 'censo' ? `Censo ${ano}` : `estimativa ${ano}`);

function CartaoDePopulacao({ municipio }: { municipio: Municipio | null }) {
  const recente = municipio?.disponivel ? municipio.populacao.serie.at(-1) : undefined;
  if (!recente) return <Numero rotulo="População">—</Numero>;
  return (
    <Numero rotulo={`População, ${rotuloDoPonto(recente)}`} detalhe="moradores">
      {numero(recente.populacao)}
    </Numero>
  );
}

function CartaoDoPib({ municipio }: { municipio: Municipio | null }) {
  const recente = municipio?.disponivel ? municipio.pib.serie.at(-1) : undefined;
  if (!recente) return <Numero rotulo="PIB per capita">—</Numero>;
  const divisor = recente.divisor
    ? `PIB ÷ ${numero(recente.divisor.populacao)} moradores (${rotuloDoPonto(recente.divisor)}); `
    : '';
  return (
    <Numero rotulo={`PIB per capita, ${recente.ano}`} detalhe={`${divisor}não é a renda do morador`}>
      {moeda(recente.perCapita)}
    </Numero>
  );
}

const SEM_CONFERENCIA = 'Sem conferência entre as fontes neste exercício.';

function CartaoDaReceita({ ano, receita }: { ano: number | null; receita: Receitas | null }) {
  if (ano === null) return <Numero rotulo="Receita arrecadada">—</Numero>;
  const rotulo = `Receita arrecadada em ${ano}`;
  if (!receita) return <Numero rotulo={rotulo}>—</Numero>;
  const { conferencia, meta, totais } = receita;
  if (meta.exemplo) {
    return (
      <Numero rotulo={rotulo} selo={<Selo selo={SELO_EXEMPLO} />}>
        <Mi valor={totais.arrecadadoNoMes} />
      </Numero>
    );
  }
  if (!conferencia.disponivel) {
    return (
      <Numero rotulo={rotulo} detalhe={SEM_CONFERENCIA}>
        —
      </Numero>
    );
  }
  return (
    <Numero rotulo={rotulo} detalhe="o que as duas fontes registram">
      <Mi valor={totais.arrecadadoNoMes} />
    </Numero>
  );
}

function CartaoDaDespesa({ ano, despesa }: { ano: number | null; despesa: DespesasResumo | null }) {
  if (ano === null) return <Numero rotulo="Despesa empenhada">—</Numero>;
  const rotulo = `Despesa empenhada em ${ano}, sem a Câmara`;
  if (!despesa) return <Numero rotulo={rotulo}>—</Numero>;
  const { conferencia, meta, totais } = despesa;
  if (meta.exemplo) {
    return (
      <Numero rotulo={rotulo} selo={<Selo selo={SELO_EXEMPLO} />}>
        <Mi valor={totais.empenhado} />
      </Numero>
    );
  }
  if (!conferencia.disponivel || totais.empenhado === null) {
    return (
      <Numero rotulo={rotulo} detalhe={SEM_CONFERENCIA}>
        —
      </Numero>
    );
  }
  return (
    <Numero rotulo={rotulo} detalhe="já descontadas as anulações">
      <Mi valor={totais.empenhado} />
    </Numero>
  );
}

export default function Capa({ filtros }: PropsDaPagina) {
  const ano = ultimoExercicioEncerrado(filtros.anos, new Date());
  const consulta = ano === null ? null : new URLSearchParams({ ano: String(ano), entidade: '' }).toString();
  const municipio = useApi('/api/municipio', municipioSchema);
  const receita = useApi(consulta && `/api/receitas?${consulta}`, receitasSchema);
  const despesa = useApi(consulta && `/api/despesas/resumo?${consulta}`, despesasResumoSchema);

  return (
    <>
      <div className="abertura">
        <h1 className="manchete">
          Quem mora em Orleans, como é a economia e <em>para onde vai o dinheiro público</em>.
        </h1>
        <div className="abertura-lado">
          <p className="capitular">
            Um retrato da cidade feito só com dados públicos. O ano muda de um número para outro, porque cada fonte
            publica no próprio ritmo. A origem e a conferência de cada um estão na página de cada área.
          </p>
          <a href="#metodologia" className="botao-link">
            Como estes dados são feitos →
          </a>
        </div>
      </div>

      <Numeros rotulo="Orleans em números">
        <CartaoDePopulacao municipio={municipio.dados} />
        <CartaoDoPib municipio={municipio.dados} />
        <CartaoDaReceita ano={ano} receita={receita.dados} />
        <CartaoDaDespesa ano={ano} despesa={despesa.dados} />
      </Numeros>

      <section className="secao dupla" aria-label="Explore por área">
        <div className="secao-cab">
          <h2 className="secao-titulo">Explore por área</h2>
        </div>
        <ul className="cartoes-de-area">
          {AREAS.map((area) => (
            <li key={area.nome}>
              <a href={area.destino} className="cartao-de-area">
                <h3>{area.nome}</h3>
                <p>{area.texto}</p>
              </a>
            </li>
          ))}
          {EM_BREVE.map((nome) => (
            <li key={nome} className="cartao-de-area em-breve">
              <h3>{nome}</h3>
              <p>em breve</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
