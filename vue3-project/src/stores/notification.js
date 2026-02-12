import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { notificationApi } from '@/api'

export const useNotificationStore = defineStore('notification', () => {
  // 状态
  const notifications = ref([])
  const systemNotifications = ref([])
  const popupNotifications = ref([])
  const unreadCount = ref(0)
  const systemUnreadCount = ref(0)
  const loading = ref(false)

  // 计算属性
  const totalUnreadCount = computed(() => unreadCount.value + systemUnreadCount.value)
  const hasUnread = computed(() => totalUnreadCount.value > 0)

  // 获取未读数量
  const fetchUnreadCount = async () => {
    try {
      const response = await notificationApi.getUnreadCount()
      if (response.success && response.data) {
        unreadCount.value = response.data.notification_count || 0
        systemUnreadCount.value = response.data.system_notification_count || 0
      }
    } catch (error) {
      console.error('获取未读数量失败:', error)
    }
  }

  // 获取通知列表
  const fetchNotifications = async (params = {}) => {
    loading.value = true
    try {
      const response = await notificationApi.getNotifications(params)
      if (response.success && response.data) {
        notifications.value = response.data.data || []
        return response.data
      }
      return null
    } catch (error) {
      console.error('获取通知列表失败:', error)
      return null
    } finally {
      loading.value = false
    }
  }

  // 获取系统通知列表
  const fetchSystemNotifications = async (params = {}) => {
    loading.value = true
    try {
      const response = await notificationApi.getSystemNotifications(params)
      if (response.success && response.data) {
        systemNotifications.value = response.data.data || []
        return response.data
      }
      return null
    } catch (error) {
      console.error('获取系统通知列表失败:', error)
      return null
    } finally {
      loading.value = false
    }
  }

  // 获取弹窗通知
  const fetchPopupNotifications = async () => {
    try {
      const response = await notificationApi.getPopupNotifications()
      if (response.success && response.data) {
        popupNotifications.value = response.data || []
      }
    } catch (error) {
      console.error('获取弹窗通知失败:', error)
    }
  }

  // 标记通知为已读
  const markAsRead = async (notificationId) => {
    try {
      const response = await notificationApi.markAsRead(notificationId)
      if (response.success) {
        const index = notifications.value.findIndex(n => n.id === notificationId)
        if (index !== -1) {
          notifications.value[index].is_read = true
        }
        if (unreadCount.value > 0) unreadCount.value--
      }
      return response
    } catch (error) {
      console.error('标记已读失败:', error)
      return { success: false }
    }
  }

  // 标记所有通知为已读
  const markAllAsRead = async () => {
    try {
      const response = await notificationApi.markAllAsRead()
      if (response.success) {
        notifications.value.forEach(n => { n.is_read = true })
        unreadCount.value = 0
      }
      return response
    } catch (error) {
      console.error('全部标记已读失败:', error)
      return { success: false }
    }
  }

  // 确认系统通知
  const confirmSystemNotification = async (notificationId) => {
    // 立即从弹窗列表中移除（防止重复弹窗）
    popupNotifications.value = popupNotifications.value.filter(n => n.id !== notificationId)
    // 立即更新系统通知列表的已读状态
    const index = systemNotifications.value.findIndex(n => n.id === notificationId)
    if (index !== -1) {
      systemNotifications.value[index].is_read = true
    }
    if (systemUnreadCount.value > 0) systemUnreadCount.value--

    try {
      const response = await notificationApi.confirmSystemNotification(notificationId)
      if (response.success) {
        // 从服务器刷新准确的未读数量
        await fetchUnreadCount()
      }
      return response
    } catch (error) {
      console.error('确认系统通知失败:', error)
      return { success: false }
    }
  }

  // 删除通知
  const deleteNotification = async (notificationId) => {
    try {
      const response = await notificationApi.deleteNotification(notificationId)
      if (response.success) {
        const index = notifications.value.findIndex(n => n.id === notificationId)
        if (index !== -1) {
          if (!notifications.value[index].is_read && unreadCount.value > 0) {
            unreadCount.value--
          }
          notifications.value.splice(index, 1)
        }
      }
      return response
    } catch (error) {
      console.error('删除通知失败:', error)
      return { success: false }
    }
  }

  return {
    // 状态
    notifications,
    systemNotifications,
    popupNotifications,
    unreadCount,
    systemUnreadCount,
    loading,

    // 计算属性
    totalUnreadCount,
    hasUnread,

    // 方法
    fetchUnreadCount,
    fetchNotifications,
    fetchSystemNotifications,
    fetchPopupNotifications,
    markAsRead,
    markAllAsRead,
    confirmSystemNotification,
    deleteNotification
  }
})
