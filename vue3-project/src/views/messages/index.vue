<template>
  <div class="messages-page">
    <div class="messages-header">
      <template v-if="activeView === 'main'">
        <h2 class="messages-title">消息</h2>
        <div class="messages-actions" v-if="notificationStore.totalUnreadCount > 0">
          <button class="mark-all-read-btn" @click="handleMarkAllRead">全部已读</button>
        </div>
      </template>
      <template v-else>
        <div class="back-header" @click="goBack">
          <SvgIcon name="left" class="back-icon" width="20" height="20" />
          <h2 class="messages-title">{{ viewTitle }}</h2>
        </div>
      </template>
    </div>

    <!-- 主页面：消息块入口 -->
    <template v-if="activeView === 'main'">
      <div class="message-blocks">
        <div class="message-block" @click="enterView('system')">
          <div class="block-icon system-icon">
            <SvgIcon name="notification" width="24" height="24" />
          </div>
          <div class="block-info">
            <div class="block-title">系统通知</div>
            <div class="block-desc">{{ systemPreview }}</div>
          </div>
          <div class="block-badge" v-if="notificationStore.systemUnreadCount > 0">
            {{ notificationStore.systemUnreadCount > 99 ? '99+' : notificationStore.systemUnreadCount }}
          </div>
        </div>

        <div class="message-block" @click="enterView('activity')">
          <div class="block-icon activity-icon">
            <SvgIcon name="alert" width="24" height="24" />
          </div>
          <div class="block-info">
            <div class="block-title">活动通知</div>
            <div class="block-desc">{{ activityPreview }}</div>
          </div>
          <div class="block-badge" v-if="activityUnreadCount > 0">
            {{ activityUnreadCount > 99 ? '99+' : activityUnreadCount }}
          </div>
        </div>

        <div class="message-block" @click="enterView('interaction')">
          <div class="block-icon interaction-icon">
            <SvgIcon name="chat" width="24" height="24" />
          </div>
          <div class="block-info">
            <div class="block-title">互动消息</div>
            <div class="block-desc">{{ interactionPreview }}</div>
          </div>
          <div class="block-badge" v-if="interactionUnreadCount > 0">
            {{ interactionUnreadCount > 99 ? '99+' : interactionUnreadCount }}
          </div>
        </div>
      </div>
    </template>

    <!-- 系统通知列表 -->
    <template v-if="activeView === 'system'">
      <div class="card-list" v-if="systemNotifications.length > 0">
        <div v-for="item in systemNotifications" :key="'sys-' + item.id" class="notification-card"
          :class="{ unread: !item.is_read }" @click="handleSystemNotificationClick(item)">
          <div class="card-header">
            <div class="card-title-row">
              <div class="notification-dot" v-if="!item.is_read"></div>
              <span class="card-type-label system-label">系统通知</span>
              <div class="card-time">{{ formatTime(item.created_at) }}</div>
            </div>
            <div class="card-more" @click.stop="toggleMenu(item.id)">
              <SvgIcon name="more" width="18" height="18" />
              <div class="card-menu" v-if="openMenuId === item.id">
                <div class="card-menu-item" @click.stop="handleDeleteSystemNotification(item, 'system')">删除消息</div>
              </div>
            </div>
          </div>
          <div class="card-title">{{ item.title }}</div>
          <div class="card-body">
            <template v-if="item.content && item.content.length > CONTENT_MAX_LENGTH && !expandedItems[item.id]">
              <span>{{ item.content.slice(0, CONTENT_MAX_LENGTH) }}...</span>
              <span class="view-detail" @click.stop="toggleExpand(item)">查看详情</span>
            </template>
            <template v-else>
              {{ item.content }}
              <span v-if="item.content && item.content.length > CONTENT_MAX_LENGTH" class="view-detail" @click.stop="toggleExpand(item)">收起</span>
            </template>
          </div>
        </div>
      </div>
      <div v-else class="empty-state"><p>暂无系统通知</p></div>
    </template>

    <!-- 活动通知列表 -->
    <template v-if="activeView === 'activity'">
      <div class="card-list" v-if="activityNotifications.length > 0">
        <div v-for="item in activityNotifications" :key="'act-' + item.id" class="notification-card"
          :class="{ unread: !item.is_read }" @click="handleSystemNotificationClick(item)">
          <div class="card-header">
            <div class="card-title-row">
              <div class="notification-dot" v-if="!item.is_read"></div>
              <span class="card-type-label activity-label">活动通知</span>
              <div class="card-time">{{ formatTime(item.created_at) }}</div>
            </div>
            <div class="card-more" @click.stop="toggleMenu(item.id)">
              <SvgIcon name="more" width="18" height="18" />
              <div class="card-menu" v-if="openMenuId === item.id">
                <div class="card-menu-item" @click.stop="handleDeleteSystemNotification(item, 'activity')">删除消息</div>
              </div>
            </div>
          </div>
          <div class="card-title">{{ item.title }}</div>
          <div class="card-body">
            <template v-if="item.content && item.content.length > CONTENT_MAX_LENGTH && !expandedItems[item.id]">
              <span>{{ item.content.slice(0, CONTENT_MAX_LENGTH) }}...</span>
              <span class="view-detail" @click.stop="toggleExpand(item)">查看详情</span>
            </template>
            <template v-else>
              {{ item.content }}
              <span v-if="item.content && item.content.length > CONTENT_MAX_LENGTH" class="view-detail" @click.stop="toggleExpand(item)">收起</span>
            </template>
          </div>
        </div>
      </div>
      <div v-else class="empty-state"><p>暂无活动通知</p></div>
    </template>

    <!-- 互动消息页面 -->
    <template v-if="activeView === 'interaction'">
      <div class="interaction-tabs">
        <div v-for="tab in interactionTabs" :key="tab.key" class="interaction-tab"
          :class="{ active: activeInteractionTab === tab.key }" @click="switchInteractionTab(tab.key)">
          {{ tab.label }}
        </div>
      </div>

      <div class="notification-list" v-if="currentInteractionList.length > 0">
        <div v-for="item in currentInteractionList" :key="'int-' + item.id" class="notification-item interaction-item"
          :class="{ unread: !item.is_read }">
          <div class="notification-dot" v-if="!item.is_read"></div>
          <div class="notification-avatar" v-if="item.sender" @click.stop="goToUserProfile(item.sender)">
            <img :src="item.sender.avatar || defaultAvatar" :alt="item.sender.nickname" @error="handleAvatarError" />
          </div>
          <div class="notification-body" @click.stop="handleInteractionClick(item)">
            <div class="notification-title">
              <span class="sender-name">{{ item.sender?.nickname }}</span>
              {{ item.title }}
            </div>
            <div class="notification-comment-text" v-if="item.comment && item.comment.content">{{ item.comment.content }}</div>
            <div class="notification-time">{{ formatTime(item.created_at) }}</div>
          </div>
          <div class="notification-cover" v-if="item.post_cover && item.target_id" @click.stop="goToPost(item)">
            <img :src="item.post_cover" alt="" @error="handleCoverError" />
          </div>
        </div>
      </div>
      <div v-else class="empty-state"><p>暂无互动消息</p></div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notification'
import { notificationApi } from '@/api'
import SvgIcon from '@/components/SvgIcon.vue'

const router = useRouter()
const notificationStore = useNotificationStore()

const defaultAvatar = new URL('@/assets/imgs/avatar.png', import.meta.url).href

// 通知类型常量（与后端 notificationHelper.js 一致）
const TYPES = {
  LIKE_POST: 1,
  LIKE_COMMENT: 2,
  COMMENT: 3,
  REPLY: 4,
  FOLLOW: 5,
  COLLECT: 6,
  MENTION: 7,
  MENTION_COMMENT: 8
}

// 视图状态
const activeView = ref('main') // main | system | activity | interaction
const activeInteractionTab = ref('all')

// 数据
const systemNotifications = ref([])
const activityNotifications = ref([])
const interactionNotifications = ref({
  all: [],
  follow: [],
  likeCollect: [],
  comment: [],
  mention: []
})

// 互动消息子标签
const interactionTabs = [
  { key: 'all', label: '全部' },
  { key: 'follow', label: '新关注我的' },
  { key: 'likeCollect', label: '赞与收藏' },
  { key: 'comment', label: '评论' },
  { key: 'mention', label: '@提及' }
]

// 预览文本
const systemPreview = computed(() => {
  if (systemNotifications.value.length === 0) return '暂无通知'
  return systemNotifications.value[0]?.title || '暂无通知'
})

const activityPreview = computed(() => {
  if (activityNotifications.value.length === 0) return '暂无通知'
  return activityNotifications.value[0]?.title || '暂无通知'
})

const interactionPreview = computed(() => {
  const list = interactionNotifications.value.all
  if (list.length === 0) return '暂无消息'
  const item = list[0]
  return item.sender?.nickname ? `${item.sender.nickname} ${item.title}` : item.title
})

// 未读数统计
const interactionUnreadCount = computed(() => {
  return notificationStore.unreadCount
})

const activityUnreadCount = ref(0)

// 展开状态跟踪
const expandedItems = ref({})

// 三点菜单状态
const openMenuId = ref(null)

// 内容截断阈值
const CONTENT_MAX_LENGTH = 100

// 当前互动列表
const currentInteractionList = computed(() => {
  return interactionNotifications.value[activeInteractionTab.value] || []
})

// 视图标题
const viewTitle = computed(() => {
  const titles = { system: '系统通知', activity: '活动通知', interaction: '互动消息' }
  return titles[activeView.value] || '消息'
})

// 时间格式化
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const now = new Date()
  const diff = now - date
  if (diff < 0) return date.toLocaleDateString()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return date.toLocaleDateString()
}

const handleAvatarError = (e) => {
  e.target.src = defaultAvatar
}

const handleCoverError = (e) => {
  e.target.style.display = 'none'
}

// 切换展开/收起
const toggleExpand = (item) => {
  expandedItems.value[item.id] = !expandedItems.value[item.id]
}

// 切换三点菜单
const toggleMenu = (itemId) => {
  openMenuId.value = openMenuId.value === itemId ? null : itemId
}

// 关闭菜单（点击外部）
const closeMenu = () => {
  openMenuId.value = null
}

// 删除系统/活动通知
const handleDeleteSystemNotification = async (item, type) => {
  openMenuId.value = null
  try {
    // 调用dismiss API，将通知标记为已删除（对当前用户隐藏）
    await notificationStore.dismissSystemNotification(item.id)
    // 从本地列表中移除
    if (type === 'system') {
      systemNotifications.value = systemNotifications.value.filter(n => n.id !== item.id)
    } else {
      activityNotifications.value = activityNotifications.value.filter(n => n.id !== item.id)
      activityUnreadCount.value = activityNotifications.value.filter(n => !n.is_read).length
    }
  } catch (error) {
    console.error('删除通知失败:', error)
  }
}

// 获取通知关联的帖子ID（优先target_id，然后comment.post_id）
const getPostId = (item) => {
  if (item.target_id) return item.target_id.toString()
  if (item.comment?.post_id) return item.comment.post_id.toString()
  return null
}

// 跳转到笔记详情
const goToPost = (item) => {
  const postId = getPostId(item)
  if (!postId) return
  const query = { id: postId }
  if (item.comment_id) query.targetCommentId = item.comment_id.toString()
  router.push({ name: 'post_detail', query })
}

// 加载数据
const loadMainData = async () => {
  const [sysRes, actRes] = await Promise.all([
    notificationApi.getSystemNotifications({ type: 'system', limit: 50 }),
    notificationApi.getSystemNotifications({ type: 'activity', limit: 50 })
  ])

  if (sysRes.success && sysRes.data) {
    systemNotifications.value = sysRes.data.data || []
  }
  if (actRes.success && actRes.data) {
    activityNotifications.value = actRes.data.data || []
    activityUnreadCount.value = activityNotifications.value.filter(n => !n.is_read).length
  }

  await loadInteractionNotifications('all')
}

const loadInteractionNotifications = async (tab) => {
  let typeParam = ''
  switch (tab) {
    case 'follow':
      typeParam = `${TYPES.FOLLOW}`
      break
    case 'likeCollect':
      typeParam = `${TYPES.LIKE_POST},${TYPES.LIKE_COMMENT},${TYPES.COLLECT}`
      break
    case 'comment':
      typeParam = `${TYPES.COMMENT},${TYPES.REPLY}`
      break
    case 'mention':
      typeParam = `${TYPES.MENTION},${TYPES.MENTION_COMMENT}`
      break
    default:
      typeParam = ''
  }

  const params = { limit: 50 }
  if (typeParam) params.type = typeParam

  const res = await notificationApi.getNotifications(params)
  if (res.success && res.data) {
    interactionNotifications.value[tab] = res.data.data || []
  }
}

// 切换互动消息子标签
const switchInteractionTab = async (tab) => {
  activeInteractionTab.value = tab
  if (interactionNotifications.value[tab].length === 0) {
    await loadInteractionNotifications(tab)
  }
}

// 进入子页面
const enterView = (view) => {
  activeView.value = view
  if (view === 'interaction') {
    activeInteractionTab.value = 'all'
  }
}

// 返回主页面
const goBack = () => {
  activeView.value = 'main'
}

// 导航到用户主页
const goToUserProfile = (sender) => {
  if (sender?.user_id) {
    router.push({ name: 'user_profile', params: { userId: sender.user_id } })
  }
}

// 处理互动消息点击
const handleInteractionClick = async (item) => {
  if (!item.is_read) {
    await notificationStore.markAsRead(item.id)
    item.is_read = true
  }

  const postId = getPostId(item)

  // 评论/回复类 → 跳转到帖子详情并定位评论
  if ([TYPES.COMMENT, TYPES.REPLY].includes(item.type)) {
    if (postId) {
      const query = { id: postId }
      if (item.comment_id) query.targetCommentId = item.comment_id.toString()
      router.push({ name: 'post_detail', query })
    }
    return
  }

  // 点赞评论 → 跳转到帖子详情并定位评论
  if (item.type === TYPES.LIKE_COMMENT) {
    if (postId) {
      const query = { id: postId }
      if (item.comment_id) query.targetCommentId = item.comment_id.toString()
      router.push({ name: 'post_detail', query })
    }
    return
  }

  // 点赞/收藏笔记 → 跳转到帖子详情
  if ([TYPES.LIKE_POST, TYPES.COLLECT].includes(item.type) && postId) {
    router.push({ name: 'post_detail', query: { id: postId } })
    return
  }

  // 关注 → 跳转到用户主页
  if (item.type === TYPES.FOLLOW && item.sender?.user_id) {
    router.push({ name: 'user_profile', params: { userId: item.sender.user_id } })
    return
  }

  // @提及 → 跳转到帖子详情
  if ([TYPES.MENTION, TYPES.MENTION_COMMENT].includes(item.type) && postId) {
    const query = { id: postId }
    if (item.comment_id) query.targetCommentId = item.comment_id.toString()
    router.push({ name: 'post_detail', query })
    return
  }
}

// 系统/活动通知点击
const handleSystemNotificationClick = async (item) => {
  if (!item.is_read) {
    try {
      const response = await notificationStore.confirmSystemNotification(item.id)
      if (response.success) {
        item.is_read = true
        // 更新活动通知未读数
        activityUnreadCount.value = activityNotifications.value.filter(n => !n.is_read).length
      }
    } catch (error) {
      console.error('确认通知失败:', error)
    }
  }
}

// 全部已读
const handleMarkAllRead = async () => {
  await notificationStore.markAllAsRead()
  interactionNotifications.value.all.forEach(n => { n.is_read = true })

  const unreadSys = [...systemNotifications.value, ...activityNotifications.value].filter(n => !n.is_read)
  if (unreadSys.length > 0) {
    const results = await Promise.all(unreadSys.map(n => notificationStore.confirmSystemNotification(n.id)))
    results.forEach((res, i) => {
      if (res.success) unreadSys[i].is_read = true
    })
  }
  activityUnreadCount.value = activityNotifications.value.filter(n => !n.is_read).length
}

onMounted(() => {
  loadMainData()
  notificationStore.fetchUnreadCount()
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>

<style scoped>
.messages-page {
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  padding: 60px 16px 16px;
  box-sizing: border-box;
}

@media (min-width: 960px) {
  .messages-page {
    padding: 60px 24px 24px;
  }
}

.messages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.messages-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 0;
}

.back-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.back-icon {
  color: var(--text-color-secondary);
}

.mark-all-read-btn {
  font-size: 13px;
  color: var(--primary-color);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.mark-all-read-btn:hover {
  background: var(--bg-color-secondary);
}

/* 消息块入口 */
.message-blocks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-block {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.message-block:hover {
  background: var(--bg-color-secondary);
}

.block-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
  color: #fff;
}

.system-icon {
  background: #3b82f6;
}

.activity-icon {
  background: #f59e0b;
}

.interaction-icon {
  background: #10b981;
}

.block-info {
  flex: 1;
  min-width: 0;
}

.block-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.block-desc {
  font-size: 13px;
  color: var(--text-color-tertiary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-badge {
  background: #ff4757;
  color: #fff;
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  flex-shrink: 0;
  margin-left: 8px;
}

/* 卡片式通知列表（系统/活动） */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification-card {
  background: var(--bg-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.notification-card:hover {
  background: var(--bg-color-secondary);
}

.notification-card.unread {
  border-left: 3px solid var(--primary-color);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.card-type-label {
  font-size: 12px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.system-label {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.activity-label {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.card-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-primary);
  line-height: 1.4;
  margin-bottom: 4px;
}

.card-time {
  font-size: 12px;
  color: var(--text-color-tertiary);
  flex-shrink: 0;
}

.card-more {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  color: var(--text-color-tertiary);
  transition: background 0.15s;
}

.card-more:hover {
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
}

.card-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 100px;
  z-index: 100;
  overflow: hidden;
}

.card-menu-item {
  padding: 8px 14px;
  font-size: 13px;
  color: #ff4757;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.card-menu-item:hover {
  background: var(--bg-color-secondary);
}

.card-body {
  font-size: 14px;
  color: var(--text-color-secondary);
  line-height: 1.6;
  word-break: break-word;
}

.view-detail {
  color: var(--primary-color);
  cursor: pointer;
  font-size: 13px;
  margin-left: 4px;
}

.view-detail:hover {
  text-decoration: underline;
}

/* 互动消息子标签 */
.interaction-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.interaction-tabs::-webkit-scrollbar {
  display: none;
}

.interaction-tab {
  padding: 8px 14px;
  font-size: 14px;
  color: var(--text-color-secondary);
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.interaction-tab.active {
  color: var(--text-color-primary);
  font-weight: 500;
  border-bottom-color: var(--text-color-primary);
}

.interaction-tab:hover {
  color: var(--text-color-primary);
}

/* 通知列表（互动消息） */
.notification-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  background: var(--bg-color-primary);
  transition: background 0.15s ease;
  box-sizing: border-box;
}

.notification-item:hover {
  background: var(--bg-color-secondary);
}

.notification-item.unread {
  background: var(--bg-color-secondary);
}

.notification-dot {
  width: 8px;
  height: 8px;
  background: #ff4757;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
  margin-right: 8px;
}

.notification-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  margin-right: 10px;
  cursor: pointer;
}

.notification-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.notification-body {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.notification-title {
  font-size: 14px;
  color: var(--text-color-primary);
  line-height: 1.4;
  word-break: break-word;
}

.sender-name {
  font-weight: 500;
  cursor: pointer;
}

.sender-name:hover {
  text-decoration: underline;
}

.notification-comment-text {
  font-size: 13px;
  color: var(--text-color-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.notification-time {
  font-size: 12px;
  color: var(--text-color-tertiary);
  margin-top: 4px;
}

/* 笔记封面缩略图 */
.notification-cover {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  margin-left: 10px;
  cursor: pointer;
}

.notification-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
  color: var(--text-color-tertiary);
  font-size: 14px;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .messages-page {
    padding: 48px 12px 12px;
  }

  .messages-title {
    font-size: 17px;
  }

  .message-block {
    padding: 10px;
  }

  .block-icon {
    width: 36px;
    height: 36px;
  }

  .block-icon svg {
    width: 20px;
    height: 20px;
  }

  .block-title {
    font-size: 14px;
  }

  .notification-card {
    padding: 12px;
  }

  .notification-item {
    padding: 10px;
  }

  .notification-cover {
    width: 44px;
    height: 44px;
  }

  .interaction-tab {
    padding: 8px 12px;
    font-size: 13px;
  }
}
</style>
