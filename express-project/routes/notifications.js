const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');
const { prisma } = require('../config/config');
const { authenticateToken } = require('../middleware/auth');

// Helper function to format notification with related data
async function formatNotification(notification) {
  const result = {
    ...notification,
    id: Number(notification.id),
    user_id: Number(notification.user_id),
    sender_id: Number(notification.sender_id),
    target_id: notification.target_id ? Number(notification.target_id) : null,
    comment_id: notification.comment_id ? Number(notification.comment_id) : null
  };
  return result;
}

// 获取评论通知
router.get('/comments', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: userId,
        type: { in: [4, 5, 7, 8] }
      },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            user_id: true,
            verified: true
          }
        },
        comment: {
          select: {
            id: true,
            content: true,
            created_at: true,
            like_count: true,
            parent_id: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: skip
    });

    // Get post info for each notification
    const formattedNotifications = await Promise.all(notifications.map(async (n) => {
      const formatted = {
        id: Number(n.id),
        user_id: Number(n.user_id),
        sender_id: Number(n.sender_id),
        type: n.type,
        title: n.title,
        target_id: n.target_id ? Number(n.target_id) : null,
        comment_id: n.comment_id ? Number(n.comment_id) : null,
        is_read: n.is_read,
        created_at: n.created_at,
        from_user_auto_id: n.sender ? Number(n.sender.id) : null,
        from_nickname: n.sender?.nickname,
        from_avatar: n.sender?.avatar,
        from_user_id: n.sender?.user_id,
        from_verified: n.sender?.verified
      };

      // Get post info if target_id exists
      if (n.target_id) {
        const post = await prisma.post.findUnique({
          where: { id: n.target_id },
          select: {
            title: true,
            type: true,
            user_id: true,
            images: { select: { image_url: true }, take: 1 },
            videos: { select: { cover_url: true }, take: 1 }
          }
        });
        if (post) {
          formatted.post_title = post.title;
          formatted.post_type = post.type;
          formatted.post_author_id = Number(post.user_id);
          formatted.post_image = post.type === 2 
            ? (post.videos[0]?.cover_url || null)
            : (post.images[0]?.image_url || null);
        }
      }

      // Get comment info
      if (n.comment) {
        formatted.comment_content = n.comment.content;
        formatted.comment_created_at = n.comment.created_at;
        formatted.comment_like_count = n.comment.like_count;

        // Check if user liked the comment
        const likeExists = await prisma.like.findUnique({
          where: {
            uk_user_target: {
              user_id: userId,
              target_type: 2,
              target_id: n.comment_id
            }
          }
        });
        formatted.comment_is_liked = likeExists ? 1 : 0;

        // Get parent comment content if this is a reply
        if (n.type === 5 && n.comment.parent_id) {
          const parentComment = await prisma.comment.findUnique({
            where: { id: n.comment.parent_id },
            select: { content: true }
          });
          formatted.parent_comment_content = parentComment?.content || null;
        }
      }

      return formatted;
    }));

    // Get total count
    const total = await prisma.notification.count({
      where: {
        user_id: userId,
        type: { in: [4, 5, 7, 8] }
      }
    });

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
    console.error('获取评论通知失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 获取点赞通知
router.get('/likes', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: userId,
        type: { in: [1, 2] }
      },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            user_id: true,
            verified: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: skip
    });

    // Get post info for each notification
    const formattedNotifications = await Promise.all(notifications.map(async (n) => {
      const formatted = {
        id: Number(n.id),
        user_id: Number(n.user_id),
        sender_id: Number(n.sender_id),
        type: n.type,
        title: n.title,
        target_id: n.target_id ? Number(n.target_id) : null,
        comment_id: n.comment_id ? Number(n.comment_id) : null,
        is_read: n.is_read,
        created_at: n.created_at,
        from_user_auto_id: n.sender ? Number(n.sender.id) : null,
        from_nickname: n.sender?.nickname,
        from_avatar: n.sender?.avatar,
        from_user_id: n.sender?.user_id,
        from_verified: n.sender?.verified,
        target_type: n.type === 1 ? 1 : (n.type === 2 ? 2 : 1)
      };

      // Get post info if target_id exists
      if (n.target_id) {
        const post = await prisma.post.findUnique({
          where: { id: n.target_id },
          select: {
            title: true,
            type: true,
            user_id: true,
            images: { select: { image_url: true }, take: 1 },
            videos: { select: { cover_url: true }, take: 1 }
          }
        });
        if (post) {
          formatted.post_title = post.title;
          formatted.post_type = post.type;
          formatted.post_author_id = Number(post.user_id);
          formatted.post_image = post.type === 2 
            ? (post.videos[0]?.cover_url || null)
            : (post.images[0]?.image_url || null);
        }
      }

      return formatted;
    }));

    // Get total count
    const total = await prisma.notification.count({
      where: {
        user_id: userId,
        type: { in: [1, 2] }
      }
    });

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
    console.error('获取点赞通知失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 获取关注通知
router.get('/follows', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: userId,
        type: 6
      },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            user_id: true,
            verified: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: skip
    });

    const formattedNotifications = notifications.map(n => ({
      id: Number(n.id),
      user_id: Number(n.user_id),
      sender_id: Number(n.sender_id),
      type: n.type,
      title: n.title,
      target_id: n.target_id ? Number(n.target_id) : null,
      comment_id: n.comment_id ? Number(n.comment_id) : null,
      is_read: n.is_read,
      created_at: n.created_at,
      from_user_auto_id: n.sender ? Number(n.sender.id) : null,
      from_nickname: n.sender?.nickname,
      from_avatar: n.sender?.avatar,
      from_user_id: n.sender?.user_id,
      from_verified: n.sender?.verified
    }));

    // Get total count
    const total = await prisma.notification.count({
      where: {
        user_id: userId,
        type: 6
      }
    });

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
    console.error('获取关注通知失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 获取收藏通知
router.get('/collections', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: userId,
        type: 3
      },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            user_id: true,
            verified: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: skip
    });

    // Get post info for each notification
    const formattedNotifications = await Promise.all(notifications.map(async (n) => {
      const formatted = {
        id: Number(n.id),
        user_id: Number(n.user_id),
        sender_id: Number(n.sender_id),
        type: n.type,
        title: n.title,
        target_id: n.target_id ? Number(n.target_id) : null,
        comment_id: n.comment_id ? Number(n.comment_id) : null,
        is_read: n.is_read,
        created_at: n.created_at,
        from_user_auto_id: n.sender ? Number(n.sender.id) : null,
        from_nickname: n.sender?.nickname,
        from_avatar: n.sender?.avatar,
        from_user_id: n.sender?.user_id,
        from_verified: n.sender?.verified
      };

      // Get post info if target_id exists
      if (n.target_id) {
        const post = await prisma.post.findUnique({
          where: { id: n.target_id },
          select: {
            title: true,
            type: true,
            images: { select: { image_url: true }, take: 1 },
            videos: { select: { cover_url: true }, take: 1 }
          }
        });
        if (post) {
          formatted.post_title = post.title;
          formatted.post_type = post.type;
          formatted.post_image = post.type === 2 
            ? (post.videos[0]?.cover_url || null)
            : (post.images[0]?.image_url || null);
        }
      }

      return formatted;
    }));

    // Get total count
    const total = await prisma.notification.count({
      where: {
        user_id: userId,
        type: 3
      }
    });

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
    console.error('获取收藏通知失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 获取通知列表（通用接口）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const type = req.query.type ? parseInt(req.query.type) : undefined;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const where = { user_id: userId };
    if (type !== undefined) {
      where.type = type;
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            user_id: true,
            verified: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: skip
    });

    const formattedNotifications = notifications.map(n => ({
      id: Number(n.id),
      user_id: Number(n.user_id),
      sender_id: Number(n.sender_id),
      type: n.type,
      title: n.title,
      target_id: n.target_id ? Number(n.target_id) : null,
      comment_id: n.comment_id ? Number(n.comment_id) : null,
      is_read: n.is_read,
      created_at: n.created_at,
      from_user_auto_id: n.sender ? Number(n.sender.id) : null,
      from_nickname: n.sender?.nickname,
      from_avatar: n.sender?.avatar,
      from_user_id: n.sender?.user_id,
      verified: n.sender?.verified
    }));

    // Get total count
    const total = await prisma.notification.count({ where });

    // Get unread count
    const unread = await prisma.notification.count({
      where: { user_id: userId, is_read: false }
    });

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
        },
        unread
      }
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 标记通知为已读
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = BigInt(req.params.id);
    const userId = BigInt(req.user.id);

    // 验证通知是否属于当前用户
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, user_id: userId }
    });

    if (!notification) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '通知不存在' });
    }

    // 标记为已读
    await prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true }
    });

    res.json({ code: RESPONSE_CODES.SUCCESS, message: '标记成功' });
  } catch (error) {
    console.error('标记通知已读失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 标记所有通知为已读
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);

    // 标记所有通知为已读
    await prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true }
    });

    res.json({ code: RESPONSE_CODES.SUCCESS, message: '全部标记成功' });
  } catch (error) {
    console.error('标记所有通知已读失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 删除通知
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = BigInt(req.params.id);
    const userId = BigInt(req.user.id);

    // 验证通知是否属于当前用户并删除
    const result = await prisma.notification.deleteMany({
      where: { id: notificationId, user_id: userId }
    });

    if (result.count === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '通知不存在' });
    }

    res.json({ code: RESPONSE_CODES.SUCCESS, message: '删除成功' });
  } catch (error) {
    console.error('删除通知失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 获取按类型分组的未读通知数量
router.get('/unread-count-by-type', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);

    // Get counts for each notification type group
    const [comments, likes, collections, follows, total] = await Promise.all([
      prisma.notification.count({
        where: { user_id: userId, is_read: false, type: { in: [4, 5, 7, 8] } }
      }),
      prisma.notification.count({
        where: { user_id: userId, is_read: false, type: { in: [1, 2] } }
      }),
      prisma.notification.count({
        where: { user_id: userId, is_read: false, type: 3 }
      }),
      prisma.notification.count({
        where: { user_id: userId, is_read: false, type: 6 }
      }),
      prisma.notification.count({
        where: { user_id: userId, is_read: false }
      })
    ]);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        comments,
        likes,
        collections,
        follows,
        total
      }
    });
  } catch (error) {
    console.error('获取按类型分组的未读通知数量失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 获取未读通知数量
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);

    const count = await prisma.notification.count({
      where: { user_id: userId, is_read: false }
    });

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: { count }
    });
  } catch (error) {
    console.error('获取未读通知数量失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

module.exports = router;
