/**
 * 自动路由扫描器 - 从Express应用自动生成Swagger文档
 * 
 * 功能：
 * 1. 扫描Express app注册的所有路由
 * 2. 自动提取路径、方法、中间件信息
 * 3. 解析路由源码提取请求参数（query/body/path）
 * 4. 为缺少JSDoc注解的路由生成完整的Swagger文档
 * 5. 将自动生成的文档与现有JSDoc文档合并
 * 6. 自动检测app.js中的路由文件挂载和内联路由，无需手动维护映射表
 * 7. 开发模式下监听路由文件变更，自动重新生成文档
 */

const fs = require('fs');
const path = require('path');

// 路由前缀与tag的映射关系（用于已知路由的标签分配）
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

// 静态路由文件映射（作为自动检测的回退方案）
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
 * 从app.js源码中自动检测路由文件挂载关系
 * 解析 app.use('/api/xxx', xxxRoutes) 和对应的 require('./routes/xxx') 
 * 无需手动维护 ROUTE_FILE_MAP，新增路由文件时自动识别
 * @param {string} appJsPath - app.js文件的绝对路径
 * @returns {{ fileMap: Object, appRoutes: Array }} fileMap: 文件名→前缀映射, appRoutes: app.js内联路由
 */
function detectRouteMounts(appJsPath) {
  const fileMap = {};
  const appRoutes = [];

  if (!fs.existsSync(appJsPath)) {
    return { fileMap: { ...ROUTE_FILE_MAP }, appRoutes };
  }

  const source = fs.readFileSync(appJsPath, 'utf8');

  // 步骤1: 提取所有 require('./routes/xxx') 的变量名与文件名映射
  // 匹配: const xxxRoutes = require('./routes/xxx')
  const requireMap = {};
  const requireRegex = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"`]\.\/routes\/([^'"`]+)['"`]\s*\)/g;
  let reqMatch;
  while ((reqMatch = requireRegex.exec(source)) !== null) {
    const varName = reqMatch[1];
    let fileName = reqMatch[2];
    if (!fileName.endsWith('.js')) fileName += '.js';
    requireMap[varName] = fileName;
  }

  // 步骤2: 提取 app.use('/prefix', xxxRoutes) 的前缀与变量名映射
  const useRegex = /app\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)\s*\)/g;
  let useMatch;
  while ((useMatch = useRegex.exec(source)) !== null) {
    const prefix = useMatch[1];
    const varName = useMatch[2];
    if (requireMap[varName]) {
      fileMap[requireMap[varName]] = prefix;
    }
  }

  // 步骤3: 检测app.js中的内联路由 app.get/post/put/delete('/api/xxx', ...)
  const inlineRegex = /app\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
  let inlineMatch;
  while ((inlineMatch = inlineRegex.exec(source)) !== null) {
    const method = inlineMatch[1].toUpperCase();
    const routePath = inlineMatch[2];
    // 只检测 /api/ 开头的业务路由，跳过 swagger 等文档元数据路由
    if (routePath.startsWith('/api/')) {
      appRoutes.push({ method, path: routePath });
    }
  }

  // 步骤4: 如果自动检测结果为空，回退到静态映射
  if (Object.keys(fileMap).length === 0) {
    console.warn('⚠️  无法从app.js自动检测路由挂载，使用静态映射');
    return { fileMap: { ...ROUTE_FILE_MAP }, appRoutes };
  }

  // 步骤5: 检查是否有新的路由文件未在静态映射中
  for (const [fileName, prefix] of Object.entries(fileMap)) {
    if (!ROUTE_FILE_MAP[fileName]) {
      console.log(`● 自动检测到新路由文件: ${fileName} → ${prefix}`);
      // 自动为新前缀生成tag名称
      if (!ROUTE_TAG_MAP[prefix]) {
        const tagName = prefix.replace('/api/', '').replace(/-/g, ' ');
        ROUTE_TAG_MAP[prefix] = tagName.charAt(0).toUpperCase() + tagName.slice(1);
      }
    }
  }

  return { fileMap, appRoutes };
}

/**
 * 检测中间件是否需要认证
 */
function requiresAuth(middlewareName) {
  return ['authenticateToken', 'adminAuth'].includes(middlewareName);
}

/**
 * 查找路由处理函数的结束位置（通过追踪大括号深度）
 * 跳过字符串字面量中的大括号以避免误判
 * @param {string} source - 源代码字符串
 * @param {number} startPos - 路由定义的起始位置
 * @returns {number} 处理函数结束位置
 */
function findHandlerEnd(source, startPos) {
  let pos = startPos;
  let depth = 0;
  let foundFirst = false;

  while (pos < source.length) {
    const ch = source[pos];

    // 跳过字符串字面量（单引号、双引号、反引号）
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      pos++;
      while (pos < source.length) {
        if (source[pos] === '\\') {
          pos++; // 跳过转义字符
        } else if (source[pos] === quote) {
          break;
        }
        pos++;
      }
    // 跳过单行注释
    } else if (ch === '/' && pos + 1 < source.length && source[pos + 1] === '/') {
      while (pos < source.length && source[pos] !== '\n') pos++;
    // 跳过多行注释
    } else if (ch === '/' && pos + 1 < source.length && source[pos + 1] === '*') {
      pos += 2;
      while (pos + 1 < source.length && !(source[pos] === '*' && source[pos + 1] === '/')) pos++;
      pos++; // 跳过 '/'
    } else if (ch === '{') {
      depth++;
      foundFirst = true;
    } else if (ch === '}') {
      depth--;
      if (foundFirst && depth === 0) {
        return pos;
      }
    }
    pos++;
  }
  return Math.min(startPos + 3000, source.length);
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

    // 获取路由处理函数的完整范围（通过追踪大括号深度）
    const handlerEnd = findHandlerEnd(source, matchPos);
    const afterContext = source.substring(matchPos, handlerEnd + 1);
    const beforeContext = source.substring(Math.max(0, matchPos - 200), matchPos);

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

    // 解析 query 参数 - 支持两种模式
    const queryParams = new Map();

    // 模式1: 解构赋值 const { page, limit, type } = req.query
    const queryDestructRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*req\.query/g;
    let queryDestructMatch;
    while ((queryDestructMatch = queryDestructRegex.exec(afterContext)) !== null) {
      const cleanedContent = queryDestructMatch[1].replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const params = cleanedContent.split(',');
      for (const param of params) {
        let cleanParam = param.trim();
        let defaultValue = undefined;
        if (cleanParam.includes('=')) {
          const parts = cleanParam.split('=');
          cleanParam = parts[0].trim();
          defaultValue = parts.slice(1).join('=').trim();
        }
        // 处理重命名 如 error: oauthError
        if (cleanParam.includes(':')) {
          cleanParam = cleanParam.split(':')[0].trim();
        }
        if (cleanParam && !cleanParam.startsWith('...')) {
          let type = 'string';
          if (defaultValue !== undefined) {
            if (/^\d+$/.test(defaultValue)) type = 'integer';
            else if (defaultValue === 'true' || defaultValue === 'false') type = 'boolean';
          }
          queryParams.set(cleanParam, { type, required: false });
        }
      }
    }

    // 模式2: 点访问 req.query.xxx
    const queryRegex = /req\.query\.(\w+)/g;
    let queryMatch;
    while ((queryMatch = queryRegex.exec(afterContext)) !== null) {
      const name = queryMatch[1];
      if (!queryParams.has(name)) {
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
        // 先移除内联注释，避免注释内容被误识别为参数名
        const cleanedContent = bodyMatch[1].replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const params = cleanedContent.split(',');
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
 * @param {Object} [fileMap] - 路由文件→前缀映射（可选，默认使用ROUTE_FILE_MAP）
 * @returns {Array} 所有解析出的路由列表
 */
function scanRoutes(routesDir, fileMap) {
  const allRoutes = [];
  const map = fileMap || ROUTE_FILE_MAP;

  for (const [fileName, basePath] of Object.entries(map)) {
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
 * 支持自动检测app.js中的路由挂载，无需手动维护映射表
 * @param {Object} existingSpec - 现有的 swagger spec（来自 swagger-jsdoc）
 * @param {string} routesDir - 路由目录路径
 * @param {string} [appJsPath] - app.js路径（可选，用于自动检测路由挂载）
 * @returns {Object} 合并后的 swagger spec
 */
function mergeWithAutoGen(existingSpec, routesDir, appJsPath) {
  // 如果提供了app.js路径，自动检测路由挂载关系
  let fileMap = ROUTE_FILE_MAP;
  if (appJsPath) {
    const detected = detectRouteMounts(appJsPath);
    fileMap = detected.fileMap;
  }

  const routes = scanRoutes(routesDir, fileMap);
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

/**
 * 验证swagger文档的完整性
 * 对比路由文件中的实际路由与swagger文档中的路由，报告遗漏
 * 支持自动从app.js检测路由挂载和内联路由，无需手动传入extraRoutes
 * @param {Object} swaggerSpec - 最终的swagger spec对象
 * @param {string} routesDir - 路由文件目录
 * @param {Object} [options] - 可选配置
 * @param {Array<{method: string, path: string}>} [options.extraRoutes=[]] - 额外路由（兼容手动指定）
 * @param {string} [options.appJsPath] - app.js路径（用于自动检测路由挂载和内联路由）
 */
function validateSwaggerCompleteness(swaggerSpec, routesDir, options = {}) {
  // 兼容旧调用方式: validateSwaggerCompleteness(spec, dir, [], appJsPath)
  let extraRoutes = [];
  let appJsPath;
  if (Array.isArray(options)) {
    extraRoutes = options;
    appJsPath = arguments[3];
  } else {
    extraRoutes = options.extraRoutes || [];
    appJsPath = options.appJsPath;
  }
  const specPaths = swaggerSpec.paths || {};
  const specEndpoints = new Set();
  for (const [path, methods] of Object.entries(specPaths)) {
    for (const method of Object.keys(methods)) {
      if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
        specEndpoints.add(`${method.toUpperCase()} ${path}`);
      }
    }
  }

  // 自动检测路由文件映射
  let fileMap = ROUTE_FILE_MAP;
  let detectedAppRoutes = [];
  if (appJsPath) {
    const detected = detectRouteMounts(appJsPath);
    fileMap = detected.fileMap;
    detectedAppRoutes = detected.appRoutes;
  }

  const allRoutes = scanRoutes(routesDir, fileMap);
  const missing = [];

  // 检查路由文件中的路由
  for (const route of allRoutes) {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    if (!specEndpoints.has(key)) {
      missing.push(key);
    }
  }

  // 合并手动传入和自动检测的app.js内联路由
  const allExtraRoutes = [...extraRoutes, ...detectedAppRoutes];
  const seen = new Set();
  for (const route of allExtraRoutes) {
    const swaggerPath = route.path.replace(/:(\w+)/g, '{$1}');
    const key = `${route.method.toUpperCase()} ${swaggerPath}`;
    if (!specEndpoints.has(key) && !seen.has(key)) {
      missing.push(key);
      seen.add(key);
    }
  }

  if (missing.length > 0) {
    console.warn(`⚠️  Swagger文档缺失 ${missing.length} 个API路由:`);
    missing.forEach(m => console.warn(`   - ${m}`));
    console.warn('   请为以上路由添加 @swagger JSDoc注解或在swagger配置中手动添加');
  } else {
    console.log('✅ Swagger文档完整: 所有API路由均已覆盖');
  }

  return missing;
}

/**
 * 监听路由文件变更，在开发模式下自动重新生成文档
 * 当路由文件被修改时记录变更并提示重启以更新文档
 * @param {string} routesDir - 路由目录路径
 * @param {string} [appJsPath] - app.js路径
 */
function watchRouteChanges(routesDir, appJsPath) {
  // 使用防抖避免频繁触发
  let debounceTimer = null;
  const changedFiles = new Set();

  function onFileChange(filename) {
    changedFiles.add(filename);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`🔄 检测到路由文件变更: ${[...changedFiles].join(', ')}`);
      console.log('   请重启服务以更新Swagger文档');
      changedFiles.clear();
    }, 1000);
  }

  // 监听路由目录中的.js文件
  try {
    fs.watch(routesDir, { recursive: false }, (eventType, filename) => {
      if (filename && filename.endsWith('.js')) {
        onFileChange(filename);
      }
    });
  } catch (e) {
    console.warn('⚠️  无法监听路由目录:', e.message);
  }

  // 单独监听app.js文件
  if (appJsPath && fs.existsSync(appJsPath)) {
    try {
      fs.watch(appJsPath, (eventType) => {
        if (eventType === 'change') {
          onFileChange('app.js');
        }
      });
    } catch (e) {
      console.warn('⚠️  无法监听app.js:', e.message);
    }
  }

  console.log('👀 开发模式: 正在监听路由文件变更');
}

module.exports = {
  scanRoutes,
  mergeWithAutoGen,
  generateSwaggerPath,
  parseRouteFile,
  detectRouteMounts,
  validateSwaggerCompleteness,
  watchRouteChanges,
  ROUTE_FILE_MAP,
  ROUTE_TAG_MAP
};
