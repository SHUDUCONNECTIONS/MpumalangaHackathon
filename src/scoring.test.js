import { describe, expect, it } from 'vitest';
import { computeResults, resultsToCsv, formatStamp } from './scoring.js';

const subs = [{ id: 1, team: 'A', title: 'One' }, { id: 2, team: 'B', title: 'Two, "quoted"' }];
const sc = (submission_id, v) => ({ submission_id, impact: v, innovation: v, technical: v, pitch: v });

describe('computeResults', () => {
  it('averages across judges and ranks by total', () => {
    const r = computeResults(subs, [sc(1, 4), sc(1, 8), sc(2, 9)]);
    expect(r[0].sub.id).toBe(2);
    expect(r[0].total).toBe(36);
    expect(r[1].n).toBe(2);
    expect(r[1].total).toBe(24);
  });
  it('puts unscored submissions last with zero', () => {
    const r = computeResults(subs, [sc(2, 5)]);
    expect(r[1].sub.id).toBe(1);
    expect(r[1].total).toBe(0);
  });
});

describe('resultsToCsv', () => {
  it('escapes quotes and includes a header', () => {
    const csv = resultsToCsv(computeResults(subs, [sc(2, 5)]));
    expect(csv.split('\n')[0]).toContain('"Total"');
    expect(csv).toContain('Two, ""quoted""');
  });
});

describe('formatStamp', () => {
  it('shows only time for today', () => {
    const now = new Date(2026, 9, 16, 12, 0);
    expect(formatStamp(new Date(2026, 9, 16, 9, 5).toISOString(), now)).toBe('09:05');
  });
  it('includes the date for other days', () => {
    const now = new Date(2026, 9, 17, 12, 0);
    expect(formatStamp(new Date(2026, 9, 16, 9, 5).toISOString(), now)).toBe('16/10 09:05');
  });
});
