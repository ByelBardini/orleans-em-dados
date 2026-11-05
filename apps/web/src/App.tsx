import { anosSchema } from '@orleans-em-dados/contracts';
import { useEffect, useState } from 'react';
import { useApi } from './api';
import type { ComponentType } from 'react';
import { Estado, SeletorTema } from './components';
import { dataCurta } from './format';
import Capa from './paginas/Capa';
import ConhecaOrleans from './paginas/ConhecaOrleans';
import Despesas from './paginas/Despesas';
import Discrepancias from './paginas/Discrepancias';
import Acesso from './paginas/educacao/Acesso';
import Aprendizado from './paginas/educacao/Aprendizado';
import Cidade from './paginas/educacao/Cidade';
import Dinheiro from './paginas/educacao/Dinheiro';
import Permanencia from './paginas/educacao/Permanencia';
import Professores from './paginas/educacao/Professores';
import Resumo from './paginas/educacao/Resumo';
import Financas from './paginas/Financas';
import Metodologia from './paginas/Metodologia';
import ParaOndeVai from './paginas/ParaOndeVai';
import type { PropsDaPagina } from './paginas/props';
import Receitas from './paginas/Receitas';

type Aba = {
  id: string;
  nome: string;
  Componente: ComponentType<PropsDaPagina>;
  caderno: string | null;
  /** A página abre sem exercício publicado, e o cabeçalho não diz um exercício. */
  semExercicio?: boolean;
  /** A aba de primeiro nível que abre o segundo nível onde esta página fica. */
  dentroDe?: string;
  /** O nome no segundo nível, quando a própria área é uma das páginas. */
  nomeNaArea?: string;
};

const CADERNO_DE_EDUCACAO = { caderno: 'Caderno de Educação', semExercicio: true };
const NA_EDUCACAO = { ...CADERNO_DE_EDUCACAO, dentroDe: 'educacao' };

const ABAS: Aba[] = [
  { id: 'visao-geral', nome: 'Início', Componente: Capa, caderno: null, semExercicio: true },
  {
    id: 'conheca-orleans',
    nome: 'Conheça Orleans',
    Componente: ConhecaOrleans,
    caderno: 'A cidade pelo IBGE',
    semExercicio: true,
  },
  { id: 'financas', nome: 'Finanças', nomeNaArea: 'Resumo', Componente: Financas, caderno: 'Caderno de Finanças' },
  { id: 'receitas', nome: 'Receitas', Componente: Receitas, caderno: 'Caderno de Receitas', dentroDe: 'financas' },
  { id: 'despesas', nome: 'Despesas', Componente: Despesas, caderno: 'Caderno de Despesas', dentroDe: 'financas' },
  {
    id: 'para-onde-vai',
    nome: 'Para onde vai',
    Componente: ParaOndeVai,
    caderno: 'Para onde vai o dinheiro',
    semExercicio: true,
    dentroDe: 'financas',
  },
  { id: 'educacao', nome: 'Educação', nomeNaArea: 'Resumo', Componente: Resumo, ...CADERNO_DE_EDUCACAO },
  { id: 'educacao-aprendizado', nome: 'Aprendizado', Componente: Aprendizado, ...NA_EDUCACAO },
  { id: 'educacao-acesso', nome: 'Acesso', Componente: Acesso, ...NA_EDUCACAO },
  { id: 'educacao-permanencia', nome: 'Permanência', Componente: Permanencia, ...NA_EDUCACAO },
  { id: 'educacao-professores', nome: 'Professores e turmas', Componente: Professores, ...NA_EDUCACAO },
  { id: 'educacao-dinheiro', nome: 'Dinheiro', Componente: Dinheiro, ...NA_EDUCACAO },
  { id: 'educacao-cidade', nome: 'Cidade e ensino superior', Componente: Cidade, ...NA_EDUCACAO },
  { id: 'discrepancias', nome: 'Discrepâncias', Componente: Discrepancias, caderno: 'Discrepâncias entre as fontes' },
  {
    id: 'metodologia',
    nome: 'Sobre os dados',
    Componente: Metodologia,
    caderno: 'Fontes e metodologia',
    semExercicio: true,
  },
];

const PADRAO = ABAS[0]!;
// O endereço antigo da seção continua abrindo.
const ALIASES: Record<string, string> = { '#conferencia': '#discrepancias' };
const abaDoHash = () => {
  const hash = ALIASES[window.location.hash] ?? window.location.hash;
  return ABAS.find((a) => `#${a.id}` === hash)?.id ?? PADRAO.id;
};

const paginasDaArea = (area: string) => ABAS.filter((a) => a.dentroDe === area);

function Navegacao({ atual }: { atual: Aba }) {
  const area = atual.dentroDe ?? atual.id;
  // Com segundo nível, a página atual é marcada lá; aqui, só a área.
  const marca = paginasDaArea(area).length ? 'true' : 'page';
  return (
    <nav className="nav-principal" aria-label="Principal">
      {ABAS.filter((a) => !a.dentroDe).map((a) => (
        <a key={a.id} href={`#${a.id}`} aria-current={a.id === area ? marca : undefined}>
          {a.nome}
        </a>
      ))}
    </nav>
  );
}

function SegundoNivel({ atual }: { atual: Aba }) {
  const area = ABAS.find((a) => a.id === (atual.dentroDe ?? atual.id)) ?? PADRAO;
  const paginas = paginasDaArea(area.id);
  if (!paginas.length) return null;
  return (
    <nav className="nav-segundo-nivel" aria-label={`Páginas de ${area.nome}`}>
      {[area, ...paginas].map((a) => (
        <a key={a.id} href={`#${a.id}`} aria-current={a.id === atual.id ? 'page' : undefined}>
          {a.nomeNaArea ?? a.nome}
        </a>
      ))}
    </nav>
  );
}

export default function App() {
  const anos = useApi('/api/anos', anosSchema);
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const ano = anoEscolhido ?? anos.dados?.anos[0] ?? null;
  const [entidade, setEntidade] = useState('');
  const [aba, setAba] = useState(abaDoHash);

  useEffect(() => {
    const ouvir = () => {
      setAba(abaDoHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', ouvir);
    return () => window.removeEventListener('hashchange', ouvir);
  }, []);

  const atual = ABAS.find((a) => a.id === aba) ?? PADRAO;
  const { Componente } = atual;
  useEffect(() => {
    document.title = aba === 'visao-geral' ? 'Orleans em Dados' : `${atual.nome} · Orleans em Dados`;
  }, [aba, atual.nome]);

  const atualizado = ano ? anos.dados?.atualizadoEm[ano] : undefined;
  const exercicio =
    ano && !atual.semExercicio
      ? `Exercício de ${ano}${atualizado ? ` · Atualizado em ${dataCurta(atualizado)}` : ''}`
      : '';
  const filtros = {
    anos: anos.dados?.anos ?? [],
    ano,
    setAno,
    entidades: anos.dados?.entidades ?? [],
    entidade,
    setEntidade,
  };

  return (
    <div className={`pagina${aba === 'visao-geral' ? ' capa' : ''}`}>
      <div className="faixa-meta barra-tema">
        <SeletorTema />
      </div>
      {aba === 'visao-geral' ? (
        <header>
          <div className="faixa-meta">
            <span>Orleans, Santa Catarina</span>
            <span>Dados públicos, cada um com fonte e ano</span>
            <span>Fontes: IBGE, INEP, MEC, SIOPE, SICONFI, Portal da Transparência e TCE-SC</span>
          </div>
          <div className="fio-duplo" aria-hidden="true" />
          <div className="titulo-jornal">
            <a href="#visao-geral">
              Orleans <span className="italico">em</span> Dados
            </a>
          </div>
          <Navegacao atual={atual} />
        </header>
      ) : (
        <>
          <header className="cabecalho-compacto">
            <a href="#visao-geral" className="marca">
              Orleans <span className="italico">em</span> Dados
            </a>
            <Navegacao atual={atual} />
          </header>
          <SegundoNivel atual={atual} />
          <div className="faixa-meta">
            <span>{atual.caderno}</span>
            <span>{exercicio}</span>
          </div>
        </>
      )}

      <main>
        {anos.dados?.exemplo && (
          <p className="aviso">
            Exibindo <strong>dados fictícios</strong> de <code>examples/</code>. Rode{' '}
            <code>pnpm importar betha --ano 2025</code> para baixar os dados reais.
          </p>
        )}
        <Estado carregando={anos.carregando} erro={anos.erro} />
        {anos.dados && !anos.dados.anos.length && <p className="aviso">Nenhum snapshot disponível.</p>}
        {(ano || atual.semExercicio) && <Componente ano={ano as number} entidade={entidade} filtros={filtros} />}
      </main>

      <footer className="rodape">
        <div>
          <p className="rotulo">Sobre os dados</p>
          <p>
            Portal da Transparência de Orleans (Betha) conferido com o Farol do TCE-SC, despesa por função do SICONFI,
            indicadores do IBGE e, na educação, INEP, SIOPE e MEC. <a href="#discrepancias">Onde as fontes divergem</a>{' '}
            · <a href="#metodologia">Como os números são conferidos</a>.
          </p>
        </div>
        <div>
          <p className="rotulo">Baixe os dados</p>
          <p>
            {ano ? (
              <>
                <a href={`/api/receitas.csv?ano=${ano}`}>Receitas {ano} (CSV)</a> ·{' '}
                <a href={`/api/despesas/empenhos.csv?ano=${ano}`}>Empenhos {ano} (CSV)</a> ·{' '}
              </>
            ) : null}
            <a href="https://github.com/ByelBardini/orleans-em-dados/blob/main/docs/DICIONARIO_DE_DADOS.md">
              Dicionário de dados
            </a>
          </p>
        </div>
        <div>
          <p className="rotulo">Projeto independente</p>
          <p>
            Sem vínculo com a Prefeitura de Orleans ou com os órgãos de controle. Código aberto, dados de fontes
            públicas identificadas.
          </p>
        </div>
      </footer>
    </div>
  );
}
