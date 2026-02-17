/**
 * 创作者中心路由
 * 处理创作者收益相关功能
 */

const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');
const { prisma, creatorCenter: creatorCenterConfig } = require('../config/config');
const { authenticateToken } = require('../middleware/auth');

// 默认平台抽成比例 (10%)
const DEFAULT_PLATFORM_FEE_RATE = 0.10;

// 获取平台抽成比例
const getPlatformFeeRate = () => {
  if (creatorCenterConfig && typeof creatorCenterConfig.platformFeeRate === 'number') {
    return creatorCenterConfig.platformFeeRate;
  }
  return DEFAULT_PLATFORM_FEE_RATE;
};

// 获取或初始化创作者收益账户
const getOrCreateCreatorEarnings = async (userId) => {
  const userIdBigInt = BigInt(userId);
  
  let earnings = await prisma.creatorEarnings.findUnique({
    where: { user_id: userIdBigInt }
  });
  
  if (!earnings) {
    earnings = await prisma.creatorEarnings.create({
      data: {
        user_id: userIdBigInt,
        balance: 0.00,
        total_earnings: 0.00,
        withdrawn_amount: 0.00
      }
    });
  }
  
  return {
    id: earnings.id,
    balance: parseFloat(earnings.balance),
    total_earnings: parseFloat(earnings.total_earnings),
    withdrawn_amount: parseFloat(earnings.withdrawn_amount)
  };
};

// 添加创作者收益
const addCreatorEarnings = async (userId, grossAmount, type, options = {}) => {
  const userIdBigInt = BigInt(userId);
  
  // 计算平台抽成
  const platformFeeRate = getPlatformFeeRate();
  const platformFee = grossAmount * platformFeeRate;
  const netAmount = grossAmount - platformFee;
  
  // 获取或创建收益账户
  const earnings = await getOrCreateCreatorEarnings(userId);
  const newBalance = earnings.balance + netAmount;
  const newTotalEarnings = earnings.total_earnings + netAmount;
  
  // 更新收益余额
  await prisma.creatorEarnings.update({
    where: { user_id: userIdBigInt },
    data: { 
      balance: newBalance,
      total_earnings: newTotalEarnings
    }
  });
  
  // 记录收益日志
  await prisma.creatorEarningsLog.create({
    data: {
      user_id: userIdBigInt,
      earnings_id: earnings.id,
      amount: netAmount,
      balance_after: newBalance,
      type: type,
      source_id: options.sourceId ? BigInt(options.sourceId) : null,
      source_type: options.sourceType || null,
      buyer_id: options.buyerId ? BigInt(options.buyerId) : null,
      reason: options.reason || null,
      platform_fee: platformFee
    }
  });
  
  return {
    grossAmount: grossAmount,
    platformFee: platformFee,
    netAmount: netAmount,
    newBalance: newBalance,
    newTotalEarnings: newTotalEarnings
  };
};

// 获取扩展收益计算配置
const getExtendedEarningsConfig = () => {
  return {
    enabled: creatorCenterConfig?.extendedEarningsEnabled ?? false,
    rates: creatorCenterConfig?.earningsRates ?? {
      perView: 0.01,
      perLike: 0.05,
      perCollect: 0.10,
      perComment: 0.02,
      perFollower: 0.20
    },
    dailyCap: creatorCenterConfig?.dailyExtendedEarningsCap ?? 0
  };
};

// 计算扩展收益（基于浏览、互动等）
const calculateExtendedEarnings = async (userId, startDate, endDate) => {
  const userIdBigInt = BigInt(userId);
  const config = getExtendedEarningsConfig();
  
  if (!config.enabled) {
    return {
      enabled: false,
      views: { count: 0, earnings: 0 },
      likes: { count: 0, earnings: 0 },
      collects: { count: 0, earnings: 0 },
      comments: { count: 0, earnings: 0 },
      followers: { count: 0, earnings: 0 },
      total: 0
    };
  }
  
  // 获取用户发布的帖子ID列表
  const userPosts = await prisma.post.findMany({
    where: { user_id: userIdBigInt, is_draft: false },
    select: { id: true }
  });
  const postIds = userPosts.map(p => p.id);
  
  let viewCount = 0;
  let likeCount = 0;
  let collectCount = 0;
  let commentCount = 0;
  let followerCount = 0;
  
  if (postIds.length > 0) {
    // 统计浏览量
    viewCount = await prisma.browsingHistory.count({
      where: {
        post_id: { in: postIds },
        created_at: { gte: startDate, lt: endDate }
      }
    });
    
    // 统计点赞数
    likeCount = await prisma.like.count({
      where: {
        target_type: 1, // 帖子点赞
        target_id: { in: postIds },
        created_at: { gte: startDate, lt: endDate }
      }
    });
    
    // 统计收藏数
    collectCount = await prisma.collection.count({
      where: {
        post_id: { in: postIds },
        created_at: { gte: startDate, lt: endDate }
      }
    });
    
    // 统计评论数
    commentCount = await prisma.comment.count({
      where: {
        post_id: { in: postIds },
        created_at: { gte: startDate, lt: endDate }
      }
    });
  }
  
  // 统计新粉丝数
  followerCount = await prisma.follow.count({
    where: {
      following_id: userIdBigInt,
      created_at: { gte: startDate, lt: endDate }
    }
  });
  
  // 计算各项收益
  const viewEarnings = viewCount * config.rates.perView;
  const likeEarnings = likeCount * config.rates.perLike;
  const collectEarnings = collectCount * config.rates.perCollect;
  const commentEarnings = commentCount * config.rates.perComment;
  const followerEarnings = followerCount * config.rates.perFollower;
  
  let totalEarnings = viewEarnings + likeEarnings + collectEarnings + commentEarnings + followerEarnings;
  
  // 应用每日上限
  if (config.dailyCap > 0 && totalEarnings > config.dailyCap) {
    totalEarnings = config.dailyCap;
  }
  
  return {
    enabled: true,
    rates: config.rates,
    dailyCap: config.dailyCap,
    views: { count: viewCount, earnings: parseFloat(viewEarnings.toFixed(2)) },
    likes: { count: likeCount, earnings: parseFloat(likeEarnings.toFixed(2)) },
    collects: { count: collectCount, earnings: parseFloat(collectEarnings.toFixed(2)) },
    comments: { count: commentCount, earnings: parseFloat(commentEarnings.toFixed(2)) },
    followers: { count: followerCount, earnings: parseFloat(followerEarnings.toFixed(2)) },
    total: parseFloat(totalEarnings.toFixed(2))
  };
};

// 领取扩展收益（将扩展收益添加到可提现余额并记录日志）
const claimExtendedEarnings = async (userId) => {
  const userIdBigInt = BigInt(userId);
  const config = getExtendedEarningsConfig();
  
  if (!config.enabled) {
    return { success: false, message: '扩展收益功能未启用' };
  }
  
  // 获取今日日期范围
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // 检查今日是否已领取
  const existingClaim = await prisma.creatorEarningsLog.findFirst({
    where: {
      user_id: userIdBigInt,
      type: 'extended_daily',
      created_at: { gte: today, lt: tomorrow }
    }
  });
  
  if (existingClaim) {
    return { success: false, message: '今日激励奖励已领取', alreadyClaimed: true };
  }
  
  // 计算今日扩展收益
  const extendedEarnings = await calculateExtendedEarnings(userId, today, tomorrow);
  
  if (extendedEarnings.total <= 0) {
    return { success: false, message: '今日暂无可领取的激励奖励', noEarnings: true };
  }
  
  // 获取或创建收益账户
  const earnings = await getOrCreateCreatorEarnings(userId);
  const newBalance = earnings.balance + extendedEarnings.total;
  const newTotalEarnings = earnings.total_earnings + extendedEarnings.total;
  
  // 更新收益余额
  await prisma.creatorEarnings.update({
    where: { user_id: userIdBigInt },
    data: { 
      balance: newBalance,
      total_earnings: newTotalEarnings
    }
  });
  
  // 构建收益明细描述
  const details = [];
  if (extendedEarnings.views.count > 0) details.push(`浏览${extendedEarnings.views.count}次`);
  if (extendedEarnings.likes.count > 0) details.push(`点赞${extendedEarnings.likes.count}次`);
  if (extendedEarnings.collects.count > 0) details.push(`收藏${extendedEarnings.collects.count}次`);
  if (extendedEarnings.comments.count > 0) details.push(`评论${extendedEarnings.comments.count}条`);
  if (extendedEarnings.followers.count > 0) details.push(`新粉丝${extendedEarnings.followers.count}位`);
  
  // 记录收益日志
  await prisma.creatorEarningsLog.create({
    data: {
      user_id: userIdBigInt,
      earnings_id: earnings.id,
      amount: extendedEarnings.total,
      balance_after: newBalance,
      type: 'extended_daily',
      source_type: 'incentive',
      reason: `今日激励奖励: ${details.join('、')}`,
      platform_fee: 0
    }
  });
  
  return {
    success: true,
    message: '激励奖励领取成功',
    earnings: extendedEarnings,
    newBalance: newBalance,
    details: details
  };
};

// 获取创作者中心配置
router.get('/config', (req, res) => {
  const platformFeeRate = getPlatformFeeRate();
  const creatorShareRate = 1 - platformFeeRate;
  
  // 获取扩展收益配置
  const extendedEarningsEnabled = creatorCenterConfig?.extendedEarningsEnabled ?? false;
  const earningsRates = creatorCenterConfig?.earningsRates ?? {
    perView: 0.01,
    perLike: 0.05,
    perCollect: 0.10,
    perComment: 0.02,
    perFollower: 0.20
  };
  const dailyExtendedEarningsCap = creatorCenterConfig?.dailyExtendedEarningsCap ?? 0;
  
  res.json({
    code: RESPONSE_CODES.SUCCESS,
    data: {
      platformFeeRate: platformFeeRate,
      creatorShareRate: creatorShareRate,
      withdrawEnabled: creatorCenterConfig?.withdrawEnabled ?? false,
      minWithdrawAmount: creatorCenterConfig?.minWithdrawAmount ?? 10,
      // 扩展收益配置
      extendedEarnings: {
        enabled: extendedEarningsEnabled,
        rates: earningsRates,
        dailyCap: dailyExtendedEarningsCap
      }
    },
    message: 'success'
  });
});

// 获取创作者收益概览
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userIdBigInt = BigInt(userId);
    
    // 自动发放今日激励奖励（静默处理，不影响主流程）
    const config = getExtendedEarningsConfig();
    if (config.enabled) {
      try {
        await claimExtendedEarnings(userId);
      } catch (e) {
        console.error('自动发放激励奖励失败:', e.message);
      }
    }
    
    // 获取收益账户信息
    const earnings = await getOrCreateCreatorEarnings(userId);
    
    // 获取今日收益
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEarnings = await prisma.creatorEarningsLog.aggregate({
      where: {
        user_id: userIdBigInt,
        amount: { gt: 0 },
        created_at: { gte: today }
      },
      _sum: { amount: true }
    });
    
    // 获取本月收益
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const monthEarnings = await prisma.creatorEarningsLog.aggregate({
      where: {
        user_id: userIdBigInt,
        amount: { gt: 0 },
        created_at: { gte: monthStart }
      },
      _sum: { amount: true }
    });
    
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        balance: earnings.balance,
        total_earnings: earnings.total_earnings,
        withdrawn_amount: earnings.withdrawn_amount,
        today_earnings: parseFloat(todayEarnings._sum.amount) || 0,
        month_earnings: parseFloat(monthEarnings._sum.amount) || 0
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取创作者收益概览失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 获取趋势数据（过去7天的每日统计）
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userIdBigInt = BigInt(userId);
    
    // 生成过去7天的日期列表
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date);
    }
    
    // 获取每日浏览量数据（基于浏览历史）
    const viewsData = await Promise.all(dates.map(async (date) => {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const result = await prisma.browsingHistory.count({
        where: {
          post: {
            user_id: userIdBigInt
          },
          created_at: {
            gte: date,
            lt: nextDate
          }
        }
      });
      
      return result;
    }));
    
    // 获取用户发布的帖子ID列表（只查询一次，用于后续统计）
    const userPosts = await prisma.post.findMany({
      where: { user_id: userIdBigInt, is_draft: false },
      select: { id: true }
    });
    const postIds = userPosts.map(p => p.id);
    
    // 获取每日点赞数据
    const likesData = await Promise.all(dates.map(async (date) => {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      if (postIds.length === 0) return 0;
      
      return await prisma.like.count({
        where: {
          target_type: 1, // 帖子点赞
          target_id: { in: postIds },
          created_at: {
            gte: date,
            lt: nextDate
          }
        }
      });
    }));
    
    // 获取每日收藏数据
    const collectsData = await Promise.all(dates.map(async (date) => {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      if (postIds.length === 0) return 0;
      
      return await prisma.collection.count({
        where: {
          post_id: { in: postIds },
          created_at: {
            gte: date,
            lt: nextDate
          }
        }
      });
    }));
    
    // 获取每日新粉丝数
    const followersData = await Promise.all(dates.map(async (date) => {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const result = await prisma.follow.count({
        where: {
          following_id: userIdBigInt,
          created_at: {
            gte: date,
            lt: nextDate
          }
        }
      });
      
      return result;
    }));
    
    // 格式化日期标签
    const labels = dates.map(date => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    });
    
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        labels: labels,
        views: viewsData,
        likes: likesData,
        collects: collectsData,
        followers: followersData
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 获取收益明细列表
router.get('/earnings-log', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userIdBigInt = BigInt(userId);
    const { page = 1, limit = 20, type } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const where = { user_id: userIdBigInt };
    if (type) {
      where.type = type;
    }
    
    const [logs, total] = await Promise.all([
      prisma.creatorEarningsLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
        include: {
          user: {
            select: { id: true, nickname: true, avatar: true }
          }
        }
      }),
      prisma.creatorEarningsLog.count({ where })
    ]);
    
    // 获取购买者信息
    const logsWithBuyer = await Promise.all(logs.map(async (log) => {
      let buyer = null;
      if (log.buyer_id) {
        buyer = await prisma.user.findUnique({
          where: { id: log.buyer_id },
          select: { id: true, nickname: true, avatar: true, user_id: true }
        });
      }
      
      let source = null;
      if (log.source_id && log.source_type === 'post') {
        source = await prisma.post.findUnique({
          where: { id: log.source_id },
          select: { id: true, title: true }
        });
      }
      
      return {
        id: log.id,
        amount: parseFloat(log.amount),
        balance_after: parseFloat(log.balance_after),
        type: log.type,
        platform_fee: parseFloat(log.platform_fee),
        reason: log.reason,
        source: source,
        buyer: buyer,
        created_at: log.created_at
      };
    }));
    
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        list: logsWithBuyer,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取收益明细失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 获取付费内容列表及销售统计
router.get('/paid-content', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userIdBigInt = BigInt(userId);
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // 获取用户的付费帖子
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: {
          user_id: userIdBigInt,
          is_draft: false,
          paymentSettings: {
            enabled: true
          }
        },
        include: {
          paymentSettings: true,
          images: { take: 1 },
          videos: { take: 1 }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.post.count({
        where: {
          user_id: userIdBigInt,
          is_draft: false,
          paymentSettings: {
            enabled: true
          }
        }
      })
    ]);
    
    // 获取每个帖子的销售统计
    const postsWithStats = await Promise.all(posts.map(async (post) => {
      const salesStats = await prisma.userPurchasedContent.aggregate({
        where: { post_id: post.id },
        _count: true,
        _sum: { price: true }
      });
      
      return {
        id: post.id,
        title: post.title,
        type: post.type,
        cover: post.images[0]?.image_url || post.videos[0]?.cover_url || null,
        price: parseFloat(post.paymentSettings?.price) || 0,
        view_count: Number(post.view_count),
        like_count: post.like_count,
        collect_count: post.collect_count,
        sales_count: salesStats._count || 0,
        total_revenue: parseFloat(salesStats._sum?.price) || 0,
        created_at: post.created_at
      };
    }));
    
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        list: postsWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取付费内容列表失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 收益提现到石榴点余额
router.post('/withdraw', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userIdBigInt = BigInt(userId);
    const { amount } = req.body;
    
    // 检查提现功能是否开启
    if (!(creatorCenterConfig?.withdrawEnabled ?? false)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '提现功能暂未开放'
      });
    }
    
    // 验证金额
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '请输入有效的提现金额'
      });
    }
    
    // 检查最低提现金额
    const minWithdraw = creatorCenterConfig?.minWithdrawAmount ?? 10;
    if (numAmount < minWithdraw) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: `最低提现金额为 ${minWithdraw} 石榴点`
      });
    }
    
    // 获取创作者收益余额
    const earnings = await getOrCreateCreatorEarnings(userId);
    
    if (earnings.balance < numAmount) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: `收益余额不足，当前余额: ${earnings.balance.toFixed(2)}`
      });
    }
    
    // 开始事务：从创作者余额转到石榴点
    const result = await prisma.$transaction(async (tx) => {
      // 1. 扣除创作者收益余额
      const newBalance = earnings.balance - numAmount;
      const newWithdrawn = earnings.withdrawn_amount + numAmount;
      
      await tx.creatorEarnings.update({
        where: { user_id: userIdBigInt },
        data: { 
          balance: newBalance,
          withdrawn_amount: newWithdrawn
        }
      });
      
      // 2. 记录提现日志（负数）
      await tx.creatorEarningsLog.create({
        data: {
          user_id: userIdBigInt,
          earnings_id: earnings.id,
          amount: -numAmount,
          balance_after: newBalance,
          type: 'withdraw',
          reason: `提现 ${numAmount} 石榴点到余额`
        }
      });
      
      // 3. 增加石榴点余额
      let userPoints = await tx.userPoints.findUnique({
        where: { user_id: userIdBigInt }
      });
      
      if (!userPoints) {
        userPoints = await tx.userPoints.create({
          data: { user_id: userIdBigInt, points: 0 }
        });
      }
      
      const currentPoints = parseFloat(userPoints.points);
      const newPoints = currentPoints + numAmount;
      
      await tx.userPoints.update({
        where: { user_id: userIdBigInt },
        data: { points: newPoints }
      });
      
      // 4. 记录石榴点日志
      await tx.pointsLog.create({
        data: {
          user_id: userIdBigInt,
          amount: numAmount,
          balance_after: newPoints,
          type: 'withdraw_from_earnings',
          reason: '从创作者收益提现'
        }
      });
      
      return {
        newEarningsBalance: newBalance,
        newPointsBalance: newPoints
      };
    });
    
    console.log(`用户 ${userId} 提现成功: 收益余额 -${numAmount}, 石榴点 +${numAmount}`);
    
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        amount: numAmount,
        newEarningsBalance: result.newEarningsBalance,
        newPointsBalance: result.newPointsBalance
      },
      message: '提现成功'
    });
  } catch (error) {
    console.error('提现失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 领取今日激励奖励（将扩展收益加入可提现余额）
router.post('/claim-incentive', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await claimExtendedEarnings(userId);
    
    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: result.message,
        data: {
          alreadyClaimed: result.alreadyClaimed || false,
          noEarnings: result.noEarnings || false
        }
      });
    }
    
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        earnings: result.earnings,
        newBalance: result.newBalance,
        details: result.details
      },
      message: result.message
    });
  } catch (error) {
    console.error('领取激励奖励失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 获取质量奖励收益详情
router.get('/quality-rewards', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userIdBigInt = BigInt(userId);
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // 获取质量奖励类型的收益记录
    const where = { 
      user_id: userIdBigInt,
      type: 'quality_reward'
    };
    
    const [logs, total, totalAmount] = await Promise.all([
      prisma.creatorEarningsLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.creatorEarningsLog.count({ where }),
      prisma.creatorEarningsLog.aggregate({
        where,
        _sum: { amount: true }
      })
    ]);
    
    // 获取关联的笔记信息
    const logsWithPost = await Promise.all(logs.map(async (log) => {
      let post = null;
      if (log.source_id && log.source_type === 'post') {
        post = await prisma.post.findUnique({
          where: { id: log.source_id },
          select: { 
            id: true, 
            title: true, 
            type: true,
            quality_level: true,
            created_at: true,
            images: { take: 1, select: { image_url: true } },
            videos: { take: 1, select: { cover_url: true } }
          }
        });
      }
      
      return {
        id: log.id,
        amount: parseFloat(log.amount),
        reason: log.reason,
        post: post ? {
          id: Number(post.id),
          title: post.title,
          type: post.type,
          quality_level: post.quality_level,
          cover: post.type === 2 
            ? (post.videos[0]?.cover_url || null)
            : (post.images[0]?.image_url || null),
          created_at: post.created_at
        } : null,
        created_at: log.created_at
      };
    }));
    
    // 按质量等级统计 - 使用Prisma的groupBy替代原始SQL
    let qualityStats = [];
    try {
      // 获取所有质量奖励记录并在应用层统计
      const allQualityLogs = await prisma.creatorEarningsLog.findMany({
        where: {
          user_id: userIdBigInt,
          type: 'quality_reward'
        },
        select: { reason: true, amount: true }
      });
      
      // 在应用层按质量等级分组统计
      const statsMap = {};
      for (const log of allQualityLogs) {
        // 从reason中提取质量等级标签
        const match = log.reason?.match(/笔记质量奖励: (.+)/);
        const qualityLabel = match ? match[1] : '其他';
        if (!statsMap[qualityLabel]) {
          statsMap[qualityLabel] = { count: 0, total_amount: 0 };
        }
        statsMap[qualityLabel].count += 1;
        statsMap[qualityLabel].total_amount += parseFloat(log.amount) || 0;
      }
      
      qualityStats = Object.entries(statsMap).map(([label, data]) => ({
        quality_label: label,
        count: data.count,
        total_amount: data.total_amount
      }));
    } catch (e) {
      console.error('统计质量奖励失败:', e);
    }
    
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      data: {
        list: logsWithPost,
        total_earnings: parseFloat(totalAmount._sum?.amount) || 0,
        stats: qualityStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      },
      message: 'success'
    });
  } catch (error) {
    console.error('获取质量奖励详情失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

// 导出模块和辅助函数
module.exports = router;
module.exports.addCreatorEarnings = addCreatorEarnings;
module.exports.getOrCreateCreatorEarnings = getOrCreateCreatorEarnings;
module.exports.getPlatformFeeRate = getPlatformFeeRate;
