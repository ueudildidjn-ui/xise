<script setup>
import WaterfallFlow from '@/components/WaterfallFlow.vue'
import FloatingBtn from './FloatingBtn.vue'
import SimpleSpinner from '@/components/spinner/SimpleSpinner.vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useAuthStore } from '@/stores/auth'
import { getFollowingPosts } from '@/api/posts.js'
import { userApi } from '@/api/index.js'
import defaultAvatar from '@/assets/imgs/avatar.png'

const router = useRouter()
const userStore = useUserStore()
const authStore = useAuthStore()

const refreshKey = ref(0)
const isImgOnly = ref(false)
const loading = ref(true)
const hasFollowing = ref(false)
const recommendedUsers = ref([])
const posts = ref([])
const currentSort = ref('time') // 'time' 或 'hot'
const loadingMore = ref(false)
const hasMore = ref(true)
const currentPage = ref(1)
const pageSize = 20
const followingUsers = ref(new Set()) // 追踪正在关注中的用户

// 计算用户是否已登录
const isLoggedIn = computed(() => userStore.isLoggedIn)

function handleReload() {
    // 通知父组件显示加载动画
    window.dispatchEvent(new CustomEvent('floating-btn-reload-request'))
}

function handleToggleImgOnly(imgOnlyState) {
    isImgOnly.value = imgOnlyState
    // 切换状态时刷新内容
    refreshKey.value++
    loadContent()
}

function handleFloatingBtnReload() {
    // 刷新按钮触发时更新内容
    refreshKey.value++
    loadContent()
    
    // 触发强制重新检查图片加载事件
    setTimeout(() => {
        document.dispatchEvent(new CustomEvent('force-recheck'))
    }, 100)
}

// 切换排序方式
function toggleSort(sort) {
    if (currentSort.value !== sort) {
        currentSort.value = sort
        currentPage.value = 1
        loadContent()
    }
}

// 加载内容
async function loadContent() {
    if (!isLoggedIn.value) {
        loading.value = false
        return
    }

    loading.value = true
    try {
        const result = await getFollowingPosts({
            page: 1,
            limit: pageSize,
            sort: currentSort.value,
            type: isImgOnly.value ? 1 : null
        })

        hasFollowing.value = result.hasFollowing
        recommendedUsers.value = result.recommendedUsers || []
        posts.value = result.posts || []
        hasMore.value = result.hasMore
        currentPage.value = 1
    } catch (error) {
        console.error('加载关注内容失败:', error)
    } finally {
        loading.value = false
    }
}

// 加载更多内容
async function loadMoreContent() {
    if (loadingMore.value || !hasMore.value || !hasFollowing.value) return

    loadingMore.value = true
    currentPage.value++

    try {
        const result = await getFollowingPosts({
            page: currentPage.value,
            limit: pageSize,
            sort: currentSort.value,
            type: isImgOnly.value ? 1 : null
        })

        posts.value.push(...(result.posts || []))
        hasMore.value = result.hasMore
    } catch (error) {
        console.error('加载更多内容失败:', error)
        currentPage.value--
    } finally {
        loadingMore.value = false
    }
}

// 关注用户
async function followUser(user) {
    if (!isLoggedIn.value) {
        authStore.openLoginModal()
        return
    }

    if (followingUsers.value.has(user.id)) return

    followingUsers.value.add(user.id)
    try {
        await userApi.followUser(user.user_id)
        // 更新用户状态
        user.isFollowing = true
        user.buttonType = 'unfollow'
        
        // 从推荐列表中移除已关注的用户
        recommendedUsers.value = recommendedUsers.value.filter(u => u.id !== user.id)
        
        // 如果所有推荐用户都被关注了，重新加载内容
        if (recommendedUsers.value.length === 0) {
            loadContent()
        }
    } catch (error) {
        console.error('关注失败:', error)
    } finally {
        followingUsers.value.delete(user.id)
    }
}

// 跳转到用户主页
function goToUserProfile(userId) {
    router.push(`/user/${userId}`)
}

// 处理头像加载失败
function handleAvatarError(event) {
    if (event.target) {
        event.target.src = defaultAvatar
    }
}

// 滚动监听
function handleScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight

    if (scrollTop + windowHeight >= documentHeight - 200) {
        loadMoreContent()
    }
}

// 监听用户登录状态变化
watch(() => userStore.isLoggedIn, (newValue) => {
    if (newValue) {
        loadContent()
    }
})

onMounted(() => {
    loadContent()
    window.addEventListener('floating-btn-reload', handleFloatingBtnReload)
    window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
    window.removeEventListener('floating-btn-reload', handleFloatingBtnReload)
    window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
    <div class="following-page">
        <!-- 未登录状态 -->
        <div v-if="!isLoggedIn" class="login-prompt">
            <div class="login-prompt-content">
                <SvgIcon name="user" width="48" height="48" class="login-icon" />
                <p class="login-text">登录后查看关注的博主动态</p>
                <button class="login-btn" @click="authStore.openLoginModal()">立即登录</button>
            </div>
        </div>

        <!-- 已登录状态 -->
        <div v-else>
            <!-- 加载中 -->
            <div v-if="loading" class="loading-container">
                <SimpleSpinner size="32" />
                <span class="loading-text">加载中...</span>
            </div>

            <!-- 无关注用户，显示推荐用户 -->
            <div v-else-if="!hasFollowing && recommendedUsers.length > 0" class="recommend-container">
                <div class="recommend-header">
                    <h3 class="recommend-title">推荐关注</h3>
                    <p class="recommend-subtitle">关注感兴趣的博主，获取他们的最新动态</p>
                </div>
                <div class="user-grid">
                    <div v-for="user in recommendedUsers" :key="user.id" class="user-card">
                        <img 
                            :src="user.avatar || defaultAvatar" 
                            alt="" 
                            class="user-avatar"
                            @click="goToUserProfile(user.user_id)"
                            @error="handleAvatarError"
                        >
                        <div class="user-info" @click="goToUserProfile(user.user_id)">
                            <div class="user-name">
                                {{ user.nickname }}
                                <SvgIcon v-if="user.verified" name="verified" width="14" height="14" class="verified-icon" />
                            </div>
                            <p class="user-bio">{{ user.bio || '这个人很懒，什么都没写' }}</p>
                            <div class="user-stats">
                                <span class="stat-item">{{ user.fans_count || 0 }} 粉丝</span>
                                <span class="stat-item">{{ user.post_count || 0 }} 笔记</span>
                            </div>
                        </div>
                        <button 
                            class="follow-btn"
                            :class="{ 'loading': followingUsers.has(user.id) }"
                            :disabled="followingUsers.has(user.id)"
                            @click="followUser(user)"
                        >
                            <SimpleSpinner v-if="followingUsers.has(user.id)" size="14" />
                            <span v-else>关注</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 无关注用户且无推荐用户 -->
            <div v-else-if="!hasFollowing && recommendedUsers.length === 0" class="empty-state">
                <p class="empty-text">暂无推荐用户</p>
            </div>

            <!-- 有关注用户，显示笔记列表 -->
            <div v-else class="content-container">
                <!-- 排序切换 -->
                <div class="sort-tabs">
                    <button 
                        class="sort-tab" 
                        :class="{ active: currentSort === 'time' }"
                        @click="toggleSort('time')"
                    >
                        最新
                    </button>
                    <button 
                        class="sort-tab" 
                        :class="{ active: currentSort === 'hot' }"
                        @click="toggleSort('hot')"
                    >
                        热门
                    </button>
                </div>

                <!-- 笔记列表 -->
                <WaterfallFlow 
                    :refresh-key="refreshKey" 
                    category="following" 
                    :type="isImgOnly ? 1 : null"
                    :preloaded-posts="posts"
                />
            </div>
        </div>

        <FloatingBtn @reload="handleReload" @toggle-img-only="handleToggleImgOnly" />
    </div>
</template>

<style scoped>
.following-page {
    position: relative;
    width: 100%;
    min-height: calc(100vh - 120px);
}

/* 登录提示样式 */
.login-prompt {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
}

.login-prompt-content {
    text-align: center;
    padding: 40px;
}

.login-icon {
    color: var(--text-color-tertiary);
    margin-bottom: 16px;
}

.login-text {
    color: var(--text-color-secondary);
    font-size: 16px;
    margin-bottom: 24px;
}

.login-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 12px 32px;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.login-btn:hover {
    background: var(--primary-color-dark);
}

/* 加载中样式 */
.loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    gap: 12px;
}

.loading-text {
    color: var(--text-color-secondary);
    font-size: 14px;
}

/* 推荐用户样式 */
.recommend-container {
    padding: 20px 16px;
}

.recommend-header {
    text-align: center;
    margin-bottom: 24px;
}

.recommend-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 8px;
}

.recommend-subtitle {
    font-size: 14px;
    color: var(--text-color-secondary);
}

.user-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
}

.user-card {
    display: flex;
    align-items: center;
    padding: 16px;
    background: var(--bg-color-secondary);
    border-radius: 12px;
    transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.user-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.user-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
    cursor: pointer;
    flex-shrink: 0;
}

.user-info {
    flex: 1;
    margin: 0 12px;
    cursor: pointer;
    min-width: 0;
}

.user-name {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 15px;
    font-weight: 500;
    color: var(--text-color-primary);
    margin-bottom: 4px;
}

.verified-icon {
    color: var(--primary-color);
    flex-shrink: 0;
}

.user-bio {
    font-size: 13px;
    color: var(--text-color-secondary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.user-stats {
    display: flex;
    gap: 12px;
}

.stat-item {
    font-size: 12px;
    color: var(--text-color-tertiary);
}

.follow-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 16px;
    font-size: 13px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 60px;
}

.follow-btn:hover:not(:disabled) {
    background: var(--primary-color-dark);
}

.follow-btn:disabled {
    cursor: not-allowed;
    opacity: 0.7;
}

.follow-btn.loading {
    background: var(--bg-color-tertiary);
}

/* 空状态样式 */
.empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
}

.empty-text {
    color: var(--text-color-secondary);
    font-size: 16px;
}

/* 内容容器样式 */
.content-container {
    padding-top: 8px;
}

/* 排序切换样式 */
.sort-tabs {
    display: flex;
    gap: 8px;
    padding: 8px 16px 16px;
}

.sort-tab {
    background: var(--bg-color-secondary);
    border: none;
    padding: 6px 16px;
    border-radius: 16px;
    font-size: 13px;
    color: var(--text-color-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
}

.sort-tab.active {
    background: var(--primary-color);
    color: white;
}

.sort-tab:hover:not(.active) {
    background: var(--bg-color-tertiary);
}

/* 响应式设计 */
@media (max-width: 600px) {
    .user-grid {
        grid-template-columns: 1fr;
    }

    .user-card {
        padding: 12px;
    }

    .user-avatar {
        width: 48px;
        height: 48px;
    }
}
</style>
