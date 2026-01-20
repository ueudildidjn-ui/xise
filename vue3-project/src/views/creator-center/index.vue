<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import * as echarts from 'echarts'
import { creatorCenterApi } from '@/api/index.js'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

// 数据状态
const loading = ref(true)
const withdrawLoading = ref(false)
const activeTab = ref('earnings')

// 图表引用
const chartRef = ref(null)
let chartInstance = null

// 趋势数据
const trends = ref({
  labels: [],
  views: [],
  likes: [],
  collects: [],
  followers: []
})

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

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return
  
  chartInstance = echarts.init(chartRef.value)
  updateChart()
  
  // 响应窗口大小变化
  window.addEventListener('resize', handleResize)
}

// 更新图表
const updateChart = () => {
  if (!chartInstance) return
  
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e0e0e0',
      borderWidth: 1,
      textStyle: { color: '#333' },
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['关注', '浏览', '点赞', '收藏'],
      bottom: 0,
      textStyle: { fontSize: 12 }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: trends.value.labels,
      axisLine: { lineStyle: { color: '#e0e0e0' } },
      axisLabel: { color: '#666', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      axisLabel: { color: '#888', fontSize: 11 }
    },
    series: [
      {
        name: '关注',
        type: 'bar',
        data: trends.value.followers,
        itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] },
        barWidth: '15%'
      },
      {
        name: '浏览',
        type: 'bar',
        data: trends.value.views,
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
        barWidth: '15%'
      },
      {
        name: '点赞',
        type: 'bar',
        data: trends.value.likes,
        itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
        barWidth: '15%'
      },
      {
        name: '收藏',
        type: 'bar',
        data: trends.value.collects,
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        barWidth: '15%'
      }
    ]
  }
  
  chartInstance.setOption(option)
}

const handleResize = () => {
  chartInstance?.resize()
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

// 加载趋势数据
const loadTrends = async () => {
  try {
    const response = await creatorCenterApi.getTrends()
    if (response.success) {
      trends.value = response.data
      await nextTick()
      updateChart()
    }
  } catch (error) {
    console.error('获取趋势失败:', error)
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

// 返回上一页
const goBack = () => {
  router.back()
}

// 跳转帖子
const goToPost = (postId) => {
  router.push({ name: 'post_detail', query: { id: postId } })
}

onMounted(async () => {
  if (!userStore.isLoggedIn) { router.push('/user'); return }
  await loadConfig()
  await loadOverview()
  await loadTrends()
  await loadEarningsLog()
  await nextTick()
  initChart()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<template>
  <div class="creator-center">
    <!-- 自定义顶部栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="goBack">
        <Icon icon="mdi:arrow-left" />
      </button>
      <h1 class="title">创作者中心</h1>
      <div class="spacer"></div>
    </div>

    <!-- 用户信息和余额 -->
    <div class="header-section" v-if="!loading">
      <div class="user-card">
        <div class="user-info">
          <img :src="userStore.userInfo?.avatar || '/default-avatar.png'" :alt="userStore.userInfo?.nickname || '用户头像'" class="avatar" />
          <div class="user-details">
            <h2 class="username">{{ userStore.userInfo?.nickname || userStore.userInfo?.username || '创作者' }}</h2>
            <div class="balance-info">
              <span class="balance-label">可提现</span>
              <span class="balance-value">¥{{ formatMoney(overview.balance) }}</span>
              <button v-if="config.withdrawEnabled" class="withdraw-btn" :disabled="overview.balance < config.minWithdrawAmount" @click="openWithdrawModal">
                提现
              </button>
            </div>
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">+{{ formatMoney(overview.today_earnings) }}</span>
            <span class="stat-label">今日收益</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">+{{ formatMoney(overview.month_earnings) }}</span>
            <span class="stat-label">本月收益</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ formatMoney(overview.total_earnings) }}</span>
            <span class="stat-label">累计收益</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载骨架 -->
    <div class="loading-container" v-if="loading">
      <div class="skeleton card"></div>
      <div class="skeleton chart"></div>
    </div>

    <!-- 图表区域 -->
    <div class="chart-section" v-if="!loading">
      <div class="section-header">
        <h3>近7天数据趋势</h3>
      </div>
      <div class="chart-container">
        <div ref="chartRef" class="chart"></div>
      </div>
    </div>

    <!-- 标签和内容区 -->
    <div class="content-section" v-if="!loading">
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'earnings' }" @click="switchTab('earnings')">
          收益明细
        </button>
        <button class="tab" :class="{ active: activeTab === 'content' }" @click="switchTab('content')">
          付费内容
        </button>
      </div>

      <!-- 收益明细 -->
      <div class="tab-content" v-show="activeTab === 'earnings'">
        <div class="list" v-if="!earningsLoading && earningsLog.length > 0">
          <div class="list-item" v-for="item in earningsLog" :key="item.id">
            <div class="item-icon" :class="item.amount >= 0 ? 'income' : 'expense'">
              <Icon :icon="item.amount >= 0 ? 'mdi:trending-up' : 'mdi:trending-down'" />
            </div>
            <div class="item-info">
              <span class="item-title">{{ getEarningsTypeLabel(item.type) }}</span>
              <span class="item-desc">{{ item.reason || '-' }}</span>
              <span class="item-time">{{ formatDate(item.created_at) }}</span>
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

        <div class="loading-spinner" v-else>
          <Icon icon="mdi:loading" class="spin" />
        </div>

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
              <div class="price-badge">¥{{ formatMoney(item.price) }}</div>
            </div>
            <div class="content-info">
              <h4 class="content-title">{{ item.title || '无标题' }}</h4>
              <div class="content-stats">
                <span><Icon icon="mdi:eye-outline" /> {{ formatNumber(item.view_count || 0) }}</span>
                <span><Icon icon="mdi:cart-outline" /> {{ item.sales_count || 0 }}人购买</span>
              </div>
              <div class="content-revenue">
                收入 <strong>¥{{ formatMoney(item.total_revenue || 0) }}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="empty" v-else-if="!contentLoading">
          <Icon icon="mdi:file-document-outline" />
          <p>暂无付费内容</p>
        </div>

        <div class="loading-spinner" v-else>
          <Icon icon="mdi:loading" class="spin" />
        </div>

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
            <div class="modal-balance">
              <span>可提现</span>
              <strong>¥{{ formatMoney(overview.balance) }}</strong>
            </div>
            <div class="input-group">
              <input type="number" v-model="withdrawAmount" placeholder="输入金额" />
              <button class="all-btn" @click="withdrawAll">全部</button>
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
  </div>
</template>

<style scoped>
.creator-center {
  min-height: 100vh;
  background: #f8f9fc;
  padding-bottom: 40px;
}

/* 顶部栏 */
.top-bar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f5f5f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  color: #333;
}

.title {
  flex: 1;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}

.spacer {
  width: 36px;
}

/* 用户卡片 */
.header-section {
  padding: 16px;
}

.user-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 20px;
  color: white;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.3);
  object-fit: cover;
}

.user-details {
  flex: 1;
}

.username {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
}

.balance-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.balance-label {
  font-size: 13px;
  opacity: 0.8;
}

.balance-value {
  font-size: 20px;
  font-weight: 700;
}

.withdraw-btn {
  padding: 4px 14px;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 16px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  margin-left: 8px;
}

.withdraw-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stats-grid {
  display: flex;
  justify-content: space-around;
  background: rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 14px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 16px;
  font-weight: 600;
}

.stat-label {
  display: block;
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
}

/* 加载骨架 */
.loading-container {
  padding: 16px;
}

.skeleton {
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 16px;
}

.skeleton.card { height: 180px; margin-bottom: 16px; }
.skeleton.chart { height: 260px; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 图表区域 */
.chart-section {
  margin: 0 16px 16px;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.section-header {
  padding: 16px 16px 0;
}

.section-header h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: #333;
}

.chart-container {
  padding: 8px;
}

.chart {
  width: 100%;
  height: 220px;
}

/* 内容区域 */
.content-section {
  margin: 0 16px;
}

.tabs {
  display: flex;
  background: white;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.tab {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  background: #667eea;
  color: white;
}

/* 列表 */
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
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

.item-icon.income { background: #e7f9ef; color: #10b981; }
.item-icon.expense { background: #fef3c7; color: #f59e0b; }

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.item-desc {
  display: block;
  font-size: 12px;
  color: #888;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-time {
  display: block;
  font-size: 11px;
  color: #aaa;
  margin-top: 2px;
}

.item-amount {
  font-size: 15px;
  font-weight: 600;
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
  gap: 12px;
  background: white;
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
  cursor: pointer;
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

.price-badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  background: rgba(0,0,0,0.7);
  color: white;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 8px;
}

.content-info {
  flex: 1;
  min-width: 0;
}

.content-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
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
}

/* 空状态和加载 */
.empty, .loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50px 20px;
  color: #aaa;
  background: white;
  border-radius: 12px;
}

.empty svg, .loading-spinner svg {
  font-size: 42px;
  margin-bottom: 10px;
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
  padding: 12px 0;
}

.pagination button {
  width: 34px;
  height: 34px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
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
  border-radius: 16px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  font-size: 16px;
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
  padding: 18px;
}

.modal-balance {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #f8f9fc;
  border-radius: 10px;
  margin-bottom: 14px;
}

.modal-balance span { color: #666; font-size: 14px; }
.modal-balance strong { color: #667eea; font-size: 18px; }

.input-group {
  display: flex;
  gap: 10px;
}

.input-group input {
  flex: 1;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
}

.input-group input:focus {
  outline: none;
  border-color: #667eea;
}

.all-btn {
  padding: 12px 14px;
  border: none;
  border-radius: 10px;
  background: #f0f0f0;
  font-size: 14px;
  cursor: pointer;
}

.hint { font-size: 12px; color: #888; margin: 10px 0 0; }
.error { font-size: 13px; color: #ef4444; margin: 10px 0 0; }

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid #f0f0f0;
}

.modal-footer button {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.modal-footer .cancel {
  background: #f0f0f0;
  border: none;
  color: #666;
}

.modal-footer .confirm {
  background: #667eea;
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
