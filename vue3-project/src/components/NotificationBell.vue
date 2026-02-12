<template>
  <div class="notification-bell" @click="handleClick">
    <SvgIcon name="notification" class="bell-icon" width="20" height="20" />
    <span v-if="notificationStore.hasUnread" class="unread-dot"></span>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { useNotificationStore } from '@/stores/notification'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'

const notificationStore = useNotificationStore()
const userStore = useUserStore()
const router = useRouter()

const POLL_INTERVAL_MS = 60000

let pollTimer = null

const handleClick = () => {
  router.push({ name: 'user' })
}

const startPolling = () => {
  if (!userStore.isLoggedIn) return
  notificationStore.fetchUnreadCount()
  pollTimer = setInterval(() => {
    if (userStore.isLoggedIn) {
      notificationStore.fetchUnreadCount()
    }
  }, POLL_INTERVAL_MS)
}

onMounted(() => {
  startPolling()
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped>
.notification-bell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
}

.notification-bell:hover {
  background: var(--bg-color-secondary);
}

.bell-icon {
  color: var(--text-color-secondary);
}

.notification-bell:hover .bell-icon {
  color: var(--text-color-primary);
}

.unread-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  background-color: #ff4757;
  border-radius: 50%;
  border: 1.5px solid var(--bg-color-primary);
}
</style>
