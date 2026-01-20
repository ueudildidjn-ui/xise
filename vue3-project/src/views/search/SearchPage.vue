<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import SvgIcon from '@/components/SvgIcon.vue'
import { useSearchHistoryStore } from '@/stores/searchHistory'
import { useUserStore } from '@/stores/user'
import { useAuthStore } from '@/stores/auth'
import apiConfig from '@/config/api.js'

const router = useRouter()
const searchHistoryStore = useSearchHistoryStore()
const userStore = useUserStore()
const authStore = useAuthStore()

// 登录状态
const isLoggedIn = computed(() => userStore.isLoggedIn)

// 打开登录弹窗
function openLogin() {
  authStore.openLoginModal()
}

const searchText = ref('')
const searchInputRef = ref(null)
const hotSearches = ref([])
const isLoadingHot = ref(false)
const isEditMode = ref(false)

// 获取最近搜索记录
const recentSearches = computed(() => searchHistoryStore.getRecentSearches())

// 处理搜索
function handleSearch(keyword = null) {
  const searchKeyword = (typeof keyword === 'string' ? keyword : searchText.value).trim()
  
  // 如果没有搜索关键词，不执行搜索
  if (!searchKeyword) {
    return
  }
  
  searchHistoryStore.addSearchRecord(searchKeyword)
  
  router.push({
    name: 'search_result_tab',
    params: { tab: 'all' },
    query: { keyword: searchKeyword }
  })
}

// 处理搜索历史点击
function handleHistoryClick(keyword) {
  if (!isEditMode.value) {
    handleSearch(keyword)
  }
}

// 处理热搜点击
function handleHotClick(keyword) {
  handleSearch(keyword)
}

// 返回上一页
function goBack() {
  router.back()
}

// 清空输入
function clearInput() {
  searchText.value = ''
  nextTick(() => {
    if (searchInputRef.value) {
      searchInputRef.value.focus()
    }
  })
}

// 进入编辑模式
function enterEditMode() {
  isEditMode.value = true
}

// 退出编辑模式
function exitEditMode() {
  isEditMode.value = false
}

// 删除单个历史记录
function handleDeleteHistory(keyword, event) {
  event.stopPropagation()
  searchHistoryStore.removeSearchRecord(keyword)
  
  if (recentSearches.value.length === 0) {
    isEditMode.value = false
  }
}

// 清空所有历史记录
function handleClearAll() {
  searchHistoryStore.clearSearchHistory()
  isEditMode.value = false
}

// 获取热门搜索
async function fetchHotSearches() {
  isLoadingHot.value = true
  try {
    const response = await fetch(`${apiConfig.baseURL}/tags/hot?limit=10`)
    if (!response.ok) {
      // 服务器返回错误状态码，静默失败
      return
    }
    const data = await response.json()
    if (data.code === 200 && Array.isArray(data.data)) {
      hotSearches.value = data.data.map(tag => tag.name)
    }
  } catch (error) {
    // 网络错误或解析错误，静默失败，热门搜索为可选功能
    console.warn('获取热门搜索失败:', error.message)
  } finally {
    isLoadingHot.value = false
  }
}

// 处理回车键搜索
function handleKeyPress(event) {
  if (event.key === 'Enter') {
    handleSearch()
  }
}

onMounted(() => {
  // 只有登录用户才自动聚焦和获取数据
  if (isLoggedIn.value) {
    // 自动聚焦搜索框
    nextTick(() => {
      if (searchInputRef.value) {
        searchInputRef.value.focus()
      }
    })
    
    // 获取热门搜索
    fetchHotSearches()
  }
})

// 当用户登录后自动获取热门搜索
watch(isLoggedIn, (newValue, oldValue) => {
  if (newValue && !oldValue) {
    nextTick(() => {
      if (searchInputRef.value) {
        searchInputRef.value.focus()
      }
    })
    fetchHotSearches()
  }
})
</script>

<template>
  <div class="search-page">
    <!-- 搜索栏 -->
    <div class="search-header">
      <div class="back-btn" @click="goBack">
        <SvgIcon name="leftArrow" width="24" height="24" />
      </div>
      <div class="search-bar">
        <input 
          ref="searchInputRef"
          v-model="searchText" 
          type="text" 
          placeholder="搜索笔记、用户" 
          @keypress="handleKeyPress"
          :disabled="!isLoggedIn"
        />
        <div class="input-controls">
          <div 
            class="clear-btn" 
            @click="clearInput"
            :style="{ visibility: searchText ? 'visible' : 'hidden' }"
          >
            <SvgIcon name="close" width="20" height="20" />
          </div>
          <div class="search-btn" @click="handleSearch">
            <SvgIcon name="search" width="20" height="20" />
          </div>
        </div>
      </div>
    </div>

    <!-- 未登录提示 -->
    <div class="login-prompt" v-if="!isLoggedIn">
      <div class="prompt-content">
        <SvgIcon name="search" width="48" height="48" class="prompt-icon" />
        <h3>请先登录</h3>
        <p>登录后可搜索全部笔记和用户</p>
        <button class="login-btn" @click="openLogin">立即登录</button>
      </div>
    </div>

    <!-- 搜索内容区域 - 仅登录用户可见 -->
    <div class="search-content" v-if="isLoggedIn">
      <!-- 搜索历史 -->
      <div v-if="recentSearches.length > 0" class="search-section">
        <div class="section-header">
          <span class="section-title">搜索历史</span>
          <div class="header-actions">
            <template v-if="!isEditMode">
              <span class="action-btn icon-only-btn" @click="enterEditMode">
                <SvgIcon name="delete" width="16" height="16" />
              </span>
            </template>
            <template v-else>
              <span class="action-btn" @click="handleClearAll">
                <SvgIcon name="delete" width="16" height="16" />
                <span class="action-text">清空</span>
              </span>
              <span class="action-btn" @click="exitEditMode">
                <SvgIcon name="tick" width="16" height="16" />
                <span class="action-text">完成</span>
              </span>
            </template>
          </div>
        </div>
        <div class="tag-list">
          <div 
            v-for="keyword in recentSearches" 
            :key="keyword" 
            class="tag-item"
            :class="{ 'edit-mode': isEditMode }"
            @click="handleHistoryClick(keyword)"
          >
            <span class="tag-text">{{ keyword }}</span>
            <span v-if="isEditMode" class="delete-icon" @click="handleDeleteHistory(keyword, $event)">
              <SvgIcon name="close" width="14" height="14" />
            </span>
          </div>
        </div>
      </div>

      <!-- 热门搜索 -->
      <div v-if="hotSearches.length > 0" class="search-section">
        <div class="section-header">
          <span class="section-title">热门搜索</span>
        </div>
        <div class="tag-list">
          <div 
            v-for="(keyword, index) in hotSearches" 
            :key="keyword" 
            class="tag-item hot"
            @click="handleHotClick(keyword)"
          >
            <span class="hot-index" :class="{ 'top-three': index < 3 }">{{ index + 1 }}</span>
            <span class="tag-text">{{ keyword }}</span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="recentSearches.length === 0 && hotSearches.length === 0 && !isLoadingHot" class="empty-state">
        <SvgIcon name="search" width="48" height="48" />
        <p>搜索笔记、用户</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  min-height: 100vh;
  background: var(--bg-color-primary);
}

.search-header {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
  position: sticky;
  top: 0;
  background: var(--bg-color-primary);
  z-index: 100;
  border-bottom: 1px solid var(--border-color-primary);
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-color-secondary);
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg-color-secondary);
  border-radius: 999px;
  height: 40px;
  padding: 0 15px;
  position: relative;
}

.search-bar input {
  border: none;
  outline: none;
  background: transparent;
  flex: 1;
  font-size: 16px;
  color: var(--text-color-primary);
  caret-color: var(--primary-color);
  padding-right: 80px;
}

.search-bar input::placeholder {
  color: var(--text-color-quaternary);
}

.input-controls {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-btn,
.search-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-color-tertiary);
}

.clear-btn:hover,
.search-btn:hover {
  color: var(--text-color-primary);
}

.search-content {
  padding: 16px;
}

.search-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-color-tertiary);
  font-size: 13px;
}

.action-btn:hover {
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
}

.icon-only-btn {
  padding: 4px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-color-secondary);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tag-item:hover {
  background: var(--bg-color-tertiary);
}

.tag-item.edit-mode {
  padding-right: 10px;
}

.tag-text {
  font-size: 14px;
  color: var(--text-color-primary);
}

.delete-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--bg-color-tertiary);
  color: var(--text-color-tertiary);
}

.delete-icon:hover {
  background: var(--error-color);
  color: white;
}

.tag-item.hot {
  padding-left: 10px;
}

.hot-index {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-tertiary);
}

.hot-index.top-three {
  color: var(--primary-color);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-color-tertiary);
}

.empty-state p {
  margin-top: 16px;
  font-size: 15px;
}

/* 登录提示样式 */
.login-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}

.prompt-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--text-color-tertiary);
}

.prompt-content .prompt-icon {
  margin-bottom: 16px;
  opacity: 0.6;
}

.prompt-content h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.prompt-content p {
  margin: 8px 0 20px 0;
  font-size: 14px;
}

.login-btn {
  padding: 10px 32px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.login-btn:hover {
  opacity: 0.9;
  transform: scale(1.02);
}

@media (min-width: 696px) {
  .search-page {
    max-width: 600px;
    margin: 0 auto;
  }
}
</style>
