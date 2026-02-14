<template>
  <div class="notification-template-page">
    <!-- 模板编写指南 -->
    <div class="template-guide" v-if="showGuide">
      <div class="guide-header">
        <h3>📝 邮件模板编写指南</h3>
        <span class="guide-close" @click="showGuide = false">收起</span>
      </div>
      <div class="guide-content">
        <div class="guide-section">
          <h4>可用变量</h4>
          <p>在模板中使用 <code>{变量名}</code> 格式插入动态内容，发送时自动替换为实际值：</p>
          <table class="guide-table">
            <thead><tr><th>变量</th><th>说明</th><th>适用模板</th></tr></thead>
            <tbody>
              <tr><td><code>{siteName}</code></td><td>站点名称</td><td>所有</td></tr>
              <tr><td><code>{senderName}</code></td><td>发送者昵称</td><td>comment, reply, mention, mention_comment, new_post</td></tr>
              <tr><td><code>{postTitle}</code></td><td>笔记标题</td><td>new_post</td></tr>
              <tr><td><code>{commentContent}</code></td><td>评论/回复内容</td><td>comment, reply, mention_comment</td></tr>
              <tr><td><code>{title}</code></td><td>通知标题</td><td>system_notification, activity_notification</td></tr>
              <tr><td><code>{content}</code></td><td>通知正文</td><td>system_notification, activity_notification</td></tr>
            </tbody>
          </table>
        </div>
        <div class="guide-section">
          <h4>邮件HTML/CSS编写规范</h4>
          <ul>
            <li><strong>必须使用内联样式</strong>：邮件客户端不支持 <code>&lt;style&gt;</code> 标签和外部CSS，所有样式都必须写在 <code>style=""</code> 属性中</li>
            <li><strong>使用表格布局</strong>：复杂布局建议使用 <code>&lt;table&gt;</code>，避免 <code>flex</code> / <code>grid</code>（兼容性差）</li>
            <li><strong>最大宽度600px</strong>：邮件正文建议包裹在 <code>max-width: 600px</code> 的容器中</li>
            <li><strong>安全字体</strong>：使用 Arial, Helvetica, sans-serif 等通用字体</li>
            <li><strong>避免使用</strong>：<code>position</code>、<code>float</code>、<code>background-image</code>（部分客户端不支持）</li>
            <li><strong>图片使用绝对URL</strong>：如 <code>https://example.com/logo.png</code></li>
          </ul>
        </div>
        <div class="guide-section">
          <h4>示例模板</h4>
          <pre class="guide-code">&lt;div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;"&gt;
  &lt;h2 style="color: #333;"&gt;💬 新评论通知&lt;/h2&gt;
  &lt;p style="color: #666; font-size: 16px;"&gt;
    &lt;strong&gt;{senderName}&lt;/strong&gt; 评论了你的笔记
  &lt;/p&gt;
  &lt;div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 16px 0;"&gt;
    &lt;p style="color: #333; margin: 0;"&gt;{commentContent}&lt;/p&gt;
  &lt;/div&gt;
  &lt;p style="color: #999; font-size: 14px;"&gt;点击查看详情&lt;/p&gt;
&lt;/div&gt;</pre>
        </div>
      </div>
    </div>
    <div class="guide-toggle" v-else>
      <span @click="showGuide = true">📝 查看邮件模板编写指南</span>
    </div>

    <!-- CrudTable -->
    <CrudTable
      title="通知模板管理"
      entity-name="通知模板"
      api-endpoint="/admin/notification-templates"
      :columns="columns"
      :form-fields="formFields"
      :search-fields="searchFields"
      default-sort-field="created_at"
      default-sort-order="desc"
      :custom-actions="customActions"
      @custom-action="handleCustomAction"
    />

    <!-- 测试发送邮件弹窗 -->
    <div class="modal-overlay" v-if="showEmailDialog" @click.self="showEmailDialog = false">
      <div class="modal-box">
        <h3>📧 测试发送邮件</h3>
        <p class="modal-desc">将使用示例数据渲染模板并发送到指定邮箱</p>
        <p class="modal-template-info">模板：{{ currentItem?.name }} ({{ currentItem?.template_key }})</p>
        <div class="modal-field">
          <label>收件邮箱</label>
          <input v-model="testEmail" type="email" placeholder="请输入测试邮箱地址" />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showEmailDialog = false">取消</button>
          <button class="btn-confirm" @click="sendTestEmail" :disabled="emailSending">
            {{ emailSending ? '发送中...' : '发送测试邮件' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 预览邮件模板弹窗 -->
    <div class="modal-overlay" v-if="showPreviewDialog" @click.self="showPreviewDialog = false">
      <div class="modal-box preview-modal">
        <div class="preview-header">
          <h3>👁️ 邮件模板预览</h3>
          <span class="guide-close" @click="showPreviewDialog = false">关闭</span>
        </div>
        <div class="preview-info" v-if="previewData">
          <p><strong>邮件主题：</strong>{{ previewData.subject }}</p>
          <p><strong>系统通知：</strong>{{ previewData.system }}</p>
        </div>
        <div class="preview-frame" v-if="previewData">
          <iframe ref="previewIframe" class="email-preview-iframe" sandbox="allow-same-origin"></iframe>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import CrudTable from '@/views/admin/components/CrudTable.vue'
import request from '@/api/request.js'
import messageManager from '@/utils/messageManager'

const showGuide = ref(false)
const showEmailDialog = ref(false)
const showPreviewDialog = ref(false)
const currentItem = ref(null)
const testEmail = ref('')
const emailSending = ref(false)
const previewData = ref(null)
const previewIframe = ref(null)

const columns = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'template_key', label: '模板键名', sortable: false },
  { key: 'name', label: '模板名称', sortable: false },
  { key: 'description', label: '描述', sortable: false, maxLength: 40 },
  { key: 'is_active', label: '启用', type: 'boolean', trueText: '是', falseText: '否', sortable: false },
  { key: 'email_subject', label: '邮件主题', sortable: false, maxLength: 30 },
  { key: 'created_at', label: '创建时间', type: 'date', sortable: true },
  { key: 'updated_at', label: '更新时间', type: 'date', sortable: true }
]

const formFields = [
  {
    key: 'template_key',
    label: '模板键名',
    type: 'select',
    required: true,
    options: [
      { value: 'comment', label: 'comment - 评论笔记' },
      { value: 'reply', label: 'reply - 回复评论' },
      { value: 'mention', label: 'mention - @提及（笔记）' },
      { value: 'mention_comment', label: 'mention_comment - @提及（评论）' },
      { value: 'new_post', label: 'new_post - 关注者发布新帖子' },
      { value: 'system_notification', label: 'system_notification - 系统通知' },
      { value: 'activity_notification', label: 'activity_notification - 活动通知' }
    ]
  },
  { key: 'name', label: '模板名称', type: 'text', required: true, placeholder: '如：评论通知模板' },
  { key: 'description', label: '描述', type: 'text', required: false, placeholder: '模板用途说明' },
  { key: 'system_template', label: '系统模板', type: 'textarea', required: false, placeholder: '站内通知模板，支持变量：{senderName}, {postTitle}, {commentContent}, {title}, {content}' },
  { key: 'email_subject', label: '邮件主题', type: 'text', required: false, placeholder: '邮件标题模板，支持变量：{siteName}, {senderName}, {title}' },
  { key: 'email_body', label: '邮件正文（HTML）', type: 'textarea', required: false, placeholder: '邮件HTML内容模板，支持变量：{siteName}, {senderName}, {postTitle}, {commentContent}, {title}, {content}' },
  {
    key: 'is_active',
    label: '启用状态',
    type: 'select',
    required: false,
    options: [
      { value: true, label: '启用' },
      { value: false, label: '禁用' }
    ]
  }
]

const searchFields = [
  { key: 'name', label: '模板名称', placeholder: '搜索模板名称' },
  {
    key: 'template_key',
    label: '模板键名',
    type: 'select',
    placeholder: '选择模板类型',
    options: [
      { value: '', label: '全部类型' },
      { value: 'comment', label: '评论笔记' },
      { value: 'reply', label: '回复评论' },
      { value: 'mention', label: '@提及（笔记）' },
      { value: 'mention_comment', label: '@提及（评论）' },
      { value: 'new_post', label: '关注者发布新帖子' },
      { value: 'system_notification', label: '系统通知' },
      { value: 'activity_notification', label: '活动通知' }
    ]
  }
]

const customActions = [
  { key: 'preview', icon: 'view', title: '预览邮件模板' },
  { key: 'test-email', icon: 'chat', title: '测试发送邮件' },
  { key: 'test-discord', icon: 'share', title: '测试发送Discord' }
]

const handleCustomAction = async ({ action, item }) => {
  currentItem.value = item

  if (action === 'preview') {
    await previewTemplate(item)
  } else if (action === 'test-email') {
    showEmailDialog.value = true
  } else if (action === 'test-discord') {
    await sendTestDiscord(item)
  }
}

const previewTemplate = async (item) => {
  try {
    const response = await request.post('/admin/notification-templates/preview', {
      template_key: item.template_key,
      email_subject: item.email_subject,
      email_body: item.email_body,
      system_template: item.system_template
    })
    if (response.success) {
      previewData.value = response.data
      showPreviewDialog.value = true
      await nextTick()
      if (previewIframe.value) {
        const doc = previewIframe.value.contentDocument || previewIframe.value.contentWindow.document
        doc.open()
        doc.write(response.data.body || '<p style="color:#999;text-align:center;">无邮件正文内容</p>')
        doc.close()
      }
    } else {
      messageManager.error(response.message || '预览失败')
    }
  } catch (error) {
    messageManager.error('预览失败')
  }
}

const sendTestEmail = async () => {
  if (!testEmail.value.trim()) {
    messageManager.error('请输入测试邮箱地址')
    return
  }
  emailSending.value = true
  try {
    const response = await request.post(`/admin/notification-templates/${currentItem.value.id}/test-email`, {
      email: testEmail.value.trim()
    })
    if (response.success) {
      messageManager.success(response.message || '测试邮件已发送')
      showEmailDialog.value = false
    } else {
      messageManager.error(response.message || '发送失败')
    }
  } catch (error) {
    messageManager.error('发送失败')
  } finally {
    emailSending.value = false
  }
}

const sendTestDiscord = async (item) => {
  try {
    const response = await request.post(`/admin/notification-templates/${item.id}/test-discord`)
    if (response.success) {
      messageManager.success(response.message || 'Discord测试通知已发送')
    } else {
      messageManager.error(response.message || '发送失败')
    }
  } catch (error) {
    messageManager.error('发送失败')
  }
}
</script>

<style scoped>
.notification-template-page {
  width: 100%;
}

/* 编写指南 */
.template-guide {
  background: var(--bg-secondary, #f9f9f9);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.guide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-tertiary, #f0f0f0);
}

.guide-header h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-primary, #333);
}

.guide-close {
  cursor: pointer;
  color: var(--text-secondary, #666);
  font-size: 13px;
}

.guide-close:hover {
  color: var(--text-primary, #333);
}

.guide-content {
  padding: 16px;
}

.guide-section {
  margin-bottom: 16px;
}

.guide-section:last-child {
  margin-bottom: 0;
}

.guide-section h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-primary, #333);
}

.guide-section p {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.guide-section ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--text-secondary, #666);
  line-height: 1.8;
}

.guide-section code {
  background: var(--bg-tertiary, #e8e8e8);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #d63384;
}

.guide-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.guide-table th,
.guide-table td {
  border: 1px solid var(--border-color, #e0e0e0);
  padding: 6px 10px;
  text-align: left;
}

.guide-table th {
  background: var(--bg-tertiary, #f0f0f0);
  font-weight: 600;
  color: var(--text-primary, #333);
}

.guide-table td {
  color: var(--text-secondary, #666);
}

.guide-code {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
  margin: 0;
}

.guide-toggle {
  margin-bottom: 12px;
}

.guide-toggle span {
  cursor: pointer;
  color: var(--text-secondary, #666);
  font-size: 13px;
}

.guide-toggle span:hover {
  color: var(--text-primary, #333);
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: var(--bg-primary, #fff);
  border-radius: 12px;
  padding: 24px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.modal-box h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--text-primary, #333);
}

.modal-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary, #999);
}

.modal-template-info {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-secondary, #666);
  padding: 8px 12px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 6px;
}

.modal-field {
  margin-bottom: 16px;
}

.modal-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-primary, #333);
  font-weight: 500;
}

.modal-field input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #333);
}

.modal-field input:focus {
  border-color: #000;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn-cancel,
.btn-confirm {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
}

.btn-cancel {
  background: var(--bg-secondary, #f0f0f0);
  color: var(--text-secondary, #666);
}

.btn-confirm {
  background: #000;
  color: #fff;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel:hover {
  background: var(--bg-tertiary, #e0e0e0);
}

.btn-confirm:hover:not(:disabled) {
  opacity: 0.85;
}

/* 预览弹窗 */
.preview-modal {
  min-width: 660px;
  max-width: 720px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-header h3 {
  margin: 0;
}

.preview-info {
  background: var(--bg-secondary, #f5f5f5);
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.preview-info p {
  margin: 4px 0;
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.preview-frame {
  flex: 1;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  overflow: hidden;
}

.email-preview-iframe {
  width: 100%;
  height: 400px;
  border: none;
  background: #fff;
}
</style>
