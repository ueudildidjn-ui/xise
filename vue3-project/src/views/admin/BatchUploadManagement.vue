<template>
  <div class="batch-upload-management">
    <div class="batch-upload-header">
      <h2>批量上传笔记</h2>
      <p class="description">从服务器 /uploads/plsc 目录读取文件批量创建笔记</p>
    </div>

    <div class="batch-upload-form">
      <div class="form-section">
        <label class="form-label">作者ID <span class="required">*</span></label>
        <input v-model.number="formData.user_id" type="number" class="form-input"
          placeholder="请输入用户ID" />
      </div>

      <div class="form-section">
        <label class="form-label">笔记类型 <span class="required">*</span></label>
        <div class="type-selector">
          <button :class="['type-btn', { active: formData.type === 1 }]" @click="selectType(1)">
            <SvgIcon name="post" width="20" height="20" />
            图文笔记
          </button>
          <button :class="['type-btn', { active: formData.type === 2 }]" @click="selectType(2)">
            <SvgIcon name="video" width="20" height="20" />
            视频笔记
          </button>
        </div>
      </div>

      <div class="form-section" v-if="formData.type === 1">
        <label class="form-label">每条笔记图片数量</label>
        <input v-model.number="formData.images_per_note" type="number" class="form-input" min="1"
          placeholder="默认4张图片为一条笔记" />
        <p class="form-hint">设置每条笔记包含多少张图片（不限制数量）</p>
      </div>

      <div class="form-section">
        <label class="form-label">笔记标题（可选）</label>
        <input v-model="formData.title" type="text" class="form-input" placeholder="留空则不显示标题" />
      </div>

      <div class="form-section">
        <label class="form-label">笔记内容（可选）</label>
        <textarea v-model="formData.content" class="form-textarea" placeholder="留空则不显示内容" rows="3"></textarea>
      </div>

      <div class="form-section">
        <label class="form-label">标签（可选，将应用到所有笔记）</label>
        <TagSelector v-model="formData.tags" :max-tags="10" />
      </div>

      <div class="form-section">
        <label class="form-label checkbox-label">
          <input type="checkbox" v-model="formData.is_draft" />
          保存为草稿
        </label>
      </div>

      <!-- Server files section -->
      <div class="form-section">
        <div class="server-files-header">
          <label class="form-label">服务器文件 (/uploads/plsc)</label>
          <button class="btn btn-small" @click="fetchServerFiles" :disabled="isLoading">
            {{ isLoading ? '加载中...' : '刷新列表' }}
          </button>
        </div>

        <div v-if="isLoading" class="loading-state">
          <SvgIcon name="loading" width="24" height="24" class="loading-icon" />
          <span>正在加载文件列表...</span>
        </div>

        <div v-else-if="currentFiles.length === 0" class="empty-state">
          <SvgIcon name="post" width="40" height="40" />
          <p>{{ formData.type === 1 ? '目录中没有图片文件' : '目录中没有视频文件' }}</p>
          <p class="hint">请将文件上传到服务器的 /uploads/plsc 目录</p>
        </div>

        <div v-else class="file-list">
          <div class="file-list-header">
            <label class="checkbox-label">
              <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
              全选 ({{ selectedFiles.length }}/{{ currentFiles.length }})
            </label>
            <span class="file-count">
              {{ formData.type === 1 
                ? `将创建 ${Math.ceil(selectedFiles.length / (formData.images_per_note || 1))} 条笔记` 
                : `将创建 ${selectedFiles.length} 条笔记` }}
            </span>
          </div>
          <div class="file-grid">
            <div v-for="file in currentFiles" :key="file.path" 
              :class="['file-item', { selected: isSelected(file) }]"
              @click="toggleSelect(file)">
              <div class="file-preview">
                <img v-if="formData.type === 1" :src="getFileUrl(file)" :alt="file.name" />
                <div v-else class="video-placeholder">
                  <SvgIcon name="video" width="32" height="32" />
                </div>
              </div>
              <div class="file-info">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
              </div>
              <div class="file-checkbox">
                <input type="checkbox" :checked="isSelected(file)" @click.stop />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-outline" @click="resetForm" :disabled="isSubmitting">
          重置
        </button>
        <button class="btn btn-primary" @click="handleBatchCreate" :disabled="!canSubmit || isSubmitting">
          {{ getSubmitButtonText() }}
        </button>
      </div>

      <!-- Progress indicator -->
      <div v-if="isSubmitting" class="upload-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <p class="progress-text">{{ progressText }}</p>
      </div>
    </div>

    <div v-if="uploadHistory.length > 0" class="upload-history">
      <h3>创建历史</h3>
      <div class="history-list">
        <div v-for="(item, index) in uploadHistory" :key="index" class="history-item"
          :class="{ success: item.success, error: !item.success }">
          <span class="history-type">{{ item.type === 1 ? '图文' : '视频' }}</span>
          <span class="history-count">{{ item.count }}条笔记</span>
          <span class="history-status">{{ item.success ? '成功' : '失败' }}</span>
          <span class="history-time">{{ formatTime(item.time) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import TagSelector from '@/components/TagSelector.vue'
import messageManager from '@/utils/messageManager'
import apiConfig from '@/config/api.js'

const formData = reactive({
  user_id: null,
  type: 1,
  images_per_note: 4,
  title: '',
  content: '',
  tags: [],
  is_draft: false
})

const serverImages = ref([])
const serverVideos = ref([])
const selectedFiles = ref([])
const isLoading = ref(false)
const isSubmitting = ref(false)
const uploadHistory = ref([])
const progressText = ref('')
const progressPercent = ref(0)

// Current files based on type
const currentFiles = computed(() => {
  return formData.type === 1 ? serverImages.value : serverVideos.value
})

// Check if all files are selected
const allSelected = computed(() => {
  return currentFiles.value.length > 0 && selectedFiles.value.length === currentFiles.value.length
})

// Check if form can be submitted
const canSubmit = computed(() => {
  return formData.user_id && selectedFiles.value.length > 0
})

// Get auth headers
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  }
  const adminToken = localStorage.getItem('admin_token')
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`
  }
  return headers
}

// Get file URL for preview
const getFileUrl = (file) => {
  return `${apiConfig.baseURL}${file.path}`
}

// Format file size
const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Format time
const formatTime = (time) => {
  return new Date(time).toLocaleString('zh-CN')
}

// Select type and clear selection
const selectType = (type) => {
  formData.type = type
  selectedFiles.value = []
}

// Check if file is selected
const isSelected = (file) => {
  return selectedFiles.value.some(f => f.path === file.path)
}

// Toggle file selection
const toggleSelect = (file) => {
  const index = selectedFiles.value.findIndex(f => f.path === file.path)
  if (index >= 0) {
    selectedFiles.value.splice(index, 1)
  } else {
    selectedFiles.value.push(file)
  }
}

// Toggle select all
const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedFiles.value = []
  } else {
    selectedFiles.value = [...currentFiles.value]
  }
}

// Fetch server files
const fetchServerFiles = async () => {
  isLoading.value = true
  try {
    const response = await fetch(`${apiConfig.baseURL}/admin/batch-upload/files`, {
      headers: getAuthHeaders()
    })
    const result = await response.json()
    
    if (result.code === 200) {
      serverImages.value = result.data.images || []
      serverVideos.value = result.data.videos || []
      selectedFiles.value = []
    } else {
      messageManager.error(result.message || '获取文件列表失败')
    }
  } catch (error) {
    console.error('获取文件列表失败:', error)
    messageManager.error('获取文件列表失败')
  } finally {
    isLoading.value = false
  }
}

// Get submit button text
const getSubmitButtonText = () => {
  if (isSubmitting.value) {
    return '创建中...'
  }
  
  if (selectedFiles.value.length === 0) {
    return '请选择文件'
  }
  
  if (formData.type === 1) {
    const noteCount = Math.ceil(selectedFiles.value.length / (formData.images_per_note || 1))
    return `创建 ${noteCount} 条笔记`
  } else {
    return `创建 ${selectedFiles.value.length} 条笔记`
  }
}

// Reset form
const resetForm = () => {
  formData.user_id = null
  formData.type = 1
  formData.images_per_note = 4
  formData.title = ''
  formData.content = ''
  formData.tags = []
  formData.is_draft = false
  selectedFiles.value = []
}

// Handle batch create
const handleBatchCreate = async () => {
  if (!canSubmit.value || isSubmitting.value) return

  isSubmitting.value = true
  progressPercent.value = 0
  progressText.value = '正在创建笔记...'

  try {
    const response = await fetch(`${apiConfig.baseURL}/admin/batch-upload/create`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: formData.user_id,
        type: formData.type,
        images_per_note: formData.images_per_note || 4,
        title: formData.title || '',
        content: formData.content || '',
        tags: formData.tags,
        is_draft: formData.is_draft,
        files: selectedFiles.value
      })
    })

    const result = await response.json()

    if (result.code === 200) {
      progressPercent.value = 100
      messageManager.success(result.message || `成功创建 ${result.data.count} 条笔记`)
      
      // Add to history
      uploadHistory.value.unshift({
        type: formData.type,
        count: result.data.count,
        success: true,
        time: new Date()
      })

      // Reset selection and refresh file list
      selectedFiles.value = []
      await fetchServerFiles()
    } else {
      throw new Error(result.message || '创建失败')
    }
  } catch (error) {
    console.error('批量创建失败:', error)
    messageManager.error(error.message || '批量创建失败')

    uploadHistory.value.unshift({
      type: formData.type,
      count: 0,
      success: false,
      time: new Date()
    })
  } finally {
    isSubmitting.value = false
    progressText.value = ''
  }
}

// Fetch files on mount
onMounted(() => {
  fetchServerFiles()
})

// Watch type change to clear selection
watch(() => formData.type, () => {
  selectedFiles.value = []
})
</script>

<style scoped>
.batch-upload-management {
  padding: 20px 30px;
  max-width: 1000px;
  margin: 0 auto;
}

.batch-upload-header {
  margin-bottom: 30px;
}

.batch-upload-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: var(--text-color-primary);
}

.batch-upload-header .description {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 14px;
}

.batch-upload-form {
  background: var(--bg-color-primary);
  border-radius: 8px;
  padding: 24px;
  border: 1px solid var(--border-color-primary);
}

.form-section {
  margin-bottom: 24px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-color-primary);
  font-size: 14px;
}

.form-label .required {
  color: var(--primary-color);
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  background-color: var(--bg-color-primary);
  color: var(--text-color-primary);
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  background-color: var(--bg-color-primary);
  color: var(--text-color-primary);
  transition: border-color 0.2s ease;
  resize: vertical;
  min-height: 80px;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: var(--text-color-tertiary);
}

.type-selector {
  display: flex;
  gap: 12px;
}

.type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid var(--border-color-primary);
  border-radius: 8px;
  background: var(--bg-color-primary);
  color: var(--text-color-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.type-btn.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: white;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary-color);
}

/* Server files section */
.server-files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.server-files-header .form-label {
  margin-bottom: 0;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-color-secondary);
  background: var(--bg-color-secondary);
  border-radius: 8px;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state p {
  margin: 10px 0 0 0;
}

.empty-state .hint {
  font-size: 12px;
  color: var(--text-color-tertiary);
}

/* File list */
.file-list {
  border: 1px solid var(--border-color-primary);
  border-radius: 8px;
  overflow: hidden;
}

.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-color-secondary);
  border-bottom: 1px solid var(--border-color-primary);
}

.file-count {
  font-size: 14px;
  color: var(--text-color-secondary);
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.file-item {
  position: relative;
  border: 2px solid var(--border-color-primary);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-item:hover {
  border-color: var(--primary-color);
}

.file-item.selected {
  border-color: var(--primary-color);
  background: var(--bg-color-secondary);
}

.file-preview {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--bg-color-secondary);
}

.file-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color-tertiary);
}

.file-info {
  padding: 8px;
  background: var(--bg-color-primary);
}

.file-name {
  display: block;
  font-size: 12px;
  color: var(--text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  display: block;
  font-size: 11px;
  color: var(--text-color-tertiary);
  margin-top: 2px;
}

.file-checkbox {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--primary-color);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color-primary);
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-outline {
  background-color: transparent;
  color: var(--text-color-secondary);
  border: 1px solid var(--border-color-primary);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--bg-color-secondary);
}

/* Upload Progress */
.upload-progress {
  margin-top: 20px;
  padding: 16px;
  background: var(--bg-color-secondary);
  border-radius: 8px;
}

.progress-bar {
  height: 8px;
  background: var(--bg-color-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: var(--text-color-secondary);
  text-align: center;
}

/* Upload History */
.upload-history {
  margin-top: 30px;
  background: var(--bg-color-primary);
  border-radius: 8px;
  padding: 24px;
  border: 1px solid var(--border-color-primary);
}

.upload-history h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-color-primary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-color-secondary);
  border-radius: 8px;
  font-size: 14px;
}

.history-item.success {
  border-left: 3px solid #67c23a;
}

.history-item.error {
  border-left: 3px solid #f56c6c;
}

.history-type {
  padding: 2px 8px;
  background: var(--bg-color-tertiary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.history-count {
  flex: 1;
  color: var(--text-color-primary);
}

.history-status {
  color: var(--text-color-secondary);
}

.history-time {
  color: var(--text-color-tertiary);
  font-size: 12px;
}

@media (max-width: 640px) {
  .batch-upload-management {
    padding: 16px;
  }

  .batch-upload-form {
    padding: 16px;
  }

  .type-selector {
    flex-direction: column;
  }

  .form-actions {
    flex-direction: column;
  }

  .form-actions .btn {
    width: 100%;
  }

  .file-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>
