/**
 * AI审核开关辅助模块
 * 提供获取AI审核开关状态的统一接口，避免循环依赖
 */

// 延迟加载admin模块的缓存
let adminRoutesCache = null;

/**
 * 获取admin路由模块（延迟加载以避免循环依赖）
 * @returns {Object|null} admin路由模块
 */
const getAdminRoutes = () => {
  if (!adminRoutesCache) {
    try {
      adminRoutesCache = require('../routes/admin');
    } catch (e) {
      console.error('加载admin模块失败:', e.message);
      return null;
    }
  }
  return adminRoutesCache;
};

/**
 * 检查用户名AI审核是否开启
 * @returns {boolean} 是否开启用户名AI审核
 */
const isAiUsernameReviewEnabled = () => {
  const adminRoutes = getAdminRoutes();
  return adminRoutes?.isAiUsernameReviewEnabled ? adminRoutes.isAiUsernameReviewEnabled() : false;
};

/**
 * 检查内容AI审核是否开启（评论、简介等）
 * @returns {boolean} 是否开启内容AI审核
 */
const isAiContentReviewEnabled = () => {
  const adminRoutes = getAdminRoutes();
  return adminRoutes?.isAiContentReviewEnabled ? adminRoutes.isAiContentReviewEnabled() : false;
};

/**
 * 检查是否有任何AI审核开启（兼容旧代码）
 * @returns {boolean} 是否有AI审核开启
 */
const isAiAutoReviewEnabled = () => {
  return isAiUsernameReviewEnabled() || isAiContentReviewEnabled();
};

module.exports = {
  isAiUsernameReviewEnabled,
  isAiContentReviewEnabled,
  isAiAutoReviewEnabled
};
