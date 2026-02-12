<template>
    <div class="footer">
        <div class="footer-container">
            <div class="footer-list">
                <ul>
                    <li v-for="item in footerList" :key="item.icon">

                        <template v-if="item.label === 'explore'">
                            <a href="#" @click="handleExploreClick" class="footer-link">
                                <SvgIcon :name="item.icon" class="icon"
                                    :class="{ active: route.path.startsWith('/explore') }" width="24px" height="24px" />
                            </a>
                        </template>
                        <template v-else-if="item.label === 'messages'">
                            <RouterLink :to="item.path" class="footer-link notification-link">
                                <SvgIcon :name="item.icon" class="icon" :class="{ active: route.path === item.path }"
                                    width="24px" height="24px" />
                                <span v-if="notificationStore.hasUnread" class="footer-unread-dot"></span>
                            </RouterLink>
                        </template>
                        <template v-else>
                            <RouterLink :to="item.path" class="footer-link">
                                <SvgIcon :name="item.icon" class="icon" :class="{ active: route.path === item.path }"
                                    width="24px" height="24px" />
                            </RouterLink>
                        </template>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<script setup>
import SvgIcon from '@/components/SvgIcon.vue'
import { ref } from 'vue'
import { useRouteUtils } from '@/composables/useRouteUtils'
import { useNotificationStore } from '@/stores/notification'

const { route, handleExploreClick } = useRouteUtils()
const notificationStore = useNotificationStore()

// 底部导航配置
const footerList = ref([
    { label: 'explore', icon: 'home', path: '/explore' },
    { label: 'publish', icon: 'publish', path: '/publish' },
    { label: 'messages', icon: 'notification', path: '/messages' },
    { label: 'user', icon: 'user', path: '/user' },
])
</script>

<style scoped>
.footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 48px;
    background-color: var(--bg-color-primary);
    z-index: 999;
    max-width: 1440px;
    margin: 0 auto;
    width: 100%;
    padding-bottom: constant(safe-area-inset-bottom);
    padding-bottom: env(safe-area-inset-bottom);
}

.footer-container {
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    padding: 0 20px;
    box-sizing: border-box;
    width: 100%;
}

@media (max-width: 960px) {
    .footer-container {
        padding: 0 16px;
    }
}

@media (max-width: 768px) {
    .footer-container {
        padding: 0 12px;
    }
}

@media (max-width: 480px) {
    .footer-container {
        padding: 0 8px;
    }
}

.footer-list {
    width: 100%;
    height: 100%;
    position: relative;
}

.footer-list ul {
    display: flex;
    align-items: center;
    justify-content: space-around;
    height: 100%;
    width: 100%;
    padding: 0;
    margin: 0;
}

.footer-list ul li {
    flex: 1;
    list-style: none;
    height: 100%;
    padding: 0;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
}

.footer-list ul li a {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-decoration: none;
}

.footer-list ul li .footer-link {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-decoration: none;
}

.icon {
    color: var(--text-color-tertiary);
}

.active {
    color: var(--text-color-primary);
}

.notification-link {
    position: relative;
}

.footer-unread-dot {
    position: absolute;
    top: 8px;
    right: -4px;
    width: 6px;
    height: 6px;
    background-color: #ff4757;
    border-radius: 50%;
}
</style>