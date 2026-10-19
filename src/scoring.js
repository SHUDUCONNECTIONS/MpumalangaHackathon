export const CRITERIA = [['impact', 'Impact'], ['innovation', 'Innovation'], ['technical', 'Technical quality'], ['pitch', 'Pitch']];

// Rank submissions by the sum of per-criterion average scores (max 10 per criterion).
export function computeResults(submissions, scores) {
  return submissions.map((sub) => {
    const rows = scores.filter((x) => x.submission_id === sub.id);
    const avg = (k) => (rows.length ? rows.reduce((t, r) => t + r[k], 0) / rows.length : 0);
    const total = CRITERIA.reduce((t, [k]) => t + avg(k), 0);
    return { sub, n: rows.length, total, avg };
  }).sort((a, b) => b.total - a.total);
}

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function resultsToCsv(results) {
  const head = ['Rank', 'Team', 'Title', 'Judges', ...CRITERIA.map(([, l]) => l), 'Total'];
  const rows = results.map((r, i) => [i + 1, r.sub.team, r.sub.title, r.n, ...CRITERIA.map(([k]) => r.avg(k).toFixed(2)), r.total.toFixed(2)]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

const pad = (n) => String(n).padStart(2, '0');
// "14:05" for today, "16/10 14:05" otherwise.
export function formatStamp(iso, now = new Date()) {
  const d = new Date(iso);
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === now.toDateString() ? t : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${t}`;
}
