import { describe, expect, it } from 'vitest';
import { classificar } from '../conferencias.js';

describe('classificar', () => {
  it('equal values from Betha and TCE are classified as confere', () => {
    expect(classificar(100, 100)).toBe('confere');
  });

  it('a one-cent difference is classified as arredondamento', () => {
    expect(classificar(100, 100.01)).toBe('arredondamento');
  });

  it('a difference above one cent is classified as diverge', () => {
    expect(classificar(100, 101)).toBe('diverge');
  });
});
