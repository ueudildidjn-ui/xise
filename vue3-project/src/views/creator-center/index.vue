<script setup>
import { ref, computed, onMounted } from 'vue'
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
const claimLoading = ref(false)
const activeTab = ref('overview')

// 配置信息
const config = ref({
  platformFeeRate: 0.10,
  creatorShareRate: 0.90,
  withdrawEnabled: false,
  minWithdrawAmount: 10,
  extendedEarnings: { enabled: false, rates: {}, dailyCap: 0 }
})

// 概览数据
const overview = ref({
  balance: 0,
  total_earnings: 0,
  withdrawn_amount: 0,
  today_earnings: 0,
  month_earnings: 0,
  extended_earnings: {
    today: { enabled: false, total: 0 },
    month: { enabled: false, total: 0 }
  }
})

// 收益明细
const earningsLog = ref([])
const earningsLogPagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const earningsLoading = ref(false)

// 提现相关
const showWithdrawModal = ref(false)
const withdrawAmount = ref('')
const withdrawError = ref('')

// 激励奖励领取状态
const incentiveClaimed = ref(false)
const claimMessage = ref('')

// 格式化金额
const formatMoney = (amount) => {
  const num = parseFloat(amount) || 0
  return num.toFixed(2)
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

// 切换标签
const switchTab = (tab) => {
  activeTab.value = tab
  if (tab === 'earnings' && earningsLog.value.length === 0) loadEarningsLog()
}

// 领取激励奖励
const claimIncentive = async () => {
  try {
    claimLoading.value = true
    claimMessage.value = ''
    const response = await creatorCenterApi.claimIncentive()
    if (response.success) {
      incentiveClaimed.value = true
      claimMessage.value = response.message
      await loadOverview()
      if (activeTab.value === 'earnings') await loadEarningsLog()
    } else {
      claimMessage.value = response.message
      if (response.data?.alreadyClaimed) incentiveClaimed.value = true
    }
  } catch (error) {
    claimMessage.value = error.message || '领取失败'
  } finally {
    claimLoading.value = false
  }
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
    } else {
      withdrawError.value = response.message || '提现失败'
    }
  } catch (error) {
    withdrawError.value = error.message || '提现失败'
  } finally {
    withdrawLoading.value = false
  }
}

onMounted(async () => {
  if (!userStore.isLoggedIn) { router.push('/user'); return }
  await loadConfig()
  await loadOverview()
})
</script>

<template>
  <div class="creator-center">
    <!-- 顶部渐变背景 -->
    <div class="header-bg"></div>
    
    <div class="main-content">
      <!-- 用户信息卡片 -->
      <div class="profile-card" v-if="!loading">
        <div class="profile-avatar">
          <img :src="userStore.userInfo?.avatar || '/default-avatar.png'" alt="头像" />
        </div>
        <div class="profile-info">
          <h2 class="profile-name">{{ userStore.userInfo?.nickname || userStore.userInfo?.username || '创作者' }}</h2>
          <p class="profile-desc">创作者中心</p>
        </div>
        <div class="profile-badge">
          <Icon icon="mdi:verified" />
        </div>
      </div>

      <!-- 收益总览卡片 -->
      <div class="balance-card" v-if="!loading">
        <div class="card-glow"></div>
        <div class="balance-main">
          <div class="balance-label">可提现余额</div>
          <div class="balance-amount">
            <span class="currency">¥</span>
            <span class="value">{{ formatMoney(overview.balance) }}</span>
          </div>
          <button v-if="config.withdrawEnabled" class="withdraw-btn" :disabled="overview.balance < config.minWithdrawAmount" @click="openWithdrawModal">
            <Icon icon="mdi:bank-transfer-out" /> 提现
          </button>
        </div>
        <div class="balance-stats">
          <div class="stat-item">
            <span class="stat-label">今日</span>
            <span class="stat-value">+{{ formatMoney(overview.today_earnings) }}</span>
          </div>
          <div class="divider"></div>
          <div class="stat-item">
            <span class="stat-label">本月</span>
            <span class="stat-value">+{{ formatMoney(overview.month_earnings) }}</span>
          </div>
          <div class="divider"></div>
          <div class="stat-item">
            <span class="stat-label">累计</span>
            <span class="stat-value">{{ formatMoney(overview.total_earnings) }}</span>
          </div>
        </div>
      </div>

      <!-- 激励奖励卡片 -->
      <div class="incentive-card" v-if="!loading && config.extendedEarnings?.enabled">
        <div class="incentive-header">
          <Icon icon="mdi:gift-outline" class="incentive-icon" />
          <div class="incentive-title">
            <h3>今日激励奖励</h3>
            <p>基于浏览、点赞、收藏、评论、新粉丝</p>
          </div>
        </div>
        <div class="incentive-amount">
          <span class="amount">+{{ formatMoney(overview.extended_earnings?.today?.total || 0) }}</span>
          <span class="unit">石榴点</span>
        </div>
        <div class="incentive-details" v-if="overview.extended_earnings?.today?.enabled">
          <div class="detail-item" v-if="overview.extended_earnings.today.views?.count > 0">
            <Icon icon="mdi:eye" /> {{ overview.extended_earnings.today.views.count }}浏览
          </div>
          <div class="detail-item" v-if="overview.extended_earnings.today.likes?.count > 0">
            <Icon icon="mdi:heart" /> {{ overview.extended_earnings.today.likes.count }}点赞
          </div>
          <div class="detail-item" v-if="overview.extended_earnings.today.collects?.count > 0">
            <Icon icon="mdi:star" /> {{ overview.extended_earnings.today.collects.count }}收藏
          </div>
          <div class="detail-item" v-if="overview.extended_earnings.today.comments?.count > 0">
            <Icon icon="mdi:comment" /> {{ overview.extended_earnings.today.comments.count }}评论
          </div>
          <div class="detail-item" v-if="overview.extended_earnings.today.followers?.count > 0">
            <Icon icon="mdi:account-plus" /> {{ overview.extended_earnings.today.followers.count }}粉丝
          </div>
        </div>
        <button class="claim-btn" :disabled="claimLoading || incentiveClaimed || (overview.extended_earnings?.today?.total || 0) <= 0" @click="claimIncentive">
          <Icon v-if="claimLoading" icon="mdi:loading" class="spin" />
          <Icon v-else-if="incentiveClaimed" icon="mdi:check-circle" />
          <span>{{ incentiveClaimed ? '已领取' : claimLoading ? '领取中...' : '立即领取' }}</span>
        </button>
        <div class="claim-message" v-if="claimMessage">{{ claimMessage }}</div>
      </div>

      <!-- 加载骨架 -->
      <div class="skeleton-loader" v-if="loading">
        <div class="skeleton-card profile"></div>
        <div class="skeleton-card balance"></div>
        <div class="skeleton-card incentive"></div>
      </div>

      <!-- 标签导航 -->
      <div class="tabs-nav" v-if="!loading">
        <button class="tab-btn" :class="{ active: activeTab === 'overview' }" @click="switchTab('overview')">
          <Icon icon="mdi:view-dashboard" /> 收益规则
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'earnings' }" @click="switchTab('earnings')">
          <Icon icon="mdi:format-list-bulleted" /> 收益明细
        </button>
      </div>

      <!-- 收益规则 -->
      <div class="tab-content" v-show="activeTab === 'overview' && !loading">
        <div class="rules-section">
          <div class="rule-card">
            <div class="rule-header">
              <Icon icon="mdi:cash-multiple" />
              <h4>付费内容收益</h4>
            </div>
            <p>用户购买您的付费内容时，平台收取 {{ (config.platformFeeRate * 100).toFixed(0) }}% 服务费，您获得 {{ (config.creatorShareRate * 100).toFixed(0) }}% 收益</p>
          </div>
          <div class="rule-card" v-if="config.extendedEarnings?.enabled">
            <div class="rule-header">
              <Icon icon="mdi:gift" />
              <h4>激励奖励</h4>
            </div>
            <p>每日根据互动数据获得激励奖励，需主动领取</p>
            <div class="rate-grid">
              <div class="rate-item"><span>每次浏览</span><strong>+{{ config.extendedEarnings.rates.perView }}</strong></div>
              <div class="rate-item"><span>每次点赞</span><strong>+{{ config.extendedEarnings.rates.perLike }}</strong></div>
              <div class="rate-item"><span>每次收藏</span><strong>+{{ config.extendedEarnings.rates.perCollect }}</strong></div>
              <div class="rate-item"><span>每条评论</span><strong>+{{ config.extendedEarnings.rates.perComment }}</strong></div>
              <div class="rate-item"><span>每位粉丝</span><strong>+{{ config.extendedEarnings.rates.perFollower }}</strong></div>
            </div>
            <p v-if="config.extendedEarnings.dailyCap > 0" class="cap-note">每日上限: {{ config.extendedEarnings.dailyCap }} 石榴点</p>
          </div>
          <div class="rule-card" v-if="config.withdrawEnabled">
            <div class="rule-header">
              <Icon icon="mdi:bank-transfer" />
              <h4>提现规则</h4>
            </div>
            <p>收益满 {{ config.minWithdrawAmount }} 石榴点可提现到您的石榴点余额</p>
          </div>
        </div>
      </div>

      <!-- 收益明细 -->
      <div class="tab-content" v-show="activeTab === 'earnings' && !loading">
        <div class="list-container" v-if="!earningsLoading && earningsLog.length > 0">
          <div class="list-item" v-for="log in earningsLog" :key="log.id">
            <div class="item-icon" :class="log.amount >= 0 ? 'income' : 'expense'">
              <Icon :icon="log.amount >= 0 ? 'mdi:arrow-down' : 'mdi:arrow-up'" />
            </div>
            <div class="item-main">
              <div class="item-type">{{ getEarningsTypeLabel(log.type) }}</div>
              <div class="item-desc">{{ log.reason || '-' }}</div>
              <div class="item-time">{{ formatDate(log.created_at) }}</div>
            </div>
            <div class="item-amount" :class="log.amount >= 0 ? 'positive' : 'negative'">
              {{ log.amount >= 0 ? '+' : '' }}{{ formatMoney(log.amount) }}
            </div>
          </div>
        </div>
        <div class="empty-state" v-else-if="!earningsLoading">
          <Icon icon="mdi:receipt-text-outline" />
          <p>暂无收益记录</p>
        </div>
        <div class="loading-state" v-else>
          <Icon icon="mdi:loading" class="spin" />
          <p>加载中...</p>
        </div>
        <div class="pagination" v-if="earningsLogPagination.totalPages > 1">
          <button :disabled="earningsLogPagination.page <= 1" @click="loadEarningsLog(earningsLogPagination.page - 1)">上一页</button>
          <span>{{ earningsLogPagination.page }} / {{ earningsLogPagination.totalPages }}</span>
          <button :disabled="earningsLogPagination.page >= earningsLogPagination.totalPages" @click="loadEarningsLog(earningsLogPagination.page + 1)">下一页</button>
        </div>
      </div>
    </div>

    <!-- 提现弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showWithdrawModal" @click.self="closeWithdrawModal">
        <div class="modal-container">
          <div class="modal-header">
            <h3><Icon icon="mdi:bank-transfer-out" /> 提现到余额</h3>
            <button class="close-btn" @click="closeWithdrawModal"><Icon icon="mdi:close" /></button>
          </div>
          <div class="modal-body">
            <div class="balance-display">
              <span>可提现</span>
              <strong>{{ formatMoney(overview.balance) }}</strong>
            </div>
            <div class="input-group">
              <input type="number" v-model="withdrawAmount" placeholder="输入金额" />
              <button class="all-btn" @click="withdrawAll">全部</button>
            </div>
            <p class="hint">最低: {{ config.minWithdrawAmount }} 石榴点</p>
            <p class="error" v-if="withdrawError">{{ withdrawError }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="closeWithdrawModal">取消</button>
            <button class="btn-confirm" @click="doWithdraw" :disabled="withdrawLoading">
              <Icon v-if="withdrawLoading" icon="mdi:loading" class="spin" />
              {{ withdrawLoading ? '处理中' : '确认' }}
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
  background: #f5f7fa;
  padding-bottom: 100px;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 0 30px 30px;
}

.main-content {
  position: relative;
  max-width: 500px;
  margin: 0 auto;
  padding: 70px 16px 20px;
}

/* 用户信息卡片 */
.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #667eea;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 4px;
}

.profile-desc {
  font-size: 13px;
  color: #888;
  margin: 0;
}

.profile-badge {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
}

/* 余额卡片 */
.balance-card {
  position: relative;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 20px;
  padding: 24px;
  color: white;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(26, 26, 46, 0.3);
}

.card-glow {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(102, 126, 234, 0.4) 0%, transparent 70%);
}

.balance-main {
  position: relative;
  z-index: 1;
  text-align: center;
  margin-bottom: 20px;
}

.balance-label {
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.balance-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 16px;
}

.balance-amount .currency {
  font-size: 24px;
  font-weight: 500;
}

.balance-amount .value {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -1px;
}

.withdraw-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border: none;
  border-radius: 25px;
  background: rgba(255,255,255,0.15);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.withdraw-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.25);
}

.withdraw-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.balance-stats {
  display: flex;
  justify-content: space-around;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
}

.divider {
  width: 1px;
  background: rgba(255,255,255,0.15);
}

/* 激励奖励卡片 */
.incentive-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.06);
}

.incentive-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.incentive-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
}

.incentive-title h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 4px;
}

.incentive-title p {
  font-size: 12px;
  color: #888;
  margin: 0;
}

.incentive-amount {
  text-align: center;
  margin-bottom: 16px;
}

.incentive-amount .amount {
  font-size: 32px;
  font-weight: 700;
  color: #f5576c;
}

.incentive-amount .unit {
  font-size: 14px;
  color: #888;
  margin-left: 4px;
}

.incentive-details {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-bottom: 16px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f8f9fa;
  border-radius: 20px;
  font-size: 12px;
  color: #666;
}

.detail-item svg {
  font-size: 14px;
  color: #667eea;
}

.claim-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s;
}

.claim-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.claim-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.claim-message {
  text-align: center;
  font-size: 13px;
  color: #888;
  margin-top: 10px;
}

/* 骨架屏 */
.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-card {
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 16px;
}

.skeleton-card.profile { height: 88px; }
.skeleton-card.balance { height: 180px; }
.skeleton-card.incentive { height: 200px; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 标签导航 */
.tabs-nav {
  display: flex;
  background: white;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.04);
}

.tab-btn {
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

.tab-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

/* 收益规则 */
.rules-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-card {
  background: white;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.04);
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.rule-header svg {
  font-size: 22px;
  color: #667eea;
}

.rule-header h4 {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.rule-card p {
  font-size: 13px;
  color: #666;
  margin: 0;
  line-height: 1.6;
}

.rate-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.rate-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 12px;
}

.rate-item span { color: #666; }
.rate-item strong { color: #10b981; }

.cap-note {
  margin-top: 10px !important;
  padding: 8px;
  background: #fff3cd;
  border-radius: 8px;
  color: #856404 !important;
  text-align: center;
}

/* 列表 */
.list-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.item-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.item-icon.income {
  background: #d1fae5;
  color: #10b981;
}

.item-icon.expense {
  background: #fee2e2;
  color: #ef4444;
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-type {
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

/* 空状态 & 加载 */
.empty-state, .loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50px 20px;
  color: #aaa;
}

.empty-state svg, .loading-state svg {
  font-size: 50px;
  margin-bottom: 12px;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.pagination button {
  padding: 10px 18px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  background: white;
  font-size: 13px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
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

.modal-container {
  width: 100%;
  max-width: 360px;
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
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: #888;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.balance-display {
  display: flex;
  justify-content: space-between;
  padding: 14px;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 16px;
}

.balance-display span { color: #666; font-size: 14px; }
.balance-display strong { color: #667eea; font-size: 18px; }

.input-group {
  display: flex;
  gap: 10px;
}

.input-group input {
  flex: 1;
  padding: 14px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
}

.input-group input:focus {
  outline: none;
  border-color: #667eea;
}

.all-btn {
  padding: 14px 18px;
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

.btn-cancel, .btn-confirm {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel {
  background: #f0f0f0;
  border: none;
  color: #666;
}

.btn-confirm {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
