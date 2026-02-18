<template>
  <div v-if="visible" class="modal-overlay" @mousedown="handleClose">
    <div class="modal-container" @mousedown.stop>
      <div class="modal-header">
        <h3 class="modal-title">API密钥管理</h3>
        <button class="close-btn" @click="handleClose">
          <SvgIcon name="close" width="20" height="20" />
        </button>
      </div>

      <div class="modal-content">
        <p class="modal-desc">API密钥可用于置换JWT令牌来访问个人账号数据，请妥善保管。</p>

        <!-- 新密钥显示区域（仅创建后显示一次） -->
        <div v-if="newKeyValue" class="new-key-alert">
          <div class="alert-title">🔑 请保存您的API密钥</div>
          <div class="alert-desc">此密钥仅显示一次，关闭后无法再次查看。</div>
          <div class="key-display">
            <code class="key-text">{{ newKeyValue }}</code>
            <button class="copy-btn" @click="copyKey">{{ copied ? '已复制' : '复制' }}</button>
          </div>
        </div>

        <!-- 创建表单 -->
        <div class="create-section">
          <div class="create-form">
            <input
              v-model="keyName"
              type="text"
              class="form-input"
              placeholder="输入密钥名称"
              maxlength="50"
              :disabled="creating"
            />
            <button class="create-btn" :disabled="creating || !keyName.trim()" @click="handleCreate">
              <span v-if="creating" class="loading-spinner"></span>
              {{ creating ? '创建中...' : '创建密钥' }}
            </button>
          </div>
        </div>

        <!-- 密钥列表 -->
        <div class="keys-list">
          <div v-if="loading" class="loading-state">加载中...</div>
          <div v-else-if="apiKeys.length === 0" class="empty-state">暂无API密钥</div>
          <div v-else>
            <div v-for="key in apiKeys" :key="key.id" class="key-item">
              <div class="key-info">
                <div class="key-name">{{ key.name }}</div>
                <div class="key-meta">
                  <span class="key-prefix">{{ key.api_key_prefix }}...</span>
                  <span class="key-date">创建于 {{ formatDate(key.created_at) }}</span>
                  <span v-if="key.last_used_at" class="key-date">最后使用 {{ formatDate(key.last_used_at) }}</span>
                </div>
              </div>
              <button class="delete-btn" :disabled="deleting === key.id" @click="handleDelete(key)">
                <SvgIcon name="delete" width="16" height="16" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 删除确认弹窗 -->
  <ConfirmDialog
    v-model:visible="showDeleteConfirm"
    title="确认删除"
    :message="`确定要删除密钥「${deletingKey?.name || ''}」吗？删除后使用该密钥的应用将无法继续访问。`"
    type="error"
    confirm-text="确认删除"
    cancel-text="取消"
    @confirm="confirmDelete"
    @cancel="showDeleteConfirm = false"
    @update:visible="showDeleteConfirm = $event"
  />
</template>

<script setup>
import { ref, watch, inject } from 'vue'
import { userApi } from '@/api/index.js'
import SvgIcon from '@/components/SvgIcon.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useScrollLock } from '@/composables/useScrollLock'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible'])

const $message = inject('$message')
const { lock, unlock } = useScrollLock()

const apiKeys = ref([])
const loading = ref(false)
const creating = ref(false)
const keyName = ref('')
const newKeyValue = ref('')
const copied = ref(false)
const deleting = ref(null)
const showDeleteConfirm = ref(false)
const deletingKey = ref(null)

// 加载密钥列表
const loadKeys = async () => {
  loading.value = true
  try {
    const result = await userApi.getApiKeys()
    if (result && result.success) {
      apiKeys.value = result.data || []
    }
  } catch (error) {
    console.error('加载API密钥失败:', error)
  } finally {
    loading.value = false
  }
}

// 创建密钥
const handleCreate = async () => {
  if (!keyName.value.trim()) return
  creating.value = true
  newKeyValue.value = ''
  try {
    const result = await userApi.createApiKey({ name: keyName.value.trim() })
    if (result && result.success) {
      newKeyValue.value = result.data.api_key
      keyName.value = ''
      copied.value = false
      await loadKeys()
      $message?.success('API密钥创建成功')
    } else {
      $message?.error(result?.message || '创建失败')
    }
  } catch (error) {
    console.error('创建API密钥失败:', error)
    $message?.error('创建失败，请重试')
  } finally {
    creating.value = false
  }
}

// 复制密钥
const copyKey = async () => {
  try {
    await navigator.clipboard.writeText(newKeyValue.value)
    copied.value = true
    $message?.success('已复制到剪贴板')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    $message?.error('复制失败，请手动复制')
  }
}

// 删除密钥
const handleDelete = (key) => {
  deletingKey.value = key
  showDeleteConfirm.value = true
}

const confirmDelete = async () => {
  if (!deletingKey.value) return
  const keyId = deletingKey.value.id
  deleting.value = keyId
  try {
    const result = await userApi.deleteApiKey(keyId)
    if (result && result.success) {
      apiKeys.value = apiKeys.value.filter(k => k.id !== keyId)
      $message?.success('API密钥已删除')
    } else {
      $message?.error(result?.message || '删除失败')
    }
  } catch (error) {
    console.error('删除API密钥失败:', error)
    $message?.error('删除失败，请重试')
  } finally {
    deleting.value = null
    showDeleteConfirm.value = false
    deletingKey.value = null
  }
}

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// 关闭
const handleClose = () => {
  newKeyValue.value = ''
  emit('update:visible', false)
}

// 监听可见性
watch(() => props.visible, (val) => {
  if (val) {
    lock()
    loadKeys()
  } else {
    unlock()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.21);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  background: var(--bg-color-primary);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color-primary);
}

.modal-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-color-primary);
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  transition: all 0.2s ease;
}

.close-btn:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

.modal-content {
  padding: 24px;
  overflow-y: auto;
}

.modal-desc {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.new-key-alert {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.alert-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 4px;
}

.alert-desc {
  font-size: 13px;
  color: var(--text-color-secondary);
  margin-bottom: 12px;
}

.key-display {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-color-secondary);
  border-radius: 6px;
  padding: 10px 12px;
}

.key-text {
  flex: 1;
  font-size: 13px;
  word-break: break-all;
  color: var(--text-color-primary);
  font-family: monospace;
}

.copy-btn {
  padding: 6px 14px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  opacity: 0.9;
}

.create-section {
  margin-bottom: 20px;
}

.create-form {
  display: flex;
  gap: 8px;
}

.form-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  caret-color: var(--primary-color);
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-input::placeholder {
  color: var(--text-color-tertiary);
}

.create-btn {
  padding: 10px 18px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.create-btn:hover {
  opacity: 0.9;
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.keys-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-color-secondary);
  font-size: 14px;
}

.key-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--border-color-primary);
  border-radius: 8px;
  transition: background 0.2s ease;
}

.key-item:hover {
  background: var(--bg-color-secondary);
}

.key-info {
  flex: 1;
  min-width: 0;
}

.key-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
  margin-bottom: 4px;
}

.key-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.key-prefix {
  font-family: monospace;
  background: var(--bg-color-secondary);
  padding: 1px 6px;
  border-radius: 4px;
}

.delete-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-color-secondary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-left: 8px;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger-color);
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .create-form {
    flex-direction: column;
  }

  .key-meta {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
