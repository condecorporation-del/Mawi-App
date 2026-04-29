const WINDOW_MS = 60_000;

type RateLimitEntry = { count: number; windowStart: number };

// In-process store — upgrade to Upstash/Redis for multi-instance deployments.
const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  limitPerMinute: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limitPerMinute - 1, resetAt: now + WINDOW_MS };
  }

  if (entry.count >= limitPerMinute) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + WINDOW_MS,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: limitPerMinute - entry.count,
    resetAt: entry.windowStart + WINDOW_MS,
  };
}

// Cleanup entries older than 2 windows to prevent unbounded memory growth.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 2;
  for (const [key, entry] of Array.from(store.entries())) {
    if (entry.windowStart < cutoff) store.delete(key);
  }
}, WINDOW_MS);
