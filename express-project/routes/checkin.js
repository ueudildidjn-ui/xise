/**
 * 每日签到路由
 * 处理用户每日签到、签到状态查询、签到记录查询
 */

const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');
const { prisma } = require('../config/config');
const { authenticateToken } = require('../middleware/auth');

// 签到奖励配置：连续签到天数 → 奖励积分
const CHECKIN_REWARDS = {
  base: 1,    // 基础签到奖励
  day3: 3,    // 连续3天额外奖励
  day7: 5,    // 连续7天额外奖励
  day30: 10   // 连续30天额外奖励
};

/**
 * 获取当天日期字符串（YYYY-MM-DD），基于服务器本地时区
 */
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取昨天日期字符串（YYYY-MM-DD），基于服务器本地时区
 */
function getYesterdayDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 根据连续签到天数计算奖励积分
 */
function calculateRewardPoints(streakDays) {
  let points = CHECKIN_REWARDS.base;
  if (streakDays >= 30) {
    points = CHECKIN_REWARDS.day30;
  } else if (streakDays >= 7) {
    points = CHECKIN_REWARDS.day7;
  } else if (streakDays >= 3) {
    points = CHECKIN_REWARDS.day3;
  }
  return points;
}

/**
 * @description 每日签到
 * @route POST /api/checkin
 * @access 需要登录
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const todayStr = getTodayDate();
    const todayDate = new Date(todayStr);

    // 检查今天是否已签到
    const existingCheckin = await prisma.dailyCheckin.findUnique({
      where: {
        uk_user_checkin_date: {
          user_id: userId,
          checkin_date: todayDate
        }
      }
    });

    if (existingCheckin) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '今天已经签到过了',
        data: {
          checkin_date: todayStr,
          streak_days: existingCheckin.streak_days,
          reward_points: parseFloat(existingCheckin.reward_points)
        }
      });
    }

    // 查询昨天的签到记录，计算连续天数
    const yesterdayStr = getYesterdayDate();
    const yesterdayDate = new Date(yesterdayStr);
    const yesterdayCheckin = await prisma.dailyCheckin.findUnique({
      where: {
        uk_user_checkin_date: {
          user_id: userId,
          checkin_date: yesterdayDate
        }
      }
    });

    const streakDays = yesterdayCheckin ? yesterdayCheckin.streak_days + 1 : 1;
    const rewardPoints = calculateRewardPoints(streakDays);

    // 创建签到记录并更新积分（事务）
    const result = await prisma.$transaction(async (tx) => {
      // 创建签到记录
      const checkin = await tx.dailyCheckin.create({
        data: {
          user_id: userId,
          checkin_date: todayDate,
          reward_points: rewardPoints,
          streak_days: streakDays
        }
      });

      // 获取或创建用户积分
      let userPoints = await tx.userPoints.findUnique({
        where: { user_id: userId }
      });

      if (!userPoints) {
        userPoints = await tx.userPoints.create({
          data: {
            user_id: userId,
            points: 0.00
          }
        });
      }

      const currentPoints = parseFloat(userPoints.points);
      const newPoints = currentPoints + rewardPoints;

      // 更新积分
      await tx.userPoints.update({
        where: { user_id: userId },
        data: { points: newPoints }
      });

      // 记录积分日志
      await tx.pointsLog.create({
        data: {
          user_id: userId,
          amount: rewardPoints,
          balance_after: newPoints,
          type: 'checkin',
          reason: `每日签到奖励（连续${streakDays}天）`
        }
      });

      return { checkin, newPoints };
    });

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        checkin_date: todayStr,
        streak_days: streakDays,
        reward_points: rewardPoints,
        total_points: result.newPoints
      },
      message: '签到成功'
    });
  } catch (error) {
    console.error('签到失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

/**
 * @description 获取今日签到状态
 * @route GET /api/checkin/status
 * @access 需要登录
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const todayStr = getTodayDate();
    const todayDate = new Date(todayStr);

    // 查询今天的签到记录
    const todayCheckin = await prisma.dailyCheckin.findUnique({
      where: {
        uk_user_checkin_date: {
          user_id: userId,
          checkin_date: todayDate
        }
      }
    });

    // 如果今天已签到，直接返回
    if (todayCheckin) {
      return res.json({
        code: RESPONSE_CODES.SUCCESS,
        data: {
          checked_in: true,
          checkin_date: todayStr,
          streak_days: todayCheckin.streak_days,
          reward_points: parseFloat(todayCheckin.reward_points)
        },
        message: 'success'
      });
    }

    // 未签到，查询昨天的记录计算预期连续天数
    const yesterdayStr = getYesterdayDate();
    const yesterdayDate = new Date(yesterdayStr);
    const yesterdayCheckin = await prisma.dailyCheckin.findUnique({
      where: {
        uk_user_checkin_date: {
          user_id: userId,
          checkin_date: yesterdayDate
        }
      }
    });

    const expectedStreak = yesterdayCheckin ? yesterdayCheckin.streak_days + 1 : 1;
    const expectedReward = calculateRewardPoints(expectedStreak);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        checked_in: false,
        checkin_date: todayStr,
        streak_days: yesterdayCheckin ? yesterdayCheckin.streak_days : 0,
        expected_reward: expectedReward
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取签到状态失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

/**
 * @description 获取签到记录（分页）
 * @route GET /api/checkin/history
 * @access 需要登录
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.dailyCheckin.findMany({
        where: { user_id: userId },
        orderBy: { checkin_date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          checkin_date: true,
          reward_points: true,
          streak_days: true,
          created_at: true
        }
      }),
      prisma.dailyCheckin.count({
        where: { user_id: userId }
      })
    ]);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        records: records.map(r => ({
          id: r.id,
          checkin_date: r.checkin_date,
          reward_points: parseFloat(r.reward_points),
          streak_days: r.streak_days,
          created_at: r.created_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取签到记录失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

module.exports = router;
