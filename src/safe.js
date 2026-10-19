// Only http(s) links are allowed, so a "javascript:" link can never be clicked by another user.
export function isSafeUrl(v) {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

// Use for hrefs that come from user input; returns undefined for anything unsafe.
export const safeHref = (v) => (v && isSafeUrl(v) ? v : undefined);
