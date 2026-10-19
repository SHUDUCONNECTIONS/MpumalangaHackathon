import { describe, expect, it } from 'vitest';
import { isSafeUrl, safeHref } from './safe.js';

describe('isSafeUrl', () => {
  it('accepts empty and http(s) links', () => {
    expect(isSafeUrl('')).toBe(true);
    expect(isSafeUrl('https://github.com/a/b')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
  });
  it('rejects script, data and malformed links', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JaVaScRiPt:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<b>x</b>')).toBe(false);
    expect(isSafeUrl('not a url')).toBe(false);
  });
});

describe('safeHref', () => {
  it('returns undefined for unsafe values', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('https://a.co')).toBe('https://a.co');
  });
});
