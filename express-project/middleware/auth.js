const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { prisma } = require('../config/config');
const { HTTP_STATUS, RESPONSE_CODES } = require('../constants');

/**
 * 认证中间件 - 验证JWT token
 */
async function authenticateToken(req, res, next) {
  try {
    const token = extractTokenFromHeader(req);

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: RESPONSE_CODES.UNAUTHORIZED,
        message: '访问令牌缺失'
      });
    }

    // 验证token
    const decoded = verifyToken(token);

    // 检查是否为管理员token
    if (decoded.type === 'admin') {
      // 管理员token验证
      const admin = await prisma.admin.findUnique({
        where: { id: BigInt(decoded.adminId) },
        select: { id: true, username: true }
      });

      if (!admin) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          code: RESPONSE_CODES.UNAUTHORIZED,
          message: '管理员不存在'
        });
      }

      // 将管理员信息添加到请求对象
      req.user = {
        id: admin.id,
        username: admin.username,
        type: 'admin',
        adminId: decoded.adminId
      };
      req.token = token;

      return next();
    } else {
      // 普通用户token验证
      if (!decoded.userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          code: RESPONSE_CODES.UNAUTHORIZED,
          message: '无效的访问令牌'
        });
      }

      // 检查用户是否存在且活跃
      const user = await prisma.user.findFirst({
        where: {
          id: BigInt(decoded.userId),
          is_active: true
        },
        select: {
          id: true,
          user_id: true,
          xise_id: true,
          nickname: true,
          avatar: true,
          is_active: true
        }
      });

      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          code: RESPONSE_CODES.UNAUTHORIZED,
          message: '用户不存在或已被禁用'
        });
      }

      // 检查会话是否有效
      const session = await prisma.userSession.findFirst({
        where: {
          user_id: BigInt(decoded.userId),
          token: token,
          is_active: true,
          expires_at: { gt: new Date() }
        },
        select: { id: true }
      });

      if (!session) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          code: RESPONSE_CODES.UNAUTHORIZED,
          message: '会话已过期，请重新登录'
        });
      }

      // 将用户信息添加到请求对象
      req.user = user;
      req.token = token;

      return next();
    }
  } catch (error) {
    console.error('Token验证失败:', error);
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      code: RESPONSE_CODES.UNAUTHORIZED,
      message: '无效的访问令牌'
    });
  }
}

/**
 * 可选认证中间件 - 如果有token则验证，没有则跳过
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractTokenFromHeader(req);

    if (!token) {
      req.user = null;
      return next();
    }

    // 验证token
    const decoded = verifyToken(token);

    // 检查用户是否存在且活跃
    const user = await prisma.user.findFirst({
      where: {
        id: BigInt(decoded.userId),
        is_active: true
      },
      select: {
        id: true,
        user_id: true,
        xise_id: true,
        nickname: true,
        avatar: true,
        is_active: true
      }
    });

    if (user) {
      // 检查会话是否有效
      const session = await prisma.userSession.findFirst({
        where: {
          user_id: BigInt(decoded.userId),
          token: token,
          is_active: true,
          expires_at: { gt: new Date() }
        },
        select: { id: true }
      });

      if (session) {
        req.user = user;
        req.token = token;
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // 如果token无效，设置user为null继续执行
    req.user = null;
    next();
  }
}

module.exports = {
  authenticateToken,
  optionalAuth
};