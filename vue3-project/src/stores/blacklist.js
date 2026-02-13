import { defineStore } from 'pinia'
import { ref } from 'vue'
import { userApi } from '@/api/index.js'

export const useBlacklistStore = defineStore('blacklist', () => {
  // 存储用户的黑名单状态 { userId: { isBlocked: boolean, isBlockedBy: boolean } }
  const userBlockStates = ref(new Map())

  // 更新用户黑名单状态
  const updateUserBlockState = (userId, isBlocked, isBlockedBy = false) => {
    userBlockStates.value.set(userId.toString(), { isBlocked, isBlockedBy })
  }

  // 获取用户黑名单状态
  const getUserBlockState = (userId) => {
    return userBlockStates.value.get(userId.toString()) || { isBlocked: false, isBlockedBy: false }
  }

  // 拉黑用户
  const blockUser = async (userId) => {
    const previousState = getUserBlockState(userId)
    // 乐观更新
    updateUserBlockState(userId, true, previousState.isBlockedBy)

    try {
      await userApi.blockUser(userId)
      return { success: true }
    } catch (error) {
      console.error('拉黑失败:', error)
      // 回滚状态
      updateUserBlockState(userId, previousState.isBlocked, previousState.isBlockedBy)
      return { success: false, error: error.message }
    }
  }

  // 取消拉黑
  const unblockUser = async (userId) => {
    const previousState = getUserBlockState(userId)
    // 乐观更新
    updateUserBlockState(userId, false, previousState.isBlockedBy)

    try {
      await userApi.unblockUser(userId)
      return { success: true }
    } catch (error) {
      console.error('取消拉黑失败:', error)
      // 回滚状态
      updateUserBlockState(userId, previousState.isBlocked, previousState.isBlockedBy)
      return { success: false, error: error.message }
    }
  }

  // 初始化黑名单状态
  const initUserBlockState = (userId, isBlocked, isBlockedBy = false) => {
    updateUserBlockState(userId, isBlocked, isBlockedBy)
  }

  // 从API获取黑名单状态
  const fetchBlockStatus = async (userId) => {
    try {
      const response = await userApi.getBlockStatus(userId)
      if (response.success) {
        const { isBlocked, isBlockedBy } = response.data
        initUserBlockState(userId, isBlocked, isBlockedBy)
        return { success: true, data: response.data }
      }
      return { success: false, error: '获取黑名单状态失败' }
    } catch (error) {
      console.error('获取黑名单状态失败:', error)
      return { success: false, error: error.message }
    }
  }

  return {
    userBlockStates,
    updateUserBlockState,
    getUserBlockState,
    blockUser,
    unblockUser,
    initUserBlockState,
    fetchBlockStatus
  }
})
