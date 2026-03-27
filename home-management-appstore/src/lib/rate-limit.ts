const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  ip: string,
  limit = 20,
  windowMs = 60_000,
): boolean {
  const now = Date.now();

  // Lazy cleanup on every call — no background timer needed.
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }

  const entry = store.get(ip);
  if (!entry || entry.resetAt < now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
