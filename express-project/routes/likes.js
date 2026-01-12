const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');
const { prisma } = require('../config/config');
const { authenticateToken } = require('../middleware/auth');
const NotificationHelper = require('../utils/notificationHelper');

// 点赞/取消点赞
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { target_type, target_id } = req.body;
    const userId = req.user.id;

    // 验证参数
    if (!target_type || !target_id) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: '缺少必要参数' });
    }

    // target_type: 1=笔记, 2=评论
    if (![1, 2].includes(parseInt(target_type))) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: '无效的目标类型' });
    }

    const targetTypeInt = parseInt(target_type);
    const targetIdBigInt = BigInt(target_id);
    const userIdBigInt = BigInt(userId);

    // 检查是否已经点赞
    const existingLike = await prisma.like.findUnique({
      where: {
        uk_user_target: {
          user_id: userIdBigInt,
          target_type: targetTypeInt,
          target_id: targetIdBigInt
        }
      }
    });

    if (existingLike) {
      // 已点赞，执行取消点赞
      await prisma.like.delete({
        where: { id: existingLike.id }
      });

      // 更新对应表的点赞数
      if (targetTypeInt === 1) {
        // 笔记
        const post = await prisma.post.update({
          where: { id: targetIdBigInt },
          data: { like_count: { decrement: 1 } },
          select: { user_id: true }
        });

        // 更新笔记作者的获赞数
        await prisma.user.update({
          where: { id: post.user_id },
          data: { like_count: { decrement: 1 } }
        });
      } else if (targetTypeInt === 2) {
        // 评论
        await prisma.comment.update({
          where: { id: targetIdBigInt },
          data: { like_count: { decrement: 1 } }
        });
      }

      console.log(`取消点赞成功 - 用户ID: ${userId}`);
      res.json({ code: RESPONSE_CODES.SUCCESS, message: '取消点赞成功', data: { liked: false } });
    } else {
      // 未点赞，执行点赞
      await prisma.like.create({
        data: {
          user_id: userIdBigInt,
          target_type: targetTypeInt,
          target_id: targetIdBigInt
        }
      });

      // 更新对应表的点赞数
      let targetUserId = null;
      let notificationTargetId = target_id; // 默认使用原始target_id

      if (targetTypeInt === 1) {
        // 笔记
        const post = await prisma.post.update({
          where: { id: targetIdBigInt },
          data: { like_count: { increment: 1 } },
          select: { user_id: true }
        });

        // 更新笔记作者的获赞数
        await prisma.user.update({
          where: { id: post.user_id },
          data: { like_count: { increment: 1 } }
        });

        targetUserId = Number(post.user_id);
        // 点赞笔记时，target_id就是笔记ID
        notificationTargetId = target_id;
      } else if (targetTypeInt === 2) {
        // 评论
        const comment = await prisma.comment.update({
          where: { id: targetIdBigInt },
          data: { like_count: { increment: 1 } },
          select: { user_id: true, post_id: true }
        });

        targetUserId = Number(comment.user_id);
        // 点赞评论时，通知的target_id应该是评论所属的笔记ID，这样点击通知可以跳转到笔记页面
        notificationTargetId = Number(comment.post_id);
      }

      // 创建通知（不给自己发通知）
      if (targetUserId && targetUserId !== userId) {

        let notificationData;
        if (targetTypeInt === 1) {
          // 点赞笔记
          notificationData = NotificationHelper.createLikePostNotification(targetUserId, userId, notificationTargetId);
        } else if (targetTypeInt === 2) {
          // 点赞评论
          notificationData = NotificationHelper.createLikeCommentNotification(targetUserId, userId, notificationTargetId, target_id);
        }

        // 插入通知到数据库
        if (notificationData) {
          await NotificationHelper.insertNotificationPrisma(prisma, notificationData);
        }
      }
      console.log(`点赞成功 - 用户ID: ${userId}`);
      res.json({ code: RESPONSE_CODES.SUCCESS, message: '点赞成功', data: { liked: true } });
    }
  } catch (error) {
    console.error('点赞操作失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 取消点赞（兼容旧接口）
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const { target_type, target_id } = req.body;
    const userId = req.user.id;

    // 验证参数
    if (!target_type || !target_id) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: '缺少必要参数' });
    }

    const targetTypeInt = parseInt(target_type);
    const targetIdBigInt = BigInt(target_id);
    const userIdBigInt = BigInt(userId);

    // 查找并删除点赞记录
    const existingLike = await prisma.like.findUnique({
      where: {
        uk_user_target: {
          user_id: userIdBigInt,
          target_type: targetTypeInt,
          target_id: targetIdBigInt
        }
      }
    });

    if (!existingLike) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '点赞记录不存在' });
    }

    await prisma.like.delete({
      where: { id: existingLike.id }
    });

    // 更新对应表的点赞数
    if (targetTypeInt === 1) {
      // 笔记
      const post = await prisma.post.update({
        where: { id: targetIdBigInt },
        data: { like_count: { decrement: 1 } },
        select: { user_id: true }
      });

      // 更新笔记作者的获赞数
      await prisma.user.update({
        where: { id: post.user_id },
        data: { like_count: { decrement: 1 } }
      });
    } else if (targetTypeInt === 2) {
      // 评论
      await prisma.comment.update({
        where: { id: targetIdBigInt },
        data: { like_count: { decrement: 1 } }
      });
    }

    console.log(`取消点赞成功 - 用户ID: ${userId}`);
    res.json({ code: RESPONSE_CODES.SUCCESS, message: '取消点赞成功' });
  } catch (error) {
    console.error('取消点赞失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

module.exports = router;