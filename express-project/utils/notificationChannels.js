/**
 * 通知渠道服务
 * 处理邮件通知和Discord Webhook通知的发送
 * 
 * @description 支持以下通知类型的邮件和Discord推送：
 *   - 评论笔记、回复评论、@提及、关注者发布新帖子
 *   - 系统通知、活动通知
 */

const { sendMail } = require('./email');
const { email: emailConfig, notificationChannels } = require('../config/config');
const axios = require('axios');

// 默认通知模板
const DEFAULT_TEMPLATES = {
  // 评论笔记
  comment: {
    system: '{senderName} 评论了你的笔记',
    email: {
      subject: '【{siteName}】{senderName} 评论了你的笔记',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">💬 新评论通知</h2>
        <p style="color: #666; font-size: 16px;"><strong>{senderName}</strong> 评论了你的笔记</p>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 16px 0;">
          <p style="color: #333; margin: 0;">{commentContent}</p>
        </div>
        <p style="color: #999; font-size: 14px;">点击查看详情</p>
      </div>`
    }
  },
  // 回复评论
  reply: {
    system: '{senderName} 回复了你的评论',
    email: {
      subject: '【{siteName}】{senderName} 回复了你的评论',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">💬 回复通知</h2>
        <p style="color: #666; font-size: 16px;"><strong>{senderName}</strong> 回复了你的评论</p>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 16px 0;">
          <p style="color: #333; margin: 0;">{commentContent}</p>
        </div>
        <p style="color: #999; font-size: 14px;">点击查看详情</p>
      </div>`
    }
  },
  // @提及（笔记）
  mention: {
    system: '{senderName} 在笔记中@了你',
    email: {
      subject: '【{siteName}】{senderName} 在笔记中提到了你',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">📢 提及通知</h2>
        <p style="color: #666; font-size: 16px;"><strong>{senderName}</strong> 在笔记中@了你</p>
        <p style="color: #999; font-size: 14px;">点击查看详情</p>
      </div>`
    }
  },
  // @提及（评论）
  mention_comment: {
    system: '{senderName} 在评论中@了你',
    email: {
      subject: '【{siteName}】{senderName} 在评论中提到了你',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">📢 提及通知</h2>
        <p style="color: #666; font-size: 16px;"><strong>{senderName}</strong> 在评论中@了你</p>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 16px 0;">
          <p style="color: #333; margin: 0;">{commentContent}</p>
        </div>
        <p style="color: #999; font-size: 14px;">点击查看详情</p>
      </div>`
    }
  },
  // 关注者发布新帖子
  new_post: {
    system: '你关注的 {senderName} 发布了新笔记：{postTitle}',
    email: {
      subject: '【{siteName}】你关注的 {senderName} 发布了新笔记',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">📝 新笔记通知</h2>
        <p style="color: #666; font-size: 16px;">你关注的 <strong>{senderName}</strong> 发布了新笔记</p>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 16px 0;">
          <h3 style="color: #333; margin: 0 0 8px 0;">{postTitle}</h3>
        </div>
        <p style="color: #999; font-size: 14px;">点击查看详情</p>
      </div>`
    }
  },
  // 系统通知
  system_notification: {
    system: '{title}',
    email: {
      subject: '【{siteName}】系统通知：{title}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">🔔 系统通知</h2>
        <h3 style="color: #333;">{title}</h3>
        <div style="color: #666; font-size: 16px; line-height: 1.6;">{content}</div>
      </div>`
    }
  },
  // 活动通知
  activity_notification: {
    system: '{title}',
    email: {
      subject: '【{siteName}】活动通知：{title}',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">🎉 活动通知</h2>
        <h3 style="color: #333;">{title}</h3>
        <div style="color: #666; font-size: 16px; line-height: 1.6;">{content}</div>
      </div>`
    }
  }
};

// 内存缓存自定义模板（从数据库加载）
let customTemplates = {};

/**
 * 渲染模板，替换占位符
 * @param {string} template - 模板字符串
 * @param {Object} variables - 变量映射
 * @returns {string} 渲染后的字符串
 */
function renderTemplate(template, variables = {}) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? (variables[key] || '') : match;
  });
}

/**
 * 获取通知模板（优先自定义模板，其次默认模板）
 * @param {string} templateKey - 模板键名
 * @returns {Object} 模板对象
 */
function getTemplate(templateKey) {
  return customTemplates[templateKey] || DEFAULT_TEMPLATES[templateKey] || null;
}

/**
 * 更新自定义模板缓存
 * @param {string} templateKey - 模板键名
 * @param {Object} template - 模板对象
 */
function updateCustomTemplate(templateKey, template) {
  customTemplates[templateKey] = template;
}

/**
 * 清除自定义模板缓存
 * @param {string} templateKey - 模板键名（可选，不传则清除所有）
 */
function clearCustomTemplates(templateKey) {
  if (templateKey) {
    delete customTemplates[templateKey];
  } else {
    customTemplates = {};
  }
}

/**
 * 加载自定义模板到缓存（从数据库数据）
 * @param {Array} templates - 数据库模板记录
 */
function loadCustomTemplates(templates) {
  for (const tpl of templates) {
    customTemplates[tpl.template_key] = {
      system: tpl.system_template || DEFAULT_TEMPLATES[tpl.template_key]?.system || '',
      email: {
        subject: tpl.email_subject || DEFAULT_TEMPLATES[tpl.template_key]?.email?.subject || '',
        body: tpl.email_body || DEFAULT_TEMPLATES[tpl.template_key]?.email?.body || ''
      }
    };
  }
}

/**
 * 发送Discord Webhook通知
 * @param {string} content - 通知文本内容
 * @param {Object} [embed] - 可选的Discord embed对象
 */
async function sendDiscordNotification(content, embed = null) {
  const { discord } = notificationChannels;
  if (!discord.enabled || !discord.webhookUrl) return;

  try {
    const payload = {};
    if (embed) {
      payload.embeds = [embed];
    } else {
      payload.content = content;
    }
    await axios.post(discord.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
  } catch (error) {
    console.error('Discord通知发送失败:', error.message);
  }
}

/**
 * 发送通知邮件
 * @param {string} to - 收件人邮箱
 * @param {string} subject - 邮件主题
 * @param {string} html - 邮件HTML内容
 */
async function sendNotificationEmail(to, subject, html) {
  if (!emailConfig.enabled || !notificationChannels.emailEnabled) return;
  if (!to) return;

  try {
    await sendMail({ to, subject, html });
  } catch (error) {
    console.error('通知邮件发送失败:', error.message);
  }
}

/**
 * 发送系统/活动通知邮件
 * @param {string} to - 收件人邮箱
 * @param {string} subject - 邮件主题
 * @param {string} html - 邮件HTML内容
 */
async function sendSystemNotificationEmail(to, subject, html) {
  if (!emailConfig.enabled || !notificationChannels.systemEmailEnabled) return;
  if (!to) return;

  try {
    await sendMail({ to, subject, html });
  } catch (error) {
    console.error('系统通知邮件发送失败:', error.message);
  }
}

/**
 * 通知用户通过所有启用的渠道（评论、回复、@提及等）
 * @param {Object} params
 * @param {string} params.templateKey - 模板键名
 * @param {Object} params.variables - 模板变量
 * @param {string} [params.recipientEmail] - 收件人邮箱
 * @param {boolean} [params.sendDiscord] - 是否发送Discord通知（默认true）
 */
async function notifyUser({ templateKey, variables, recipientEmail, sendDiscord = true }) {
  const siteName = notificationChannels.discord?.siteName || '汐社校园图文社区';
  const vars = { siteName, ...variables };
  const template = getTemplate(templateKey);
  if (!template) return;

  const tasks = [];

  // 发送邮件通知
  if (recipientEmail && template.email) {
    const subject = renderTemplate(template.email.subject, vars);
    const html = renderTemplate(template.email.body, vars);
    tasks.push(sendNotificationEmail(recipientEmail, subject, html));
  }

  // 发送Discord通知
  if (sendDiscord && notificationChannels.discord?.enabled) {
    const siteUrl = notificationChannels.discord?.siteUrl || '';
    const text = renderTemplate(template.system, vars);
    const embed = {
      title: '📢 ' + siteName,
      description: text,
      color: 5814783,
      timestamp: new Date().toISOString()
    };
    if (siteUrl) {
      embed.url = siteUrl;
    }
    tasks.push(sendDiscordNotification(null, embed));
  }

  await Promise.allSettled(tasks);
}

/**
 * 发送系统/活动通知邮件到指定邮箱列表
 * @param {Object} params
 * @param {string} params.type - 通知类型 ('system' 或 'activity')
 * @param {string} params.title - 通知标题
 * @param {string} params.content - 通知内容
 * @param {Array<string>} params.emails - 收件人邮箱列表
 */
async function notifySystemNotification({ type, title, content, emails = [] }) {
  const templateKey = type === 'activity' ? 'activity_notification' : 'system_notification';
  const siteName = notificationChannels.discord?.siteName || '汐社校园图文社区';
  const vars = { siteName, title, content };
  const template = getTemplate(templateKey);
  if (!template) return;

  const tasks = [];

  // 发送邮件
  if (emails.length > 0 && template.email) {
    const subject = renderTemplate(template.email.subject, vars);
    const html = renderTemplate(template.email.body, vars);
    for (const email of emails) {
      tasks.push(sendSystemNotificationEmail(email, subject, html));
    }
  }

  // 发送Discord通知
  if (notificationChannels.discord?.enabled) {
    const text = renderTemplate(template.system, vars);
    const embed = {
      title: type === 'activity' ? '🎉 活动通知' : '🔔 系统通知',
      description: `**${title}**\n${content}`,
      color: type === 'activity' ? 16750848 : 5814783,
      footer: { text: siteName },
      timestamp: new Date().toISOString()
    };
    tasks.push(sendDiscordNotification(null, embed));
  }

  await Promise.allSettled(tasks);
}

module.exports = {
  DEFAULT_TEMPLATES,
  renderTemplate,
  getTemplate,
  updateCustomTemplate,
  clearCustomTemplates,
  loadCustomTemplates,
  sendDiscordNotification,
  sendNotificationEmail,
  sendSystemNotificationEmail,
  notifyUser,
  notifySystemNotification
};
