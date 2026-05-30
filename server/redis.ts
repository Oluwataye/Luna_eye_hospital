import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let client: any = null;
let redisAvailable = false;
let isConnecting = false;

const initRedis = async (): Promise<void> => {
  if (isConnecting || redisAvailable) return;
  isConnecting = true;
  
  console.log(`[REDIS] Attempting to connect to Redis at ${REDIS_URL}...`);
  
  client = createClient({
    url: REDIS_URL,
    socket: {
      connectTimeout: 2000, // 2s timeout to fail fast
      reconnectStrategy: (retries: number) => {
        // Try reconnecting up to 2 times, then mark unavailable to prevent blocking
        if (retries > 2) {
          if (redisAvailable) {
            console.warn('[REDIS] Connection lost. Maximum reconnection attempts exceeded. Falling back to SQLite.');
          }
          redisAvailable = false;
          return false; // stop reconnecting
        }
        return 1000; // try reconnecting after 1s
      }
    }
  });

  client.on('error', (err: Error) => {
    // Suppress repeated stack traces, log connection failures cleanly
    if (redisAvailable) {
      console.warn(`[REDIS] Connection error: ${err.message}. Marking Redis offline.`);
      redisAvailable = false;
    }
  });

  client.on('ready', () => {
    console.log('[REDIS] Connection established successfully. Blacklist cache active.');
    redisAvailable = true;
    isConnecting = false;
  });

  try {
    await client.connect();
  } catch (err: any) {
    console.warn(`[REDIS] Connection failed (${err.message}). Safe fallback mode enabled: using SQLite database for blacklist storage.`);
    redisAvailable = false;
    isConnecting = false;
  }
};

// Initialize asynchronously on module load
initRedis();

export const isRedisAvailable = (): boolean => redisAvailable;

export const blacklistToken = async (token: string, expirySeconds: number): Promise<boolean> => {
  if (!redisAvailable || !client) return false;
  try {
    // Store in Redis with TTL in seconds
    await client.set(`blacklist:${token}`, '1', {
      EX: Math.max(1, Math.floor(expirySeconds))
    });
    console.log(`[REDIS] Token blacklisted successfully for ${Math.floor(expirySeconds)}s`);
    return true;
  } catch (err: any) {
    console.error('[REDIS] Failed to write to blacklist cache:', err.message);
    return false;
  }
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  if (!redisAvailable || !client) return false;
  try {
    const res = await client.get(`blacklist:${token}`);
    return res !== null;
  } catch (err: any) {
    console.error('[REDIS] Failed to read from blacklist cache:', err.message);
    return false; // Fallback to let middleware query SQLite if needed
  }
};

export const incrRateLimit = async (key: string, expirySeconds: number): Promise<number> => {
  if (!redisAvailable || !client) return 0;
  try {
    const val = await client.incr(key);
    if (val === 1) {
      await client.expire(key, expirySeconds);
    }
    return val;
  } catch (err: any) {
    console.error('[REDIS] Failed to increment rate limit:', err.message);
    return 0; // Fallback to local memory limiter on error
  }
};
