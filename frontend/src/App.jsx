import { useEffect, useState } from 'react';
import { useApi } from './api.js';
import { Estado } from './components.jsx';
import Despesas from './paginas/Despesas.jsx';
import Metodologia from './paginas/Metodologia.jsx';
import Receitas from './paginas/Receitas.jsx';
import VisaoGeral from './paginas/VisaoGeral.jsx';

const ABAS = [
  { id: 'visao-geral', nome: 'Visão geral', Componente: VisaoGeral },
  { id: 'receitas', nome: 'Receitas', Componente: Receitas },
  { id: 'despesas', nome: 'Despesas', Componente: Despesas },
  { id: 'metodologia', nome: 'Fontes e metodologia', Componente: Metodologia },
];

const abaDoHash = () => ABAS.find((a) => `#${a.id}` === window.location.hash)?.id ?? ABAS[0].id;

export default function App() {
  const anos = useApi('/api/anos');
  const [ano, setAno] = useState(null);
  const [aba, setAba] = useState(abaDoHash);

  useEffect(() => {
    const ouvir = () => setAba(abaDoHash());
    window.addEventListener('hashchange', ouvir);
    return () => window.removeEventListener('hashchange', ouvir);
  }, []);

  useEffect(() => {
    if (!ano && anos.dados?.anos.length) setAno(anos.dados.anos[0]);
  }, [anos.dados, ano]);

  const { Componente } = ABAS.find((a) => a.id === aba);

  return (
    <>
      <header className="topo">
        <div className="topo-conteudo">
          <div>
            <h1>Orleans em Dados</h1>
            <p className="topo-sub">Dados públicos do município de Orleans/SC</p>
          </div>
          {anos.dados?.anos.length > 0 && (
            <label className="seletor-ano">
              Exercício
              <select value={ano ?? ''} onChange={(e) => setAno(Number(e.target.value))}>
                {anos.dados.anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <nav className="abas">
          {ABAS.map((a) => (
            <a key={a.id} href={`#${a.id}`} className={a.id === aba ? 'is-ativa' : undefined}>
              {a.nome}
            </a>
          ))}
        </nav>
      </header>

      <main className="conteudo">
        {anos.dados?.exemplo && (
          <p className="aviso">
            Exibindo <strong>dados fictícios</strong> de <code>examples/</code>. Rode <code>npm run coletar -- --ano 2025</code>{' '}
            para baixar os dados reais.
          </p>
        )}
        <Estado carregando={anos.carregando} erro={anos.erro} />
        {anos.dados && !anos.dados.anos.length && <p className="aviso">Nenhum snapshot disponível.</p>}
        {(ano || aba === 'metodologia') && <Componente ano={ano} />}
      </main>

      <footer className="rodape">
        Projeto independente, sem vínculo institucional com a Prefeitura Municipal de Orleans ou com os órgãos de
        controle. Os dados são obtidos de fontes públicas identificadas e apresentados com suas respectivas
        metodologias e limitações.
      </footer>
    </>
  );
}
