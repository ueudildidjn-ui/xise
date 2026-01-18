/**
 * 简单内存缓存工具
 * 
 * 用于缓存低变更频率的数据，减少数据库查询
 * 适用于分类、标签等数据
 */

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {any} 缓存值，不存在时返回 undefined
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    // 检查是否过期
    if (item.expireAt && Date.now() > item.expireAt) {
      this.delete(key);
      return undefined;
    }
    
    return item.value;
  }

  /**
   * 设置缓存值
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttlMs - 过期时间（毫秒），默认5分钟
   * 
   * 注意：每个缓存项使用独立的定时器进行自动清理。
   * 对于少量缓存项（<1000）这种方式简单高效。
   * 如果需要处理大量缓存项，建议改用周期性清理机制。
   */
  set(key, value, ttlMs = 5 * 60 * 1000) {
    // 清除旧的定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const expireAt = ttlMs > 0 ? Date.now() + ttlMs : null;
    this.cache.set(key, { value, expireAt });

    // 设置自动清理定时器
    // 使用 unref() 确保定时器不会阻止 Node.js 进程退出
    if (ttlMs > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttlMs);
      // 确保定时器不会阻止进程退出（使用可选链）
      timer.unref?.();
      this.timers.set(key, timer);
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * 清空所有缓存
   */
  clear() {
    this.cache.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  /**
   * 检查缓存是否存在
   * @param {string} key - 缓存键
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * 获取缓存统计
   * @returns {Object} 缓存统计信息
   */
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 创建全局缓存实例
const globalCache = new SimpleCache();

// 缓存TTL配置（毫秒）
const CACHE_TTL = {
  CATEGORIES: 10 * 60 * 1000,      // 分类缓存10分钟
  TAGS_POPULAR: 5 * 60 * 1000,      // 热门标签缓存5分钟
  USER_STATS: 1 * 60 * 1000,        // 用户统计缓存1分钟
  SYSTEM_SETTINGS: 30 * 60 * 1000   // 系统设置缓存30分钟
};

// 用于防止并发加载的锁
const loadingPromises = new Map();

/**
 * 获取或设置缓存（带自动加载和并发控制）
 * 
 * 使用简单的锁机制防止并发请求重复加载同一资源：
 * - 如果有正在加载的请求，后续请求会等待该加载完成
 * - 这避免了 "thundering herd" 问题
 * 
 * @param {string} key - 缓存键
 * @param {Function} loader - 数据加载函数
 * @param {number} ttlMs - 过期时间
 * @returns {Promise<any>} 缓存值
 */
async function getOrSet(key, loader, ttlMs = 5 * 60 * 1000) {
  // 检查缓存是否存在
  let value = globalCache.get(key);
  if (value !== undefined) {
    return value;
  }

  // 检查是否有正在进行的加载
  if (loadingPromises.has(key)) {
    // 等待正在进行的加载完成
    return await loadingPromises.get(key);
  }

  // 创建加载 Promise 并存储
  const loadPromise = (async () => {
    try {
      const result = await loader();
      globalCache.set(key, result, ttlMs);
      return result;
    } finally {
      // 加载完成后清除锁
      loadingPromises.delete(key);
    }
  })();

  loadingPromises.set(key, loadPromise);
  return await loadPromise;
}

/**
 * 使缓存失效
 * 
 * 支持两种模式：
 * 1. 精确匹配：直接传入完整的缓存键，如 'tags:all'
 * 2. 前缀匹配：在键末尾加 '*'，如 'tags:*' 会匹配所有以 'tags:' 开头的键
 * 
 * 注意：仅支持末尾的 '*' 通配符，不支持其他通配符模式（如 '*.js' 或 'a*b'）
 * 
 * @param {string} keyPattern - 缓存键或带前缀通配符的模式
 * @example
 * invalidate('tags:all')     // 删除精确匹配的键
 * invalidate('tags:*')       // 删除所有以 'tags:' 开头的键
 */
function invalidate(keyPattern) {
  if (keyPattern.endsWith('*')) {
    // 前缀匹配
    const prefix = keyPattern.slice(0, -1);
    const keysToDelete = [];
    globalCache.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => globalCache.delete(key));
  } else {
    globalCache.delete(keyPattern);
  }
}

module.exports = {
  cache: globalCache,
  CACHE_TTL,
  getOrSet,
  invalidate
};
