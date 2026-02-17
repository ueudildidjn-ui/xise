/**
 * 自动路由扫描器 - 从Express应用自动生成Swagger文档
 * 
 * 功能：
 * 1. 扫描Express app注册的所有路由
 * 2. 自动提取路径、方法、中间件信息
 * 3. 解析路由源码提取请求参数（query/body/path）
 * 4. 为缺少JSDoc注解的路由生成完整的Swagger文档
 * 5. 将自动生成的文档与现有JSDoc文档合并
 */

const fs = require('fs');
const path = require('path');

// 路由前缀与tag的映射关系
const ROUTE_TAG_MAP = {
  '/api/auth': '认证',
  '/api/users': '用户',
  '/api/posts': '帖子',
  '/api/comments': '评论',
  '/api/likes': '点赞',
  '/api/tags': '标签',
  '/api/search': '搜索',
  '/api/upload': '上传',
  '/api/stats': '统计',
  '/api/admin': '管理后台',
  '/api/balance': '余额',
  '/api/creator-center': '创作中心',
  '/api/notifications': '通知'
};

// 路由文件与前缀的映射
const ROUTE_FILE_MAP = {
  'auth.js': '/api/auth',
  'users.js': '/api/users',
  'posts.js': '/api/posts',
  'comments.js': '/api/comments',
  'likes.js': '/api/likes',
  'tags.js': '/api/tags',
  'search.js': '/api/search',
  'upload.js': '/api/upload',
  'stats.js': '/api/stats',
  'admin.js': '/api/admin',
  'balance.js': '/api/balance',
  'creatorCenter.js': '/api/creator-center',
  'notifications.js': '/api/notifications'
};

/**
 * 检测中间件是否需要认证
 */
function requiresAuth(middlewareName) {
  return ['authenticateToken', 'adminAuth'].includes(middlewareName);
}

/**
 * 从路由源码文件中解析路由定义和参数
 * @param {string} filePath - 路由文件的绝对路径
 * @param {string} basePath - 路由基础前缀（如 /api/auth）
 * @returns {Array} 解析出的路由信息列表
 */
function parseRouteFile(filePath, basePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const routes = [];

  // 匹配 router.METHOD(path, ...middlewares, handler) 模式
  // 支持 get, post, put, delete, patch
  const routeRegex = /router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
  let match;

  while ((match = routeRegex.exec(source)) !== null) {
    const method = match[1];
    const routePath = match[2];
    const matchPos = match.index;

    // 获取路由定义所在行以及前后上下文
    const beforeContext = source.substring(Math.max(0, matchPos - 200), matchPos);
    const afterContext = source.substring(matchPos, Math.min(source.length, matchPos + 3000));

    // 检测中间件 - 支持带中间件和不带中间件的路由
    const middlewareMatch = afterContext.match(/router\.\w+\([^,]+,\s*([\w,\s]+),\s*(?:async\s+)?\(/);
    let authRequired = false;
    let isAdmin = false;
    if (middlewareMatch) {
      const middlewares = middlewareMatch[1].split(',').map(m => m.trim());
      authRequired = middlewares.some(m => requiresAuth(m));
      isAdmin = middlewares.some(m => m === 'adminAuth');
    } else {
      // 无中间件的路由 - 检查是否直接跟 handler
      authRequired = false;
    }

    // 检查是否已有 @swagger 注解
    const hasSwaggerAnnotation = beforeContext.includes('@swagger');

    // 解析路径参数
    const pathParams = [];
    const paramRegex = /:(\w+)/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(routePath)) !== null) {
      pathParams.push(paramMatch[1]);
    }

    // 解析 query 参数 - 从 req.query.xxx 中提取
    const queryParams = new Map();
    const queryRegex = /req\.query\.(\w+)/g;
    let queryMatch;
    while ((queryMatch = queryRegex.exec(afterContext)) !== null) {
      const name = queryMatch[1];
      if (!queryParams.has(name)) {
        // 尝试检测类型
        const surrounding = afterContext.substring(
          Math.max(0, queryMatch.index - 100),
          Math.min(afterContext.length, queryMatch.index + 200)
        );
        let type = 'string';
        if (surrounding.includes('parseInt') || surrounding.includes('Number(')) {
          type = 'integer';
        }
        let isRequired = false;
        if (surrounding.includes(`!req.query.${name}`)) {
          isRequired = true;
        }
        queryParams.set(name, { type, required: isRequired });
      }
    }

    // 解析 body 参数 - 从解构赋值中提取
    const bodyParams = new Map();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      // 匹配 const { xxx, yyy } = req.body 模式
      const bodyDestructRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*req\.body/g;
      let bodyMatch;
      while ((bodyMatch = bodyDestructRegex.exec(afterContext)) !== null) {
        const params = bodyMatch[1].split(',');
        for (const param of params) {
          let cleanParam = param.trim();
          // 处理默认值 如 title = ''
          let defaultValue = undefined;
          if (cleanParam.includes('=')) {
            const parts = cleanParam.split('=');
            cleanParam = parts[0].trim();
            defaultValue = parts[1].trim();
          }
          // 处理重命名 如 old: new
          if (cleanParam.includes(':')) {
            cleanParam = cleanParam.split(':')[0].trim();
          }
          if (cleanParam && !cleanParam.startsWith('...')) {
            let type = 'string';
            if (defaultValue !== undefined) {
              // 检测未引号包裹的布尔值字面量
              if (defaultValue === 'true' || defaultValue === 'false') type = 'boolean';
              else if (defaultValue === '[]') type = 'array';
              else if (defaultValue === '{}') type = 'object';
              else if (/^\d+$/.test(defaultValue)) type = 'integer';
            }
            bodyParams.set(cleanParam, { type, default: defaultValue });
          }
        }
      }
      // 也匹配单独的 req.body.xxx 模式
      const bodyDotRegex = /req\.body\.(\w+)/g;
      let bodyDotMatch;
      while ((bodyDotMatch = bodyDotRegex.exec(afterContext)) !== null) {
        const name = bodyDotMatch[1];
        if (!bodyParams.has(name)) {
          bodyParams.set(name, { type: 'string' });
        }
      }
    }

    // 提取路由行前的注释作为 summary
    const commentMatch = beforeContext.match(/\/\/\s*(.+?)\s*$/m);
    let summary = '';
    if (commentMatch) {
      summary = commentMatch[1];
    }

    // 构建 swagger 路径格式，规范化路径（避免双斜杠和尾部斜杠）
    let swaggerPath = (basePath + routePath.replace(/:(\w+)/g, '{$1}')).replace(/\/+/g, '/');
    if (swaggerPath.length > 1 && swaggerPath.endsWith('/')) {
      swaggerPath = swaggerPath.slice(0, -1);
    }

    routes.push({
      method,
      path: swaggerPath,
      rawPath: routePath,
      authRequired,
      isAdmin,
      hasSwaggerAnnotation,
      pathParams,
      queryParams: Object.fromEntries(queryParams),
      bodyParams: Object.fromEntries(bodyParams),
      summary,
      tag: ROUTE_TAG_MAP[basePath] || '其他'
    });
  }

  return routes;
}

/**
 * 为路由生成 Swagger Path 对象
 */
function generateSwaggerPath(route) {
  const pathItem = {};

  pathItem.summary = route.summary || `${route.method.toUpperCase()} ${route.path}`;
  pathItem.tags = [route.tag];

  if (route.authRequired) {
    pathItem.security = [{ bearerAuth: [] }];
  }

  // 构建 parameters 数组
  const parameters = [];

  // 路径参数
  for (const param of route.pathParams) {
    parameters.push({
      in: 'path',
      name: param,
      required: true,
      schema: { type: param.toLowerCase().includes('id') ? 'integer' : 'string' },
      description: param
    });
  }

  // Query 参数
  for (const [name, info] of Object.entries(route.queryParams)) {
    parameters.push({
      in: 'query',
      name,
      required: info.required || false,
      schema: { type: info.type || 'string' },
      description: name
    });
  }

  if (parameters.length > 0) {
    pathItem.parameters = parameters;
  }

  // Request Body
  if (Object.keys(route.bodyParams).length > 0 && ['post', 'put', 'patch', 'delete'].includes(route.method)) {
    const properties = {};
    for (const [name, info] of Object.entries(route.bodyParams)) {
      const prop = { type: info.type || 'string' };
      if (info.default !== undefined) {
        // 仅对有效的 JSON 字面量设置默认值（数字、布尔值、null、[]、{}）
        if (/^(\d+|true|false|null|\[\]|\{\})$/.test(info.default)) {
          try {
            prop.default = JSON.parse(info.default);
          } catch (e) {
            // 忽略无法解析的值
          }
        }
      }
      properties[name] = prop;
    }
    pathItem.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties
          }
        }
      }
    };
  }

  // 响应
  pathItem.responses = {
    '200': {
      description: '成功',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SuccessResponse' }
        }
      }
    },
    '400': { description: '请求参数错误' },
    '500': { description: '服务器错误' }
  };

  if (route.authRequired) {
    pathItem.responses['401'] = { description: '未授权' };
  }

  return pathItem;
}

/**
 * 扫描所有路由文件并生成自动文档
 * @param {string} routesDir - 路由目录路径
 * @returns {Object} 自动生成的 swagger paths 对象
 */
function scanRoutes(routesDir) {
  const allRoutes = [];

  for (const [fileName, basePath] of Object.entries(ROUTE_FILE_MAP)) {
    const filePath = path.join(routesDir, fileName);
    if (fs.existsSync(filePath)) {
      const routes = parseRouteFile(filePath, basePath);
      allRoutes.push(...routes);
    }
  }

  return allRoutes;
}

/**
 * 将自动扫描的路由与现有 swagger spec 合并
 * JSDoc 生成的文档优先，自动扫描补充缺失的路由和参数
 * @param {Object} existingSpec - 现有的 swagger spec（来自 swagger-jsdoc）
 * @param {string} routesDir - 路由目录路径
 * @returns {Object} 合并后的 swagger spec
 */
function mergeWithAutoGen(existingSpec, routesDir) {
  const routes = scanRoutes(routesDir);
  const spec = JSON.parse(JSON.stringify(existingSpec)); // 深拷贝

  let addedCount = 0;
  let enhancedCount = 0;

  for (const route of routes) {
    const swaggerPath = route.path;
    const method = route.method;

    if (!spec.paths[swaggerPath]) {
      spec.paths[swaggerPath] = {};
    }

    if (!spec.paths[swaggerPath][method]) {
      // 路由完全缺失 - 添加自动生成的文档
      spec.paths[swaggerPath][method] = generateSwaggerPath(route);
      addedCount++;
    } else {
      // 路由已存在 - 检查并补充缺失的参数
      const existing = spec.paths[swaggerPath][method];
      let enhanced = false;

      // 补充缺失的路径参数
      if (route.pathParams.length > 0) {
        if (!existing.parameters) {
          existing.parameters = [];
        }
        for (const param of route.pathParams) {
          const hasParam = existing.parameters.some(
            p => p.in === 'path' && p.name === param
          );
          if (!hasParam) {
            existing.parameters.push({
              in: 'path',
              name: param,
              required: true,
              schema: { type: param.toLowerCase().includes('id') ? 'integer' : 'string' },
              description: param
            });
            enhanced = true;
          }
        }
      }

      // 补充缺失的 query 参数
      if (Object.keys(route.queryParams).length > 0) {
        if (!existing.parameters) {
          existing.parameters = [];
        }
        for (const [name, info] of Object.entries(route.queryParams)) {
          const hasParam = existing.parameters.some(
            p => p.in === 'query' && p.name === name
          );
          if (!hasParam) {
            existing.parameters.push({
              in: 'query',
              name,
              schema: { type: info.type || 'string' },
              description: name
            });
            enhanced = true;
          }
        }
      }

      // 补充缺失的 requestBody
      if (!existing.requestBody && Object.keys(route.bodyParams).length > 0 &&
          ['post', 'put', 'patch', 'delete'].includes(method)) {
        const properties = {};
        for (const [name, info] of Object.entries(route.bodyParams)) {
          properties[name] = { type: info.type || 'string' };
        }
        existing.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties
              }
            }
          }
        };
        enhanced = true;
      }

      // 补充缺失的 security 定义
      if (route.authRequired && !existing.security) {
        existing.security = [{ bearerAuth: [] }];
        enhanced = true;
      }

      if (enhanced) {
        enhancedCount++;
      }
    }
  }

  console.log(`● Swagger自动扫描完成: 新增 ${addedCount} 个路由, 增强 ${enhancedCount} 个路由`);
  return spec;
}

module.exports = {
  scanRoutes,
  mergeWithAutoGen,
  parseRouteFile,
  ROUTE_FILE_MAP,
  ROUTE_TAG_MAP
};
