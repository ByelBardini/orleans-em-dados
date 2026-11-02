import { expect, it } from 'vitest';
import { classificar } from './conferencias.js';

it('a spec living next to the source is flagged as outside test/', () => {
  expect(classificar(1, 2)).toBe('diverge');
});
