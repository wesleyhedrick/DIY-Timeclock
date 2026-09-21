const buckets = globalThis.__helpTimeRateBuckets || new Map();
globalThis.__helpTimeRateBuckets = buckets;

export function rateLimit(key, limit = 8, windowMs = 60_000) {
  const now = Date.now();
  const existing = buckets.get(key) || [];
  const recent = existing.filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  return {
    allowed: recent.length <= limit,
    remaining: Math.max(0, limit - recent.length)
  };
}
