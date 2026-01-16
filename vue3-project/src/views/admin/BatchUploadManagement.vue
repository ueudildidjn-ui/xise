<template>
  <div class="batch-upload-management">
    <div class="batch-upload-header">
      <h2>批量上传笔记</h2>
      <p class="description">可批量上传图片或视频发布笔记，标题和内容为可选字段</p>
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
          <button :class="['type-btn', { active: formData.type === 1 }]" @click="formData.type = 1">
            <SvgIcon name="post" width="20" height="20" />
            图文笔记
          </button>
          <button :class="['type-btn', { active: formData.type === 2 }]" @click="formData.type = 2">
            <SvgIcon name="video" width="20" height="20" />
            视频笔记
          </button>
        </div>
      </div>

      <div class="form-section">
        <label class="form-label">标题（可选）</label>
        <input v-model="formData.title" type="text" class="form-input" placeholder="请输入笔记标题" />
      </div>

      <div class="form-section">
        <label class="form-label">内容（可选）</label>
        <textarea v-model="formData.content" class="form-textarea" placeholder="请输入笔记内容" rows="4"></textarea>
      </div>

      <div class="form-section">
        <label class="form-label">标签（可选）</label>
        <TagSelector v-model="formData.tags" :max-tags="10" />
      </div>

      <div class="form-section" v-if="formData.type === 1">
        <label class="form-label">批量上传图片 <span class="required">*</span></label>
        <MultiImageUpload ref="multiImageUploadRef" v-model="uploadedImages" :max-images="9"
          @update:model-value="handleImagesChange" />
        <p class="upload-hint">最多可上传9张图片，支持JPG、PNG、GIF、WebP格式</p>
      </div>

      <div class="form-section" v-if="formData.type === 2">
        <label class="form-label">上传视频 <span class="required">*</span></label>
        <VideoUpload ref="videoUploadRef" v-model="formData.video" @update:model-value="handleVideoChange"
          @error="handleVideoError" />
        <p class="upload-hint">支持MP4、MOV、AVI、WMV、FLV格式</p>
      </div>

      <div class="form-section">
        <label class="form-label checkbox-label">
          <input type="checkbox" v-model="formData.is_draft" />
          保存为草稿
        </label>
      </div>

      <div class="form-actions">
        <button class="btn btn-outline" @click="resetForm" :disabled="isSubmitting">
          重置
        </button>
        <button class="btn btn-primary" @click="handleSubmit" :disabled="!canSubmit || isSubmitting">
          {{ getSubmitButtonText() }}
        </button>
      </div>
    </div>

    <div v-if="uploadHistory.length > 0" class="upload-history">
      <h3>上传历史</h3>
      <div class="history-list">
        <div v-for="(item, index) in uploadHistory" :key="index" class="history-item"
          :class="{ success: item.success, error: !item.success }">
          <span class="history-type">{{ item.type === 1 ? '图文' : '视频' }}</span>
          <span class="history-title">{{ item.title || '无标题' }}</span>
          <span class="history-status">{{ item.success ? '成功' : '失败' }}</span>
          <span class="history-time">{{ formatTime(item.time) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import TagSelector from '@/components/TagSelector.vue'
import MultiImageUpload from '@/components/MultiImageUpload.vue'
import VideoUpload from '@/components/VideoUpload.vue'
import messageManager from '@/utils/messageManager'
import apiConfig from '@/config/api.js'

const multiImageUploadRef = ref(null)
const videoUploadRef = ref(null)

const formData = reactive({
  user_id: null,
  type: 1,
  title: '',
  content: '',
  tags: [],
  video: null,
  is_draft: false
})

const uploadedImages = ref([])
const isSubmitting = ref(false)
const isUploadingMedia = ref(false)
const uploadHistory = ref([])

// Check if form can be submitted
const canSubmit = computed(() => {
  if (!formData.user_id) return false

  if (formData.type === 1) {
    // For image posts, need at least one image
    return uploadedImages.value.length > 0
  } else {
    // For video posts, need a video
    return formData.video && (formData.video.file || formData.video.url)
  }
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

// Handle images change
const handleImagesChange = (images) => {
  uploadedImages.value = images
}

// Handle video change
const handleVideoChange = (video) => {
  formData.video = video
}

// Handle video error
const handleVideoError = (error) => {
  messageManager.error(error)
}

// Get submit button text
const getSubmitButtonText = () => {
  if (isSubmitting.value) {
    return isUploadingMedia.value ? '上传中...' : '发布中...'
  }

  // Check if there are files to upload
  if (formData.type === 1) {
    const hasNewImages = uploadedImages.value.some(img => img.file && !img.uploaded)
    if (hasNewImages) return '上传并发布'
  } else if (formData.type === 2) {
    if (formData.video && formData.video.file && !formData.video.uploaded) {
      return '上传并发布'
    }
  }

  return '发布笔记'
}

// Format time
const formatTime = (time) => {
  return new Date(time).toLocaleString('zh-CN')
}

// Reset form
const resetForm = () => {
  formData.user_id = null
  formData.type = 1
  formData.title = ''
  formData.content = ''
  formData.tags = []
  formData.video = null
  formData.is_draft = false
  uploadedImages.value = []

  if (multiImageUploadRef.value && multiImageUploadRef.value.reset) {
    multiImageUploadRef.value.reset()
  }
}

// Handle submit
const handleSubmit = async () => {
  if (!canSubmit.value || isSubmitting.value) return

  isSubmitting.value = true

  try {
    let imageUrls = []
    let videoUrl = null
    let coverUrl = null

    // Upload media first
    if (formData.type === 1) {
      // Upload images
      const hasNewImages = uploadedImages.value.some(img => img.file && !img.uploaded)
      if (hasNewImages && multiImageUploadRef.value) {
        isUploadingMedia.value = true
        messageManager.info('正在上传图片...')

        try {
          imageUrls = await multiImageUploadRef.value.uploadAllImages()
          messageManager.success(`成功上传 ${imageUrls.length} 张图片`)
        } catch (error) {
          messageManager.error(`图片上传失败: ${error.message}`)
          throw error
        } finally {
          isUploadingMedia.value = false
        }
      } else {
        // Use already uploaded URLs
        imageUrls = uploadedImages.value
          .filter(img => img.uploaded && img.url)
          .map(img => img.url)
      }
    } else {
      // Upload video
      if (formData.video && formData.video.file && !formData.video.uploaded) {
        isUploadingMedia.value = true
        messageManager.info('正在上传视频...')

        try {
          const uploadResult = await videoUploadRef.value.startUpload()
          if (uploadResult && uploadResult.success) {
            videoUrl = uploadResult.data.url
            coverUrl = uploadResult.data.coverUrl || uploadResult.data.thumbnailUrl || ''
            messageManager.success('视频上传成功')
          } else {
            throw new Error('视频上传失败')
          }
        } catch (error) {
          messageManager.error(`视频上传失败: ${error.message}`)
          throw error
        } finally {
          isUploadingMedia.value = false
        }
      } else if (formData.video && formData.video.url) {
        // Use already uploaded video
        videoUrl = formData.video.url
        coverUrl = formData.video.coverUrl || ''
      }
    }

    // Create post
    const postData = {
      user_id: formData.user_id,
      type: formData.type,
      title: formData.title,
      content: formData.content,
      tags: formData.tags,
      is_draft: formData.is_draft
    }

    if (formData.type === 1) {
      postData.images = imageUrls
    } else {
      postData.video_url = videoUrl
      postData.cover_url = coverUrl
    }

    const response = await fetch(`${apiConfig.baseURL}/admin/posts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(postData)
    })

    const result = await response.json()

    if (result.code === 200) {
      messageManager.success('笔记发布成功')

      // Add to history
      uploadHistory.value.unshift({
        type: formData.type,
        title: formData.title,
        success: true,
        time: new Date()
      })

      // Reset form
      resetForm()
    } else {
      throw new Error(result.message || '发布失败')
    }
  } catch (error) {
    console.error('发布失败:', error)

    // Add to history
    uploadHistory.value.unshift({
      type: formData.type,
      title: formData.title,
      success: false,
      time: new Date()
    })
  } finally {
    isSubmitting.value = false
    isUploadingMedia.value = false
  }
}
</script>

<style scoped>
.batch-upload-management {
  padding: 20px 30px;
  max-width: 800px;
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

.form-input,
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
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
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

.upload-hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: var(--text-color-tertiary);
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

.history-title {
  flex: 1;
  color: var(--text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

  .history-item {
    flex-wrap: wrap;
  }

  .history-title {
    width: 100%;
    order: 1;
  }

  .history-time {
    order: 2;
  }
}
</style>
