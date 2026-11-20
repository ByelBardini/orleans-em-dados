import { anosSchema, PAGINAS, paginaDoCaminho, type IdDaPagina, type Pagina } from '@orleans-em-dados/contracts';
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
import NaoEncontrada from './paginas/NaoEncontrada';
import ParaOndeVai from './paginas/ParaOndeVai';
import type { PropsDaPagina } from './paginas/props';
import Receitas from './paginas/Receitas';
import { substituir, useCaminho, useRotas } from './rotas';

// O catálogo (`packages/contracts/src/paginas.ts`) diz caminho, nome, título e área; aqui, o que só a tela usa.
type Tela = {
  Componente: ComponentType<PropsDaPagina>;
  caderno: string | null;
  /** A página abre sem exercício publicado, e o cabeçalho não diz um exercício. */
  semExercicio?: boolean;
  /** O nome no segundo nível, quando a própria área é uma das páginas. */
  nomeNaArea?: string;
};

const CADERNO_DE_EDUCACAO = { caderno: 'Caderno de Educação', semExercicio: true };

const TELAS: Record<IdDaPagina, Tela> = {
  'visao-geral': { Componente: Capa, caderno: null, semExercicio: true },
  'conheca-orleans': { Componente: ConhecaOrleans, caderno: 'A cidade pelo IBGE', semExercicio: true },
  financas: { Componente: Financas, caderno: 'Caderno de Finanças', nomeNaArea: 'Resumo' },
  receitas: { Componente: Receitas, caderno: 'Caderno de Receitas' },
  despesas: { Componente: Despesas, caderno: 'Caderno de Despesas' },
  'para-onde-vai': { Componente: ParaOndeVai, caderno: 'Para onde vai o dinheiro', semExercicio: true },
  educacao: { Componente: Resumo, ...CADERNO_DE_EDUCACAO, nomeNaArea: 'Resumo' },
  'educacao-aprendizado': { Componente: Aprendizado, ...CADERNO_DE_EDUCACAO },
  'educacao-acesso': { Componente: Acesso, ...CADERNO_DE_EDUCACAO },
  'educacao-permanencia': { Componente: Permanencia, ...CADERNO_DE_EDUCACAO },
  'educacao-professores': { Componente: Professores, ...CADERNO_DE_EDUCACAO },
  'educacao-dinheiro': { Componente: Dinheiro, ...CADERNO_DE_EDUCACAO },
  'educacao-cidade': { Componente: Cidade, ...CADERNO_DE_EDUCACAO },
  discrepancias: { Componente: Discrepancias, caderno: 'Discrepâncias entre as fontes' },
  metodologia: { Componente: Metodologia, caderno: 'Fontes e metodologia', semExercicio: true },
  apoiar: { Componente: NaoEncontrada, caderno: null, semExercicio: true },
};

// A página Apoiar está no catálogo, mas só abre com o Pix configurado.
const existe = (pagina: Pagina) => pagina.id !== 'apoiar';

const NAO_ENCONTRADA: Tela = { Componente: NaoEncontrada, caderno: null, semExercicio: true };
const TITULO_NAO_ENCONTRADA = 'Página não encontrada · Orleans em Dados';

const AREAS = PAGINAS.filter((p) => p.menu && p.area === p.id);
const paginasDaArea = (area: IdDaPagina) => PAGINAS.filter((p) => p.menu && p.area === area && p.id !== area);

function Navegacao({ atual }: { atual: Pagina | null }) {
  // Com segundo nível, a página atual é marcada lá; aqui, só a área.
  const marca = atual && paginasDaArea(atual.area).length ? 'true' : 'page';
  return (
    <nav className="nav-principal" aria-label="Principal">
      {AREAS.map((a) => (
        <a key={a.id} href={a.caminho} aria-current={a.id === atual?.area ? marca : undefined}>
          {a.nome}
        </a>
      ))}
    </nav>
  );
}

function SegundoNivel({ atual }: { atual: Pagina }) {
  const paginas = paginasDaArea(atual.area);
  const area = PAGINAS.find((p) => p.id === atual.area);
  if (!paginas.length || !area) return null;
  return (
    <nav className="nav-segundo-nivel" aria-label={`Páginas de ${area.nome}`}>
      {[area, ...paginas].map((p) => (
        <a key={p.id} href={p.caminho} aria-current={p.id === atual.id ? 'page' : undefined}>
          {TELAS[p.id].nomeNaArea ?? p.nome}
        </a>
      ))}
    </nav>
  );
}

function definirMeta(nome: string, conteudo: string | null) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${nome}"]`);
  if (conteudo === null) return meta?.remove();
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = nome;
    document.head.append(meta);
  }
  meta.content = conteudo;
}

/** Título, descrição e canonical da página aberta. O servidor já entrega o head certo; aqui, a navegação. */
function useHead(pagina: Pagina | null) {
  useEffect(() => {
    document.title = pagina?.titulo ?? TITULO_NAO_ENCONTRADA;
    definirMeta('description', pagina?.descricao ?? null);
    definirMeta('robots', pagina ? null : 'noindex');
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical && pagina) canonical.href = new URL(pagina.caminho, canonical.href).href;
  }, [pagina]);
}

export default function App() {
  useRotas();
  const caminho = useCaminho();
  const achada = paginaDoCaminho(caminho);
  const redirecionar = achada?.redirecionar;
  useEffect(() => {
    if (redirecionar) substituir(redirecionar);
  }, [redirecionar]);

  const pagina = achada && existe(achada.pagina) ? achada.pagina : null;
  const tela = pagina ? TELAS[pagina.id] : NAO_ENCONTRADA;
  useHead(pagina);

  const anos = useApi('/api/anos', anosSchema);
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const ano = anoEscolhido ?? anos.dados?.anos[0] ?? null;
  const [entidade, setEntidade] = useState('');

  const { Componente } = tela;
  const naCapa = pagina?.id === 'visao-geral';
  const atualizado = ano ? anos.dados?.atualizadoEm[ano] : undefined;
  const exercicio =
    ano && !tela.semExercicio
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
    <div className={`pagina${naCapa ? ' capa' : ''}`}>
      <div className="faixa-meta barra-tema">
        <SeletorTema />
      </div>
      {naCapa ? (
        <header>
          <div className="faixa-meta">
            <span>Orleans, Santa Catarina</span>
            <span>Dados públicos, cada um com fonte e ano</span>
            <span>Fontes: IBGE, INEP, MEC, SIOPE, SICONFI, Portal da Transparência e TCE-SC</span>
          </div>
          <div className="fio-duplo" aria-hidden="true" />
          <div className="titulo-jornal">
            <a href="/">
              Orleans <span className="italico">em</span> Dados
            </a>
          </div>
          <Navegacao atual={pagina} />
        </header>
      ) : (
        <>
          <header className="cabecalho-compacto">
            <a href="/" className="marca">
              Orleans <span className="italico">em</span> Dados
            </a>
            <Navegacao atual={pagina} />
          </header>
          {pagina && <SegundoNivel atual={pagina} />}
          <div className="faixa-meta">
            <span>{tela.caderno}</span>
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
        {pagina ? (
          <>
            <Estado carregando={anos.carregando} erro={anos.erro} />
            {anos.dados && !anos.dados.anos.length && <p className="aviso">Nenhum snapshot disponível.</p>}
            {(ano || tela.semExercicio) && <Componente ano={ano as number} entidade={entidade} filtros={filtros} />}
          </>
        ) : (
          <NaoEncontrada />
        )}
      </main>

      <footer className="rodape">
        <div>
          <p className="rotulo">Sobre os dados</p>
          <p>
            Portal da Transparência de Orleans (Betha) conferido com o Farol do TCE-SC, despesa por função do SICONFI,
            indicadores do IBGE e, na educação, INEP, SIOPE e MEC. <a href="/discrepancias">Onde as fontes divergem</a>{' '}
            · <a href="/sobre-os-dados">Como os números são conferidos</a>.
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
