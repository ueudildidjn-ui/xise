/**
 * 通知辅助工具
 * 用于创建和管理用户通知
 */

const { notifyUser } = require('./notificationChannels');

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
  ACTIVITY: 10,       // 活动通知
  NEW_POST: 11        // 关注者发布新帖子
}

// 通知类型到模板键的映射
const TYPE_TEMPLATE_MAP = {
  [TYPES.COMMENT]: 'comment',
  [TYPES.REPLY]: 'reply',
  [TYPES.MENTION]: 'mention',
  [TYPES.MENTION_COMMENT]: 'mention_comment',
  [TYPES.NEW_POST]: 'new_post'
};

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
 * 插入通知并触发邮件/Discord推送
 * @param {Object} prisma - Prisma客户端实例
 * @param {Object} data - 通知数据
 * @param {Object} [channelOptions] - 推送渠道选项
 * @param {string} [channelOptions.senderName] - 发送者昵称
 * @param {string} [channelOptions.recipientEmail] - 接收者邮箱
 * @param {string} [channelOptions.commentContent] - 评论内容
 * @param {string} [channelOptions.postTitle] - 笔记标题
 * @returns {Promise<Object>} 创建的通知
 */
async function insertNotificationWithChannels(prisma, data, channelOptions = {}) {
  const notification = await prisma.notification.create({ data });

  // 异步发送邮件/Discord通知（不阻塞主流程）
  const templateKey = TYPE_TEMPLATE_MAP[data.type];
  if (templateKey) {
    const variables = {
      senderName: channelOptions.senderName || '',
      commentContent: channelOptions.commentContent || '',
      postTitle: channelOptions.postTitle || ''
    };
    notifyUser({
      templateKey,
      variables,
      recipientEmail: channelOptions.recipientEmail
    }).catch(err => console.error('通知渠道推送失败:', err.message));
  }

  return notification;
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
function createLikeCommentNotification(targetUserId, senderId, postId, commentId) {
  return createNotificationData({
    userId: targetUserId,
    senderId,
    type: TYPES.LIKE_COMMENT,
    title: '赞了你的评论',
    targetId: postId,
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

/**
 * 创建关注者新帖子通知
 */
function createNewPostNotification(targetUserId, senderId, postId, postTitle) {
  return createNotificationData({
    userId: targetUserId,
    senderId,
    type: TYPES.NEW_POST,
    title: `发布了新笔记：${postTitle || ''}`.substring(0, 200),
    targetId: postId
  })
}

module.exports = {
  TYPES,
  TYPE_TEMPLATE_MAP,
  createNotificationData,
  insertNotification,
  insertNotificationWithChannels,
  createLikePostNotification,
  createLikeCommentNotification,
  createCommentPostNotification,
  createReplyCommentNotification,
  createFollowNotification,
  createCollectPostNotification,
  createNewPostNotification
}
