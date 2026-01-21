const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');
const { prisma } = require('../config/config');
const { getOrSet, CACHE_TTL } = require('../utils/cache');
const { optionalAuthWithGuestRestriction } = require('../middleware/auth');

// 获取所有标签
router.get('/', optionalAuthWithGuestRestriction, async (req, res) => {
  try {
    const rows = await getOrSet('tags:all', async () => {
      return await prisma.tag.findMany({
        orderBy: { name: 'asc' }
      });
    }, CACHE_TTL.TAGS_POPULAR);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: rows
    });
  } catch (error) {
    console.error('获取标签列表失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

// 获取热门标签
router.get('/hot', optionalAuthWithGuestRestriction, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    // 使用缓存获取热门标签（不同 limit 值使用不同的缓存键）
    const cacheKey = `tags:hot:${limit}`;
    const rows = await getOrSet(cacheKey, async () => {
      return await prisma.tag.findMany({
        where: { use_count: { gt: 0 } },
        orderBy: [
          { use_count: 'desc' },
          { name: 'asc' }
        ],
        take: limit
      });
    }, CACHE_TTL.TAGS_POPULAR);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: rows
    });
  } catch (error) {
    console.error('获取热门标签失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

module.exports = router;