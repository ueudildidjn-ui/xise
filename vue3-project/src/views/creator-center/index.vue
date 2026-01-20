<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
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
const activeTab = ref('overview') // overview, earnings, content

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
  month_earnings: 0,
  content_stats: {
    total_posts: 0,
    paid_posts: 0,
    total_views: 0,
    total_likes: 0,
    total_collects: 0,
    total_buyers: 0
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
const earningsLogPagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})
const earningsLoading = ref(false)

// 付费内容
const paidContent = ref([])
const paidContentPagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})
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

// 格式化数字（带单位）
const formatNumber = (num) => {
  if (num == null || isNaN(num)) return '0'
  const n = Number(num)
  if (n >= 10000) {
    return (n / 10000).toFixed(1) + '万'
  }
  return n.toString()
}

// 格式化日期
const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取收益类型标签
const getEarningsTypeLabel = (type) => {
  const typeMap = {
    content_sale: '内容销售',
    subscription: '订阅收入',
    tip: '打赏收入',
    withdraw: '提现'
  }
  return typeMap[type] || type
}

// 获取收益类型颜色
const getEarningsTypeColor = (type) => {
  if (type === 'withdraw') return 'text-orange-500'
  return 'text-green-500'
}

// 加载配置
const loadConfig = async () => {
  try {
    const response = await creatorCenterApi.getConfig()
    if (response.success) {
      config.value = response.data
    }
  } catch (error) {
    console.error('获取创作者中心配置失败:', error)
  }
}

// 加载概览
const loadOverview = async () => {
  try {
    loading.value = true
    const response = await creatorCenterApi.getOverview()
    if (response.success) {
      overview.value = response.data
    }
  } catch (error) {
    console.error('获取创作者收益概览失败:', error)
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
      // 延迟初始化图表，确保DOM已渲染
      setTimeout(() => {
        initEarningsChart()
        initTrendsChart()
      }, 100)
    }
  } catch (error) {
    console.error('获取趋势数据失败:', error)
  } finally {
    trendsLoading.value = false
  }
}

// 初始化收益趋势图表
const initEarningsChart = () => {
  const chartDom = document.getElementById('earnings-chart')
  if (!chartDom) return
  
  if (earningsChartInstance) {
    earningsChartInstance.dispose()
  }
  
  earningsChartInstance = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: trends.value.labels,
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      },
      axisLabel: {
        color: '#666'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      },
      axisLabel: {
        color: '#666'
      }
    },
    series: [
      {
        name: '收益',
        type: 'bar',
        data: trends.value.earnings,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#8b9df0' },
              { offset: 1, color: '#9a6fc2' }
            ])
          }
        }
      }
    ]
  }
  
  earningsChartInstance.setOption(option)
}

// 初始化综合趋势图表
const initTrendsChart = () => {
  const chartDom = document.getElementById('trends-chart')
  if (!chartDom) return
  
  if (trendsChartInstance) {
    trendsChartInstance.dispose()
  }
  
  trendsChartInstance = echarts.init(chartDom)
  
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['浏览量', '互动数', '新粉丝'],
      bottom: 0,
      textStyle: {
        color: '#666'
      }
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
      boundaryGap: false,
      data: trends.value.labels,
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      },
      axisLabel: {
        color: '#666'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      },
      axisLabel: {
        color: '#666'
      }
    },
    series: [
      {
        name: '浏览量',
        type: 'line',
        smooth: true,
        data: trends.value.views,
        lineStyle: {
          color: '#10b981',
          width: 2
        },
        itemStyle: {
          color: '#10b981'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
          ])
        }
      },
      {
        name: '互动数',
        type: 'line',
        smooth: true,
        data: trends.value.interactions,
        lineStyle: {
          color: '#f59e0b',
          width: 2
        },
        itemStyle: {
          color: '#f59e0b'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
            { offset: 1, color: 'rgba(245, 158, 11, 0.05)' }
          ])
        }
      },
      {
        name: '新粉丝',
        type: 'line',
        smooth: true,
        data: trends.value.followers,
        lineStyle: {
          color: '#6366f1',
          width: 2
        },
        itemStyle: {
          color: '#6366f1'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(99, 102, 241, 0.3)' },
            { offset: 1, color: 'rgba(99, 102, 241, 0.05)' }
          ])
        }
      }
    ]
  }
  
  trendsChartInstance.setOption(option)
}

// 处理窗口大小变化
const handleResize = () => {
  if (earningsChartInstance) {
    earningsChartInstance.resize()
  }
  if (trendsChartInstance) {
    trendsChartInstance.resize()
  }
}

// 加载收益明细
const loadEarningsLog = async (page = 1) => {
  try {
    earningsLoading.value = true
    const response = await creatorCenterApi.getEarningsLog({
      page,
      limit: earningsLogPagination.value.limit
    })
    if (response.success) {
      earningsLog.value = response.data.list
      earningsLogPagination.value = response.data.pagination
    }
  } catch (error) {
    console.error('获取收益明细失败:', error)
  } finally {
    earningsLoading.value = false
  }
}

// 加载付费内容
const loadPaidContent = async (page = 1) => {
  try {
    contentLoading.value = true
    const response = await creatorCenterApi.getPaidContent({
      page,
      limit: paidContentPagination.value.limit
    })
    if (response.success) {
      paidContent.value = response.data.list
      paidContentPagination.value = response.data.pagination
    }
  } catch (error) {
    console.error('获取付费内容失败:', error)
  } finally {
    contentLoading.value = false
  }
}

// 切换标签
const switchTab = (tab) => {
  activeTab.value = tab
  if (tab === 'earnings' && earningsLog.value.length === 0) {
    loadEarningsLog()
  } else if (tab === 'content' && paidContent.value.length === 0) {
    loadPaidContent()
  }
}

// 打开提现弹窗
const openWithdrawModal = () => {
  withdrawAmount.value = ''
  withdrawError.value = ''
  showWithdrawModal.value = true
}

// 关闭提现弹窗
const closeWithdrawModal = () => {
  showWithdrawModal.value = false
}

// 提现全部
const withdrawAll = () => {
  withdrawAmount.value = overview.value.balance.toString()
}

// 执行提现
const doWithdraw = async () => {
  const amount = parseFloat(withdrawAmount.value)
  
  if (isNaN(amount) || amount <= 0) {
    withdrawError.value = '请输入有效的提现金额'
    return
  }
  
  if (amount < config.value.minWithdrawAmount) {
    withdrawError.value = `最低提现金额为 ${config.value.minWithdrawAmount} 石榴点`
    return
  }
  
  if (amount > overview.value.balance) {
    withdrawError.value = '提现金额超出可用余额'
    return
  }
  
  try {
    withdrawLoading.value = true
    withdrawError.value = ''
    
    const response = await creatorCenterApi.withdraw(amount)
    
    if (response.success) {
      // 更新余额
      overview.value.balance = response.data.newEarningsBalance
      // 关闭弹窗
      closeWithdrawModal()
      // 刷新概览
      loadOverview()
    } else {
      withdrawError.value = response.message || '提现失败'
    }
  } catch (error) {
    console.error('提现失败:', error)
    withdrawError.value = error.message || '提现失败，请稍后重试'
  } finally {
    withdrawLoading.value = false
  }
}

// 跳转到帖子详情
const goToPost = (postId) => {
  router.push({ name: 'post_detail', query: { id: postId } })
}

// 页面初始化
onMounted(async () => {
  if (!userStore.isLoggedIn) {
    router.push('/user')
    return
  }
  
  await loadConfig()
  await loadOverview()
  await loadTrends()
  
  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize)
})

// 清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (earningsChartInstance) {
    earningsChartInstance.dispose()
    earningsChartInstance = null
  }
  if (trendsChartInstance) {
    trendsChartInstance.dispose()
    trendsChartInstance = null
  }
})
</script>

<template>
  <div class="creator-center">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">创作者中心</h1>
      <p class="page-subtitle">管理您的创作收益</p>
    </div>

    <!-- 收益卡片 -->
    <div class="earnings-cards" v-if="!loading">
      <div class="earnings-card main-card">
        <div class="card-header">
          <Icon icon="mdi:wallet-outline" class="card-icon" />
          <span>可提现收益</span>
        </div>
        <div class="card-value">
          <span class="currency">¥</span>
          <span class="amount">{{ formatMoney(overview.balance) }}</span>
        </div>
        <button 
          v-if="config.withdrawEnabled"
          class="withdraw-btn"
          :disabled="overview.balance < config.minWithdrawAmount"
          @click="openWithdrawModal"
        >
          提现到余额
        </button>
      </div>

      <div class="earnings-card">
        <div class="card-header">
          <Icon icon="mdi:calendar-today" class="card-icon" />
          <span>今日收益</span>
        </div>
        <div class="card-value small">
          <span class="amount">{{ formatMoney(overview.today_earnings) }}</span>
        </div>
      </div>

      <div class="earnings-card">
        <div class="card-header">
          <Icon icon="mdi:calendar-month" class="card-icon" />
          <span>本月收益</span>
        </div>
        <div class="card-value small">
          <span class="amount">{{ formatMoney(overview.month_earnings) }}</span>
        </div>
      </div>

      <div class="earnings-card">
        <div class="card-header">
          <Icon icon="mdi:chart-line" class="card-icon" />
          <span>累计收益</span>
        </div>
        <div class="card-value small">
          <span class="amount">{{ formatMoney(overview.total_earnings) }}</span>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div class="loading-skeleton" v-else>
      <div class="skeleton-card" v-for="i in 4" :key="i"></div>
    </div>

    <!-- 内容统计 -->
    <div class="stats-section" v-if="!loading">
      <h2 class="section-title">内容统计</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ formatNumber(overview.content_stats.total_posts) }}</div>
          <div class="stat-label">发布内容</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatNumber(overview.content_stats.total_views) }}</div>
          <div class="stat-label">总浏览量</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatNumber(overview.content_stats.total_likes) }}</div>
          <div class="stat-label">获得点赞</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatNumber(overview.content_stats.total_collects) }}</div>
          <div class="stat-label">获得收藏</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatNumber(overview.content_stats.paid_posts) }}</div>
          <div class="stat-label">付费内容</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatNumber(overview.content_stats.total_buyers) }}</div>
          <div class="stat-label">购买人数</div>
        </div>
      </div>
    </div>

    <!-- 标签切换 -->
    <div class="tabs-section">
      <div class="tabs">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'overview' }"
          @click="switchTab('overview')"
        >
          概览
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'earnings' }"
          @click="switchTab('earnings')"
        >
          收益明细
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'content' }"
          @click="switchTab('content')"
        >
          付费内容
        </button>
      </div>
    </div>

    <!-- 概览内容 -->
    <div class="tab-content" v-if="activeTab === 'overview'">
      <!-- 收益趋势图表 -->
      <div class="chart-section">
        <h3 class="chart-title">
          <Icon icon="mdi:chart-bar" class="chart-title-icon" />
          近7天收益趋势
        </h3>
        <div class="chart-container">
          <div id="earnings-chart" class="chart"></div>
        </div>
      </div>
      
      <!-- 综合数据趋势图表 -->
      <div class="chart-section">
        <h3 class="chart-title">
          <Icon icon="mdi:chart-line-variant" class="chart-title-icon" />
          数据分析
        </h3>
        <div class="chart-container">
          <div id="trends-chart" class="chart"></div>
        </div>
      </div>
      
      <!-- 收益规则说明 -->
      <div class="overview-info">
        <div class="info-card">
          <Icon icon="mdi:information-outline" class="info-icon" />
          <div class="info-content">
            <h3>收益规则</h3>
            <p>当用户购买您的付费内容时，平台收取 {{ (config.platformFeeRate * 100).toFixed(0) }}% 的服务费，您将获得 {{ (config.creatorShareRate * 100).toFixed(0) }}% 的收益。</p>
            <p v-if="config.withdrawEnabled">
              收益满 {{ config.minWithdrawAmount }} 石榴点后可提现到您的石榴点余额。
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 收益明细 -->
    <div class="tab-content" v-if="activeTab === 'earnings'">
      <div class="earnings-list" v-if="!earningsLoading && earningsLog.length > 0">
        <div 
          class="earnings-item" 
          v-for="log in earningsLog" 
          :key="log.id"
        >
          <div class="item-left">
            <div class="item-type" :class="getEarningsTypeColor(log.type)">
              {{ getEarningsTypeLabel(log.type) }}
            </div>
            <div class="item-reason">{{ log.reason || '-' }}</div>
            <div class="item-time">{{ formatDate(log.created_at) }}</div>
          </div>
          <div class="item-right">
            <div class="item-amount" :class="log.amount >= 0 ? 'positive' : 'negative'">
              {{ log.amount >= 0 ? '+' : '' }}{{ formatMoney(log.amount) }}
            </div>
            <div class="item-balance">余额: {{ formatMoney(log.balance_after) }}</div>
          </div>
        </div>
      </div>
      
      <div class="empty-state" v-else-if="!earningsLoading">
        <Icon icon="mdi:receipt-text-outline" class="empty-icon" />
        <p>暂无收益记录</p>
      </div>
      
      <div class="loading-state" v-else>
        <Icon icon="mdi:loading" class="loading-icon spin" />
        <p>加载中...</p>
      </div>

      <!-- 分页 -->
      <div class="pagination" v-if="earningsLogPagination.totalPages > 1">
        <button 
          class="page-btn"
          :disabled="earningsLogPagination.page <= 1"
          @click="loadEarningsLog(earningsLogPagination.page - 1)"
        >
          上一页
        </button>
        <span class="page-info">
          {{ earningsLogPagination.page }} / {{ earningsLogPagination.totalPages }}
        </span>
        <button 
          class="page-btn"
          :disabled="earningsLogPagination.page >= earningsLogPagination.totalPages"
          @click="loadEarningsLog(earningsLogPagination.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 付费内容 -->
    <div class="tab-content" v-if="activeTab === 'content'">
      <div class="content-list" v-if="!contentLoading && paidContent.length > 0">
        <div 
          class="content-item" 
          v-for="item in paidContent" 
          :key="item.id"
          @click="goToPost(item.id)"
        >
          <div class="content-cover">
            <img 
              v-if="item.cover" 
              :src="item.cover" 
              :alt="item.title"
            />
            <div v-else class="cover-placeholder">
              <Icon icon="mdi:image-outline" />
            </div>
          </div>
          <div class="content-info">
            <h3 class="content-title">{{ item.title }}</h3>
            <div class="content-meta">
              <span class="meta-item">
                <Icon icon="mdi:currency-cny" />
                {{ formatMoney(item.price) }}
              </span>
              <span class="meta-item">
                <Icon icon="mdi:shopping-outline" />
                {{ item.sales_count }} 购买
              </span>
              <span class="meta-item">
                <Icon icon="mdi:eye-outline" />
                {{ formatNumber(item.view_count) }}
              </span>
            </div>
            <div class="content-revenue">
              总收入: <strong>{{ formatMoney(item.total_revenue) }}</strong>
            </div>
          </div>
        </div>
      </div>
      
      <div class="empty-state" v-else-if="!contentLoading">
        <Icon icon="mdi:file-document-outline" class="empty-icon" />
        <p>暂无付费内容</p>
      </div>
      
      <div class="loading-state" v-else>
        <Icon icon="mdi:loading" class="loading-icon spin" />
        <p>加载中...</p>
      </div>

      <!-- 分页 -->
      <div class="pagination" v-if="paidContentPagination.totalPages > 1">
        <button 
          class="page-btn"
          :disabled="paidContentPagination.page <= 1"
          @click="loadPaidContent(paidContentPagination.page - 1)"
        >
          上一页
        </button>
        <span class="page-info">
          {{ paidContentPagination.page }} / {{ paidContentPagination.totalPages }}
        </span>
        <button 
          class="page-btn"
          :disabled="paidContentPagination.page >= paidContentPagination.totalPages"
          @click="loadPaidContent(paidContentPagination.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 提现弹窗 -->
    <div class="modal-overlay" v-if="showWithdrawModal" @click.self="closeWithdrawModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>提现到余额</h3>
          <button class="close-btn" @click="closeWithdrawModal">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body">
          <div class="withdraw-info">
            <p>可提现余额: <strong>{{ formatMoney(overview.balance) }}</strong> 石榴点</p>
            <p class="withdraw-hint">最低提现金额: {{ config.minWithdrawAmount }} 石榴点</p>
          </div>
          <div class="withdraw-input-group">
            <input 
              type="number" 
              v-model="withdrawAmount"
              placeholder="请输入提现金额"
              class="withdraw-input"
              :min="config.minWithdrawAmount"
              :max="overview.balance"
            />
            <button class="withdraw-all-btn" @click="withdrawAll">全部</button>
          </div>
          <div class="withdraw-error" v-if="withdrawError">
            {{ withdrawError }}
          </div>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" @click="closeWithdrawModal">取消</button>
          <button 
            class="confirm-btn" 
            @click="doWithdraw"
            :disabled="withdrawLoading"
          >
            <Icon v-if="withdrawLoading" icon="mdi:loading" class="spin" />
            {{ withdrawLoading ? '处理中...' : '确认提现' }}
          </button>
        </div>
      </div>
    </div>

    <BackToTopButton />
  </div>
</template>

<style scoped>
.creator-center {
  padding: 72px 16px 100px;
  max-width: 800px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--bg-color-primary);
}

.page-header {
  text-align: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  color: var(--text-color-primary);
  margin: 0 0 8px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin: 0;
}

/* 收益卡片 */
.earnings-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.earnings-card {
  background: var(--bg-color-secondary);
  border-radius: 12px;
  padding: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.earnings-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.earnings-card.main-card {
  grid-column: span 2;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-color-secondary);
  margin-bottom: 8px;
}

.main-card .card-header {
  color: rgba(255, 255, 255, 0.9);
}

.card-icon {
  font-size: 18px;
}

.card-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.card-value .currency {
  font-size: 16px;
  font-weight: 500;
}

.card-value .amount {
  font-size: 32px;
  font-weight: bold;
}

.card-value.small .amount {
  font-size: 24px;
  color: var(--text-color-primary);
}

.withdraw-btn {
  margin-top: 16px;
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.withdraw-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.withdraw-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 加载骨架 */
.loading-skeleton {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.skeleton-card {
  height: 100px;
  background: var(--bg-color-secondary);
  border-radius: 12px;
  animation: pulse 1.5s infinite;
}

.skeleton-card:first-child {
  grid-column: span 2;
  height: 140px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 内容统计 */
.stats-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 0 0 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-item {
  text-align: center;
  padding: 12px 8px;
  background: var(--bg-color-secondary);
  border-radius: 8px;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: var(--text-color-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}

/* 标签 */
.tabs-section {
  margin-bottom: 16px;
}

.tabs {
  display: flex;
  background: var(--bg-color-secondary);
  border-radius: 8px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: var(--text-color-secondary);
  font-size: 14px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--bg-color-primary);
  color: var(--text-color-primary);
  font-weight: 500;
}

.tab-btn:hover:not(.active) {
  color: var(--text-color-primary);
}

/* 标签内容 */
.tab-content {
  min-height: 200px;
}

/* 图表区域 */
.chart-section {
  margin-bottom: 24px;
  background: var(--bg-color-secondary);
  border-radius: 12px;
  padding: 16px;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 0 0 16px;
}

.chart-title-icon {
  font-size: 20px;
  color: #667eea;
}

.chart-container {
  width: 100%;
  overflow: hidden;
}

.chart {
  width: 100%;
  height: 280px;
}

/* 概览信息 */
.info-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--bg-color-secondary);
  border-radius: 12px;
}

.info-icon {
  font-size: 24px;
  color: var(--primary-color);
  flex-shrink: 0;
}

.info-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 0 0 8px;
}

.info-content p {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin: 0 0 4px;
  line-height: 1.5;
}

/* 收益列表 */
.earnings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.earnings-item {
  display: flex;
  justify-content: space-between;
  padding: 14px;
  background: var(--bg-color-secondary);
  border-radius: 10px;
}

.item-type {
  font-size: 14px;
  font-weight: 500;
}

.text-green-500 {
  color: #10b981;
}

.text-orange-500 {
  color: #f59e0b;
}

.item-reason {
  font-size: 13px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}

.item-time {
  font-size: 12px;
  color: var(--text-color-tertiary);
  margin-top: 4px;
}

.item-right {
  text-align: right;
}

.item-amount {
  font-size: 16px;
  font-weight: 600;
}

.item-amount.positive {
  color: #10b981;
}

.item-amount.negative {
  color: #f59e0b;
}

.item-balance {
  font-size: 12px;
  color: var(--text-color-tertiary);
  margin-top: 4px;
}

/* 内容列表 */
.content-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.content-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--bg-color-secondary);
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.2s;
}

.content-item:hover {
  transform: translateX(4px);
}

.content-cover {
  width: 80px;
  height: 80px;
  border-radius: 8px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color-tertiary);
  color: var(--text-color-tertiary);
  font-size: 24px;
}

.content-info {
  flex: 1;
  min-width: 0;
}

.content-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
  margin: 0 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.content-revenue {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.content-revenue strong {
  color: #10b981;
}

/* 空状态和加载状态 */
.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--text-color-tertiary);
}

.empty-icon,
.loading-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color-primary);
  border-radius: 6px;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: var(--bg-color-tertiary);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: var(--text-color-secondary);
}

/* 提现弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  width: 100%;
  max-width: 400px;
  background: var(--bg-color-primary);
  border-radius: 16px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color-primary);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-color-secondary);
  cursor: pointer;
}

.modal-body {
  padding: 20px 16px;
}

.withdraw-info {
  margin-bottom: 16px;
}

.withdraw-info p {
  font-size: 14px;
  color: var(--text-color-primary);
  margin: 0 0 8px;
}

.withdraw-info strong {
  color: var(--primary-color);
}

.withdraw-hint {
  font-size: 12px !important;
  color: var(--text-color-tertiary) !important;
}

.withdraw-input-group {
  display: flex;
  gap: 8px;
}

.withdraw-input {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 8px;
  font-size: 16px;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
}

.withdraw-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.withdraw-all-btn {
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: var(--bg-color-tertiary);
  color: var(--text-color-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.withdraw-all-btn:hover {
  background: var(--bg-color-secondary);
}

.withdraw-error {
  margin-top: 12px;
  font-size: 13px;
  color: #ef4444;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--border-color-primary);
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  border: 1px solid var(--border-color-primary);
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
}

.confirm-btn {
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.confirm-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 响应式 */
@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stat-value {
    font-size: 18px;
  }
}
</style>
