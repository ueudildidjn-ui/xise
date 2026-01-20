<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { creatorCenterApi } from '@/api/index.js'
import { useUserStore } from '@/stores/user'
import BackToTopButton from '@/components/BackToTopButton.vue'

const router = useRouter()
const userStore = useUserStore()

// 数据状态
const loading = ref(true)
const withdrawLoading = ref(false)
const activeTab = ref('earnings')

// 配置信息
const config = ref({
  platformFeeRate: 0.10,
  creatorShareRate: 0.90,
  withdrawEnabled: false,
  minWithdrawAmount: 10
})

// 概览数据
const overview = ref({
  balance: 0,
  total_earnings: 0,
  withdrawn_amount: 0,
  today_earnings: 0,
  month_earnings: 0
})

// 收益明细
const earningsLog = ref([])
const earningsLogPagination = ref({ page: 1, limit: 15, total: 0, totalPages: 0 })
const earningsLoading = ref(false)

// 付费内容
const paidContent = ref([])
const paidContentPagination = ref({ page: 1, limit: 15, total: 0, totalPages: 0 })
const contentLoading = ref(false)

// 提现相关
const showWithdrawModal = ref(false)
const withdrawAmount = ref('')
const withdrawError = ref('')

// 格式化金额
const formatMoney = (amount) => {
  const num = parseFloat(amount) || 0
  return num.toFixed(2)
}

// 格式化数字
const formatNumber = (num) => {
  if (num == null || isNaN(num)) return '0'
  const n = Number(num)
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toString()
}

// 格式化日期
const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// 获取收益类型标签
const getEarningsTypeLabel = (type) => {
  const typeMap = {
    content_sale: '内容销售',
    subscription: '订阅收入',
    tip: '打赏收入',
    withdraw: '提现',
    extended_daily: '激励奖励'
  }
  return typeMap[type] || type
}

// 加载配置
const loadConfig = async () => {
  try {
    const response = await creatorCenterApi.getConfig()
    if (response.success) config.value = response.data
  } catch (error) {
    console.error('获取配置失败:', error)
  }
}

// 加载概览
const loadOverview = async () => {
  try {
    loading.value = true
    const response = await creatorCenterApi.getOverview()
    if (response.success) overview.value = response.data
  } catch (error) {
    console.error('获取概览失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载收益明细
const loadEarningsLog = async (page = 1) => {
  try {
    earningsLoading.value = true
    const response = await creatorCenterApi.getEarningsLog({ page, limit: earningsLogPagination.value.limit })
    if (response.success) {
      earningsLog.value = response.data.list
      earningsLogPagination.value = response.data.pagination
    }
  } catch (error) {
    console.error('获取明细失败:', error)
  } finally {
    earningsLoading.value = false
  }
}

// 加载付费内容
const loadPaidContent = async (page = 1) => {
  try {
    contentLoading.value = true
    const response = await creatorCenterApi.getPaidContent({ page, limit: paidContentPagination.value.limit })
    if (response.success) {
      paidContent.value = response.data.list
      paidContentPagination.value = response.data.pagination
    }
  } catch (error) {
    console.error('获取内容失败:', error)
  } finally {
    contentLoading.value = false
  }
}

// 切换标签
const switchTab = (tab) => {
  activeTab.value = tab
  if (tab === 'earnings' && earningsLog.value.length === 0) loadEarningsLog()
  else if (tab === 'content' && paidContent.value.length === 0) loadPaidContent()
}

// 提现相关
const openWithdrawModal = () => { withdrawAmount.value = ''; withdrawError.value = ''; showWithdrawModal.value = true }
const closeWithdrawModal = () => { showWithdrawModal.value = false }
const withdrawAll = () => { withdrawAmount.value = overview.value.balance.toString() }

const doWithdraw = async () => {
  const amount = parseFloat(withdrawAmount.value)
  if (isNaN(amount) || amount <= 0) { withdrawError.value = '请输入有效金额'; return }
  if (amount < config.value.minWithdrawAmount) { withdrawError.value = `最低提现 ${config.value.minWithdrawAmount} 石榴点`; return }
  if (amount > overview.value.balance) { withdrawError.value = '余额不足'; return }
  
  try {
    withdrawLoading.value = true
    withdrawError.value = ''
    const response = await creatorCenterApi.withdraw(amount)
    if (response.success) {
      overview.value.balance = response.data.newEarningsBalance
      closeWithdrawModal()
      loadOverview()
      if (activeTab.value === 'earnings') loadEarningsLog()
    } else {
      withdrawError.value = response.message || '提现失败'
    }
  } catch (error) {
    withdrawError.value = error.message || '提现失败'
  } finally {
    withdrawLoading.value = false
  }
}

// 跳转帖子
const goToPost = (postId) => {
  router.push({ name: 'post_detail', query: { id: postId } })
}

onMounted(async () => {
  if (!userStore.isLoggedIn) { router.push('/user'); return }
  await loadConfig()
  await loadOverview()
  await loadEarningsLog()
})
</script>

<template>
  <div class="creator-center">
    <!-- 顶部区域 -->
    <div class="header-section">
      <div class="header-bg"></div>
      <div class="header-content">
        <!-- 用户信息 -->
        <div class="user-info" v-if="!loading">
          <div class="avatar-wrapper">
            <img :src="userStore.userInfo?.avatar || '/default-avatar.png'" :alt="userStore.userInfo?.nickname || '用户头像'" class="avatar" />
            <div class="verified-badge"><Icon icon="mdi:check" /></div>
          </div>
          <div class="user-details">
            <h1 class="username">{{ userStore.userInfo?.nickname || userStore.userInfo?.username || '创作者' }}</h1>
            <span class="user-tag">创作者中心</span>
          </div>
        </div>
        
        <!-- 余额卡片 -->
        <div class="balance-card" v-if="!loading">
          <div class="balance-row">
            <div class="balance-main">
              <span class="label">可提现余额</span>
              <div class="amount">
                <span class="currency">¥</span>
                <span class="value">{{ formatMoney(overview.balance) }}</span>
              </div>
            </div>
            <button v-if="config.withdrawEnabled" class="withdraw-btn" :disabled="overview.balance < config.minWithdrawAmount" @click="openWithdrawModal">
              提现
            </button>
          </div>
          <div class="stats-row">
            <div class="stat">
              <span class="stat-label">今日</span>
              <span class="stat-value">+{{ formatMoney(overview.today_earnings) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">本月</span>
              <span class="stat-value">+{{ formatMoney(overview.month_earnings) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">累计</span>
              <span class="stat-value">{{ formatMoney(overview.total_earnings) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="loading-container" v-if="loading">
      <div class="skeleton user"></div>
      <div class="skeleton balance"></div>
    </div>

    <!-- 主内容区 -->
    <div class="main-section" v-if="!loading">
      <!-- 标签切换 -->
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'earnings' }" @click="switchTab('earnings')">
          <Icon icon="mdi:format-list-bulleted" /> 收益明细
        </button>
        <button class="tab" :class="{ active: activeTab === 'content' }" @click="switchTab('content')">
          <Icon icon="mdi:file-document-outline" /> 付费内容
        </button>
      </div>

      <!-- 收益明细 -->
      <div class="tab-content" v-show="activeTab === 'earnings'">
        <div class="earnings-list" v-if="!earningsLoading && earningsLog.length > 0">
          <div class="earnings-item" v-for="item in earningsLog" :key="item.id">
            <div class="item-icon" :class="item.amount >= 0 ? 'income' : 'expense'">
              <Icon :icon="item.amount >= 0 ? 'mdi:trending-up' : 'mdi:trending-down'" />
            </div>
            <div class="item-info">
              <div class="item-title">{{ getEarningsTypeLabel(item.type) }}</div>
              <div class="item-desc">{{ item.reason || '-' }}</div>
              <div class="item-time">{{ formatDate(item.created_at) }}</div>
            </div>
            <div class="item-amount" :class="item.amount >= 0 ? 'positive' : 'negative'">
              {{ item.amount >= 0 ? '+' : '' }}{{ formatMoney(item.amount) }}
            </div>
          </div>
        </div>

        <div class="empty" v-else-if="!earningsLoading">
          <Icon icon="mdi:inbox-outline" />
          <p>暂无收益记录</p>
        </div>

        <div class="loading" v-else>
          <Icon icon="mdi:loading" class="spin" />
        </div>

        <!-- 分页 -->
        <div class="pagination" v-if="earningsLogPagination.totalPages > 1">
          <button :disabled="earningsLogPagination.page <= 1" @click="loadEarningsLog(earningsLogPagination.page - 1)">
            <Icon icon="mdi:chevron-left" />
          </button>
          <span>{{ earningsLogPagination.page }} / {{ earningsLogPagination.totalPages }}</span>
          <button :disabled="earningsLogPagination.page >= earningsLogPagination.totalPages" @click="loadEarningsLog(earningsLogPagination.page + 1)">
            <Icon icon="mdi:chevron-right" />
          </button>
        </div>
      </div>

      <!-- 付费内容 -->
      <div class="tab-content" v-show="activeTab === 'content'">
        <div class="content-list" v-if="!contentLoading && paidContent.length > 0">
          <div class="content-item" v-for="item in paidContent" :key="item.id" @click="goToPost(item.id)">
            <div class="content-cover">
              <img v-if="item.cover" :src="item.cover" alt="" />
              <div v-else class="cover-placeholder"><Icon icon="mdi:image" /></div>
              <div class="price-tag">¥{{ formatMoney(item.price) }}</div>
            </div>
            <div class="content-info">
              <h3 class="content-title">{{ item.title || '无标题' }}</h3>
              <div class="content-stats">
                <span><Icon icon="mdi:eye-outline" /> {{ formatNumber(item.view_count || 0) }}</span>
                <span><Icon icon="mdi:cart-outline" /> {{ item.sales_count || 0 }}人购买</span>
              </div>
              <div class="content-revenue">
                收入 <strong>¥{{ formatMoney(item.total_revenue || 0) }}</strong>
              </div>
            </div>
            <Icon icon="mdi:chevron-right" class="arrow" />
          </div>
        </div>

        <div class="empty" v-else-if="!contentLoading">
          <Icon icon="mdi:file-document-outline" />
          <p>暂无付费内容</p>
        </div>

        <div class="loading" v-else>
          <Icon icon="mdi:loading" class="spin" />
        </div>

        <!-- 分页 -->
        <div class="pagination" v-if="paidContentPagination.totalPages > 1">
          <button :disabled="paidContentPagination.page <= 1" @click="loadPaidContent(paidContentPagination.page - 1)">
            <Icon icon="mdi:chevron-left" />
          </button>
          <span>{{ paidContentPagination.page }} / {{ paidContentPagination.totalPages }}</span>
          <button :disabled="paidContentPagination.page >= paidContentPagination.totalPages" @click="loadPaidContent(paidContentPagination.page + 1)">
            <Icon icon="mdi:chevron-right" />
          </button>
        </div>
      </div>
    </div>

    <!-- 提现弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showWithdrawModal" @click.self="closeWithdrawModal">
        <div class="modal">
          <div class="modal-header">
            <h3>提现到余额</h3>
            <button class="close" @click="closeWithdrawModal"><Icon icon="mdi:close" /></button>
          </div>
          <div class="modal-body">
            <div class="balance-info">
              <span>可提现</span>
              <strong>¥{{ formatMoney(overview.balance) }}</strong>
            </div>
            <div class="input-row">
              <input type="number" v-model="withdrawAmount" placeholder="输入金额" />
              <button class="all" @click="withdrawAll">全部</button>
            </div>
            <p class="hint">最低提现: {{ config.minWithdrawAmount }} 石榴点</p>
            <p class="error" v-if="withdrawError">{{ withdrawError }}</p>
          </div>
          <div class="modal-footer">
            <button class="cancel" @click="closeWithdrawModal">取消</button>
            <button class="confirm" @click="doWithdraw" :disabled="withdrawLoading">
              <Icon v-if="withdrawLoading" icon="mdi:loading" class="spin" />
              {{ withdrawLoading ? '处理中' : '确认提现' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <BackToTopButton />
  </div>
</template>

<style scoped>
.creator-center {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 80px;
}

/* 顶部区域 */
.header-section {
  position: relative;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 180px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
}

.header-content {
  position: relative;
  padding: 60px 16px 20px;
  max-width: 500px;
  margin: 0 auto;
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.avatar-wrapper {
  position: relative;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.3);
  object-fit: cover;
}

.verified-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  background: #10b981;
  border-radius: 50%;
  border: 2px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
}

.user-details {
  flex: 1;
}

.username {
  font-size: 20px;
  font-weight: 700;
  color: white;
  margin: 0 0 4px;
}

.user-tag {
  font-size: 12px;
  color: rgba(255,255,255,0.8);
  background: rgba(255,255,255,0.15);
  padding: 2px 10px;
  border-radius: 12px;
}

/* 余额卡片 */
.balance-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.balance-main .label {
  font-size: 13px;
  color: #888;
  display: block;
  margin-bottom: 6px;
}

.balance-main .amount {
  display: flex;
  align-items: baseline;
}

.balance-main .currency {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

.balance-main .value {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a2e;
  margin-left: 2px;
}

.withdraw-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 25px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.withdraw-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
}

.withdraw-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stats-row {
  display: flex;
  justify-content: space-around;
}

.stat {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #10b981;
}

/* 加载骨架 */
.loading-container {
  padding: 60px 16px;
  max-width: 500px;
  margin: 0 auto;
}

.skeleton {
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 16px;
}

.skeleton.user { height: 80px; margin-bottom: 16px; }
.skeleton.balance { height: 150px; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 主内容 */
.main-section {
  max-width: 500px;
  margin: 0 auto;
  padding: 0 16px;
}

/* 标签 */
.tabs {
  display: flex;
  background: white;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.tab.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

/* 收益列表 */
.earnings-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.earnings-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.item-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.item-icon.income {
  background: #d1fae5;
  color: #10b981;
}

.item-icon.expense {
  background: #fef3c7;
  color: #f59e0b;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.item-desc {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-time {
  font-size: 11px;
  color: #aaa;
  margin-top: 2px;
}

.item-amount {
  font-size: 16px;
  font-weight: 700;
}

.item-amount.positive { color: #10b981; }
.item-amount.negative { color: #f59e0b; }

/* 付费内容列表 */
.content-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.content-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: all 0.2s;
}

.content-item:active {
  transform: scale(0.98);
}

.content-cover {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.content-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  font-size: 28px;
}

.price-tag {
  position: absolute;
  bottom: 6px;
  left: 6px;
  background: rgba(0,0,0,0.7);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.content-info {
  flex: 1;
  min-width: 0;
}

.content-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.content-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.content-stats span {
  display: flex;
  align-items: center;
  gap: 3px;
}

.content-revenue {
  font-size: 13px;
  color: #666;
}

.content-revenue strong {
  color: #10b981;
  font-weight: 700;
}

.arrow {
  color: #ccc;
  font-size: 20px;
}

/* 空状态 & 加载 */
.empty, .loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: #aaa;
}

.empty svg, .loading svg {
  font-size: 48px;
  margin-bottom: 12px;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
  padding: 16px 0;
}

.pagination button {
  width: 36px;
  height: 36px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #666;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination span {
  font-size: 13px;
  color: #888;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  width: 100%;
  max-width: 340px;
  background: white;
  border-radius: 20px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}

.modal-header .close {
  background: none;
  border: none;
  font-size: 22px;
  color: #888;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.balance-info {
  display: flex;
  justify-content: space-between;
  padding: 14px;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 16px;
}

.balance-info span { color: #666; font-size: 14px; }
.balance-info strong { color: #6366f1; font-size: 18px; }

.input-row {
  display: flex;
  gap: 10px;
}

.input-row input {
  flex: 1;
  padding: 14px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
}

.input-row input:focus {
  outline: none;
  border-color: #6366f1;
}

.input-row .all {
  padding: 14px 16px;
  border: none;
  border-radius: 12px;
  background: #f0f0f0;
  font-size: 14px;
  cursor: pointer;
}

.hint { font-size: 12px; color: #888; margin: 10px 0 0; }
.error { font-size: 13px; color: #ef4444; margin: 10px 0 0; }

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
}

.modal-footer button {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.modal-footer .cancel {
  background: #f0f0f0;
  border: none;
  color: #666;
}

.modal-footer .confirm {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.modal-footer .confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
