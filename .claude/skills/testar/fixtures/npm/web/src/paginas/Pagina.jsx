import { reais } from '../format.js';

export function Pagina({ total }) {
  return <p>{reais(total)}</p>;
}
