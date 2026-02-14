<template>
  <div class="system-settings-page">
    <div class="settings-container">
      <!-- 访问控制设置 -->
      <div class="settings-section">
        <div class="section-header">
          <h3 class="section-title">
            <SvgIcon name="setting" class="section-icon" />
            访问控制
          </h3>
          <p class="section-description">控制用户访问权限和限制</p>
        </div>
        <div class="settings-list">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">禁止游客访问</span>
              <span class="setting-description">启用后，未登录用户无法访问笔记、评论、搜索、标签等内容</span>
            </div>
            <div class="setting-control">
              <div class="toggle-switch" :class="{ active: settings.guest_access_restricted }" @click="toggleSetting('guest_access_restricted')">
                <div class="toggle-slider"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI审核设置 -->
      <div class="settings-section">
        <div class="section-header">
          <h3 class="section-title">
            <SvgIcon name="warning" class="section-icon" />
            AI审核
          </h3>
          <p class="section-description">配置AI内容审核功能</p>
        </div>
        <div class="settings-list">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">用户名AI审核</span>
              <span class="setting-description">启用后，用户昵称将通过AI进行内容审核</span>
            </div>
            <div class="setting-control">
              <div class="toggle-switch" :class="{ active: settings.ai_username_review_enabled }" @click="toggleSetting('ai_username_review_enabled')">
                <div class="toggle-slider"></div>
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">内容AI审核</span>
              <span class="setting-description">启用后，评论等内容将通过AI进行审核</span>
            </div>
            <div class="setting-control">
              <div class="toggle-switch" :class="{ active: settings.ai_content_review_enabled }" @click="toggleSetting('ai_content_review_enabled')">
                <div class="toggle-slider"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 初始设置页面配置 -->
      <div class="settings-section">
        <div class="section-header">
          <h3 class="section-title">
            <SvgIcon name="edit" class="section-icon" />
            初始设置
          </h3>
          <p class="section-description">配置用户初始设置页面的选项，同步到前端初始页面和用户资料页面</p>
        </div>
        <div class="settings-list">
          <div class="setting-item setting-item-vertical">
            <div class="setting-info">
              <span class="setting-label">兴趣爱好选项</span>
              <span class="setting-description">配置初始设置页面和个人资料中可选的兴趣爱好标签</span>
            </div>
            <div class="interest-tags-editor">
              <div class="interest-tags-list">
                <span v-for="(tag, index) in settings.onboarding_interest_options" :key="index" class="interest-tag-item">
                  {{ tag }}
                  <button type="button" class="remove-tag-btn" @click="removeInterestOption(index)">×</button>
                </span>
              </div>
              <div class="add-tag-row">
                <input v-model="newInterestOption" type="text" placeholder="输入兴趣选项后按回车添加" maxlength="8"
                  @keyup.enter="addInterestOption" class="tag-input" />
                <button type="button" class="add-tag-btn" @click="addInterestOption"
                  :disabled="!newInterestOption.trim()">添加</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 保存按钮 -->
      <div class="settings-actions">
        <button class="btn btn-primary" @click="saveSettings" :disabled="!hasChanges || isSaving">
          <span v-if="isSaving">保存中...</span>
          <span v-else>保存设置</span>
        </button>
        <button class="btn btn-secondary" @click="resetSettings" :disabled="!hasChanges">
          重置
        </button>
      </div>
    </div>

    <!-- 消息提示 -->
    <MessageToast v-if="showToast" :message="toastMessage" :type="toastType" @close="handleToastClose" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import MessageToast from '@/components/MessageToast.vue'
import { apiConfig } from '@/config/api'

// 设置状态
const settings = reactive({
  guest_access_restricted: false,
  ai_username_review_enabled: false,
  ai_content_review_enabled: false,
  onboarding_interest_options: []
})

// 原始设置（用于检测变更）
const originalSettings = reactive({
  guest_access_restricted: false,
  ai_username_review_enabled: false,
  ai_content_review_enabled: false,
  onboarding_interest_options: []
})

const isSaving = ref(false)
const isLoading = ref(true)

// Toast状态
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

// 检测是否有变更
const hasChanges = computed(() => {
  return Object.keys(settings).some(key => {
    if (Array.isArray(settings[key])) {
      return JSON.stringify(settings[key]) !== JSON.stringify(originalSettings[key])
    }
    return settings[key] !== originalSettings[key]
  })
})

// 获取认证头
function getAuthHeaders() {
  const token = localStorage.getItem('admin_token')
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  }
}

// 显示提示
function showToastMessage(message, type = 'success') {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
}

function handleToastClose() {
  showToast.value = false
}

// 兴趣爱好选项编辑
const newInterestOption = ref('')

function addInterestOption() {
  const val = newInterestOption.value.trim()
  if (val && !settings.onboarding_interest_options.includes(val)) {
    settings.onboarding_interest_options.push(val)
  }
  newInterestOption.value = ''
}

function removeInterestOption(index) {
  settings.onboarding_interest_options.splice(index, 1)
}

// 切换设置
function toggleSetting(key) {
  settings[key] = !settings[key]
}

// 加载设置
async function loadSettings() {
  isLoading.value = true
  try {
    const response = await fetch(`${apiConfig.baseURL}/admin/system-settings`, {
      method: 'GET',
      headers: getAuthHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const result = await response.json()
    if (result.code === 200 && result.data) {
      // 从分类结构中提取设置值
      const data = result.data
      
      // 访问控制设置
      if (data.access_control?.settings?.guest_access_restricted) {
        settings.guest_access_restricted = data.access_control.settings.guest_access_restricted.value
        originalSettings.guest_access_restricted = data.access_control.settings.guest_access_restricted.value
      }
      
      // AI审核设置
      if (data.ai_review?.settings?.ai_username_review_enabled) {
        settings.ai_username_review_enabled = data.ai_review.settings.ai_username_review_enabled.value
        originalSettings.ai_username_review_enabled = data.ai_review.settings.ai_username_review_enabled.value
      }
      if (data.ai_review?.settings?.ai_content_review_enabled) {
        settings.ai_content_review_enabled = data.ai_review.settings.ai_content_review_enabled.value
        originalSettings.ai_content_review_enabled = data.ai_review.settings.ai_content_review_enabled.value
      }

      // 初始设置页面配置
      if (data.onboarding?.settings?.onboarding_interest_options) {
        const options = data.onboarding.settings.onboarding_interest_options.value
        settings.onboarding_interest_options = Array.isArray(options) ? [...options] : []
        originalSettings.onboarding_interest_options = Array.isArray(options) ? [...options] : []
      }
    }
  } catch (error) {
    console.error('加载设置失败:', error)
    showToastMessage('加载设置失败', 'error')
  } finally {
    isLoading.value = false
  }
}

// 保存设置
async function saveSettings() {
  isSaving.value = true
  try {
    const response = await fetch(`${apiConfig.baseURL}/admin/system-settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        settings: {
          guest_access_restricted: settings.guest_access_restricted,
          ai_username_review_enabled: settings.ai_username_review_enabled,
          ai_content_review_enabled: settings.ai_content_review_enabled,
          onboarding_interest_options: settings.onboarding_interest_options
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const result = await response.json()
    if (result.code === 200) {
      // 更新原始设置
      Object.assign(originalSettings, settings)
      showToastMessage(result.message || '设置保存成功', 'success')
    } else {
      throw new Error(result.message || '保存失败')
    }
  } catch (error) {
    console.error('保存设置失败:', error)
    showToastMessage('保存设置失败: ' + error.message, 'error')
  } finally {
    isSaving.value = false
  }
}

// 重置设置
function resetSettings() {
  settings.guest_access_restricted = originalSettings.guest_access_restricted
  settings.ai_username_review_enabled = originalSettings.ai_username_review_enabled
  settings.ai_content_review_enabled = originalSettings.ai_content_review_enabled
  settings.onboarding_interest_options = [...originalSettings.onboarding_interest_options]
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.system-settings-page {
  padding: 0;
}

.settings-container {
  max-width: 800px;
}

.settings-section {
  background: var(--bg-color-secondary);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}

.section-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 8px 0;
}

.section-icon {
  width: 20px;
  height: 20px;
  color: var(--primary-color);
}

.section-description {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin: 0;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--bg-color);
  border-radius: 8px;
  transition: background-color 0.2s;
}

.setting-item:hover {
  background: var(--bg-color-hover);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  margin-right: 16px;
}

.setting-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color);
}

.setting-description {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.setting-control {
  flex-shrink: 0;
}

/* Toggle Switch 样式 */
.toggle-switch {
  width: 48px;
  height: 26px;
  background: var(--border-color);
  border-radius: 13px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.3s;
}

.toggle-switch.active {
  background: var(--primary-color);
}

.toggle-slider {
  width: 22px;
  height: 22px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch.active .toggle-slider {
  transform: translateX(22px);
}

/* 操作按钮 */
.settings-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-color-dark);
}

.btn-secondary {
  background: var(--bg-color-secondary);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-color-hover);
}

/* 响应式 */
@media (max-width: 640px) {
  .settings-section {
    padding: 16px;
  }
  
  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .setting-info {
    margin-right: 0;
  }
  
  .settings-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}

/* 兴趣爱好选项编辑器 */
.setting-item-vertical {
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.interest-tags-editor {
  width: 100%;
}

.interest-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  min-height: 32px;
}

.interest-tag-item {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: var(--bg-color-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  font-size: 13px;
  color: var(--text-color);
  gap: 4px;
}

.interest-tag-item .remove-tag-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color-secondary);
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
  margin-left: 2px;
}

.interest-tag-item .remove-tag-btn:hover {
  color: var(--primary-color);
}

.add-tag-row {
  display: flex;
  gap: 8px;
}

.tag-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  background: var(--bg-color);
  color: var(--text-color);
  outline: none;
}

.tag-input:focus {
  border-color: var(--primary-color);
}

.add-tag-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--primary-color);
  background: transparent;
  color: var(--primary-color);
  transition: all 0.2s;
}

.add-tag-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: white;
}

.add-tag-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
