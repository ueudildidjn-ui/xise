import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePrivacyStore = defineStore('privacy', () => {
  const showPrivacyModal = ref(false)

  const openPrivacyModal = () => {
    showPrivacyModal.value = true
  }

  const closePrivacyModal = () => {
    showPrivacyModal.value = false
  }

  return {
    showPrivacyModal,
    openPrivacyModal,
    closePrivacyModal
  }
})
