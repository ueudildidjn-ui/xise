const express = require('express')
const router = express.Router()
const { HTTP_STATUS, RESPONSE_CODES } = require('../constants')
const { prisma } = require('../config/config')
const { authenticateToken } = require('../middleware/auth')

// ===================== 用户通知 =====================

// 获取当前用户的通知列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id)
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const type = req.query.type // 可选：按类型筛选
    const is_read = req.query.is_read // 可选：按已读状态筛选

    const where = { user_id: userId }
    if (type !== undefined && type !== '') {
      // 支持逗号分隔的多类型筛选，如 type=1,2,6
      const types = type.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t))
      if (types.length === 1) {
        where.type = types[0]
      } else if (types.length > 1) {
        where.type = { in: types }
      }
    }
    if (is_read !== undefined && is_read !== '') {
      where.is_read = is_read === 'true' || is_read === '1'
    }

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        include: {
          sender: {
            select: { id: true, nickname: true, avatar: true, user_id: true }
          }
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip
      })
    ])

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        data: notifications,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      },
      message: 'success'
    })
  } catch (error) {
    console.error('获取通知列表失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '获取通知列表失败' })
  }
})

// 获取未读通知数量
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id)

    // 用户通知未读数
    const notificationCount = await prisma.notification.count({
      where: { user_id: userId, is_read: false }
    })

    // 系统通知未读数（未确认的系统通知）
    const activeSystemNotifications = await prisma.systemNotification.count({
      where: {
        is_active: true,
        confirmations: {
          none: { user_id: userId }
        }
      }
    })

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        notification_count: notificationCount,
        system_notification_count: activeSystemNotifications,
        total: notificationCount + activeSystemNotifications
      },
      message: 'success'
    })
  } catch (error) {
    console.error('获取未读通知数量失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '获取未读通知数量失败' })
  }
})

// 标记所有通知为已读
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id)

    await prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true }
    })

    res.json({ code: RESPONSE_CODES.SUCCESS, message: '全部标记已读成功' })
  } catch (error) {
    console.error('全部标记已读失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '全部标记已读失败' })
  }
})

// 标记通知为已读
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id)
    const notificationId = BigInt(req.params.id)

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, user_id: userId }
    })

    if (!notification) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '通知不存在' })
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true }
    })

    res.json({ code: RESPONSE_CODES.SUCCESS, message: '标记已读成功' })
  } catch (error) {
    console.error('标记通知已读失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '标记已读失败' })
  }
})

// 删除通知
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id)
    const notificationId = BigInt(req.params.id)

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, user_id: userId }
    })

    if (!notification) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '通知不存在' })
    }

    await prisma.notification.delete({ where: { id: notificationId } })

    res.json({ code: RESPONSE_CODES.SUCCESS, message: '删除成功' })
  } catch (error) {
    console.error('删除通知失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '删除失败' })
  }
})

// ===================== 系统通知 =====================

// 获取当前用户的系统通知列表
router.get('/system', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id)
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const type = req.query.type // 可选：system / activity

    const where = {
      is_active: true
    }
    if (type) {
      where.type = type
    }

    const [total, notifications] = await Promise.all([
      prisma.systemNotification.count({ where }),
      prisma.systemNotification.findMany({
        where,
        include: {
          confirmations: {
            where: { user_id: userId },
            select: { id: true, confirmed_at: true }
          }
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip
      })
    ])

    // 给每条通知附上当前用户的已读状态
    const data = notifications.map(n => ({
      ...n,
      is_read: n.confirmations.length > 0,
      confirmed_at: n.confirmations[0]?.confirmed_at || null,
      confirmations: undefined
    }))

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      },
      message: 'success'
    })
  } catch (error) {
    console.error('获取系统通知列表失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '获取系统通知列表失败' })
  }
})

// 获取需要弹窗显示的系统通知
router.get('/system/popup', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id)

    const notifications = await prisma.systemNotification.findMany({
      where: {
        is_active: true,
        show_popup: true,
        confirmations: {
          none: { user_id: userId }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: notifications,
      message: 'success'
    })
  } catch (error) {
    console.error('获取弹窗通知失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '获取弹窗通知失败' })
  }
})

// 确认系统通知（标记已读）
router.post('/system/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id)
    const notificationId = BigInt(req.params.id)

    const notification = await prisma.systemNotification.findUnique({
      where: { id: notificationId }
    })

    if (!notification) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '系统通知不存在' })
    }

    // 使用 upsert 避免重复确认
    await prisma.systemNotificationConfirmation.upsert({
      where: {
        notification_id_user_id: {
          notification_id: notificationId,
          user_id: userId
        }
      },
      create: {
        notification_id: notificationId,
        user_id: userId
      },
      update: {}
    })

    res.json({ code: RESPONSE_CODES.SUCCESS, message: '确认成功' })
  } catch (error) {
    console.error('确认系统通知失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '确认失败' })
  }
})

module.exports = router
