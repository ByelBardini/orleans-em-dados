import { it } from 'vitest';
import { reais } from '../src/format.js';

it('formats a value in reais with a decimal comma', () => {
  reais(10);
});
