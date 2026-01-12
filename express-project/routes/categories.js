const express = require('express');
const router = express.Router();
const { prisma } = require('../config/config');
const { success, error } = require('../utils/responseHelper');

/**
 * @api {get} /api/categories 获取分类列表
 * @apiName GetCategories
 * @apiGroup Categories
 * @apiDescription 获取所有分类列表
 * 
 * @apiSuccess {Number} code 状态码
 * @apiSuccess {String} message 响应消息
 * @apiSuccess {Array} data 分类列表
 * @apiSuccess {Number} data.id 分类ID
 * @apiSuccess {String} data.name 分类名称
 * 
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "code": 200,
 *       "message": "获取成功",
 *       "data": [
 *         {
 *           "id": 1,
 *           "name": "推荐"
 *         },
 *         {
 *           "id": 2,
 *           "name": "学习"
 *         }
 *       ]
 *     }
 */
router.get('/', async (req, res) => {
  try {
    const { sortField = 'id', sortOrder = 'asc', name, category_title } = req.query;

    const allowedSortFields = ['id', 'name', 'created_at'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'id';
    const validSortOrder = sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    // 构建WHERE条件
    const where = {};

    if (name && typeof name === 'string' && name.trim()) {
      where.name = { contains: name.trim() };
    }

    if (category_title && typeof category_title === 'string' && category_title.trim()) {
      where.category_title = { contains: category_title.trim() };
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { [validSortField]: validSortOrder },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    });

    // 转换为前端期望的格式
    const result = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      category_title: cat.category_title,
      created_at: cat.created_at,
      post_count: cat._count.posts
    }));

    // 如果需要按 post_count 排序
    if (sortField === 'post_count') {
      result.sort((a, b) => {
        const diff = a.post_count - b.post_count;
        return validSortOrder === 'desc' ? -diff : diff;
      });
    }

    success(res, result, '获取成功');
  } catch (err) {
    console.error('获取分类列表失败:', err);
    error(res, '获取分类列表失败');
  }
});
module.exports = router;