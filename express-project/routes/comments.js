const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');
const { prisma } = require('../config/config');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const NotificationHelper = require('../utils/notificationHelper');
const { extractMentionedUsers, hasMentions } = require('../utils/mentionParser');
const { sanitizeContent } = require('../utils/contentSecurity');
const { auditComment, isAuditEnabled } = require('../utils/contentAudit');

// 获取AI自动审核状态（延迟加载以避免循环依赖）
let getAiAutoReviewStatus = null;
const isAiAutoReviewEnabled = () => {
  if (!getAiAutoReviewStatus) {
    try {
      const adminRoutes = require('./admin');
      getAiAutoReviewStatus = adminRoutes.isAiAutoReviewEnabled || (() => false);
    } catch (e) {
      return false;
    }
  }
  return getAiAutoReviewStatus();
};

// 递归删除评论及其子评论，返回删除的评论总数
async function deleteCommentRecursive(commentId) {
  let deletedCount = 0;
  const commentIdBigInt = BigInt(commentId);

  // 获取所有子评论
  const children = await prisma.comment.findMany({
    where: { parent_id: commentIdBigInt },
    select: { id: true }
  });

  // 递归删除子评论
  for (const child of children) {
    deletedCount += await deleteCommentRecursive(child.id);
  }

  // 删除当前评论的点赞记录
  await prisma.like.deleteMany({
    where: { target_type: 2, target_id: commentIdBigInt }
  });

  // 删除当前评论
  await prisma.comment.delete({
    where: { id: commentIdBigInt }
  });

  // 当前评论也算一个
  deletedCount += 1;

  return deletedCount;
}

// 获取评论列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const postId = req.query.post_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = req.user ? BigInt(req.user.id) : null;

    if (!postId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: '缺少笔记ID' });
    }

    const postIdBigInt = BigInt(postId);

    // 构建查询条件
    const where = {
      post_id: postIdBigInt,
      parent_id: null
    };

    if (currentUserId) {
      // 已登录用户：显示公开评论 + 自己的评论（包括待审核的）
      where.OR = [
        { is_public: true },
        { user_id: currentUserId }
      ];
    } else {
      // 未登录用户：只显示公开评论
      where.is_public = true;
    }

    const comments = await prisma.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            user_id: true,
            location: true,
            verified: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: skip
    });

    // 格式化评论并添加额外信息
    const formattedComments = await Promise.all(comments.map(async (comment) => {
      const formatted = {
        id: Number(comment.id),
        post_id: Number(comment.post_id),
        user_id: Number(comment.user_id),
        parent_id: comment.parent_id ? Number(comment.parent_id) : null,
        content: comment.content,
        like_count: comment.like_count,
        audit_status: comment.audit_status,
        is_public: comment.is_public,
        audit_result: comment.audit_result,
        created_at: comment.created_at,
        nickname: comment.user?.nickname,
        user_avatar: comment.user?.avatar,
        user_auto_id: comment.user ? Number(comment.user.id) : null,
        user_display_id: comment.user?.user_id,
        user_location: comment.user?.location,
        verified: comment.user?.verified
      };

      // 检查点赞状态
      if (currentUserId) {
        const likeExists = await prisma.like.findUnique({
          where: {
            uk_user_target: {
              user_id: currentUserId,
              target_type: 2,
              target_id: comment.id
            }
          }
        });
        formatted.liked = !!likeExists;
      } else {
        formatted.liked = false;
      }

      // 获取子评论数量
      const childCountWhere = { parent_id: comment.id };
      if (currentUserId) {
        childCountWhere.OR = [
          { is_public: true },
          { user_id: currentUserId }
        ];
      } else {
        childCountWhere.is_public = true;
      }
      const replyCount = await prisma.comment.count({ where: childCountWhere });
      formatted.reply_count = replyCount;

      return formatted;
    }));

    // 获取总数
    const total = await prisma.comment.count({ where });

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        comments: formattedComments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 创建评论
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { post_id, content, parent_id } = req.body;
    const userId = BigInt(req.user.id);

    // 验证必填字段
    if (!post_id || !content) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: '笔记ID和评论内容不能为空' });
    }

    // 对内容进行安全过滤，防止XSS攻击
    const sanitizedContent = sanitizeContent(content);
    
    // 再次验证过滤后的内容不为空
    if (!sanitizedContent.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: '评论内容不能为空' });
    }

    const postIdBigInt = BigInt(post_id);

    // 验证笔记是否存在
    const post = await prisma.post.findUnique({
      where: { id: postIdBigInt },
      select: { id: true, user_id: true }
    });
    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '笔记不存在' });
    }

    // 如果是回复评论，验证父评论是否存在
    let parentIdBigInt = null;
    if (parent_id) {
      parentIdBigInt = BigInt(parent_id);
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentIdBigInt },
        select: { id: true, user_id: true }
      });
      if (!parentComment) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '父评论不存在' });
      }
    }

    // 进行内容审核
    let auditStatus = isAuditEnabled() ? 0 : 1;
    let isPublic = isAuditEnabled() ? false : true;
    let auditResult = null;
    let auditRecordStatus = 0;
    let shouldDeleteComment = false;

    if (isAuditEnabled()) {
      try {
        auditResult = await auditComment(sanitizedContent, Number(userId));
        
        let detailedReason = '';
        if (auditResult) {
          const parts = [];
          if (auditResult.reason) parts.push(`AI审核结果: ${auditResult.reason}`);
          if (auditResult.suggestion) parts.push(`建议: ${auditResult.suggestion}`);
          if (auditResult.passed !== undefined) parts.push(`是否通过: ${auditResult.passed ? '是' : '否'}`);
          if (auditResult.score !== undefined) parts.push(`风险分数: ${auditResult.score}`);
          if (auditResult.matched_keywords && auditResult.matched_keywords.length > 0) {
            parts.push(`匹配关键词: ${auditResult.matched_keywords.join(', ')}`);
          }
          if (auditResult.problem_sentences && auditResult.problem_sentences.length > 0) {
            parts.push(`问题句子: ${auditResult.problem_sentences.join('; ')}`);
          }
          detailedReason = parts.join(' | ');
          
          if (auditResult.passed !== undefined) {
            if (auditResult.passed === true) {
              auditStatus = 1;
              isPublic = true;
              auditRecordStatus = 1;
              detailedReason = `[AI自动审核通过] ${detailedReason}`;
            } else {
              auditStatus = 2;
              isPublic = false;
              auditRecordStatus = 2;
              shouldDeleteComment = true;
              detailedReason = `[AI自动审核拒绝] ${detailedReason}`;
            }
          }
        }
        
        // 记录到audit表
        await prisma.audit.create({
          data: {
            user_id: userId,
            type: 3,
            target_id: null,
            content: sanitizedContent,
            audit_result: auditResult,
            risk_level: auditResult?.risk_level || 'low',
            categories: auditResult?.categories || [],
            reason: detailedReason || 'AI审核完成，等待人工确认',
            status: auditRecordStatus,
            audit_time: auditRecordStatus !== 0 ? new Date() : null,
            retry_count: 0
          }
        });
      } catch (auditError) {
        console.error('评论审核异常:', auditError);
        await prisma.audit.create({
          data: {
            user_id: userId,
            type: 3,
            target_id: null,
            content: sanitizedContent,
            audit_result: null,
            risk_level: 'unknown',
            categories: [],
            reason: '审核服务异常，需人工审核',
            status: 0,
            retry_count: 0
          }
        });
      }
    }

    // 如果AI自动审核拒绝，不创建评论
    if (shouldDeleteComment) {
      return res.status(HTTP_STATUS.OK).json({
        code: RESPONSE_CODES.SUCCESS,
        message: '评论已提交，但因内容违规被系统自动拒绝',
        data: {
          rejected: true,
          reason: auditResult?.reason || '内容不符合社区规范'
        }
      });
    }

    // 插入评论
    const newComment = await prisma.comment.create({
      data: {
        post_id: postIdBigInt,
        user_id: userId,
        content: sanitizedContent,
        parent_id: parentIdBigInt,
        audit_status: auditStatus,
        is_public: isPublic,
        audit_result: auditResult
      }
    });

    const commentId = newComment.id;
    
    // 更新audit表中的target_id为评论ID
    if (isAuditEnabled()) {
      await prisma.audit.updateMany({
        where: {
          user_id: userId,
          type: 3,
          target_id: null
        },
        data: { target_id: commentId }
      });
    }

    // 更新笔记评论数
    await prisma.post.update({
      where: { id: postIdBigInt },
      data: { comment_count: { increment: 1 } }
    });

    // 创建通知
    if (parent_id) {
      // 回复评论，给被回复的评论作者发通知
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentIdBigInt },
        select: { user_id: true }
      });
      if (parentComment && parentComment.user_id !== userId) {
        const notificationData = NotificationHelper.createReplyCommentNotification(
          Number(parentComment.user_id), Number(userId), Number(post_id), Number(commentId)
        );
        await NotificationHelper.insertNotification(prisma, notificationData);
      }
    } else {
      // 评论笔记，给笔记作者发通知
      if (post.user_id !== userId) {
        const notificationData = NotificationHelper.createCommentPostNotification(
          Number(post.user_id), Number(userId), Number(post_id), Number(commentId)
        );
        await NotificationHelper.insertNotification(prisma, notificationData);
      }
    }

    // 处理@用户通知
    if (hasMentions(content)) {
      const mentionedUsers = extractMentionedUsers(content);

      for (const mentionedUser of mentionedUsers) {
        try {
          const userRow = await prisma.user.findUnique({
            where: { user_id: mentionedUser.userId },
            select: { id: true }
          });

          if (userRow && userRow.id !== userId) {
            const mentionNotificationData = NotificationHelper.createNotificationData({
              userId: Number(userRow.id),
              senderId: Number(userId),
              type: NotificationHelper.TYPES.MENTION_COMMENT,
              targetId: Number(post_id),
              commentId: Number(commentId)
            });

            await NotificationHelper.insertNotification(prisma, mentionNotificationData);
          }
        } catch (error) {
          console.error(`处理@用户通知失败 - 用户: ${mentionedUser.userId}:`, error);
        }
      }
    }

    // 获取刚创建的评论的完整信息
    const fullComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            user_id: true,
            location: true,
            verified: true
          }
        }
      }
    });

    const commentData = {
      id: Number(fullComment.id),
      post_id: Number(fullComment.post_id),
      user_id: Number(fullComment.user_id),
      parent_id: fullComment.parent_id ? Number(fullComment.parent_id) : null,
      content: fullComment.content,
      like_count: fullComment.like_count,
      audit_status: fullComment.audit_status,
      is_public: fullComment.is_public,
      audit_result: fullComment.audit_result,
      created_at: fullComment.created_at,
      nickname: fullComment.user?.nickname,
      user_avatar: fullComment.user?.avatar,
      user_auto_id: fullComment.user ? Number(fullComment.user.id) : null,
      user_display_id: fullComment.user?.user_id,
      user_location: fullComment.user?.location,
      verified: fullComment.user?.verified,
      liked: false,
      reply_count: 0
    };

    console.log(`创建评论成功 - 用户ID: ${userId}, 评论ID: ${commentId}`);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: '评论成功',
      data: commentData
    });
  } catch (error) {
    console.error('创建评论失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 获取子评论列表
router.get('/:id/replies', optionalAuth, async (req, res) => {
  try {
    const parentId = BigInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = req.user ? BigInt(req.user.id) : null;

    // 构建查询条件
    const where = { parent_id: parentId };
    if (currentUserId) {
      where.OR = [
        { is_public: true },
        { user_id: currentUserId }
      ];
    } else {
      where.is_public = true;
    }

    const comments = await prisma.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            user_id: true,
            location: true,
            verified: true
          }
        }
      },
      orderBy: { created_at: 'asc' },
      take: limit,
      skip: skip
    });

    // 格式化评论并添加点赞状态
    const formattedComments = await Promise.all(comments.map(async (comment) => {
      const formatted = {
        id: Number(comment.id),
        post_id: Number(comment.post_id),
        user_id: Number(comment.user_id),
        parent_id: comment.parent_id ? Number(comment.parent_id) : null,
        content: comment.content,
        like_count: comment.like_count,
        audit_status: comment.audit_status,
        is_public: comment.is_public,
        audit_result: comment.audit_result,
        created_at: comment.created_at,
        nickname: comment.user?.nickname,
        user_avatar: comment.user?.avatar,
        user_auto_id: comment.user ? Number(comment.user.id) : null,
        user_display_id: comment.user?.user_id,
        user_location: comment.user?.location,
        verified: comment.user?.verified
      };

      if (currentUserId) {
        const likeExists = await prisma.like.findUnique({
          where: {
            uk_user_target: {
              user_id: currentUserId,
              target_type: 2,
              target_id: comment.id
            }
          }
        });
        formatted.liked = !!likeExists;
      } else {
        formatted.liked = false;
      }

      return formatted;
    }));

    // 获取总数
    const total = await prisma.comment.count({ where });

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        comments: formattedComments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取子评论列表失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 删除评论
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const commentId = BigInt(req.params.id);
    const userId = BigInt(req.user.id);

    // 验证评论是否存在并且是当前用户发布的
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, post_id: true, user_id: true, parent_id: true }
    });

    if (!comment) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '评论不存在' });
    }

    // 检查是否是评论作者
    if (comment.user_id !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ code: RESPONSE_CODES.FORBIDDEN, message: '只能删除自己发布的评论' });
    }

    // 使用递归删除函数删除评论及其所有子评论，获取删除的评论总数
    const deletedCount = await deleteCommentRecursive(commentId);

    // 根据实际删除的评论数量更新笔记的评论计数
    await prisma.post.update({
      where: { id: comment.post_id },
      data: { comment_count: { decrement: deletedCount } }
    });

    console.log(`删除评论成功 - 用户ID: ${userId}, 评论ID: ${commentId}`);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: '删除成功',
      data: {
        id: Number(commentId),
        deletedCount: deletedCount
      }
    });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

module.exports = router;
