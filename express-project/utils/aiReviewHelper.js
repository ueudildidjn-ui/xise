/**
 * AI审核开关辅助模块
 * 提供获取AI审核开关状态的统一接口，使用 settingsService 直接读取设置
 */

const settingsService = require('./settingsService');

/**
 * 检查用户名AI审核是否开启
 * @returns {boolean} 是否开启用户名AI审核
 */
const isAiUsernameReviewEnabled = () => {
  return settingsService.isAiUsernameReviewEnabled();
};

/**
 * 检查内容AI审核是否开启（评论、简介等）
 * @returns {boolean} 是否开启内容AI审核
 */
const isAiContentReviewEnabled = () => {
  return settingsService.isAiContentReviewEnabled();
};

/**
 * 检查是否有任何AI审核开启（兼容旧代码）
 * @returns {boolean} 是否有AI审核开启
 */
const isAiAutoReviewEnabled = () => {
  return settingsService.isAiAutoReviewEnabled();
};

module.exports = {
  isAiUsernameReviewEnabled,
  isAiContentReviewEnabled,
  isAiAutoReviewEnabled
};
