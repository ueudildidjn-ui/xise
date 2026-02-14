<template>
  <div class="auth-modal-overlay" :class="{ animating: isAnimating }" @mousedown="handleClose">
    <div class="auth-modal" :class="{ 'scale-in': isAnimating }" @mousedown.stop>
      <button @click="handleClose" class="close-btn">
        <SvgIcon name="close" width="16" height="16" />
      </button>

      <div class="auth-content">
        <div class="auth-header">
          <h2 class="auth-title">申请认证</h2>
          <p class="auth-subtitle" v-if="showForm">选择认证类型并填写相关信息</p>
        </div>

        <!-- 加载状态 -->
        <div v-if="statusLoading" class="loading-container">
          <div class="loading-spinner"></div>
          <p>正在获取认证状态...</p>
        </div>

        <!-- 认证状态提示 -->
        <div v-else-if="hasVerification.hasPending || hasVerification.hasApproved || hasVerification.hasRejected"
          class="verification-status">
          <!-- 已通过认证 - 显示详细认证信息 -->
          <template v-if="hasVerification.hasApproved">
            <div class="cert-info">
              <div class="cert-info-header">
                <VerifiedBadge :verified="hasVerification.approvedType" size="large" />
                <span class="cert-type-text">{{ hasVerification.approvedType === 1 ? '官方认证' : '个人认证' }}</span>
              </div>
              <div class="cert-info-item">
                <span class="cert-label">认证名称</span>
                <span class="cert-value">{{ hasVerification.verifiedName || '-' }}</span>
              </div>
              <div v-if="hasVerification.approvedTime" class="cert-info-item">
                <span class="cert-label">认证时间</span>
                <span class="cert-value">{{ formatTime(hasVerification.approvedTime) }}</span>
              </div>
            </div>
          </template>
          <!-- 审核中或已拒绝 -->
          <template v-else>
            <div class="status-icon">
              <SvgIcon v-if="hasVerification.hasPending" name="clock" width="48" height="48" />
              <SvgIcon v-else name="close" width="48" height="48" />
            </div>
            <p class="status-text">{{ hasVerification.statusText }}</p>
          </template>
        </div>

        <!-- 认证申请表单 -->
        <form v-else @submit.prevent="handleSubmitVerification" class="auth-form">
          <!-- 认证类型选择 -->
          <div class="form-group">
            <label class="form-label">认证类型</label>
            <div class="verification-types">
              <div class="verification-type" :class="{ active: form.type === 2 }" @click="selectVerificationType(2)">
                <div class="type-icon">
                  <VerifiedBadge :verified="2" size="large" />
                </div>
                <div class="type-content">
                  <div class="type-title">个人认证</div>
                  <div class="type-desc">适用于个人用户</div>
                </div>
              </div>

              <div class="verification-type" :class="{ active: form.type === 1 }" @click="selectVerificationType(1)">
                <div class="type-icon">
                  <VerifiedBadge :verified="1" size="large" />
                </div>
                <div class="type-content">
                  <div class="type-title">官方认证</div>
                  <div class="type-desc">适用于机构、企业等</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 个人认证表单 -->
          <div v-if="form.type === 2" class="verification-form">
            <div class="form-group">
              <label class="form-label">认证名称</label>
              <input v-model="form.verifiedName" type="text" class="form-input" placeholder="请输入认证名称，如：某某博主"
                :disabled="loading" />
            </div>

            <template v-if="collectSensitiveInfo">
              <div class="form-group">
                <label class="form-label">真实姓名</label>
                <input v-model="form.personalInfo.realName" type="text" class="form-input" placeholder="请输入真实姓名"
                  :disabled="loading" />
              </div>

              <div class="form-group">
                <label class="form-label">身份证号</label>
                <input v-model="form.personalInfo.idCard" type="text" class="form-input" placeholder="请输入身份证号"
                  :disabled="loading" />
              </div>

              <div class="form-group">
                <label class="form-label">职业/身份</label>
                <input v-model="form.personalInfo.occupation" type="text" class="form-input" placeholder="请输入职业或身份描述"
                  :disabled="loading" />
              </div>
            </template>

            <div class="form-group">
              <label class="form-label">认证详情</label>
              <ContentEditableInput v-model="form.personalInfo.reason" :input-class="'form-textarea'"
                placeholder="请简述申请个人认证的理由和详细说明" :max-length="500" />
            </div>

            <div class="form-group">
              <label class="form-label">上传佐证图片</label>
              <div class="image-upload-area">
                <div v-for="(img, index) in form.images" :key="index" class="upload-preview">
                  <img :src="img" alt="佐证图片" />
                  <button type="button" class="remove-image-btn" @click="removeImage(index)">
                    <SvgIcon name="close" width="12" height="12" />
                  </button>
                </div>
                <label v-if="form.images.length < 3" class="upload-trigger" :class="{ disabled: loading }">
                  <input type="file" accept="image/*" @change="handleImageUpload" :disabled="loading" hidden />
                  <SvgIcon name="add" width="24" height="24" />
                  <span>上传图片</span>
                </label>
              </div>
              <p class="form-hint">最多上传3张图片作为认证佐证</p>
            </div>
          </div>

          <!-- 官方认证表单 -->
          <div v-if="form.type === 1" class="verification-form">
            <div class="form-group">
              <label class="form-label">认证名称</label>
              <input v-model="form.verifiedName" type="text" class="form-input" placeholder="请输入认证名称，如：某某官方"
                :disabled="loading" />
            </div>

            <template v-if="collectSensitiveInfo">
              <div class="form-group">
                <label class="form-label">机构/企业名称</label>
                <input v-model="form.officialInfo.organizationName" type="text" class="form-input"
                  placeholder="请输入机构或企业全称" :disabled="loading" />
              </div>

              <div class="form-group">
                <label class="form-label">统一社会信用代码</label>
                <input v-model="form.officialInfo.creditCode" type="text" class="form-input" placeholder="请输入统一社会信用代码"
                  :disabled="loading" />
              </div>

              <div class="form-group">
                <label class="form-label">联系人姓名</label>
                <input v-model="form.officialInfo.contactName" type="text" class="form-input" placeholder="请输入联系人姓名"
                  :disabled="loading" />
              </div>

              <div class="form-group">
                <label class="form-label">联系电话</label>
                <input v-model="form.officialInfo.contactPhone" type="tel" class="form-input" placeholder="请输入联系电话"
                  :disabled="loading" />
              </div>
            </template>

            <div class="form-group">
              <label class="form-label">认证详情</label>
              <ContentEditableInput v-model="form.officialInfo.reason" :input-class="'form-textarea'"
                placeholder="请简述申请官方认证的理由和详细说明" :max-length="500" />
            </div>

            <div class="form-group">
              <label class="form-label">上传佐证图片</label>
              <div class="image-upload-area">
                <div v-for="(img, index) in form.images" :key="index" class="upload-preview">
                  <img :src="img" alt="佐证图片" />
                  <button type="button" class="remove-image-btn" @click="removeImage(index)">
                    <SvgIcon name="close" width="12" height="12" />
                  </button>
                </div>
                <label v-if="form.images.length < 3" class="upload-trigger" :class="{ disabled: loading }">
                  <input type="file" accept="image/*" @change="handleImageUpload" :disabled="loading" hidden />
                  <SvgIcon name="add" width="24" height="24" />
                  <span>上传图片</span>
                </label>
              </div>
              <p class="form-hint">最多上传3张图片作为认证佐证</p>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="loading || !form.type">
              <span v-if="loading" class="loading-spinner"></span>
              {{ loading ? '提交中...' : '提交申请' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, inject, onMounted, computed } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import VerifiedBadge from '@/components/VerifiedBadge.vue'
import ContentEditableInput from '@/components/ContentEditableInput.vue'
import { useScrollLock } from '@/composables/useScrollLock'
import { useUserStore } from '@/stores/user'

const emit = defineEmits(['close'])

// 注入消息管理器
const $message = inject('$message')

// 滚动锁定
const { lock, unlock } = useScrollLock()

// 用户信息
const userStore = useUserStore()

// 动画状态
const isAnimating = ref(false)

// 是否收集敏感信息（从后端配置获取）
const collectSensitiveInfo = ref(false)

// 表单数据
const form = reactive({
  type: null, // 1-官方认证，2-个人认证
  verifiedName: '',
  images: [],
  personalInfo: {
    realName: '',
    idCard: '',
    occupation: '',
    reason: ''
  },
  officialInfo: {
    organizationName: '',
    creditCode: '',
    contactName: '',
    contactPhone: '',
    reason: ''
  }
})

// 加载状态
const loading = ref(false)

// 认证状态
const verificationStatus = ref(null)
const statusLoading = ref(true)

// 计算认证状态
const hasVerification = computed(() => {
  if (!verificationStatus.value || verificationStatus.value.length === 0) {
    return { hasPending: false, hasApproved: false, hasRejected: false, statusText: '' }
  }

  const pendingAudit = verificationStatus.value.find(audit => audit.status === 0)
  const approvedAudit = verificationStatus.value.find(audit => audit.status === 1)
  const rejectedAudit = verificationStatus.value.find(audit => audit.status === 2)

  if (approvedAudit) {
    const typeText = approvedAudit.type === 1 ? '官方认证' : '个人认证'
    const verifiedName = approvedAudit.audit_result?.verifiedName || ''
    return {
      hasPending: false,
      hasApproved: true,
      hasRejected: false,
      approvedType: approvedAudit.type,
      verifiedName: verifiedName,
      approvedTime: approvedAudit.audit_time,
      statusText: `您已通过${typeText}`
    }
  }

  if (rejectedAudit) {
    const typeText = rejectedAudit.type === 1 ? '官方认证' : '个人认证'
    return {
      hasPending: false,
      hasApproved: false,
      hasRejected: true,
      statusText: `您的${typeText}申请已被拒绝，如有疑问请联系管理员`
    }
  }

  if (pendingAudit) {
    const typeText = pendingAudit.type === 1 ? '官方认证' : '个人认证'
    return {
      hasPending: true,
      hasApproved: false,
      hasRejected: false,
      statusText: `您的${typeText}申请正在审核中，请耐心等待`
    }
  }

  return { hasPending: false, hasApproved: false, hasRejected: false, statusText: '' }
})

// 是否显示表单
const showForm = computed(() => {
  return !statusLoading.value && !hasVerification.value.hasPending && !hasVerification.value.hasApproved && !hasVerification.value.hasRejected
})

// 获取认证状态
const fetchVerificationStatus = async () => {
  try {
    statusLoading.value = true
    const response = await fetch('/api/users/verification/status', {
      headers: {
        'Authorization': `Bearer ${userStore.token}`
      }
    })
    const result = await response.json()

    if (result.code === 200) {
      verificationStatus.value = result.data
    }
  } catch (error) {
    console.error('获取认证状态失败:', error)
  } finally {
    statusLoading.value = false
  }
}

// 获取认证配置
const fetchVerificationConfig = async () => {
  try {
    const response = await fetch('/api/auth/auth-config')
    const result = await response.json()
    if (result.code === 200 && result.data) {
      collectSensitiveInfo.value = result.data.verificationCollectSensitiveInfo || false
    }
  } catch (error) {
    console.error('获取认证配置失败:', error)
  }
}

// 组件挂载时启动动画并获取认证状态
onMounted(() => {
  lock()
  fetchVerificationStatus()
  fetchVerificationConfig()
  setTimeout(() => {
    isAnimating.value = true
  }, 10)
})

// 关闭模态框
const handleClose = () => {
  if (loading.value) return
  isAnimating.value = false
  unlock()
  setTimeout(() => {
    emit('close')
  }, 200)
}

// 格式化时间
const formatTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 选择认证类型
const selectVerificationType = (type) => {
  form.type = type
}

// 图片上传处理
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  event.target.value = ''

  if (form.images.length >= 3) {
    $message.error('最多上传3张图片')
    return
  }

  if (!file.type.startsWith('image/')) {
    $message.error('请上传图片文件')
    return
  }

  if (file.size > MAX_IMAGE_SIZE) {
    $message.error('图片大小不能超过10MB')
    return
  }

  try {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target.result
      if (typeof result === 'string' && result.startsWith('data:image/')) {
        form.images.push(result)
      } else {
        $message.error('无效的图片格式')
      }
    }
    reader.readAsDataURL(file)
  } catch (error) {
    console.error('图片上传失败:', error)
    $message.error('图片上传失败')
  }
}

// 移除图片
const removeImage = (index) => {
  form.images.splice(index, 1)
}

// 生成认证内容HTML
const generateContentHtml = () => {
  const imagesHtml = form.images.length > 0
    ? `<tr><td style="font-weight: bold;">佐证图片</td><td>${form.images.map(img => `<img src="${img}" style="max-width: 200px; max-height: 200px; margin: 4px;" />`).join('')}</td></tr>`
    : ''

  if (form.type === 2) {
    // 个人认证
    const sensitiveRows = collectSensitiveInfo.value ? `
        <tr>
          <td style=" font-weight: bold;">真实姓名</td>
          <td>${form.personalInfo.realName}</td>
        </tr>
        <tr>
          <td style=" font-weight: bold;">身份证号</td>
          <td>${form.personalInfo.idCard}</td>
        </tr>
        <tr>
          <td style=" font-weight: bold;">职业/身份</td>
          <td>${form.personalInfo.occupation}</td>
        </tr>` : ''
    return `
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
        <caption style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">个人认证申请</caption>
        <tr>
          <td style=" font-weight: bold; width: 30%;">认证名称</td>
          <td>${form.verifiedName}</td>
        </tr>
        ${sensitiveRows}
        <tr>
          <td style=" font-weight: bold;">认证详情</td>
          <td>${form.personalInfo.reason}</td>
        </tr>
        ${imagesHtml}
      </table>
    `
  } else if (form.type === 1) {
    // 官方认证
    const sensitiveRows = collectSensitiveInfo.value ? `
        <tr>
          <td style=" font-weight: bold;">机构/企业名称</td>
          <td>${form.officialInfo.organizationName}</td>
        </tr>
        <tr>
          <td style=" font-weight: bold;">统一社会信用代码</td>
          <td>${form.officialInfo.creditCode}</td>
        </tr>
        <tr>
          <td style=" font-weight: bold;">联系人姓名</td>
          <td>${form.officialInfo.contactName}</td>
        </tr>
        <tr>
          <td style=" font-weight: bold;">联系电话</td>
          <td>${form.officialInfo.contactPhone}</td>
        </tr>` : ''
    return `
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
        <caption style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">官方认证申请</caption>
        <tr>
          <td style=" font-weight: bold; width: 30%;">认证名称</td>
          <td>${form.verifiedName}</td>
        </tr>
        ${sensitiveRows}
        <tr>
          <td style=" font-weight: bold;">认证详情</td>
          <td>${form.officialInfo.reason}</td>
        </tr>
        ${imagesHtml}
      </table>
    `
  }
  return ''
}

// 提交认证申请
const handleSubmitVerification = async () => {
  // 基础验证
  if (!form.type) {
    $message.error('请选择认证类型')
    return
  }

  // 公共字段验证
  if (!form.verifiedName) {
    $message.error('请输入认证名称')
    return
  }

  if (form.type === 2) {
    // 个人认证验证
    if (collectSensitiveInfo.value) {
      if (!form.personalInfo.realName) {
        $message.error('请输入真实姓名')
        return
      }
      if (!form.personalInfo.idCard) {
        $message.error('请输入身份证号')
        return
      }
      if (!form.personalInfo.occupation) {
        $message.error('请输入职业或身份')
        return
      }
    }
    if (!form.personalInfo.reason) {
      $message.error('请输入认证详情')
      return
    }
  } else if (form.type === 1) {
    // 官方认证验证
    if (collectSensitiveInfo.value) {
      if (!form.officialInfo.organizationName) {
        $message.error('请输入机构或企业名称')
        return
      }
      if (!form.officialInfo.creditCode) {
        $message.error('请输入统一社会信用代码')
        return
      }
      if (!form.officialInfo.contactName) {
        $message.error('请输入联系人姓名')
        return
      }
      if (!form.officialInfo.contactPhone) {
        $message.error('请输入联系电话')
        return
      }
    }
    if (!form.officialInfo.reason) {
      $message.error('请输入认证详情')
      return
    }
  }

  loading.value = true

  try {
    const contentHtml = generateContentHtml()

    const response = await fetch('/api/users/verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.token}`
      },
      body: JSON.stringify({
        type: form.type,
        content: contentHtml,
        verifiedName: form.verifiedName
      })
    })

    const result = await response.json()

    if (result.code === 200 || result.success) {
      $message.success('认证申请提交成功，请耐心等待审核')

      // 重置表单
      form.type = null
      form.verifiedName = ''
      form.images = []
      form.personalInfo = {
        realName: '',
        idCard: '',
        occupation: '',
        reason: ''
      }
      form.officialInfo = {
        organizationName: '',
        creditCode: '',
        contactName: '',
        contactPhone: '',
        reason: ''
      }

      // 重新获取认证状态，显示认证状态和撤回按钮
      await fetchVerificationStatus()
    } else {
      $message.error(result.message || '提交失败，请重试')
    }
  } catch (error) {
    console.error('提交认证申请失败:', error)
    $message.error('网络错误，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  opacity: 0;
  transition: opacity 0.2s ease;
  width: 100vw;
  height: 100%;
}

.auth-modal-overlay.animating {
  opacity: 1;
}

.auth-modal {
  background: var(--bg-color-primary);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  transform: scale(0.9);
  transition: transform 0.2s ease;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.auth-modal.scale-in {
  transform: scale(1);
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

.auth-content {
  padding: 32px;
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin: 0 0 8px 0;
}

.auth-subtitle {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin: 0;
}

.auth-form {
  display: flex;
  flex-direction: column;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
  color: var(--text-color-primary);
  font-size: 15px;
}

.verification-types {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.verification-type {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid var(--border-color-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-color-primary);
}

.verification-type:hover {
  border-color: var(--primary-color);
  background: var(--bg-color-secondary);
}

.verification-type.active {
  border-color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.05);
}

.type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.type-content {
  flex: 1;
}

.type-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 4px;
}

.type-desc {
  font-size: 14px;
  color: var(--text-color-secondary);
}

.verification-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  background-color: var(--bg-color-primary);
  color: var(--text-color-primary);
  caret-color: var(--primary-color);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.form-input:focus {
  border-color: var(--primary-color);
  outline: none;
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-input::placeholder {
  color: var(--text-color-tertiary);
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  background-color: var(--bg-color-primary);
  color: var(--text-color-primary);
  caret-color: var(--primary-color);
  transition: background-color 0.2s ease, border-color 0.2s ease;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.form-textarea:focus {
  border-color: var(--primary-color);
  outline: none;
}

.form-textarea:empty::before {
  color: var(--text-color-tertiary);
}

/* 图片上传样式 */
.image-upload-area {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.upload-preview {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color-primary);
}

.upload-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.upload-trigger {
  width: 80px;
  height: 80px;
  border: 2px dashed var(--border-color-primary);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-color-tertiary);
  gap: 4px;
}

.upload-trigger:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.upload-trigger.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-trigger span {
  font-size: 11px;
}

.form-hint {
  font-size: 12px;
  color: var(--text-color-tertiary);
  margin: 4px 0 0 0;
}

/* 加载状态样式 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.loading-container p {
  margin-top: 16px;
  color: var(--text-color-secondary);
  font-size: 14px;
}

/* 认证状态提示样式 */
.verification-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  text-align: center;
}

.status-icon {
  margin-bottom: 20px;
  color: var(--primary-color);
}

.cert-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cert-info-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.cert-type-text {
  color: var(--text-color-primary);
}

.cert-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-color-secondary);
  border-radius: 8px;
}

.cert-label {
  font-size: 14px;
  color: var(--text-color-secondary);
}

.cert-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.status-text {
  font-size: 16px;
  color: var(--text-color-secondary);
  text-align: center;
  margin: 0 0 16px 0;
}

.form-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-textarea::placeholder {
  color: var(--text-color-tertiary);
}

.form-actions {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.submit-btn {
  width: 100%;
  max-width: 200px;
  padding: 14px 24px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
}

.submit-btn:hover {
  background: var(--primary-color-dark);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .auth-content {
    padding: 24px;
  }

  .auth-title {
    font-size: 20px;
  }

  .verification-form {
    padding: 16px;
  }
}
</style>