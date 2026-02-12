/**
 * 通知辅助工具
 * 用于创建和管理用户通知
 */

// 通知类型常量
const TYPES = {
  LIKE_POST: 1,       // 点赞笔记
  LIKE_COMMENT: 2,    // 点赞评论
  COMMENT: 3,         // 评论笔记
  REPLY: 4,           // 回复评论
  FOLLOW: 5,          // 关注
  COLLECT: 6,         // 收藏
  MENTION: 7,         // @提及（笔记）
  MENTION_COMMENT: 8, // @提及（评论）
  SYSTEM: 9,          // 系统通知
  ACTIVITY: 10        // 活动通知
}

/**
 * 创建通知数据对象
 * @param {Object} params
 * @param {number} params.userId - 接收者ID
 * @param {number} params.senderId - 发送者ID
 * @param {number} params.type - 通知类型
 * @param {string} params.title - 通知标题
 * @param {number} [params.targetId] - 目标ID（如笔记ID）
 * @param {number} [params.commentId] - 评论ID
 * @returns {Object} 通知数据
 */
function createNotificationData({ userId, senderId, type, title, targetId = null, commentId = null }) {
  return {
    user_id: BigInt(userId),
    sender_id: BigInt(senderId),
    type,
    title,
    target_id: targetId ? BigInt(targetId) : null,
    comment_id: commentId ? BigInt(commentId) : null,
    is_read: false
  }
}

/**
 * 插入通知到数据库
 * @param {Object} prisma - Prisma客户端实例
 * @param {Object} data - 通知数据
 * @returns {Promise<Object>} 创建的通知
 */
async function insertNotification(prisma, data) {
  return prisma.notification.create({ data })
}

/**
 * 创建点赞笔记通知
 */
function createLikePostNotification(targetUserId, senderId, postId) {
  return createNotificationData({
    userId: targetUserId,
    senderId,
    type: TYPES.LIKE_POST,
    title: '赞了你的笔记',
    targetId: postId
  })
}

/**
 * 创建点赞评论通知
 */
function createLikeCommentNotification(targetUserId, senderId, commentId) {
  return createNotificationData({
    userId: targetUserId,
    senderId,
    type: TYPES.LIKE_COMMENT,
    title: '赞了你的评论',
    commentId
  })
}

/**
 * 创建评论笔记通知
 */
function createCommentPostNotification(targetUserId, senderId, postId, commentId) {
  return createNotificationData({
    userId: targetUserId,
    senderId,
    type: TYPES.COMMENT,
    title: '评论了你的笔记',
    targetId: postId,
    commentId
  })
}

/**
 * 创建回复评论通知
 */
function createReplyCommentNotification(targetUserId, senderId, postId, commentId) {
  return createNotificationData({
    userId: targetUserId,
    senderId,
    type: TYPES.REPLY,
    title: '回复了你的评论',
    targetId: postId,
    commentId
  })
}

/**
 * 创建关注通知
 */
function createFollowNotification(targetUserId, senderId) {
  return createNotificationData({
    userId: targetUserId,
    senderId,
    type: TYPES.FOLLOW,
    title: '关注了你'
  })
}

/**
 * 创建收藏笔记通知
 */
function createCollectPostNotification(targetUserId, senderId, postId) {
  return createNotificationData({
    userId: targetUserId,
    senderId,
    type: TYPES.COLLECT,
    title: '收藏了你的笔记',
    targetId: postId
  })
}

module.exports = {
  TYPES,
  createNotificationData,
  insertNotification,
  createLikePostNotification,
  createLikeCommentNotification,
  createCommentPostNotification,
  createReplyCommentNotification,
  createFollowNotification,
  createCollectPostNotification
}
