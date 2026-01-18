/**
 * Redis 连接池和辅助函数
 * 
 * @author ZTMYO
 * @description 提供共享的 Redis 连接池和通用辅助函数
 *              用于队列服务、缓存和其他需要 Redis 的功能
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const Redis = require('ioredis');

// Redis 配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  // 连接池配置
  maxRetriesPerRequest: null, // BullMQ 要求设置为 null
  enableReadyCheck: true,
  // 重连策略
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis 重连中... 第 ${times} 次尝试，延迟 ${delay}ms`);
    return delay;
  },
  // 连接超时
  connectTimeout: 10000,
  // 命令超时
  commandTimeout: 5000,
};

// 移除空密码
if (!redisConfig.password || !redisConfig.password.trim()) {
  delete redisConfig.password;
}

// Redis 客户端实例（延迟初始化）
let redisClient = null;
let isConnected = false;
let connectionPromise = null;

/**
 * 获取 Redis 连接配置（用于 BullMQ 等需要配置对象的库）
 * @returns {Object} Redis 连接配置
 */
function getRedisConfig() {
  const config = {
    host: redisConfig.host,
    port: redisConfig.port,
    db: redisConfig.db,
    maxRetriesPerRequest: null, // BullMQ 要求
  };
  
  if (redisConfig.password) {
    config.password = redisConfig.password;
  }
  
  return config;
}

/**
 * 获取 Redis 客户端实例（单例模式）
 * @returns {Promise<Redis>} Redis 客户端实例
 */
async function getRedisClient() {
  if (redisClient && isConnected) {
    return redisClient;
  }

  // 如果正在连接中，等待连接完成
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      console.log(`● Redis 连接成功 (${redisConfig.host}:${redisConfig.port})`);
    });

    redisClient.on('ready', () => {
      isConnected = true;
      connectionPromise = null;
      resolve(redisClient);
    });

    redisClient.on('error', (err) => {
      console.error('Redis 连接错误:', err.message);
      if (!isConnected) {
        connectionPromise = null;
        reject(err);
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
      console.log('Redis 连接已关闭');
    });

    redisClient.on('reconnecting', () => {
      console.log('Redis 正在重新连接...');
    });
  });

  return connectionPromise;
}

/**
 * 检查 Redis 是否可用
 * @returns {Promise<boolean>} 是否可用
 */
async function isRedisAvailable() {
  try {
    const client = await getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    return false;
  }
}

/**
 * 关闭 Redis 连接
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    connectionPromise = null;
    console.log('● Redis 连接已关闭');
  }
}

// ===================== 通用辅助函数 =====================

/**
 * 获取缓存值
 * @param {string} key - 缓存键
 * @returns {Promise<any>} 缓存值（自动反序列化 JSON）
 */
async function get(key) {
  try {
    const client = await getRedisClient();
    const value = await client.get(key);
    if (value === null) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error(`Redis GET 错误 [${key}]:`, error.message);
    return null;
  }
}

/**
 * 设置缓存值
 * @param {string} key - 缓存键
 * @param {any} value - 缓存值（自动序列化为 JSON）
 * @param {number} ttlSeconds - 过期时间（秒），默认不过期
 * @returns {Promise<boolean>} 是否成功
 */
async function set(key, value, ttlSeconds = 0) {
  try {
    const client = await getRedisClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (error) {
    console.error(`Redis SET 错误 [${key}]:`, error.message);
    return false;
  }
}

/**
 * 删除缓存
 * @param {string} key - 缓存键
 * @returns {Promise<boolean>} 是否成功
 */
async function del(key) {
  try {
    const client = await getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`Redis DEL 错误 [${key}]:`, error.message);
    return false;
  }
}

/**
 * 批量删除缓存（支持模式匹配）
 * @param {string} pattern - 键模式（如 'user:*'）
 * @returns {Promise<number>} 删除的键数量
 */
async function delByPattern(pattern) {
  try {
    const client = await getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;
    
    await client.del(...keys);
    return keys.length;
  } catch (error) {
    console.error(`Redis DEL PATTERN 错误 [${pattern}]:`, error.message);
    return 0;
  }
}

/**
 * 检查键是否存在
 * @param {string} key - 缓存键
 * @returns {Promise<boolean>} 是否存在
 */
async function exists(key) {
  try {
    const client = await getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    console.error(`Redis EXISTS 错误 [${key}]:`, error.message);
    return false;
  }
}

/**
 * 设置键的过期时间
 * @param {string} key - 缓存键
 * @param {number} ttlSeconds - 过期时间（秒）
 * @returns {Promise<boolean>} 是否成功
 */
async function expire(key, ttlSeconds) {
  try {
    const client = await getRedisClient();
    await client.expire(key, ttlSeconds);
    return true;
  } catch (error) {
    console.error(`Redis EXPIRE 错误 [${key}]:`, error.message);
    return false;
  }
}

/**
 * 原子递增
 * @param {string} key - 缓存键
 * @param {number} increment - 增量，默认 1
 * @returns {Promise<number|null>} 递增后的值
 */
async function incr(key, increment = 1) {
  try {
    const client = await getRedisClient();
    if (increment === 1) {
      return await client.incr(key);
    }
    return await client.incrby(key, increment);
  } catch (error) {
    console.error(`Redis INCR 错误 [${key}]:`, error.message);
    return null;
  }
}

/**
 * 原子递减
 * @param {string} key - 缓存键
 * @param {number} decrement - 减量，默认 1
 * @returns {Promise<number|null>} 递减后的值
 */
async function decr(key, decrement = 1) {
  try {
    const client = await getRedisClient();
    if (decrement === 1) {
      return await client.decr(key);
    }
    return await client.decrby(key, decrement);
  } catch (error) {
    console.error(`Redis DECR 错误 [${key}]:`, error.message);
    return null;
  }
}

/**
 * 批量获取
 * @param {string[]} keys - 缓存键数组
 * @returns {Promise<Object>} 键值对对象
 */
async function mget(keys) {
  if (!keys || keys.length === 0) return {};
  
  try {
    const client = await getRedisClient();
    const values = await client.mget(keys);
    
    const result = {};
    keys.forEach((key, index) => {
      if (values[index] !== null) {
        try {
          result[key] = JSON.parse(values[index]);
        } catch {
          result[key] = values[index];
        }
      }
    });
    
    return result;
  } catch (error) {
    console.error('Redis MGET 错误:', error.message);
    return {};
  }
}

/**
 * 批量设置
 * @param {Object} keyValuePairs - 键值对对象
 * @param {number} ttlSeconds - 过期时间（秒），默认不过期
 * @returns {Promise<boolean>} 是否成功
 */
async function mset(keyValuePairs, ttlSeconds = 0) {
  if (!keyValuePairs || Object.keys(keyValuePairs).length === 0) return true;
  
  try {
    const client = await getRedisClient();
    const pipeline = client.pipeline();
    
    for (const [key, value] of Object.entries(keyValuePairs)) {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds > 0) {
        pipeline.setex(key, ttlSeconds, serialized);
      } else {
        pipeline.set(key, serialized);
      }
    }
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error('Redis MSET 错误:', error.message);
    return false;
  }
}

/**
 * 获取或设置缓存（缓存穿透保护）
 * @param {string} key - 缓存键
 * @param {Function} loader - 数据加载函数
 * @param {number} ttlSeconds - 过期时间（秒）
 * @returns {Promise<any>} 缓存值
 */
async function getOrSet(key, loader, ttlSeconds = 300) {
  try {
    // 先尝试从缓存获取
    const cached = await get(key);
    if (cached !== null) {
      return cached;
    }
    
    // 缓存未命中，加载数据
    const value = await loader();
    
    // 存入缓存
    if (value !== null && value !== undefined) {
      await set(key, value, ttlSeconds);
    }
    
    return value;
  } catch (error) {
    console.error(`Redis getOrSet 错误 [${key}]:`, error.message);
    // 缓存失败时直接调用 loader
    return await loader();
  }
}

// ===================== Hash 操作 =====================

/**
 * 设置 Hash 字段
 * @param {string} key - Hash 键
 * @param {string} field - 字段名
 * @param {any} value - 字段值
 * @returns {Promise<boolean>} 是否成功
 */
async function hset(key, field, value) {
  try {
    const client = await getRedisClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await client.hset(key, field, serialized);
    return true;
  } catch (error) {
    console.error(`Redis HSET 错误 [${key}.${field}]:`, error.message);
    return false;
  }
}

/**
 * 获取 Hash 字段
 * @param {string} key - Hash 键
 * @param {string} field - 字段名
 * @returns {Promise<any>} 字段值
 */
async function hget(key, field) {
  try {
    const client = await getRedisClient();
    const value = await client.hget(key, field);
    if (value === null) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error(`Redis HGET 错误 [${key}.${field}]:`, error.message);
    return null;
  }
}

/**
 * 获取 Hash 所有字段
 * @param {string} key - Hash 键
 * @returns {Promise<Object>} 所有字段键值对
 */
async function hgetall(key) {
  try {
    const client = await getRedisClient();
    const data = await client.hgetall(key);
    
    const result = {};
    for (const [field, value] of Object.entries(data)) {
      try {
        result[field] = JSON.parse(value);
      } catch {
        result[field] = value;
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Redis HGETALL 错误 [${key}]:`, error.message);
    return {};
  }
}

/**
 * 删除 Hash 字段
 * @param {string} key - Hash 键
 * @param {string} field - 字段名
 * @returns {Promise<boolean>} 是否成功
 */
async function hdel(key, field) {
  try {
    const client = await getRedisClient();
    await client.hdel(key, field);
    return true;
  } catch (error) {
    console.error(`Redis HDEL 错误 [${key}.${field}]:`, error.message);
    return false;
  }
}

// ===================== 列表操作 =====================

/**
 * 向列表头部添加元素
 * @param {string} key - 列表键
 * @param {any} value - 值
 * @returns {Promise<number|null>} 列表长度
 */
async function lpush(key, value) {
  try {
    const client = await getRedisClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return await client.lpush(key, serialized);
  } catch (error) {
    console.error(`Redis LPUSH 错误 [${key}]:`, error.message);
    return null;
  }
}

/**
 * 向列表尾部添加元素
 * @param {string} key - 列表键
 * @param {any} value - 值
 * @returns {Promise<number|null>} 列表长度
 */
async function rpush(key, value) {
  try {
    const client = await getRedisClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return await client.rpush(key, serialized);
  } catch (error) {
    console.error(`Redis RPUSH 错误 [${key}]:`, error.message);
    return null;
  }
}

/**
 * 获取列表范围
 * @param {string} key - 列表键
 * @param {number} start - 起始索引
 * @param {number} stop - 结束索引
 * @returns {Promise<Array>} 元素数组
 */
async function lrange(key, start = 0, stop = -1) {
  try {
    const client = await getRedisClient();
    const values = await client.lrange(key, start, stop);
    
    return values.map(v => {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    });
  } catch (error) {
    console.error(`Redis LRANGE 错误 [${key}]:`, error.message);
    return [];
  }
}

/**
 * 修剪列表（只保留指定范围）
 * @param {string} key - 列表键
 * @param {number} start - 起始索引
 * @param {number} stop - 结束索引
 * @returns {Promise<boolean>} 是否成功
 */
async function ltrim(key, start, stop) {
  try {
    const client = await getRedisClient();
    await client.ltrim(key, start, stop);
    return true;
  } catch (error) {
    console.error(`Redis LTRIM 错误 [${key}]:`, error.message);
    return false;
  }
}

// ===================== 集合操作 =====================

/**
 * 向集合添加成员
 * @param {string} key - 集合键
 * @param {string|string[]} members - 成员
 * @returns {Promise<number|null>} 新增成员数量
 */
async function sadd(key, members) {
  try {
    const client = await getRedisClient();
    const memberArray = Array.isArray(members) ? members : [members];
    return await client.sadd(key, ...memberArray);
  } catch (error) {
    console.error(`Redis SADD 错误 [${key}]:`, error.message);
    return null;
  }
}

/**
 * 获取集合所有成员
 * @param {string} key - 集合键
 * @returns {Promise<string[]>} 成员数组
 */
async function smembers(key) {
  try {
    const client = await getRedisClient();
    return await client.smembers(key);
  } catch (error) {
    console.error(`Redis SMEMBERS 错误 [${key}]:`, error.message);
    return [];
  }
}

/**
 * 检查成员是否在集合中
 * @param {string} key - 集合键
 * @param {string} member - 成员
 * @returns {Promise<boolean>} 是否存在
 */
async function sismember(key, member) {
  try {
    const client = await getRedisClient();
    const result = await client.sismember(key, member);
    return result === 1;
  } catch (error) {
    console.error(`Redis SISMEMBER 错误 [${key}]:`, error.message);
    return false;
  }
}

/**
 * 从集合移除成员
 * @param {string} key - 集合键
 * @param {string|string[]} members - 成员
 * @returns {Promise<number|null>} 移除的成员数量
 */
async function srem(key, members) {
  try {
    const client = await getRedisClient();
    const memberArray = Array.isArray(members) ? members : [members];
    return await client.srem(key, ...memberArray);
  } catch (error) {
    console.error(`Redis SREM 错误 [${key}]:`, error.message);
    return null;
  }
}

module.exports = {
  // 连接管理
  getRedisConfig,
  getRedisClient,
  isRedisAvailable,
  closeRedis,
  
  // 基础操作
  get,
  set,
  del,
  delByPattern,
  exists,
  expire,
  incr,
  decr,
  mget,
  mset,
  getOrSet,
  
  // Hash 操作
  hset,
  hget,
  hgetall,
  hdel,
  
  // 列表操作
  lpush,
  rpush,
  lrange,
  ltrim,
  
  // 集合操作
  sadd,
  smembers,
  sismember,
  srem,
};
