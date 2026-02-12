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
      <div class="notification-list" v-if="systemNotifications.length > 0">
        <div v-for="item in systemNotifications" :key="'sys-' + item.id" class="notification-item"
          :class="{ unread: !item.is_read }" @click="handleSystemNotificationClick(item)">
          <div class="notification-dot" v-if="!item.is_read"></div>
          <div class="notification-content">
            <div class="notification-title">{{ item.title }}</div>
            <div class="notification-text">{{ item.content }}</div>
            <div class="notification-time">{{ formatTime(item.created_at) }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state"><p>暂无系统通知</p></div>
    </template>

    <!-- 活动通知列表 -->
    <template v-if="activeView === 'activity'">
      <div class="notification-list" v-if="activityNotifications.length > 0">
        <div v-for="item in activityNotifications" :key="'act-' + item.id" class="notification-item"
          :class="{ unread: !item.is_read }" @click="handleSystemNotificationClick(item)">
          <div class="notification-dot" v-if="!item.is_read"></div>
          <div class="notification-content">
            <div class="notification-title">{{ item.title }}</div>
            <div class="notification-text">{{ item.content }}</div>
            <div class="notification-time">{{ formatTime(item.created_at) }}</div>
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
        <div v-for="item in currentInteractionList" :key="'int-' + item.id" class="notification-item"
          :class="{ unread: !item.is_read }" @click="handleInteractionClick(item)">
          <div class="notification-dot" v-if="!item.is_read"></div>
          <div class="notification-avatar" v-if="item.sender" @click.stop="goToUserProfile(item.sender)">
            <img :src="item.sender.avatar || defaultAvatar" :alt="item.sender.nickname" @error="handleAvatarError" />
          </div>
          <div class="notification-content" @click.stop="handleInteractionClick(item)">
            <div class="notification-title">
              <span class="sender-name" @click.stop="goToUserProfile(item.sender)">{{ item.sender?.nickname }}</span>
              {{ item.title }}
            </div>
            <div class="notification-time">{{ formatTime(item.created_at) }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state"><p>暂无互动消息</p></div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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
  { key: 'all', label: '互动消息' },
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

// 加载数据
const loadMainData = async () => {
  // 加载系统通知（type=system）和活动通知（type=activity）
  const [sysRes, actRes] = await Promise.all([
    notificationApi.getSystemNotifications({ type: 'system', limit: 50 }),
    notificationApi.getSystemNotifications({ type: 'activity', limit: 50 })
  ])

  if (sysRes.success && sysRes.data) {
    systemNotifications.value = sysRes.data.data || []
  }
  if (actRes.success && actRes.data) {
    activityNotifications.value = actRes.data.data || []
    // 计算活动通知未读数
    activityUnreadCount.value = activityNotifications.value.filter(n => !n.is_read).length
  }

  // 加载互动消息全部
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
      typeParam = '' // all
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
  if (interactionNotifications.value[tab].length === 0 || tab !== 'all') {
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

  // 评论/回复类 → 跳转到帖子详情并定位评论
  if ([TYPES.COMMENT, TYPES.REPLY].includes(item.type)) {
    if (item.target_id) {
      const query = { id: item.target_id.toString() }
      if (item.comment_id) query.targetCommentId = item.comment_id.toString()
      router.push({ name: 'post_detail', query })
    }
    return
  }

  // 点赞/收藏笔记 → 跳转到帖子详情
  if ([TYPES.LIKE_POST, TYPES.COLLECT].includes(item.type) && item.target_id) {
    router.push({ name: 'post_detail', query: { id: item.target_id.toString() } })
    return
  }

  // 关注 → 跳转到用户主页
  if (item.type === TYPES.FOLLOW && item.sender?.user_id) {
    router.push({ name: 'user_profile', params: { userId: item.sender.user_id } })
    return
  }

  // @提及 → 跳转到帖子详情
  if ([TYPES.MENTION, TYPES.MENTION_COMMENT].includes(item.type) && item.target_id) {
    const query = { id: item.target_id.toString() }
    if (item.comment_id) query.targetCommentId = item.comment_id.toString()
    router.push({ name: 'post_detail', query })
    return
  }
}

// 系统/活动通知点击
const handleSystemNotificationClick = async (item) => {
  if (!item.is_read) {
    await notificationStore.confirmSystemNotification(item.id)
    item.is_read = true
  }
}

// 全部已读
const handleMarkAllRead = async () => {
  await notificationStore.markAllAsRead()
  interactionNotifications.value.all.forEach(n => { n.is_read = true })

  const unreadSys = [...systemNotifications.value, ...activityNotifications.value].filter(n => !n.is_read)
  if (unreadSys.length > 0) {
    await Promise.all(unreadSys.map(n => notificationStore.confirmSystemNotification(n.id)))
    unreadSys.forEach(n => { n.is_read = true })
  }
  activityUnreadCount.value = 0
}

onMounted(() => {
  loadMainData()
  notificationStore.fetchUnreadCount()
})
</script>

<style scoped>
.messages-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px 16px;
}

.messages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.messages-title {
  font-size: 20px;
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
  padding: 14px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.message-block:hover {
  background: var(--bg-color-secondary);
}

.block-icon {
  width: 44px;
  height: 44px;
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

/* 互动消息子标签 */
.interaction-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.interaction-tab {
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-color-secondary);
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.interaction-tab.active {
  color: var(--text-color-primary);
  font-weight: 500;
  border-bottom-color: var(--text-color-primary);
}

.interaction-tab:hover {
  color: var(--text-color-primary);
}

/* 通知列表 */
.notification-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  background: var(--bg-color-primary);
  transition: background 0.15s ease;
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

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 14px;
  color: var(--text-color-primary);
  line-height: 1.4;
}

.sender-name {
  font-weight: 500;
  cursor: pointer;
}

.sender-name:hover {
  text-decoration: underline;
}

.notification-text {
  font-size: 13px;
  color: var(--text-color-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time {
  font-size: 12px;
  color: var(--text-color-tertiary);
  margin-top: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
  color: var(--text-color-tertiary);
  font-size: 14px;
}
</style>
