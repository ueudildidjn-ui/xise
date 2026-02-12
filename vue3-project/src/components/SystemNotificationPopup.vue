<template>
  <Teleport to="body">
    <div v-if="currentNotification" class="sys-popup-overlay" tabindex="-1" ref="overlayRef"
      @click.self="handleClose" @keydown.esc="handleClose">
      <div class="sys-popup-card">
        <div class="sys-popup-header">
          <span class="sys-popup-type">{{ currentNotification.type === 'activity' ? '活动通知' : '系统通知' }}</span>
          <button class="sys-popup-close" aria-label="关闭" @click="handleClose">&times;</button>
        </div>
        <div class="sys-popup-title">{{ currentNotification.title }}</div>
        <div class="sys-popup-content">{{ currentNotification.content }}</div>
        <div v-if="currentNotification.image_url" class="sys-popup-image">
          <img :src="currentNotification.image_url" alt="" />
        </div>
        <div class="sys-popup-footer">
          <button class="sys-popup-btn" @click="handleClose">我知道了</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useNotificationStore } from '@/stores/notification'
import { useUserStore } from '@/stores/user'
import { notificationApi } from '@/api'

const notificationStore = useNotificationStore()
const userStore = useUserStore()
const currentNotification = ref(null)
const overlayRef = ref(null)

const showNext = async () => {
  if (notificationStore.popupNotifications.length > 0) {
    currentNotification.value = notificationStore.popupNotifications[0]
    await nextTick()
    overlayRef.value?.focus()
  } else {
    currentNotification.value = null
  }
}

const handleClose = async () => {
  if (!currentNotification.value) return
  const id = currentNotification.value.id
  // Immediately clear current to close popup
  currentNotification.value = null

  try {
    // Call confirm API directly to ensure it works regardless of store state
    await notificationApi.confirmSystemNotification(id)
    // Remove from popup list
    notificationStore.popupNotifications = notificationStore.popupNotifications.filter(n => n.id !== id)
    if (notificationStore.systemUnreadCount > 0) notificationStore.systemUnreadCount--
  } catch (error) {
    console.error('确认系统通知失败:', error)
  }

  // Show next popup if any
  await showNext()
}

const init = async () => {
  if (userStore.isLoggedIn) {
    await notificationStore.fetchPopupNotifications()
    await showNext()
  }
}

onMounted(() => {
  init()
})

// Watch for login state changes
watch(() => userStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    init()
  } else {
    currentNotification.value = null
  }
})
</script>

<style scoped>
.sys-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.sys-popup-card {
  background: var(--bg-color-primary);
  border-radius: 14px;
  width: 90%;
  max-width: 400px;
  padding: 24px;
  box-sizing: border-box;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.sys-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sys-popup-type {
  font-size: 12px;
  color: var(--primary-color);
  background: var(--bg-color-secondary);
  padding: 2px 8px;
  border-radius: 4px;
}

.sys-popup-close {
  background: none;
  border: none;
  font-size: 22px;
  color: var(--text-color-tertiary);
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}

.sys-popup-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 8px;
}

.sys-popup-content {
  font-size: 14px;
  color: var(--text-color-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.sys-popup-image {
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
}

.sys-popup-image img {
  width: 100%;
  display: block;
}

.sys-popup-footer {
  display: flex;
  justify-content: flex-end;
}

.sys-popup-btn {
  background: var(--primary-color);
  color: #fff;
  border: none;
  padding: 8px 24px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
}

.sys-popup-btn:hover {
  opacity: 0.9;
}
</style>
