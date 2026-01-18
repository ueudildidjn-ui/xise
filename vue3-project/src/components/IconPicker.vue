<template>
  <div class="icon-picker">
    <div class="icon-picker-trigger" @click="togglePicker">
      <div class="selected-icon" v-if="modelValue">
        <Icon :icon="modelValue" width="20" height="20" />
        <span class="icon-name">{{ getIconDisplayName(modelValue) }}</span>
      </div>
      <span class="placeholder" v-else>{{ placeholder }}</span>
      <SvgIcon name="down" width="14" height="14" class="dropdown-arrow" :class="{ rotated: showPicker }" />
    </div>
    
    <div v-if="showPicker" class="icon-picker-dropdown" v-click-outside.mousedown="closePicker">
      <div class="icon-search">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="搜索图标（如：home, user, settings...）"
          class="search-input"
          @input="handleSearch"
        />
      </div>
      <div class="icon-categories">
        <button 
          v-for="cat in categories" 
          :key="cat.value"
          class="category-btn"
          :class="{ active: selectedCategory === cat.value }"
          @click="selectCategory(cat.value)"
        >
          {{ cat.label }}
        </button>
      </div>
      <div class="icon-grid" v-if="!loading">
        <div 
          v-for="icon in displayIcons" 
          :key="icon"
          class="icon-item"
          :class="{ selected: modelValue === icon }"
          @click="selectIcon(icon)"
          :title="icon"
        >
          <Icon :icon="icon" width="24" height="24" />
          <span class="icon-label">{{ getIconDisplayName(icon) }}</span>
        </div>
      </div>
      <div v-if="loading" class="loading-state">
        <SvgIcon name="loading" width="24" height="24" class="loading-spin" />
        <span>加载中...</span>
      </div>
      <div v-if="!loading && displayIcons.length === 0" class="no-results">
        没有找到匹配的图标
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import SvgIcon from '@/components/SvgIcon.vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '请选择图标'
  }
})

const emit = defineEmits(['update:modelValue'])

const showPicker = ref(false)
const searchQuery = ref('')
const selectedCategory = ref('common')
const loading = ref(false)

// 图标分类
const categories = [
  { value: 'common', label: '常用' },
  { value: 'social', label: '社交' },
  { value: 'media', label: '媒体' },
  { value: 'file', label: '文件' },
  { value: 'ui', label: '界面' }
]

// 常用图标预设（使用 Iconify 图标名称）
const iconSets = {
  common: [
    'mdi:home', 'mdi:account', 'mdi:cog', 'mdi:magnify', 'mdi:bell', 'mdi:heart',
    'mdi:star', 'mdi:bookmark', 'mdi:history', 'mdi:clock-outline', 'mdi:calendar',
    'mdi:email', 'mdi:phone', 'mdi:map-marker', 'mdi:link', 'mdi:share-variant',
    'mdi:download', 'mdi:upload', 'mdi:plus', 'mdi:minus', 'mdi:check', 'mdi:close',
    'mdi:pencil', 'mdi:delete', 'mdi:refresh', 'mdi:eye', 'mdi:eye-off', 'mdi:lock',
    'mdi:lock-open', 'mdi:help-circle', 'mdi:information', 'mdi:alert', 'mdi:check-circle'
  ],
  social: [
    'mdi:account-group', 'mdi:account-plus', 'mdi:account-heart', 'mdi:chat', 'mdi:chat-outline',
    'mdi:message', 'mdi:message-text', 'mdi:forum', 'mdi:thumb-up', 'mdi:thumb-down',
    'mdi:share', 'mdi:comment', 'mdi:emoticon', 'mdi:emoticon-happy', 'mdi:emoticon-sad',
    'mdi:gift', 'mdi:crown', 'mdi:trophy', 'mdi:medal', 'mdi:fire', 'mdi:lightning-bolt',
    'mdi:cards-heart', 'mdi:hand-wave', 'mdi:handshake', 'mdi:party-popper'
  ],
  media: [
    'mdi:image', 'mdi:image-multiple', 'mdi:camera', 'mdi:video', 'mdi:music',
    'mdi:microphone', 'mdi:headphones', 'mdi:play', 'mdi:pause', 'mdi:stop',
    'mdi:skip-next', 'mdi:skip-previous', 'mdi:volume-high', 'mdi:volume-mute',
    'mdi:fullscreen', 'mdi:fullscreen-exit', 'mdi:movie', 'mdi:youtube', 'mdi:spotify',
    'mdi:podcast', 'mdi:radio', 'mdi:record', 'mdi:filmstrip', 'mdi:animation'
  ],
  file: [
    'mdi:file', 'mdi:file-document', 'mdi:file-pdf-box', 'mdi:file-word', 'mdi:file-excel',
    'mdi:file-powerpoint', 'mdi:file-image', 'mdi:file-video', 'mdi:file-music',
    'mdi:folder', 'mdi:folder-open', 'mdi:folder-plus', 'mdi:folder-star',
    'mdi:attachment', 'mdi:paperclip', 'mdi:zip-box', 'mdi:cloud', 'mdi:cloud-upload',
    'mdi:cloud-download', 'mdi:database', 'mdi:server', 'mdi:harddisk', 'mdi:content-copy'
  ],
  ui: [
    'mdi:menu', 'mdi:dots-vertical', 'mdi:dots-horizontal', 'mdi:chevron-up', 'mdi:chevron-down',
    'mdi:chevron-left', 'mdi:chevron-right', 'mdi:arrow-up', 'mdi:arrow-down', 'mdi:arrow-left',
    'mdi:arrow-right', 'mdi:sort', 'mdi:filter', 'mdi:tune', 'mdi:view-grid', 'mdi:view-list',
    'mdi:apps', 'mdi:table', 'mdi:chart-bar', 'mdi:chart-line', 'mdi:chart-pie',
    'mdi:palette', 'mdi:brightness-6', 'mdi:theme-light-dark', 'mdi:translate'
  ]
}

// 获取显示的图标
const displayIcons = computed(() => {
  if (searchQuery.value) {
    // 搜索模式：在所有分类中搜索
    const query = searchQuery.value.toLowerCase()
    const allIcons = Object.values(iconSets).flat()
    return allIcons.filter(icon => {
      const iconName = icon.split(':')[1] || icon
      return iconName.toLowerCase().includes(query)
    })
  }
  return iconSets[selectedCategory.value] || iconSets.common
})

// 获取图标显示名称
const getIconDisplayName = (iconName) => {
  if (!iconName) return ''
  const parts = iconName.split(':')
  return parts.length > 1 ? parts[1] : iconName
}

const handleSearch = () => {
  // 搜索时清除分类选择
  if (searchQuery.value) {
    selectedCategory.value = ''
  } else {
    selectedCategory.value = 'common'
  }
}

const selectCategory = (category) => {
  selectedCategory.value = category
  searchQuery.value = ''
}

const togglePicker = () => {
  showPicker.value = !showPicker.value
  if (showPicker.value) {
    searchQuery.value = ''
    selectedCategory.value = 'common'
  }
}

const closePicker = () => {
  showPicker.value = false
}

const selectIcon = (icon) => {
  emit('update:modelValue', icon)
  showPicker.value = false
}
</script>

<style scoped>
.icon-picker {
  position: relative;
  width: 100%;
}

.icon-picker-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 4px;
  background: var(--bg-color-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-picker-trigger:hover {
  border-color: var(--primary-color);
}

.selected-icon {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-color-primary);
}

.icon-name {
  font-size: 14px;
}

.placeholder {
  color: var(--text-color-tertiary);
  font-size: 14px;
}

.dropdown-arrow {
  color: var(--text-color-secondary);
  transition: transform 0.2s ease;
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.icon-picker-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--bg-color-primary);
  border: 1px solid var(--border-color-primary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.icon-search {
  padding: 8px;
  border-bottom: 1px solid var(--border-color-primary);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.icon-categories {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--border-color-primary);
  overflow-x: auto;
  flex-shrink: 0;
}

.category-btn {
  padding: 4px 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 16px;
  background: var(--bg-color-secondary);
  color: var(--text-color-secondary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.category-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.category-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 8px;
  overflow-y: auto;
  max-height: 280px;
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 4px;
}

.icon-item:hover {
  background: var(--bg-color-secondary);
}

.icon-item.selected {
  background: var(--primary-color);
  color: white;
}

.icon-label {
  font-size: 9px;
  color: var(--text-color-secondary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.icon-item.selected .icon-label {
  color: white;
}

.no-results,
.loading-state {
  padding: 20px;
  text-align: center;
  color: var(--text-color-tertiary);
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.loading-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 滚动条样式 */
.icon-grid::-webkit-scrollbar {
  width: 6px;
}

.icon-grid::-webkit-scrollbar-track {
  background: var(--bg-color-secondary);
  border-radius: 3px;
}

.icon-grid::-webkit-scrollbar-thumb {
  background: var(--border-color-primary);
  border-radius: 3px;
}

.icon-grid::-webkit-scrollbar-thumb:hover {
  background: var(--text-color-quaternary);
}

.icon-categories::-webkit-scrollbar {
  height: 4px;
}

.icon-categories::-webkit-scrollbar-track {
  background: transparent;
}

.icon-categories::-webkit-scrollbar-thumb {
  background: var(--border-color-primary);
  border-radius: 2px;
}
</style>
