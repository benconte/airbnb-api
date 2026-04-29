export type CacheItem = {
  data: any;
  expiry: number;
};

const cache = new Map<string, CacheItem>();

export const getCache = (key: string): any | null => {
  const item = cache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

export const setCache = (key: string, data: any, ttlSeconds: number): void => {
  const expiry = Date.now() + ttlSeconds * 1000;
  cache.set(key, { data, expiry });
};

export const clearCachePrefix = (prefix: string): void => {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};

export const clearCache = (key: string): void => {
  cache.delete(key);
};
