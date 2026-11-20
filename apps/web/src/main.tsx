import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Antes do App: a folha de uma página vem depois dos tokens e do visual comum, e ganha no empate.
import './styles.css';
import App from './App';
import { redirecionarHashAntigo } from './rotas';

// O link antigo (`/#receitas`) vira o caminho novo antes da primeira pintura, sem mostrar a capa no meio.
redirecionarHashAntigo();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
