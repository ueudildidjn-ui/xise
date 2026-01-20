<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { creatorCenterApi } from '@/api/index.js'
import { useUserStore } from '@/stores/user'
import BackToTopButton from '@/components/BackToTopButton.vue'
import * as echarts from 'echarts'

const router = useRouter()
const userStore = useUserStore()

// 图表实例
let earningsChartInstance = null
let trendsChartInstance = null

// 数据状态
const loading = ref(true)
const withdrawLoading = ref(false)
const activeTab = ref('overview')

// 配置信息
const config = ref({
  platformFeeRate: 0.10,
  creatorShareRate: 0.90,
  withdrawEnabled: false,
  minWithdrawAmount: 10,
  extendedEarnings: {
    enabled: false,
    rates: {
      perView: 0.01,
      perLike: 0.05,
      perCollect: 0.10,
      perComment: 0.02,
      perFollower: 0.20
    },
    dailyCap: 0
  }
})

// 概览数据
const overview = ref({
  balance: 0,
  total_earnings: 0,
  withdrawn_amount: 0,
  today_earnings: 0,
  month_earnings: 0,
  content_stats: {
    total_posts: 0,
    paid_posts: 0,
    total_views: 0,
    total_likes: 0,
    total_collects: 0,
    total_buyers: 0
  },
  extended_earnings: {
    today: { enabled: false, total: 0 },
    month: { enabled: false, total: 0 }
  }
})

// 趋势数据
const trends = ref({
  labels: [],
  earnings: [],
  views: [],
  interactions: [],
  followers: []
})
const trendsLoading = ref(false)

// 收益明细
const earningsLog = ref([])
const earningsLogPagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const earningsLoading = ref(false)

// 付费内容
const paidContent = ref([])
const paidContentPagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
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
  return date.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

// 获取收益类型标签
const getEarningsTypeLabel = (type) => {
  const typeMap = {
    content_sale: '内容销售',
    subscription: '订阅收入',
    tip: '打赏收入',
    withdraw: '提现',
    view: '浏览收益',
    like: '点赞收益',
    collect: '收藏收益',
    comment: '评论收益',
    follower: '粉丝收益'
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

// 加载趋势数据
const loadTrends = async () => {
  try {
    trendsLoading.value = true
    const response = await creatorCenterApi.getTrends()
    if (response.success) {
      trends.value = response.data
      await nextTick()
      initEarningsChart()
      initTrendsChart()
    }
  } catch (error) {
    console.error('获取趋势失败:', error)
  } finally {
    trendsLoading.value = false
  }
}

// 初始化收益图表
const initEarningsChart = () => {
  const chartDom = document.getElementById('earnings-chart')
  if (!chartDom) return
  if (earningsChartInstance) earningsChartInstance.dispose()
  earningsChartInstance = echarts.init(chartDom)
  
  earningsChartInstance.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#eee', textStyle: { color: '#333' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: { type: 'category', data: trends.value.labels, axisLine: { lineStyle: { color: '#e0e0e0' } }, axisLabel: { color: '#888' } },
    yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: '#f5f5f5' } }, axisLabel: { color: '#888' } },
    series: [{
      name: '收益', type: 'bar', data: trends.value.earnings, barWidth: '60%',
      itemStyle: { 
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#6366f1' }, { offset: 1, color: '#8b5cf6' }
        ]), 
        borderRadius: [8, 8, 0, 0] 
      }
    }]
  })
}

// 初始化趋势图表
const initTrendsChart = () => {
  const chartDom = document.getElementById('trends-chart')
  if (!chartDom) return
  if (trendsChartInstance) trendsChartInstance.dispose()
  trendsChartInstance = echarts.init(chartDom)
  
  trendsChartInstance.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#eee', textStyle: { color: '#333' } },
    legend: { data: ['浏览', '互动', '粉丝'], bottom: 0, textStyle: { color: '#888' } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: trends.value.labels, axisLine: { lineStyle: { color: '#e0e0e0' } }, axisLabel: { color: '#888' } },
    yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: '#f5f5f5' } }, axisLabel: { color: '#888' } },
    series: [
      { name: '浏览', type: 'line', smooth: true, data: trends.value.views, lineStyle: { color: '#10b981', width: 3 }, itemStyle: { color: '#10b981' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(16, 185, 129, 0.25)' }, { offset: 1, color: 'rgba(16, 185, 129, 0.02)' }]) } },
      { name: '互动', type: 'line', smooth: true, data: trends.value.interactions, lineStyle: { color: '#f59e0b', width: 3 }, itemStyle: { color: '#f59e0b' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(245, 158, 11, 0.25)' }, { offset: 1, color: 'rgba(245, 158, 11, 0.02)' }]) } },
      { name: '粉丝', type: 'line', smooth: true, data: trends.value.followers, lineStyle: { color: '#6366f1', width: 3 }, itemStyle: { color: '#6366f1' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(99, 102, 241, 0.25)' }, { offset: 1, color: 'rgba(99, 102, 241, 0.02)' }]) } }
    ]
  })
}

const handleResize = () => {
  earningsChartInstance?.resize()
  trendsChartInstance?.resize()
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
    } else {
      withdrawError.value = response.message || '提现失败'
    }
  } catch (error) {
    withdrawError.value = error.message || '提现失败'
  } finally {
    withdrawLoading.value = false
  }
}

const goToPost = (postId) => { router.push({ name: 'post_detail', query: { id: postId } }) }

onMounted(async () => {
  if (!userStore.isLoggedIn) { router.push('/user'); return }
  await loadConfig()
  await loadOverview()
  await loadTrends()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  earningsChartInstance?.dispose()
  trendsChartInstance?.dispose()
})
</script>

<template>
  <div class="creator-center">
    <!-- 顶部背景装饰 -->
    <div class="header-bg"></div>
    
    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 标题区域 -->
      <div class="page-header">
        <div class="header-content">
          <h1 class="page-title">
            <Icon icon="mdi:creation" class="title-icon" />
            创作者中心
          </h1>
          <p class="page-subtitle">管理您的创作收益与数据分析</p>
        </div>
      </div>

      <!-- 核心数据卡片 -->
      <div class="hero-cards" v-if="!loading">
        <!-- 余额卡片 -->
        <div class="hero-card balance-card">
          <div class="card-glow"></div>
          <div class="card-content">
            <div class="card-label">
              <Icon icon="mdi:wallet-outline" />
              <span>可提现收益</span>
            </div>
            <div class="card-amount">
              <span class="currency">¥</span>
              <span class="value">{{ formatMoney(overview.balance) }}</span>
            </div>
            <button v-if="config.withdrawEnabled" class="withdraw-btn" :disabled="overview.balance < config.minWithdrawAmount" @click="openWithdrawModal">
              <Icon icon="mdi:bank-transfer-out" />
              立即提现
            </button>
          </div>
          <div class="card-decoration">
            <Icon icon="mdi:chart-line-variant" />
          </div>
        </div>

        <!-- 统计卡片组 -->
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-icon today"><Icon icon="mdi:calendar-today" /></div>
            <div class="stat-info">
              <span class="stat-value">{{ formatMoney(overview.today_earnings) }}</span>
              <span class="stat-label">今日收益</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon month"><Icon icon="mdi:calendar-month" /></div>
            <div class="stat-info">
              <span class="stat-value">{{ formatMoney(overview.month_earnings) }}</span>
              <span class="stat-label">本月收益</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon total"><Icon icon="mdi:chart-line" /></div>
            <div class="stat-info">
              <span class="stat-value">{{ formatMoney(overview.total_earnings) }}</span>
              <span class="stat-label">累计收益</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载骨架 -->
      <div class="skeleton-loader" v-else>
        <div class="skeleton-card large"></div>
        <div class="skeleton-row">
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
        </div>
      </div>

      <!-- 数据概览网格 -->
      <div class="data-grid" v-if="!loading">
        <div class="grid-item" v-for="(item, index) in [
          { icon: 'mdi:file-document-multiple', label: '发布内容', value: overview.content_stats.total_posts, color: '#6366f1' },
          { icon: 'mdi:eye', label: '总浏览量', value: overview.content_stats.total_views, color: '#10b981' },
          { icon: 'mdi:heart', label: '获得点赞', value: overview.content_stats.total_likes, color: '#ef4444' },
          { icon: 'mdi:star', label: '获得收藏', value: overview.content_stats.total_collects, color: '#f59e0b' },
          { icon: 'mdi:cash-multiple', label: '付费内容', value: overview.content_stats.paid_posts, color: '#8b5cf6' },
          { icon: 'mdi:account-group', label: '购买用户', value: overview.content_stats.total_buyers, color: '#06b6d4' }
        ]" :key="index">
          <div class="grid-icon" :style="{ background: item.color + '15', color: item.color }">
            <Icon :icon="item.icon" />
          </div>
          <div class="grid-value">{{ formatNumber(item.value) }}</div>
          <div class="grid-label">{{ item.label }}</div>
        </div>
      </div>

      <!-- 标签导航 -->
      <div class="tabs-nav">
        <button v-for="tab in [
          { key: 'overview', icon: 'mdi:view-dashboard', label: '数据概览' },
          { key: 'earnings', icon: 'mdi:format-list-bulleted', label: '收益明细' },
          { key: 'content', icon: 'mdi:file-document', label: '付费内容' }
        ]" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }" @click="switchTab(tab.key)">
          <Icon :icon="tab.icon" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- 概览标签内容 -->
      <div class="tab-content" v-show="activeTab === 'overview'">
        <!-- 图表区域 -->
        <div class="charts-section">
          <div class="chart-card">
            <div class="chart-header">
              <h3><Icon icon="mdi:chart-bar" /> 近7天收益</h3>
            </div>
            <div id="earnings-chart" class="chart-body"></div>
          </div>
          <div class="chart-card">
            <div class="chart-header">
              <h3><Icon icon="mdi:trending-up" /> 数据趋势</h3>
            </div>
            <div id="trends-chart" class="chart-body"></div>
          </div>
        </div>

        <!-- 扩展收益配置 -->
        <div class="config-section" v-if="config.extendedEarnings?.enabled">
          <div class="section-header">
            <Icon icon="mdi:cog" />
            <h3>扩展收益算法配置</h3>
          </div>
          <div class="config-grid">
            <div class="config-item" v-for="(item, index) in [
              { icon: 'mdi:eye', label: '每次浏览', value: config.extendedEarnings.rates.perView },
              { icon: 'mdi:heart', label: '每次点赞', value: config.extendedEarnings.rates.perLike },
              { icon: 'mdi:star', label: '每次收藏', value: config.extendedEarnings.rates.perCollect },
              { icon: 'mdi:comment', label: '每条评论', value: config.extendedEarnings.rates.perComment },
              { icon: 'mdi:account-plus', label: '每位粉丝', value: config.extendedEarnings.rates.perFollower }
            ]" :key="index">
              <Icon :icon="item.icon" class="config-icon" />
              <span class="config-label">{{ item.label }}</span>
              <span class="config-value">+{{ item.value }}</span>
            </div>
          </div>
          <div class="daily-cap" v-if="config.extendedEarnings.dailyCap > 0">
            <Icon icon="mdi:shield-check" />
            每日扩展收益上限: {{ config.extendedEarnings.dailyCap }} 石榴点
          </div>
        </div>

        <!-- 扩展收益明细 -->
        <div class="extended-earnings" v-if="overview.extended_earnings?.today?.enabled">
          <div class="section-header">
            <Icon icon="mdi:chart-box" />
            <h3>今日扩展收益</h3>
            <span class="total-badge">+{{ formatMoney(overview.extended_earnings.today.total || 0) }}</span>
          </div>
          <div class="extended-grid">
            <div class="extended-item" v-for="(item, index) in [
              { label: '浏览', count: overview.extended_earnings.today.views?.count, earnings: overview.extended_earnings.today.views?.earnings },
              { label: '点赞', count: overview.extended_earnings.today.likes?.count, earnings: overview.extended_earnings.today.likes?.earnings },
              { label: '收藏', count: overview.extended_earnings.today.collects?.count, earnings: overview.extended_earnings.today.collects?.earnings },
              { label: '评论', count: overview.extended_earnings.today.comments?.count, earnings: overview.extended_earnings.today.comments?.earnings },
              { label: '粉丝', count: overview.extended_earnings.today.followers?.count, earnings: overview.extended_earnings.today.followers?.earnings }
            ]" :key="index">
              <span class="ext-label">{{ item.label }}</span>
              <span class="ext-count">{{ item.count || 0 }}次</span>
              <span class="ext-value">+{{ formatMoney(item.earnings || 0) }}</span>
            </div>
          </div>
        </div>

        <!-- 收益规则 -->
        <div class="rules-card">
          <div class="rules-header">
            <Icon icon="mdi:information" />
            <h3>收益规则</h3>
          </div>
          <div class="rules-content">
            <p>• 付费内容收益：平台收取 {{ (config.platformFeeRate * 100).toFixed(0) }}% 服务费，您获得 {{ (config.creatorShareRate * 100).toFixed(0) }}%</p>
            <p v-if="config.withdrawEnabled">• 收益满 {{ config.minWithdrawAmount }} 石榴点可提现到余额</p>
            <p v-if="config.extendedEarnings?.enabled">• 扩展收益：通过用户浏览、点赞、收藏等互动获得额外收益</p>
          </div>
        </div>
      </div>

      <!-- 收益明细标签内容 -->
      <div class="tab-content" v-show="activeTab === 'earnings'">
        <div class="list-container" v-if="!earningsLoading && earningsLog.length > 0">
          <div class="list-item" v-for="log in earningsLog" :key="log.id">
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

      <!-- 付费内容标签内容 -->
      <div class="tab-content" v-show="activeTab === 'content'">
        <div class="content-grid" v-if="!contentLoading && paidContent.length > 0">
          <div class="content-card" v-for="item in paidContent" :key="item.id" @click="goToPost(item.id)">
            <div class="content-cover">
              <img v-if="item.cover" :src="item.cover" :alt="item.title" />
              <div v-else class="cover-placeholder"><Icon icon="mdi:image" /></div>
            </div>
            <div class="content-info">
              <h4>{{ item.title }}</h4>
              <div class="content-stats">
                <span><Icon icon="mdi:currency-cny" /> {{ formatMoney(item.price) }}</span>
                <span><Icon icon="mdi:cart" /> {{ item.sales_count }}人购买</span>
              </div>
              <div class="content-revenue">总收入: <strong>{{ formatMoney(item.total_revenue) }}</strong></div>
            </div>
          </div>
        </div>
        <div class="empty-state" v-else-if="!contentLoading">
          <Icon icon="mdi:file-document-outline" />
          <p>暂无付费内容</p>
        </div>
        <div class="loading-state" v-else>
          <Icon icon="mdi:loading" class="spin" />
          <p>加载中...</p>
        </div>
        <div class="pagination" v-if="paidContentPagination.totalPages > 1">
          <button :disabled="paidContentPagination.page <= 1" @click="loadPaidContent(paidContentPagination.page - 1)">上一页</button>
          <span>{{ paidContentPagination.page }} / {{ paidContentPagination.totalPages }}</span>
          <button :disabled="paidContentPagination.page >= paidContentPagination.totalPages" @click="loadPaidContent(paidContentPagination.page + 1)">下一页</button>
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
              <span>可提现余额</span>
              <strong>{{ formatMoney(overview.balance) }} 石榴点</strong>
            </div>
            <div class="input-group">
              <input type="number" v-model="withdrawAmount" placeholder="请输入提现金额" :min="config.minWithdrawAmount" :max="overview.balance" />
              <button class="all-btn" @click="withdrawAll">全部</button>
            </div>
            <p class="hint">最低提现金额: {{ config.minWithdrawAmount }} 石榴点</p>
            <p class="error" v-if="withdrawError">{{ withdrawError }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="closeWithdrawModal">取消</button>
            <button class="btn-confirm" @click="doWithdraw" :disabled="withdrawLoading">
              <Icon v-if="withdrawLoading" icon="mdi:loading" class="spin" />
              {{ withdrawLoading ? '处理中...' : '确认提现' }}
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
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding-bottom: 100px;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 280px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  border-radius: 0 0 40px 40px;
  z-index: 0;
}

.main-content {
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
  padding: 80px 16px 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 24px;
}

.page-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 26px;
  font-weight: 700;
  color: white;
  margin: 0 0 8px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.title-icon { font-size: 32px; }

.page-subtitle {
  font-size: 14px;
  color: rgba(255,255,255,0.85);
  margin: 0;
}

/* Hero Cards */
.hero-cards { margin-bottom: 24px; }

.balance-card {
  position: relative;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border-radius: 20px;
  padding: 24px;
  color: white;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 0 10px 40px rgba(99, 102, 241, 0.3);
}

.card-glow {
  position: absolute;
  top: -50%;
  right: -30%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%);
  pointer-events: none;
}

.card-content { position: relative; z-index: 1; }

.card-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 12px;
}

.card-amount {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 20px;
}

.card-amount .currency { font-size: 24px; font-weight: 600; }
.card-amount .value { font-size: 42px; font-weight: 700; letter-spacing: -1px; }

.withdraw-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(10px);
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.withdraw-btn:hover:not(:disabled) { background: rgba(255,255,255,0.25); transform: translateY(-2px); }
.withdraw-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.card-decoration {
  position: absolute;
  right: 20px;
  bottom: 20px;
  font-size: 80px;
  opacity: 0.1;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  transition: transform 0.3s, box-shadow 0.3s;
}

.stat-card:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.stat-icon.today { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #d97706; }
.stat-icon.month { background: linear-gradient(135deg, #dbeafe, #bfdbfe); color: #2563eb; }
.stat-icon.total { background: linear-gradient(135deg, #d1fae5, #a7f3d0); color: #059669; }

.stat-info { display: flex; flex-direction: column; }
.stat-value { font-size: 18px; font-weight: 700; color: #1e293b; }
.stat-label { font-size: 12px; color: #64748b; }

/* Skeleton */
.skeleton-loader { margin-bottom: 24px; }
.skeleton-card { background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 16px; }
.skeleton-card.large { height: 180px; margin-bottom: 16px; }
.skeleton-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.skeleton-row .skeleton-card { height: 80px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Data Grid */
.data-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.grid-item {
  background: white;
  border-radius: 16px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.04);
  transition: transform 0.3s;
}

.grid-item:hover { transform: translateY(-2px); }

.grid-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px;
  font-size: 20px;
}

.grid-value { font-size: 22px; font-weight: 700; color: #1e293b; }
.grid-label { font-size: 12px; color: #64748b; margin-top: 4px; }

/* Tabs */
.tabs-nav {
  display: flex;
  background: white;
  border-radius: 16px;
  padding: 6px;
  margin-bottom: 20px;
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
  border-radius: 12px;
  background: transparent;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

.tab-btn:hover:not(.active) { background: #f1f5f9; color: #1e293b; }

/* Charts */
.charts-section {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}

.chart-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.04);
}

.chart-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px;
}

.chart-body { height: 240px; }

/* Config Section */
.config-section, .extended-earnings {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.04);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.section-header h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0; }
.section-header > svg { font-size: 20px; color: #6366f1; }

.total-badge {
  margin-left: auto;
  background: linear-gradient(135deg, #10b981, #34d399);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.config-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 12px;
  text-align: center;
}

.config-icon { font-size: 24px; color: #6366f1; margin-bottom: 8px; }
.config-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
.config-value { font-size: 16px; font-weight: 700; color: #10b981; }

.daily-cap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
  padding: 10px;
  background: #fef3c7;
  border-radius: 10px;
  font-size: 13px;
  color: #92400e;
}

.extended-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.extended-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 12px;
  text-align: center;
}

.ext-label { font-size: 12px; color: #64748b; }
.ext-count { font-size: 14px; font-weight: 600; color: #1e293b; margin: 4px 0; }
.ext-value { font-size: 14px; font-weight: 700; color: #10b981; }

/* Rules */
.rules-card {
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  border-radius: 16px;
  padding: 20px;
}

.rules-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.rules-header h3 { font-size: 15px; font-weight: 600; color: #1e40af; margin: 0; }
.rules-header svg { color: #3b82f6; font-size: 20px; }
.rules-content p { font-size: 13px; color: #1e40af; margin: 0 0 6px; line-height: 1.6; }

/* List */
.list-container { display: flex; flex-direction: column; gap: 12px; }

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.item-main { flex: 1; }
.item-type { font-size: 14px; font-weight: 600; color: #1e293b; }
.item-desc { font-size: 13px; color: #64748b; margin-top: 4px; }
.item-time { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.item-amount { font-size: 18px; font-weight: 700; }
.item-amount.positive { color: #10b981; }
.item-amount.negative { color: #f59e0b; }

/* Content Grid */
.content-grid {
  display: grid;
  gap: 12px;
}

.content-card {
  display: flex;
  gap: 14px;
  background: white;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
}

.content-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }

.content-cover {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.content-cover img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder { width: 100%; height: 100%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 28px; }

.content-info { flex: 1; min-width: 0; }
.content-info h4 { font-size: 14px; font-weight: 600; color: #1e293b; margin: 0 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.content-stats { display: flex; gap: 12px; font-size: 12px; color: #64748b; margin-bottom: 6px; }
.content-stats span { display: flex; align-items: center; gap: 4px; }
.content-revenue { font-size: 13px; color: #64748b; }
.content-revenue strong { color: #10b981; font-weight: 700; }

/* Empty & Loading */
.empty-state, .loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #94a3b8;
}

.empty-state svg, .loading-state svg { font-size: 56px; margin-bottom: 12px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}

.pagination button {
  padding: 10px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  color: #1e293b;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.pagination button:hover:not(:disabled) { background: #f1f5f9; border-color: #6366f1; color: #6366f1; }
.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
.pagination span { font-size: 14px; color: #64748b; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-container {
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0,0,0,0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f1f5f9;
}

.modal-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.close-btn { background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; }

.modal-body { padding: 20px; }

.balance-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  margin-bottom: 16px;
}

.balance-display span { color: #64748b; font-size: 14px; }
.balance-display strong { color: #6366f1; font-size: 18px; font-weight: 700; }

.input-group { display: flex; gap: 10px; margin-bottom: 12px; }
.input-group input {
  flex: 1;
  padding: 14px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 16px;
  transition: border-color 0.3s;
}
.input-group input:focus { outline: none; border-color: #6366f1; }
.all-btn {
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  background: #f1f5f9;
  color: #1e293b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.3s;
}
.all-btn:hover { background: #e2e8f0; }

.hint { font-size: 12px; color: #94a3b8; margin: 0; }
.error { font-size: 13px; color: #ef4444; margin: 12px 0 0; }

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f1f5f9;
}

.btn-cancel, .btn-confirm {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-cancel { background: #f1f5f9; border: none; color: #64748b; }
.btn-cancel:hover { background: #e2e8f0; }

.btn-confirm {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.btn-confirm:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4); }
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

/* Responsive */
@media (max-width: 600px) {
  .stats-cards { grid-template-columns: 1fr; }
  .data-grid { grid-template-columns: repeat(2, 1fr); }
  .config-grid, .extended-grid { grid-template-columns: repeat(2, 1fr); }
  .stat-card { padding: 14px; }
  .card-amount .value { font-size: 36px; }
}
</style>
