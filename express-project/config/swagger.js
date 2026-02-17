/**
 * Swagger/OpenAPI 配置
 * 自动生成API文档，支持在线调试
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '汐社校园图文社区 API',
      version: '1.3.0',
      description: '汐社校园图文社区后端API接口文档，支持在线调试。\n\n' +
        '## 通用说明\n' +
        '- 所有接口统一返回 JSON 格式\n' +
        '- 需要认证的接口请在请求头中携带 `Authorization: Bearer <token>`\n' +
        '- 管理员接口需要使用管理员token\n' +
        '- 分页接口支持 `page` 和 `limit` 参数',
      contact: {
        name: 'ZTMYO',
        url: 'https://github.com/ZTMYO'
      },
      license: {
        name: 'GPLv3',
        url: 'https://www.gnu.org/licenses/gpl-3.0.html'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: '本地开发服务器'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '用户JWT令牌，通过登录接口获取'
        }
      },
      schemas: {
        // 通用响应格式
        SuccessResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 200, description: '响应码' },
            message: { type: 'string', example: 'success', description: '响应消息' },
            data: { type: 'object', description: '响应数据' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 500, description: '错误码' },
            message: { type: 'string', example: '服务器内部错误', description: '错误消息' }
          }
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 200 },
            message: { type: 'string', example: 'success' },
            data: {
              type: 'object',
              properties: {
                list: { type: 'array', items: { type: 'object' }, description: '数据列表' },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer', example: 1, description: '当前页码' },
                    limit: { type: 'integer', example: 20, description: '每页数量' },
                    total: { type: 'integer', example: 100, description: '总数' },
                    totalPages: { type: 'integer', example: 5, description: '总页数' }
                  }
                }
              }
            }
          }
        },
        // 用户模型
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1, description: '用户自增ID' },
            user_id: { type: 'string', example: 'user_001', description: '用户ID' },
            nickname: { type: 'string', example: '汐社用户', description: '昵称' },
            avatar: { type: 'string', example: 'https://example.com/avatar.jpg', description: '头像URL' },
            bio: { type: 'string', example: '这是个人简介', description: '个人简介' },
            location: { type: 'string', example: '北京', description: '所在地' },
            verified: { type: 'integer', example: 0, description: '认证状态' }
          }
        },
        // 帖子模型
        Post: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1, description: '帖子ID' },
            title: { type: 'string', example: '分享一下今天的美食', description: '标题' },
            content: { type: 'string', example: '今天去了一家新开的餐厅...', description: '内容' },
            images: { type: 'string', example: '["url1","url2"]', description: '图片列表JSON' },
            type: { type: 'integer', example: 1, description: '类型：1图文 2视频' },
            user_id: { type: 'string', description: '作者ID' },
            likes_count: { type: 'integer', example: 10, description: '点赞数' },
            comments_count: { type: 'integer', example: 5, description: '评论数' },
            collects_count: { type: 'integer', example: 3, description: '收藏数' },
            created_at: { type: 'string', format: 'date-time', description: '创建时间' }
          }
        },
        // 评论模型
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1, description: '评论ID' },
            content: { type: 'string', example: '很不错的分享！', description: '评论内容' },
            post_id: { type: 'integer', description: '帖子ID' },
            user_id: { type: 'string', description: '评论者ID' },
            parent_id: { type: 'integer', nullable: true, description: '父评论ID' },
            created_at: { type: 'string', format: 'date-time', description: '创建时间' }
          }
        },
        // 标签模型
        Tag: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1, description: '标签ID' },
            name: { type: 'string', example: '美食', description: '标签名称' },
            post_count: { type: 'integer', example: 100, description: '关联帖子数' }
          }
        },
        // Token响应
        TokenResponse: {
          type: 'object',
          properties: {
            access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: '访问令牌' },
            refresh_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: '刷新令牌' },
            expires_in: { type: 'integer', example: 3600, description: '过期时间（秒）' }
          }
        }
      }
    },
    tags: [
      { name: '认证', description: '用户注册、登录、令牌管理' },
      { name: '用户', description: '用户信息、关注、收藏等' },
      { name: '帖子', description: '帖子的增删改查' },
      { name: '评论', description: '评论的增删查' },
      { name: '点赞', description: '点赞与取消点赞' },
      { name: '标签', description: '标签查询' },
      { name: '搜索', description: '全文搜索' },
      { name: '上传', description: '文件上传（图片、视频、分片）' },
      { name: '统计', description: '全局统计数据' },
      { name: '余额', description: '用户余额与积分管理' },
      { name: '创作中心', description: '创作者数据分析与收益' },
      { name: '通知', description: '用户通知管理' },
      { name: '管理后台', description: '管理员专用接口' }
    ]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
