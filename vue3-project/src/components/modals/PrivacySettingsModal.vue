<template>
  <div v-if="visible" class="modal-overlay" v-click-outside.mousedown="handleClose" v-escape-key="handleClose">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">隐私设置</h3>
        <button class="close-btn" @click="handleClose">
          <SvgIcon name="close" width="20" height="20" />
        </button>
      </div>

      <div class="modal-content">
        <p class="modal-desc">设置你的个人信息公开状态</p>

        <div class="privacy-options">
          <div class="privacy-item">
            <div class="item-info">
              <div class="item-title">公开生日</div>
              <div class="item-desc">其他用户可以看到你的生日</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.privacy_birthday" @change="handleSettingChange" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="privacy-item">
            <div class="item-info">
              <div class="item-title">公开年龄</div>
              <div class="item-desc">其他用户可以看到你的年龄</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.privacy_age" @change="handleSettingChange" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="privacy-item">
            <div class="item-info">
              <div class="item-title">公开星座</div>
              <div class="item-desc">其他用户可以看到你的星座</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.privacy_zodiac" @change="handleSettingChange" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="privacy-item">
            <div class="item-info">
              <div class="item-title">公开MBTI人格</div>
              <div class="item-desc">其他用户可以看到你的MBTI人格类型</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.privacy_mbti" @change="handleSettingChange" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- 动态自定义字段隐私设置 -->
          <div v-for="field in customFieldDefs" :key="field.name" class="privacy-item">
            <div class="item-info">
              <div class="item-title">公开{{ field.name }}</div>
              <div class="item-desc">其他用户可以看到你的{{ field.name }}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" :checked="getCustomFieldPrivacy(field.name)" @change="toggleCustomFieldPrivacy(field.name, $event)" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div v-if="saveMessage" class="save-message" :class="{ error: saveError }">
          {{ saveMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useScrollLock } from '@/composables/useScrollLock'
import { userApi } from '@/api/index.js'
import SvgIcon from '@/components/SvgIcon.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'close'])

const { lock, unlock } = useScrollLock()

const settings = ref({
  privacy_birthday: true,
  privacy_age: true,
  privacy_zodiac: true,
  privacy_mbti: true,
  privacy_custom_fields: {}
})

const customFieldDefs = ref([])

const saveMessage = ref('')
const saveError = ref(false)
let saveTimer = null

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

const loadCustomFieldDefs = async () => {
  try {
    const response = await userApi.getOnboardingConfig()
    if (response.success || response.code === 200) {
      const fields = response.data?.custom_fields
      if (Array.isArray(fields) && fields.length > 0) {
        customFieldDefs.value = fields
      }
    }
  } catch (error) {
    console.warn('加载自定义字段配置失败:', error)
  }
}

const fetchSettings = async () => {
  try {
    const response = await userApi.getPrivacySettings()
    if (response.success || response.data) {
      settings.value = { ...settings.value, ...response.data }
      if (!settings.value.privacy_custom_fields) {
        settings.value.privacy_custom_fields = {}
      }
    }
  } catch (error) {
    console.error('获取隐私设置失败:', error)
  }
}

const getCustomFieldPrivacy = (fieldName) => {
  const pcf = settings.value.privacy_custom_fields
  return pcf && pcf[fieldName] !== undefined ? pcf[fieldName] : true
}

const toggleCustomFieldPrivacy = (fieldName, event) => {
  if (!settings.value.privacy_custom_fields) {
    settings.value.privacy_custom_fields = {}
  }
  settings.value.privacy_custom_fields[fieldName] = event.target.checked
  handleSettingChange()
}

const handleSettingChange = async () => {
  try {
    const response = await userApi.updatePrivacySettings(settings.value)
    if (response.success || response.code === 200) {
      saveMessage.value = '设置已保存'
      saveError.value = false
    } else {
      saveMessage.value = '保存失败'
      saveError.value = true
    }
  } catch (error) {
    console.error('更新隐私设置失败:', error)
    saveMessage.value = '保存失败'
    saveError.value = true
  }

  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveMessage.value = ''
  }, 2000)
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    lock()
    fetchSettings()
    loadCustomFieldDefs()
  } else {
    unlock()
    saveMessage.value = ''
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.modal-container {
  background: var(--bg-color-primary);
  border-radius: 16px;
  width: 90%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-color-secondary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-color-secondary);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--bg-color-tertiary, var(--bg-color-secondary));
}

.modal-content {
  padding: 16px 24px 24px;
}

.modal-desc {
  font-size: 13px;
  color: var(--text-color-tertiary);
  margin: 0 0 20px;
}

.privacy-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.privacy-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-color-primary);
}

.privacy-item:last-child {
  border-bottom: none;
}

.item-info {
  flex: 1;
  margin-right: 12px;
}

.item-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.item-desc {
  font-size: 12px;
  color: var(--text-color-tertiary);
  margin-top: 2px;
}

/* Toggle switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-color-primary);
  border-radius: 24px;
  transition: 0.3s;
}

.toggle-slider::before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--primary-color);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.save-message {
  margin-top: 16px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  text-align: center;
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  color: var(--primary-color);
}

.save-message.error {
  background: color-mix(in srgb, #ff4757 10%, transparent);
  color: #ff4757;
}
</style>
