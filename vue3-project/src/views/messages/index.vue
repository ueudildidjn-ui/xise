<template>
  <div class="messages-page">
    <div class="messages-header">
      <h2 class="messages-title">消息</h2>
      <div class="messages-actions" v-if="notificationStore.totalUnreadCount > 0">
        <button class="mark-all-read-btn" @click="handleMarkAllRead">全部已读</button>
      </div>
    </div>

    <!-- 系统通知区域 -->
    <div v-if="systemNotifications.length > 0" class="notification-section">
      <h3 class="section-title">系统通知</h3>
      <div class="notification-list">
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
    </div>

    <!-- 互动通知区域 -->
    <div class="notification-section">
      <h3 class="section-title">互动消息</h3>
      <div v-if="notifications.length > 0" class="notification-list">
        <div v-for="item in notifications" :key="'notif-' + item.id" class="notification-item"
          :class="{ unread: !item.is_read }" @click="handleNotificationClick(item)">
          <div class="notification-dot" v-if="!item.is_read"></div>
          <div class="notification-avatar" v-if="item.sender">
            <img :src="item.sender.avatar || defaultAvatar" :alt="item.sender.nickname" @error="handleAvatarError" />
          </div>
          <div class="notification-content">
            <div class="notification-title">
              <span class="sender-name" v-if="item.sender">{{ item.sender.nickname }}</span>
              {{ item.title }}
            </div>
            <div class="notification-time">{{ formatTime(item.created_at) }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <p>暂无消息</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useNotificationStore } from '@/stores/notification'

const notificationStore = useNotificationStore()

const defaultAvatar = new URL('@/assets/imgs/avatar.png', import.meta.url).href

const notifications = ref([])
const systemNotifications = ref([])

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const now = new Date()
  const diff = now - date
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

const loadData = async () => {
  const [notifData, sysData] = await Promise.all([
    notificationStore.fetchNotifications({ limit: 50 }),
    notificationStore.fetchSystemNotifications({ limit: 50 })
  ])
  notifications.value = notificationStore.notifications
  systemNotifications.value = notificationStore.systemNotifications
}

const handleNotificationClick = async (item) => {
  if (!item.is_read) {
    await notificationStore.markAsRead(item.id)
    item.is_read = true
  }
}

const handleSystemNotificationClick = async (item) => {
  if (!item.is_read) {
    await notificationStore.confirmSystemNotification(item.id)
    item.is_read = true
  }
}

const handleMarkAllRead = async () => {
  await notificationStore.markAllAsRead()
  notifications.value.forEach(n => { n.is_read = true })
  // Also confirm all system notifications
  for (const sn of systemNotifications.value) {
    if (!sn.is_read) {
      await notificationStore.confirmSystemNotification(sn.id)
      sn.is_read = true
    }
  }
}

onMounted(() => {
  loadData()
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

.notification-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-secondary);
  margin: 0 0 12px 0;
}

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
