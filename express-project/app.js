/**
 * 汐社校园图文社区 - Express后端服务
 * 
 * @author ZTMYO
 * @github https://github.com/ZTMYO
 * @description 基于Express框架的图文社区后端API服务
 * @version v1.3.0
 * @license GPLv3
 */

// Add BigInt serialization support for JSON.stringify BEFORE any other imports
// This is critical because Prisma returns BigInt for BIGINT columns
// and JavaScript's JSON.stringify doesn't know how to serialize BigInt
if (typeof BigInt.prototype.toJSON !== 'function') {
  BigInt.prototype.toJSON = function() {
    // Convert to number if it's safe, otherwise to string
    const num = Number(this);
    if (Number.isSafeInteger(num)) {
      return num;
    }
    return this.toString();
  };
}

const express = require('express');
const path = require('path');
const cors = require('cors');
const { execSync } = require('child_process');
const config = require('./config/config');
const { HTTP_STATUS, RESPONSE_CODES } = require('./constants');
const prisma = require('./utils/prisma');
const { initQueueService, closeQueueService, cleanupExpiredBrowsingHistory } = require('./utils/queueService');
const { loadSettingsFromRedis } = require('./utils/settingsService');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { generateAccessToken, generateRefreshToken } = require('./utils/jwt');
const { validateSwaggerCompleteness, watchRouteChanges } = require('./utils/swaggerAutoGen');

// 加载环境变量
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// 复杂路径配置（防止未授权访问敏感调试工具）
const SWAGGER_DOCS_PATH = process.env.SWAGGER_DOCS_PATH || 'swagger-MYQD6LuH0heYgcK5DT10Al00dj6OW8Wc';
const JWT_TEST_TOKEN_PATH = process.env.JWT_TEST_TOKEN_PATH || 'jwt-MYQD6LuH0heYgcK5DT10Al00dj6OW8Wc';

// 定时清理过期浏览历史的间隔（1小时）
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let cleanupTimer = null;

// 默认管理员账户配置
// 用户名: admin
// 密码: 123456 (SHA-256加密后的值)
const DEFAULT_ADMIN = {
  username: 'admin',
  // SHA-256 hash of '123456'
  passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
};

// 导入路由模块
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const likesRoutes = require('./routes/likes');
const tagsRoutes = require('./routes/tags');
const searchRoutes = require('./routes/search');
const uploadRoutes = require('./routes/upload');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const balanceRoutes = require('./routes/balance');
const creatorCenterRoutes = require('./routes/creatorCenter');
const notificationsRoutes = require('./routes/notifications');

const app = express();

// 中间件配置
// CORS配置
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));  // 显式处理OPTIONS请求
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务 - 提供uploads目录的文件访问
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Swagger API 文档路由（使用复杂路径防止未授权访问）
app.use(`/api/${SWAGGER_DOCS_PATH}`, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: '汐社API文档',
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'list',
    filter: true,
    showRequestDuration: true
  }
}));
// Swagger JSON 规范
app.get(`/api/${SWAGGER_DOCS_PATH}.json`, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// JWT测试令牌生成API（用于Swagger调试，使用复杂路径防止未授权访问）
app.post(`/api/${JWT_TEST_TOKEN_PATH}`, async (req, res) => {
  const { userId, user_id, type } = req.body || {};
  const validType = type === 'admin' ? 'admin' : 'user';
  const safeUserId = Number.isInteger(userId) && userId > 0 ? userId : 1;
  const safeUserIdStr = typeof user_id === 'string' && user_id.trim() ? user_id.trim() : (validType === 'admin' ? 'admin' : 'test_user');
  let payload;
  if (validType === 'admin') {
    payload = { adminId: safeUserId, username: safeUserIdStr, type: 'admin' };
  } else {
    payload = { userId: safeUserId, user_id: safeUserIdStr };
  }
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // 为普通用户测试令牌创建会话记录，否则认证中间件会拒绝该令牌
  if (validType === 'user') {
    try {
      await prisma.userSession.create({
        data: {
          user_id: BigInt(safeUserId),
          token: accessToken,
          refresh_token: refreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          user_agent: 'swagger-test',
          is_active: true
        }
      });
    } catch (e) {
      // 会话创建失败不阻止令牌返回（例如用户不存在时外键约束失败）
      console.warn('测试令牌会话创建失败:', e.message);
    }
  }

  res.json({
    code: 200,
    message: '测试令牌生成成功',
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      payload,
      usage: '复制 access_token，点击 Swagger 页面的 Authorize 按钮粘贴即可调试'
    }
  });
});

// JWT测试令牌页面
app.get(`/api/${JWT_TEST_TOKEN_PATH}`, (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JWT测试令牌生成器</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
  h1 { font-size: 24px; margin-bottom: 8px; color: #1a1a2e; }
  .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
  .subtitle a { color: #4361ee; text-decoration: none; }
  .card { background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 28px; width: 100%; max-width: 520px; margin-bottom: 20px; }
  .card h2 { font-size: 16px; margin-bottom: 16px; color: #1a1a2e; display: flex; align-items: center; gap: 8px; }
  .form-group { margin-bottom: 14px; }
  label { display: block; font-size: 13px; color: #555; margin-bottom: 4px; font-weight: 500; }
  input, select { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; transition: border-color 0.2s; }
  input:focus, select:focus { outline: none; border-color: #4361ee; }
  .btn { display: inline-block; padding: 10px 24px; background: #4361ee; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 500; transition: background 0.2s; width: 100%; }
  .btn:hover { background: #3651d4; }
  .btn:active { transform: scale(0.98); }
  .result { display: none; margin-top: 20px; }
  .token-box { background: #f0f4ff; border: 1px solid #d0d9ff; border-radius: 8px; padding: 12px; margin: 8px 0; position: relative; }
  .token-box code { display: block; word-break: break-all; font-size: 12px; color: #333; line-height: 1.5; max-height: 80px; overflow-y: auto; }
  .token-box .label { font-size: 12px; color: #666; margin-bottom: 4px; font-weight: 500; }
  .copy-btn { position: absolute; top: 8px; right: 8px; padding: 4px 10px; background: #4361ee; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; }
  .copy-btn:hover { background: #3651d4; }
  .payload-box { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; margin-top: 8px; }
  .payload-box pre { font-size: 12px; color: #555; white-space: pre-wrap; }
  .tip { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; font-size: 13px; color: #856404; margin-top: 12px; line-height: 1.6; }
  .tip strong { color: #664d03; }
  .authorize-btn { display: inline-block; margin-top: 12px; padding: 8px 20px; background: #49cc90; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; text-decoration: none; font-weight: 500; }
  .authorize-btn:hover { background: #3bb37a; }
</style>
</head>
<body>
  <h1>🔑 JWT测试令牌生成器</h1>
  <p class="subtitle">生成测试JWT令牌，用于 <a href="/api/${SWAGGER_DOCS_PATH}" target="_blank">Swagger API文档</a> 调试接口</p>
  
  <div class="card">
    <h2>⚙️ 令牌配置</h2>
    <div class="form-group">
      <label for="type">令牌类型</label>
      <select id="type" onchange="toggleFields()">
        <option value="user">👤 普通用户令牌</option>
        <option value="admin">🔧 管理员令牌</option>
      </select>
    </div>
    <div class="form-group">
      <label for="userId">用户ID (数字)</label>
      <input type="number" id="userId" value="1" min="1">
    </div>
    <div class="form-group">
      <label for="userIdStr" id="userIdStrLabel">用户标识 (user_id)</label>
      <input type="text" id="userIdStr" value="test_user" placeholder="输入用户标识">
    </div>
    <button class="btn" onclick="generateToken()">🚀 生成测试令牌</button>
    
    <div class="result" id="result">
      <div class="token-box">
        <div class="label">🎫 Access Token</div>
        <button class="copy-btn" onclick="copyToken('accessToken')">复制</button>
        <code id="accessToken"></code>
      </div>
      <div class="token-box">
        <div class="label">🔄 Refresh Token</div>
        <button class="copy-btn" onclick="copyToken('refreshToken')">复制</button>
        <code id="refreshToken"></code>
      </div>
      <div class="payload-box">
        <div class="label">📋 Payload</div>
        <pre id="payload"></pre>
      </div>
      <div class="tip">
        <strong>使用方法：</strong><br>
        1. 复制上方的 Access Token<br>
        2. 打开 <a href="/api/${SWAGGER_DOCS_PATH}" target="_blank">API文档页面</a><br>
        3. 点击页面右上角的 <strong>Authorize</strong> 🔒 按钮<br>
        4. 粘贴令牌后点击 <strong>Authorize</strong> 确认<br>
        5. 即可调试所有需要认证的接口
      </div>
      <a class="authorize-btn" href="/api/${SWAGGER_DOCS_PATH}" target="_blank">📝 前往API文档调试</a>
    </div>
  </div>

<script>
function toggleFields() {
  const type = document.getElementById('type').value;
  const label = document.getElementById('userIdStrLabel');
  const input = document.getElementById('userIdStr');
  if (type === 'admin') {
    label.textContent = '管理员用户名';
    input.value = 'admin';
    input.placeholder = '输入管理员用户名';
  } else {
    label.textContent = '用户标识 (user_id)';
    input.value = 'test_user';
    input.placeholder = '输入用户标识';
  }
}

async function generateToken() {
  const type = document.getElementById('type').value;
  const userId = parseInt(document.getElementById('userId').value) || 1;
  const userIdStr = document.getElementById('userIdStr').value || (type === 'admin' ? 'admin' : 'test_user');
  
  try {
    const resp = await fetch('/api/${JWT_TEST_TOKEN_PATH}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, user_id: userIdStr, type })
    });
    const data = await resp.json();
    if (data.code === 200) {
      document.getElementById('accessToken').textContent = data.data.access_token;
      document.getElementById('refreshToken').textContent = data.data.refresh_token;
      document.getElementById('payload').textContent = JSON.stringify(data.data.payload, null, 2);
      document.getElementById('result').style.display = 'block';
    } else {
      alert('生成失败: ' + data.message);
    }
  } catch(e) {
    alert('请求失败: ' + e.message);
  }
}

function copyToken(id) {
  const text = document.getElementById(id).textContent;
  navigator.clipboard.writeText(text).then(function() {
    const btn = document.querySelector('#' + id).parentElement.querySelector('.copy-btn');
    btn.textContent = '已复制!';
    setTimeout(function() { btn.textContent = '复制'; }, 1500);
  });
}
</script>
</body>
</html>`);
});

// 健康检查路由
app.get('/api/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    code: RESPONSE_CODES.SUCCESS,
    message: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 路由配置
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/creator-center', creatorCenterRoutes);
app.use('/api/notifications', notificationsRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '服务器内部错误' });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({ code: RESPONSE_CODES.NOT_FOUND, message: '接口不存在' });
});

/**
 * 执行 Prisma db push 命令同步数据库表结构
 * 当环境变量 AUTO_DB_PUSH=true 时自动执行
 */
async function runPrismaDbPush() {
  if (process.env.AUTO_DB_PUSH !== 'true') {
    return;
  }

  console.log('● 自动执行 Prisma db push...');
  
  try {
    execSync('npx prisma db push --skip-generate', {
      cwd: __dirname,
      stdio: 'inherit'
    });
    console.log('● Prisma db push 完成');
  } catch (error) {
    console.error('● Prisma db push 失败:', error.message);
    throw error;
  }
}

/**
 * 检查并创建默认管理员账户
 * 如果管理员表为空，则创建默认管理员
 */
async function ensureDefaultAdmin() {
  try {
    // 检查管理员表是否有数据
    const adminCount = await prisma.admin.count();
    
    if (adminCount === 0) {
      console.log('● 未检测到管理员账户，正在创建默认管理员...');
      
      await prisma.admin.create({
        data: {
          username: DEFAULT_ADMIN.username,
          password: DEFAULT_ADMIN.passwordHash
        }
      });
      
      console.log(`● 默认管理员账户创建成功 (用户名: ${DEFAULT_ADMIN.username})`);
    }
  } catch (error) {
    console.error('● 创建默认管理员失败:', error.message);
    // 不抛出错误，允许应用继续启动
  }
}

/**
 * Prisma 数据库连接验证和表结构检查
 * 在程序启动时自动验证数据库连接和表结构
 */
async function validatePrismaConnection() {
  try {
    // 如果启用了自动 db push，先执行
    await runPrismaDbPush();

    // 测试数据库连接
    await prisma.$connect();
    console.log('● Prisma ORM 数据库连接成功');
    
    // 验证核心表结构是否存在（通过简单查询验证）
    const tables = [
      { name: 'users', model: prisma.user },
      { name: 'posts', model: prisma.post },
      { name: 'comments', model: prisma.comment },
      { name: 'notifications', model: prisma.notification },
      { name: 'admin', model: prisma.admin }
    ];
    
    let validTables = 0;
    for (const table of tables) {
      try {
        await table.model.count();
        validTables++;
      } catch (error) {
        console.warn(`  ⚠️ 表 ${table.name} 可能不存在或结构不匹配`);
      }
    }
    
    if (validTables === tables.length) {
      console.log(`● Prisma 表结构验证通过 (${validTables}/${tables.length} 核心表)`);
    } else {
      console.warn(`● Prisma 表结构部分验证 (${validTables}/${tables.length} 核心表)`);
      console.log('  提示: 运行 "npx prisma db push" 同步表结构');
    }
    
    // 检查并创建默认管理员
    await ensureDefaultAdmin();
    
    return true;
  } catch (error) {
    console.error('● Prisma 数据库连接失败:', error.message);
    console.log('  提示: 请检查 DATABASE_URL 环境变量配置');
    console.log('  提示: 运行 "npx prisma generate" 生成 Prisma Client');
    console.log('  提示: 运行 "npx prisma db push" 同步表结构');
    return false;
  }
}

// 启动服务器
const PORT = config.server.port;

// 先验证 Prisma 连接，然后启动服务器
validatePrismaConnection().then(async (connected) => {
  // 初始化异步队列服务
  await initQueueService();
  
  // 从 Redis 加载后台设置
  await loadSettingsFromRedis();
  
  // 启动定时清理过期浏览历史任务（每小时执行一次）
  if (connected) {
    // 首次启动时执行一次清理
    cleanupExpiredBrowsingHistory();
    
    // 设置定时任务
    cleanupTimer = setInterval(() => {
      cleanupExpiredBrowsingHistory();
    }, CLEANUP_INTERVAL_MS);
    
    console.log('● 浏览历史定时清理任务已启动（每小时执行）');
  }
  
  app.listen(PORT, () => {
    console.log(`● 服务器运行在端口 ${PORT}`);
    console.log(`● 环境: ${config.server.env}`);
    if (!connected) {
      console.warn('● 警告: 数据库连接失败，部分功能可能不可用');
    }
    // 启动时验证swagger文档完整性（自动检测app.js中的路由挂载和内联路由）
    const routesDir = path.join(__dirname, 'routes');
    const appJsPath = path.join(__dirname, 'app.js');
    validateSwaggerCompleteness(swaggerSpec, routesDir, { appJsPath });
    // 开发模式下监听路由文件变更
    if (config.server.env === 'development') {
      watchRouteChanges(routesDir, appJsPath);
    }
  });
});

// 优雅关闭 - 断开 Prisma 连接和队列服务
process.on('beforeExit', async () => {
  // 清除定时器
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  await closeQueueService();
  await prisma.$disconnect();
});

module.exports = app;