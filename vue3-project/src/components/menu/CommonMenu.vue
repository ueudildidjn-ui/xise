<script setup>
import DropdownItem from '@/components/menu/DropdownItem.vue'
import DropdownDivider from '@/components/menu/DropdownDivider.vue'
import ThemeSwitcherMenuItem from '@/components/menu/ThemeSwitcherMenuItem.vue'
import { useUserStore } from '@/stores/user'
import { useAuthStore } from '@/stores/auth'
import { useKeyboardShortcutsStore } from '@/stores/keyboardShortcuts'
import { useAccountSecurityStore } from '@/stores/accountSecurity'
import { useBalanceStore } from '@/stores/balance'
import { useVerifiedStore } from '@/stores/verified'
import ColorPickerMenuItem from '@/components/menu/ColorPickerMenuItem.vue'
import { onMounted } from 'vue'

const userStore = useUserStore()
const authStore = useAuthStore()
const keyboardShortcutsStore = useKeyboardShortcutsStore()
const accountSecurityStore = useAccountSecurityStore()
const balanceStore = useBalanceStore()
const verifiedStore = useVerifiedStore()

// 登录处理
const handleLoginClick = () => {
  authStore.openLoginModal()
}

// 退出登录处理
const handleLogout = async () => {
  try {
    await userStore.logout()
    // 退出登录后刷新页面，避免保留错误信息
    window.location.reload()
  } catch (error) {
    console.error('退出登录失败:', error)
  }
}

// 菜单项点击处理
const handleMenuClick = (action) => {
  if (action === 'logout') {
    handleLogout()
  } else if (action === 'login') {
    handleLoginClick()
  } else if (action === 'accountSecurity') {
    accountSecurityStore.openAccountSecurityModal()
  } else if (action === 'keyboardShortcuts') {
    keyboardShortcutsStore.openKeyboardShortcutsModal()
  } else if (action === 'balanceCenter') {
    balanceStore.openBalanceModal()
  } else if (action === 'applyVerification') {
    verifiedStore.openVerifiedModal()
  }
}

// 获取余额中心配置
onMounted(() => {
  balanceStore.fetchConfig()
})
</script>

<template>

  <DropdownItem @click="handleMenuClick('keyboardShortcuts')">
    键盘快捷键
  </DropdownItem>
  <DropdownItem v-if="userStore.isLoggedIn" @click="handleMenuClick('accountSecurity')">
    账号与安全
  </DropdownItem>
  <DropdownItem v-if="userStore.isLoggedIn" @click="handleMenuClick('applyVerification')">
    申请认证
  </DropdownItem>
  <DropdownItem v-if="userStore.isLoggedIn && balanceStore.enabled" @click="handleMenuClick('balanceCenter')">
    余额中心
  </DropdownItem>
  <DropdownDivider />
  <ColorPickerMenuItem />
  <ThemeSwitcherMenuItem />

  <DropdownItem v-if="userStore.isLoggedIn" @click="handleMenuClick('logout')">
    退出登录
  </DropdownItem>
  <DropdownItem v-else @click="handleMenuClick('login')">
    登录/注册
  </DropdownItem>
</template>