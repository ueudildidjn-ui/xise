const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');
const { prisma } = require('../config/config');
const { authenticateToken } = require('../middleware/auth');

// 获取当前用户未确认的活跃系统通知
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const now = new Date();

    // 查找所有活跃的、在有效期内的、用户未确认的系统通知
    const notifications = await prisma.systemNotification.findMany({
      where: {
        is_active: true,
        OR: [
          // 没有设置时间限制
          {
            start_time: null,
            end_time: null
          },
          // 在有效期内
          {
            start_time: { lte: now },
            end_time: { gte: now }
          },
          // 只设置了开始时间
          {
            start_time: { lte: now },
            end_time: null
          },
          // 只设置了结束时间
          {
            start_time: null,
            end_time: { gte: now }
          }
        ],
        // 用户未确认过
        NOT: {
          confirmations: {
            some: {
              user_id: userId
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const formattedNotifications = notifications.map(n => ({
      id: Number(n.id),
      title: n.title,
      content: n.content,
      type: n.type,
      image_url: n.image_url,
      link_url: n.link_url,
      created_at: n.created_at
    }));

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        notifications: formattedNotifications
      }
    });
  } catch (error) {
    console.error('获取系统通知失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      code: RESPONSE_CODES.ERROR, 
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR 
    });
  }
});

// 确认系统通知（用户点击确认后调用）
router.post('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const notificationId = BigInt(req.params.id);
    const userId = BigInt(req.user.id);

    // 检查通知是否存在
    const notification = await prisma.systemNotification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ 
        code: RESPONSE_CODES.NOT_FOUND, 
        message: '通知不存在' 
      });
    }

    // 创建确认记录（如果已存在则忽略）
    await prisma.systemNotificationConfirmation.upsert({
      where: {
        uk_notification_user: {
          notification_id: notificationId,
          user_id: userId
        }
      },
      update: {}, // 已存在则不更新
      create: {
        notification_id: notificationId,
        user_id: userId
      }
    });

    res.json({ 
      code: RESPONSE_CODES.SUCCESS, 
      message: '确认成功' 
    });
  } catch (error) {
    console.error('确认系统通知失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      code: RESPONSE_CODES.ERROR, 
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR 
    });
  }
});

// 获取所有系统通知列表（包括历史的）
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type; // 可选：system 或 activity

    const where = { is_active: true };
    if (type) {
      where.type = type;
    }

    const [total, notifications] = await Promise.all([
      prisma.systemNotification.count({ where }),
      prisma.systemNotification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: skip
      })
    ]);

    const formattedNotifications = notifications.map(n => ({
      id: Number(n.id),
      title: n.title,
      content: n.content,
      type: n.type,
      image_url: n.image_url,
      link_url: n.link_url,
      start_time: n.start_time,
      end_time: n.end_time,
      created_at: n.created_at
    }));

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        notifications: formattedNotifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取系统通知历史失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      code: RESPONSE_CODES.ERROR, 
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR 
    });
  }
});

module.exports = router;
