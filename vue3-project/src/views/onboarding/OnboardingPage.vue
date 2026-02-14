<template>
  <div class="onboarding-page">
    <div class="onboarding-container">
      <!-- 步骤指示器 -->
      <div class="step-indicator">
        <div v-for="i in totalSteps" :key="i" class="step-dot" :class="{ active: currentStep >= i, done: currentStep > i }"></div>
      </div>

      <!-- 步骤1：选择性别 -->
      <div v-if="currentStep === 1" class="step-content">
        <h2 class="step-title">选择你的性别</h2>
        <p class="step-desc">仅用于个性化推荐</p>
        <div class="gender-options">
          <div class="gender-option" :class="{ selected: form.gender === '男' }" @click="form.gender = '男'">
            <SvgIcon name="male" width="32" height="32" />
            <span>男</span>
          </div>
          <div class="gender-option" :class="{ selected: form.gender === '女' }" @click="form.gender = '女'">
            <SvgIcon name="female" width="32" height="32" />
            <span>女</span>
          </div>
        </div>
      </div>

      <!-- 步骤2：填写生日 -->
      <div v-if="currentStep === 2" class="step-content">
        <h2 class="step-title">填写你的生日</h2>
        <p class="step-desc">仅用于个性化推荐，可在隐私设置中管理公开状态</p>
        <div class="birthday-input">
          <input type="date" v-model="form.birthday" :max="todayStr" class="date-picker" />
        </div>
        <div v-if="form.birthday" class="birthday-preview">
          <span class="preview-item">{{ computedAge }}岁</span>
          <span class="preview-item">{{ computedZodiac }}</span>
        </div>
      </div>

      <!-- 步骤3：选择兴趣爱好 -->
      <div v-if="currentStep === 3" class="step-content">
        <h2 class="step-title">选择你的兴趣爱好</h2>
        <p class="step-desc">仅用于个性化推荐，可通过隐私设置进行管理</p>
        <div class="interests-grid">
          <div v-for="interest in interestOptions" :key="interest" class="interest-tag"
            :class="{ selected: form.interests.includes(interest) }" @click="toggleInterest(interest)">
            {{ interest }}
          </div>
        </div>
      </div>

      <!-- 步骤4：自定义字段（如果有配置） -->
      <div v-if="currentStep === 4 && customFieldDefs.length > 0" class="step-content">
        <h2 class="step-title">完善个人信息</h2>
        <p class="step-desc">填写更多个人信息，帮助我们更好地了解你</p>
        <div class="custom-fields-form">
          <div v-for="field in customFieldDefs" :key="field.name" class="custom-field-group">
            <label class="custom-field-label">{{ field.name }}</label>
            <select v-if="field.type === 'select'" v-model="form.customFields[field.name]" class="custom-field-select" :aria-label="field.name">
              <option value="">请选择</option>
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <input v-else v-model="form.customFields[field.name]" type="text" :placeholder="'请输入' + field.name" maxlength="50" class="custom-field-input" />
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="step-actions">
        <button v-if="currentStep > 1" class="btn-secondary" @click="prevStep">上一步</button>
        <button v-if="currentStep < totalSteps" class="btn-primary" @click="nextStep">下一步</button>
        <button v-if="currentStep === totalSteps" class="btn-primary" :disabled="isSubmitting" @click="handleSubmit">
          {{ isSubmitting ? '保存中...' : '完成' }}
        </button>
      </div>

      <button v-if="allowSkip" class="skip-btn" @click="handleSkip">跳过</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { userApi } from '@/api/index.js'
import SvgIcon from '@/components/SvgIcon.vue'

const router = useRouter()
const userStore = useUserStore()

const currentStep = ref(1)
const isSubmitting = ref(false)

const form = ref({
  gender: '',
  birthday: '',
  interests: [],
  customFields: {}
})

const defaultInterestOptions = [
  '美食', '旅行', '摄影', '音乐', '电影',
  '阅读', '运动', '游戏', '绘画', '舞蹈',
  '编程', '设计', '时尚', '美妆', '宠物',
  '动漫', '手工', '健身', '科技', '数码'
]

const interestOptions = ref([...defaultInterestOptions])
const customFieldDefs = ref([])
const allowSkip = ref(true)

const totalSteps = computed(() => {
  return customFieldDefs.value.length > 0 ? 4 : 3
})

// 保存草稿到 Redis（防抖）
let saveDraftTimer = null
const saveDraft = () => {
  clearTimeout(saveDraftTimer)
  saveDraftTimer = setTimeout(async () => {
    try {
      await userApi.saveOnboardingDraft({
        currentStep: currentStep.value,
        gender: form.value.gender,
        birthday: form.value.birthday,
        interests: form.value.interests,
        customFields: form.value.customFields
      })
    } catch (error) {
      // 草稿保存失败不影响用户操作
    }
  }, 500)
}

// 监听表单和步骤变化，自动保存草稿
watch([currentStep, () => form.value.gender, () => form.value.birthday, () => form.value.interests, () => form.value.customFields], saveDraft, { deep: true })

// 从后台加载草稿
const loadDraft = async () => {
  try {
    const response = await userApi.getOnboardingDraft()
    if ((response.success || response.code === 200) && response.data) {
      const draft = response.data
      if (draft.gender) form.value.gender = draft.gender
      if (draft.birthday) form.value.birthday = draft.birthday
      if (Array.isArray(draft.interests) && draft.interests.length > 0) {
        form.value.interests = draft.interests
      }
      if (draft.customFields && typeof draft.customFields === 'object') {
        form.value.customFields = draft.customFields
      }
      if (draft.currentStep && draft.currentStep >= 1 && draft.currentStep <= totalSteps.value) {
        currentStep.value = draft.currentStep
      }
    }
  } catch (error) {
    // 加载草稿失败不影响用户操作
  }
}

// 从后台加载兴趣选项配置
const loadInterestOptions = async () => {
  try {
    const response = await userApi.getOnboardingConfig()
    if (response.success || response.code === 200) {
      const options = response.data?.interest_options
      if (Array.isArray(options) && options.length > 0) {
        interestOptions.value = options
      }
      const fields = response.data?.custom_fields
      if (Array.isArray(fields) && fields.length > 0) {
        customFieldDefs.value = fields
      }
      if (response.data?.allow_skip !== undefined) {
        allowSkip.value = response.data.allow_skip
      }
    }
  } catch (error) {
    console.warn('加载兴趣选项配置失败，使用默认选项:', error)
  }
}

onMounted(async () => {
  await loadInterestOptions()
  await loadDraft()
})

const todayStr = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const computedAge = computed(() => {
  if (!form.value.birthday) return ''
  const birth = new Date(form.value.birthday)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return age
})

const computedZodiac = computed(() => {
  if (!form.value.birthday) return ''
  const birth = new Date(form.value.birthday)
  const month = birth.getMonth() + 1
  const day = birth.getDate()
  const zodiacSigns = [
    { sign: '摩羯座', start: [1, 1], end: [1, 19] },
    { sign: '水瓶座', start: [1, 20], end: [2, 18] },
    { sign: '双鱼座', start: [2, 19], end: [3, 20] },
    { sign: '白羊座', start: [3, 21], end: [4, 19] },
    { sign: '金牛座', start: [4, 20], end: [5, 20] },
    { sign: '双子座', start: [5, 21], end: [6, 21] },
    { sign: '巨蟹座', start: [6, 22], end: [7, 22] },
    { sign: '狮子座', start: [7, 23], end: [8, 22] },
    { sign: '处女座', start: [8, 23], end: [9, 22] },
    { sign: '天秤座', start: [9, 23], end: [10, 23] },
    { sign: '天蝎座', start: [10, 24], end: [11, 22] },
    { sign: '射手座', start: [11, 23], end: [12, 21] },
    { sign: '摩羯座', start: [12, 22], end: [12, 31] }
  ]
  const found = zodiacSigns.find(z => {
    const afterStart = month > z.start[0] || (month === z.start[0] && day >= z.start[1])
    const beforeEnd = month < z.end[0] || (month === z.end[0] && day <= z.end[1])
    return afterStart && beforeEnd
  })
  return found ? found.sign : ''
})

const toggleInterest = (interest) => {
  const idx = form.value.interests.indexOf(interest)
  if (idx >= 0) {
    form.value.interests.splice(idx, 1)
  } else {
    form.value.interests.push(interest)
  }
}

const nextStep = () => {
  if (currentStep.value < totalSteps.value) currentStep.value++
}

const prevStep = () => {
  if (currentStep.value > 1) currentStep.value--
}

const handleSubmit = async () => {
  isSubmitting.value = true
  try {
    const data = {
      gender: form.value.gender || '',
      birthday: form.value.birthday || '',
      interests: form.value.interests.length > 0 ? form.value.interests : null,
      custom_fields: (() => {
        const cf = form.value.customFields
        const filtered = {}
        for (const [k, v] of Object.entries(cf)) {
          if (v && String(v).trim()) filtered[k] = String(v).trim()
        }
        return Object.keys(filtered).length > 0 ? filtered : undefined
      })()
    }
    const response = await userApi.submitOnboarding(data)
    if (response.success || response.code === 200) {
      userStore.updateUserInfo(response.data)
      router.replace('/explore')
    }
  } catch (error) {
    console.error('保存引导信息失败:', error)
  } finally {
    isSubmitting.value = false
  }
}

const handleSkip = async () => {
  isSubmitting.value = true
  try {
    const response = await userApi.submitOnboarding({})
    if (response.success || response.code === 200) {
      userStore.updateUserInfo(response.data)
    }
  } catch (error) {
    console.error('跳过引导失败:', error)
  } finally {
    isSubmitting.value = false
    router.replace('/explore')
  }
}
</script>

<style scoped>
.onboarding-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color-primary);
  padding: 20px;
}

.onboarding-container {
  width: 100%;
  max-width: 480px;
  text-align: center;
}

.step-indicator {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 32px;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-color-primary);
  transition: all 0.3s ease;
}

.step-dot.active {
  background: var(--primary-color);
  width: 24px;
  border-radius: 4px;
}

.step-dot.done {
  background: var(--primary-color);
}

.step-content {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin: 0 0 8px;
}

.step-desc {
  font-size: 14px;
  color: var(--text-color-tertiary);
  margin: 0 0 32px;
}

.gender-options {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.gender-option {
  width: 120px;
  height: 120px;
  border-radius: 16px;
  border: 2px solid var(--border-color-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-color-secondary);
  background: var(--bg-color-secondary);
}

.gender-option:hover {
  border-color: var(--primary-color);
}

.gender-option.selected {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  color: var(--primary-color);
}

.gender-option span {
  font-size: 16px;
  font-weight: 500;
}

.birthday-input {
  width: 100%;
  max-width: 300px;
}

.date-picker {
  width: 100%;
  height: 48px;
  border: 2px solid var(--border-color-primary);
  border-radius: 12px;
  padding: 0 16px;
  font-size: 16px;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}

.date-picker:focus {
  border-color: var(--primary-color);
}

.birthday-preview {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.preview-item {
  padding: 6px 14px;
  background: var(--bg-color-secondary);
  border-radius: 20px;
  font-size: 14px;
  color: var(--text-color-secondary);
  border: 1px solid var(--border-color-primary);
}

.interests-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  max-width: 400px;
}

.interest-tag {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--border-color-primary);
  background: var(--bg-color-secondary);
  color: var(--text-color-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.interest-tag:hover {
  border-color: var(--primary-color);
}

.interest-tag.selected {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  color: var(--primary-color);
}

.step-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}

.btn-primary,
.btn-secondary {
  height: 44px;
  padding: 0 32px;
  border-radius: 22px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--primary-color);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-color-secondary);
  color: var(--text-color-secondary);
  border: 1px solid var(--border-color-primary);
}

.btn-secondary:hover {
  background: var(--bg-color-tertiary, var(--bg-color-secondary));
}

.skip-btn {
  margin-top: 16px;
  background: none;
  border: none;
  color: var(--text-color-tertiary);
  font-size: 14px;
  cursor: pointer;
  padding: 8px 16px;
}

.skip-btn:hover {
  color: var(--text-color-secondary);
}

/* 自定义字段表单 */
.custom-fields-form {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.custom-field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.custom-field-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.custom-field-select,
.custom-field-input {
  width: 100%;
  height: 44px;
  border: 2px solid var(--border-color-primary);
  border-radius: 12px;
  padding: 0 16px;
  font-size: 15px;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}

.custom-field-select:focus,
.custom-field-input:focus {
  border-color: var(--primary-color);
}
</style>
