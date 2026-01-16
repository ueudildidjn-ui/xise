<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'
import { useUserStore } from '@/stores/user'
import { userApi } from '@/api/index.js'
import WaterfallFlow from '@/components/WaterfallFlow.vue'
import SvgIcon from '@/components/SvgIcon.vue'
import BackToTopButton from '@/components/BackToTopButton.vue'

const router = useRouter()
const navigationStore = useNavigationStore()
const userStore = useUserStore()

const loading = ref(false)
const posts = ref([])
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  pages: 0
})
const showClearConfirm = ref(false)
const refreshKey = ref(0)

// 加载浏览历史
async function loadHistory() {
  if (!userStore.isLoggedIn) return
  
  loading.value = true
  try {
    const response = await userApi.getHistory({
      page: pagination.value.page,
      limit: pagination.value.limit
    })
    
    if (response.success && response.data) {
      posts.value = response.data.posts || []
      pagination.value = response.data.pagination || pagination.value
    }
  } catch (error) {
    console.error('加载浏览历史失败:', error)
  } finally {
    loading.value = false
  }
}

// 清空所有历史记录
async function clearAllHistory() {
  try {
    const response = await userApi.clearHistory()
    if (response.success) {
      posts.value = []
      pagination.value.total = 0
      refreshKey.value++
    }
  } catch (error) {
    console.error('清空浏览历史失败:', error)
  } finally {
    showClearConfirm.value = false
  }
}

// 处理点赞事件
function handleLike(data) {
  console.log('点赞操作:', data)
}

// 处理收藏事件
function handleCollect(data) {
  console.log('收藏操作:', data)
}

onMounted(() => {
  navigationStore.scrollToTop('instant')
  
  if (!userStore.isLoggedIn) {
    console.warn('用户未登录，跳转回首页')
    router.push('/')
    return
  }
  
  loadHistory()
})
</script>

<template>
  <div class="history-container">
    <!-- 页面头部 -->
    <div class="header">
      <div class="header-left"></div>
      <div class="header-title">浏览历史</div>
      <div class="header-right">
        <button 
          v-if="posts.length > 0" 
          class="clear-btn" 
          @click="showClearConfirm = true"
        >
          <SvgIcon name="delete" width="18" height="18" />
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-area">
      <!-- 加载状态 -->
      <div v-if="loading && posts.length === 0" class="loading-state">
        <SvgIcon name="loading" width="32" height="32" class="loading-icon" />
        <p>加载中...</p>
      </div>
      
      <!-- 空状态 -->
      <div v-else-if="!loading && posts.length === 0" class="empty-state">
        <SvgIcon name="history" width="64" height="64" class="empty-icon" />
        <h3>暂无浏览记录</h3>
        <p>浏览过的笔记会在这里显示</p>
      </div>
      
      <!-- 历史记录列表 -->
      <div v-else class="waterfall-container">
        <WaterfallFlow 
          :userId="userStore.userInfo?.user_id" 
          :type="'history'" 
          :refreshKey="refreshKey"
          @like="handleLike" 
          @collect="handleCollect" 
        />
      </div>
    </div>

    <!-- 回到顶部按钮 -->
    <BackToTopButton />

    <!-- 清空确认对话框 -->
    <Teleport to="body">
      <div v-if="showClearConfirm" class="confirm-overlay" @click="showClearConfirm = false">
        <div class="confirm-dialog" @click.stop>
          <div class="confirm-title">清空浏览历史</div>
          <div class="confirm-message">确定要清空所有浏览历史吗？此操作不可撤销。</div>
          <div class="confirm-actions">
            <button class="cancel-btn" @click="showClearConfirm = false">取消</button>
            <button class="confirm-btn" @click="clearAllHistory">确定</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ---------- 1. 全局样式设置 ---------- */
* {
  box-sizing: border-box;
}

/* ---------- 2. 布局容器样式 ---------- */
.history-container {
  padding-top: 72px;
  margin: 0 auto;
  width: 100%;
  max-width: 1200px;
  background: var(--bg-color-primary);
  padding-bottom: 20px;
  min-height: calc(100vh - 72px);
  transition: background-color 0.2s ease;
}

/* ---------- 3. 顶部导航栏样式 ---------- */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 72px;
  background: var(--bg-color-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 100;
  transition: background-color 0.2s ease;
}

.header-left {
  width: 48px;
  height: 48px;
}

.header-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-color-primary);
  transition: color 0.2s ease;
}

.header-right {
  width: 48px;
  display: flex;
  justify-content: flex-end;
}

.clear-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-color-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
}

/* ---------- 4. 内容区域样式 ---------- */
.content-area {
  width: 100%;
  padding: 16px 0;
}

.waterfall-container {
  width: 100%;
  max-width: 700px;
  padding: 0 8px;
  margin: 0 auto;
  background: var(--bg-color-primary);
  transition: background-color 0.2s ease;
}

/* 大屏下调整瀑布流容器宽度以适应 4 列布局 */
@media (min-width: 960px) {
  .waterfall-container {
    max-width: 1000px;
    padding: 0 16px;
  }
}

/* ---------- 5. 加载和空状态样式 ---------- */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  padding: 40px 16px;
  text-align: center;
}

.loading-icon {
  color: var(--text-color-quaternary);
  margin-bottom: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-icon {
  color: var(--text-color-quaternary);
  margin-bottom: 16px;
}

.loading-state p,
.empty-state h3 {
  color: var(--text-color-primary);
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.empty-state p {
  color: var(--text-color-secondary);
  font-size: 14px;
  margin: 0;
  line-height: 1.5;
}

/* ---------- 6. 确认对话框样式 ---------- */
.confirm-overlay {
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

.confirm-dialog {
  background: var(--bg-color-primary);
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 320px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.confirm-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 12px;
  text-align: center;
}

.confirm-message {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin-bottom: 24px;
  text-align: center;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
}

.cancel-btn:hover {
  background: var(--bg-color-tertiary);
}

.confirm-btn {
  background: #ff4d4f;
  color: #fff;
}

.confirm-btn:hover {
  background: #ff7875;
}

/* ---------- 7. 媒体查询 ---------- */
@media (min-width: 901px) {
  .content-area {
    max-width: 1000px;
    margin: 0 auto;
    padding: 16px;
  }
}
</style>
