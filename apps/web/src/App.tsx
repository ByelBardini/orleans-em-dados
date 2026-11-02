import { anosSchema } from '@orleans-em-dados/contracts';
import { useEffect, useState } from 'react';
import { useApi } from './api';
import { Estado, SeletorTema } from './components';
import { dataCurta } from './format';
import Despesas from './paginas/Despesas';
import Discrepancias from './paginas/Discrepancias';
import Metodologia from './paginas/Metodologia';
import Receitas from './paginas/Receitas';
import VisaoGeral from './paginas/VisaoGeral';

const ABAS = [
  { id: 'visao-geral', nome: 'Visão geral', Componente: VisaoGeral, caderno: null },
  { id: 'receitas', nome: 'Receitas', Componente: Receitas, caderno: 'Caderno de Receitas' },
  { id: 'despesas', nome: 'Despesas', Componente: Despesas, caderno: 'Caderno de Despesas' },
  { id: 'discrepancias', nome: 'Discrepâncias', Componente: Discrepancias, caderno: 'Discrepâncias entre as fontes' },
  { id: 'metodologia', nome: 'Sobre os dados', Componente: Metodologia, caderno: 'Fontes e metodologia' },
];

const PADRAO = ABAS[0]!;
// O endereço antigo da seção continua abrindo.
const ALIASES: Record<string, string> = { '#conferencia': '#discrepancias' };
const abaDoHash = () => {
  const hash = ALIASES[window.location.hash] ?? window.location.hash;
  return ABAS.find((a) => `#${a.id}` === hash)?.id ?? PADRAO.id;
};

function Navegacao({ aba }: { aba: string }) {
  return (
    <nav className="nav-principal" aria-label="Principal">
      {ABAS.map((a) => (
        <a key={a.id} href={`#${a.id}`} aria-current={a.id === aba ? 'page' : undefined}>
          {a.nome}
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
  const exercicio = ano ? `Exercício de ${ano}${atualizado ? ` · Atualizado em ${dataCurta(atualizado)}` : ''}` : ' ';
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
      {aba === 'visao-geral' ? (
        <header>
          <div className="faixa-meta">
            <span>Orleans, Santa Catarina</span>
            <span>{exercicio}</span>
            <span>
              Fonte: Portal da Transparência · <SeletorTema />
            </span>
          </div>
          <div className="fio-duplo" aria-hidden="true" />
          <div className="titulo-jornal">
            <a href="#visao-geral">
              Orleans <span className="italico">em</span> Dados
            </a>
          </div>
          <Navegacao aba={aba} />
        </header>
      ) : (
        <>
          <header className="cabecalho-compacto">
            <a href="#visao-geral" className="marca">
              Orleans <span className="italico">em</span> Dados
            </a>
            <Navegacao aba={aba} />
          </header>
          <div className="faixa-meta">
            <span>{atual.caderno}</span>
            <span>
              {exercicio} · <SeletorTema />
            </span>
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
        {(ano || aba === 'metodologia') && <Componente ano={ano as number} entidade={entidade} filtros={filtros} />}
      </main>

      <footer className="rodape">
        <div>
          <p className="rotulo">Sobre os dados</p>
          <p>
            Portal da Transparência de Orleans (Betha), conferido com o Farol do TCE-SC.{' '}
            <a href="#discrepancias">Onde as fontes divergem</a> ·{' '}
            <a href="#metodologia">Como os números são conferidos</a>.
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
