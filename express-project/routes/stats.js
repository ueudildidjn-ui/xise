const express = require('express');
const router = express.Router();
const { success, error } = require('../utils/responseHelper');
const { getMultipleTableStats } = require('../utils/statsHelper');

// 获取系统统计信息
/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: 获取全局统计信息
 *     tags: [统计]
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */
router.get('/', async (req, res) => {
  try {
    // 定义需要统计的表
    const tables = [
      { table: 'users', alias: 'users' },
      { table: 'posts', alias: 'posts' },
      { table: 'comments', alias: 'comments' },
      { table: 'likes', alias: 'likes' }
    ];

    const stats = await getMultipleTableStats(tables);
    success(res, stats, '获取统计信息成功');
  } catch (err) {
    console.error('获取统计信息失败:', err);
    error(res, '获取统计信息失败');
  }
});

module.exports = router;