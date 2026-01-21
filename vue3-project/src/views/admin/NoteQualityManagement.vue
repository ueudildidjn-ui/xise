<template>
  <div class="note-quality-management">
    <div class="page-header">
      <h1>笔记质量管理</h1>
      <p class="description">标记笔记质量等级并发放相应奖励</p>
    </div>

    <!-- 质量奖励设置 -->
    <div class="settings-section">
      <div class="section-header">
        <h2>质量奖励设置</h2>
        <button @click="saveSettings" class="btn btn-primary" :disabled="savingSettings">
          {{ savingSettings ? '保存中...' : '保存设置' }}
        </button>
      </div>
      <div class="settings-grid">
        <div v-for="setting in qualitySettings" :key="setting.quality_level" class="setting-card">
          <div class="setting-header">
            <span class="quality-badge" :class="setting.quality_level">
              {{ getQualityLabel(setting.quality_level) }}
            </span>
            <label class="toggle">
              <input type="checkbox" v-model="setting.is_active" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-body">
            <label>奖励金额 (石榴点)</label>
            <input type="number" v-model.number="setting.reward_amount" min="0" step="0.01" />
          </div>
          <div class="setting-body">
            <label>描述</label>
            <input type="text" v-model="setting.description" placeholder="奖励描述" />
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选条 -->
    <div class="filter-bar">
      <div class="filter-inputs">
        <input v-model="filters.title" placeholder="搜索标题" @keyup.enter="loadPosts" />
        <input v-model="filters.user_display_id" placeholder="搜索作者汐社号" @keyup.enter="loadPosts" />
        <select v-model="filters.type">
          <option value="">全部类型</option>
          <option value="1">图文</option>
          <option value="2">视频</option>
        </select>
        <select v-model="filters.quality_level">
          <option value="">全部质量</option>
          <option value="none">未标记</option>
          <option value="low">低质量</option>
          <option value="medium">中质量</option>
          <option value="high">高质量</option>
        </select>
        <select v-model="filters.is_draft">
          <option value="">全部状态</option>
          <option value="0">已发布</option>
          <option value="1">草稿</option>
        </select>
      </div>
      <div class="filter-actions">
        <button @click="loadPosts" class="btn btn-primary">筛选</button>
        <button @click="clearFilters" class="btn btn-outline">清空</button>
      </div>
    </div>

    <!-- 批量操作 -->
    <div class="batch-actions" v-if="selectedPosts.length > 0">
      <span>已选择 {{ selectedPosts.length }} 篇笔记</span>
      <select v-model="batchQuality">
        <option value="">选择质量等级</option>
        <option value="none">清除标记</option>
        <option value="low">低质量</option>
        <option value="medium">中质量</option>
        <option value="high">高质量</option>
      </select>
      <button @click="batchSetQuality" class="btn btn-primary" :disabled="!batchQuality || batchLoading">
        {{ batchLoading ? '处理中...' : '批量设置' }}
      </button>
      <button @click="clearSelection" class="btn btn-outline">取消选择</button>
    </div>

    <!-- 笔记列表 -->
    <div class="posts-table">
      <table>
        <thead>
          <tr>
            <th class="checkbox-col">
              <input type="checkbox" @change="toggleSelectAll" :checked="isAllSelected" />
            </th>
            <th>封面</th>
            <th>标题</th>
            <th>作者</th>
            <th>类型</th>
            <th>互动数据</th>
            <th>当前质量</th>
            <th>奖励金额</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in posts" :key="post.id">
            <td class="checkbox-col">
              <input type="checkbox" :value="post.id" v-model="selectedPosts" />
            </td>
            <td class="cover-col">
              <div class="cover-wrapper" @click="showMediaGallery(post)" :title="post.type === 2 ? '点击查看视频' : '点击查看图片'">
                <img v-if="post.cover" :src="post.cover" alt="" class="post-cover" />
                <div v-else class="no-cover">
                  <span>{{ post.type === 2 ? '视频' : '图片' }}</span>
                </div>
                <div class="cover-overlay">
                  <span v-if="loadingMedia === post.id">加载中...</span>
                  <span v-else>{{ post.type === 2 ? '▶ 播放' : '🔍 查看' }}</span>
                </div>
              </div>
            </td>
            <td class="title-col">
              <div class="post-title">{{ post.title || '无标题' }}</div>
              <div class="post-content">{{ post.content }}</div>
            </td>
            <td>
              <div class="author-info">
                <span class="author-id">@{{ post.user_display_id }}</span>
                <span class="author-name">{{ post.nickname }}</span>
              </div>
            </td>
            <td>
              <span class="type-badge" :class="post.type === 2 ? 'video' : 'image'">
                {{ post.type === 2 ? '视频' : '图文' }}
              </span>
            </td>
            <td class="stats-col">
              <div class="stats">
                <span>👁 {{ formatNumber(post.view_count) }}</span>
                <span>❤️ {{ post.like_count }}</span>
                <span>⭐ {{ post.collect_count }}</span>
              </div>
            </td>
            <td>
              <span class="quality-badge" :class="post.quality_level">
                {{ getQualityLabel(post.quality_level) }}
              </span>
            </td>
            <td>
              <span v-if="post.quality_reward" class="reward-amount">
                +{{ post.quality_reward.toFixed(2) }}
              </span>
              <span v-else class="no-reward">-</span>
            </td>
            <td class="actions-col">
              <div class="action-buttons" v-if="post.quality_level === 'none' || !post.quality_level">
                <button 
                  v-for="level in ['low', 'medium', 'high']" 
                  :key="level"
                  @click="setQuality(post.id, level)"
                  class="quality-btn"
                  :class="[level]"
                  :disabled="settingQuality === post.id"
                >
                  {{ getQualityShortLabel(level) }}
                </button>
              </div>
              <div class="marked-info" v-else>
                <span class="marked-label">已标记</span>
                <button 
                  @click="setQuality(post.id, 'none')"
                  class="quality-btn clear"
                  :disabled="settingQuality === post.id"
                >
                  清除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-if="!loading && posts.length === 0" class="empty">暂无数据</div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="pagination.pages > 1">
      <button @click="goToPage(pagination.page - 1)" :disabled="pagination.page <= 1">上一页</button>
      <span>{{ pagination.page }} / {{ pagination.pages }}</span>
      <button @click="goToPage(pagination.page + 1)" :disabled="pagination.page >= pagination.pages">下一页</button>
    </div>

    <!-- 图片查看器 -->
    <ImageViewer 
      v-model:visible="showImageViewer" 
      :images="currentImages" 
      :initial-index="0"
      @close="closeImageViewer" 
    />

    <!-- 视频播放器 -->
    <VideoPlayerModal 
      v-model:visible="showVideoPlayer" 
      :video-url="currentVideoUrl"
      :poster-url="currentPosterUrl" 
      @close="closeVideoPlayer" 
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import request from '@/api/request.js'
import ImageViewer from '@/components/ImageViewer.vue'
import VideoPlayerModal from '@/views/admin/components/VideoPlayerModal.vue'

// 状态
const loading = ref(false)
const savingSettings = ref(false)
const settingQuality = ref(null)
const batchLoading = ref(false)
const posts = ref([])
const selectedPosts = ref([])
const batchQuality = ref('')
const pagination = ref({ page: 1, limit: 20, total: 0, pages: 0 })
const qualitySettings = ref([])

// 媒体查看状态
const loadingMedia = ref(null)
const showImageViewer = ref(false)
const showVideoPlayer = ref(false)
const currentImages = ref([])
const currentVideoUrl = ref('')
const currentPosterUrl = ref('')

// 筛选条件
const filters = ref({
  title: '',
  user_display_id: '',
  type: '',
  quality_level: '',
  is_draft: ''
})

// 计算属性
const isAllSelected = computed(() => {
  return posts.value.length > 0 && selectedPosts.value.length === posts.value.length
})

// 质量等级标签
const getQualityLabel = (level) => {
  const labels = {
    none: '未标记',
    low: '低质量',
    medium: '中质量',
    high: '高质量'
  }
  return labels[level] || '未知'
}

const getQualityShortLabel = (level) => {
  const labels = { low: '低', medium: '中', high: '高' }
  return labels[level] || level
}

// 格式化数字
const formatNumber = (num) => {
  if (num >= 10000) return (num / 10000).toFixed(1) + '万'
  return num.toString()
}

// 加载质量奖励设置
const loadSettings = async () => {
  try {
    const response = await request.get('/admin/quality-reward-settings')
    if (response.success && response.data?.data) {
      qualitySettings.value = response.data.data
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 保存设置
const saveSettings = async () => {
  savingSettings.value = true
  try {
    for (const setting of qualitySettings.value) {
      await request.put(`/admin/quality-reward-settings/${setting.id}`, {
        reward_amount: setting.reward_amount,
        description: setting.description,
        is_active: setting.is_active
      })
    }
    alert('设置保存成功')
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败')
  } finally {
    savingSettings.value = false
  }
}

// 加载笔记列表
const loadPosts = async (page = 1) => {
  loading.value = true
  try {
    const params = {
      page,
      limit: pagination.value.limit,
      ...filters.value
    }
    // 移除空值
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null) delete params[key]
    })

    const response = await request.get('/admin/posts-quality', { params })
    if (response.success && response.data) {
      posts.value = response.data.data || []
      pagination.value = response.data.pagination || { page: 1, limit: 20, total: 0, pages: 0 }
    }
  } catch (error) {
    console.error('加载失败:', error)
  } finally {
    loading.value = false
  }
}

// 设置单个笔记质量
const setQuality = async (postId, level) => {
  settingQuality.value = postId
  try {
    const response = await request.put(`/admin/posts/${postId}/quality`, { quality_level: level })
    if (response.success) {
      // 更新本地数据
      const post = posts.value.find(p => p.id === postId)
      if (post) {
        post.quality_level = level
        post.quality_reward = response.data?.reward_amount || null
        post.quality_marked_at = level !== 'none' ? new Date() : null
      }
    } else {
      alert(response.message || '设置失败')
    }
  } catch (error) {
    console.error('设置失败:', error)
    alert('设置失败')
  } finally {
    settingQuality.value = null
  }
}

// 批量设置质量
const batchSetQuality = async () => {
  if (!batchQuality.value || selectedPosts.value.length === 0) return
  
  batchLoading.value = true
  try {
    const response = await request.put('/admin/posts-quality/batch', {
      ids: selectedPosts.value,
      quality_level: batchQuality.value
    })
    if (response.success) {
      alert(response.message)
      await loadPosts(pagination.value.page)
      clearSelection()
    } else {
      alert(response.message || '操作失败')
    }
  } catch (error) {
    console.error('批量操作失败:', error)
    alert('操作失败')
  } finally {
    batchLoading.value = false
  }
}

// 全选/取消全选
const toggleSelectAll = (event) => {
  if (event.target.checked) {
    selectedPosts.value = posts.value.map(p => p.id)
  } else {
    selectedPosts.value = []
  }
}

// 清空选择
const clearSelection = () => {
  selectedPosts.value = []
  batchQuality.value = ''
}

// 清空筛选
const clearFilters = () => {
  filters.value = {
    title: '',
    user_display_id: '',
    type: '',
    quality_level: '',
    is_draft: ''
  }
  loadPosts(1)
}

// 分页
const goToPage = (page) => {
  if (page >= 1 && page <= pagination.value.pages) {
    loadPosts(page)
  }
}

// 媒体查看功能
const showMediaGallery = async (post) => {
  loadingMedia.value = post.id
  try {
    // 获取笔记详情
    const response = await request.get(`/posts/${post.id}`)
    if (response.success) {
      if (post.type === 2) {
        // 视频笔记
        currentVideoUrl.value = response.data.video_url || ''
        currentPosterUrl.value = response.data.images && response.data.images[0] ? response.data.images[0] : ''
        showVideoPlayer.value = true
      } else {
        // 图文笔记
        const images = response.data.images || []
        currentImages.value = images
        showImageViewer.value = true
      }
    } else {
      alert(response.message || '获取媒体信息失败')
    }
  } catch (error) {
    console.error('获取媒体信息失败:', error)
    alert('获取媒体信息失败')
  } finally {
    loadingMedia.value = null
  }
}

const closeImageViewer = () => {
  showImageViewer.value = false
  currentImages.value = []
}

const closeVideoPlayer = () => {
  showVideoPlayer.value = false
  currentVideoUrl.value = ''
  currentPosterUrl.value = ''
}

onMounted(() => {
  loadSettings()
  loadPosts()
})
</script>

<style scoped>
.note-quality-management {
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px;
}

.page-header .description {
  color: #666;
  font-size: 14px;
  margin: 0;
}

/* 设置区域 */
.settings-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.setting-card {
  background: #f8f9fc;
  border-radius: 10px;
  padding: 16px;
}

.setting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.setting-body {
  margin-bottom: 12px;
}

.setting-body label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.setting-body input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.toggle {
  position: relative;
  width: 40px;
  height: 22px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  border-radius: 22px;
  transition: 0.3s;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: 0.3s;
}

.toggle input:checked + .toggle-slider {
  background-color: #667eea;
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(18px);
}

/* 质量标签 */
.quality-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.quality-badge.none { background: #f0f0f0; color: #888; }
.quality-badge.low { background: #fef3c7; color: #b45309; }
.quality-badge.medium { background: #dbeafe; color: #1d4ed8; }
.quality-badge.high { background: #d1fae5; color: #047857; }

/* 筛选条 */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  background: white;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.filter-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex: 1;
}

.filter-inputs input,
.filter-inputs select {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  min-width: 120px;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

/* 批量操作 */
.batch-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #e0f2fe;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.batch-actions select {
  padding: 8px 12px;
  border: 1px solid #7dd3fc;
  border-radius: 6px;
  background: white;
}

/* 按钮 */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover { background: #5a67d8; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline {
  background: white;
  border: 1px solid #e0e0e0;
  color: #666;
}

.btn-outline:hover { background: #f5f5f5; }

/* 表格 */
.posts-table {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

th {
  background: #f8f9fc;
  font-weight: 600;
  font-size: 13px;
  color: #666;
}

.checkbox-col {
  width: 40px;
  text-align: center;
}

.cover-col {
  width: 80px;
}

.cover-wrapper {
  position: relative;
  width: 60px;
  height: 60px;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
}

.cover-wrapper:hover .cover-overlay {
  opacity: 1;
}

.cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.2s;
}

.post-cover {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
}

.no-cover {
  width: 60px;
  height: 60px;
  background: #f0f0f0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #888;
}

.title-col {
  max-width: 200px;
}

.post-title {
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-content {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.author-id {
  font-size: 12px;
  color: #667eea;
}

.author-name {
  font-size: 12px;
  color: #888;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.type-badge.image { background: #e0f2fe; color: #0284c7; }
.type-badge.video { background: #fce7f3; color: #be185d; }

.stats-col .stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #666;
}

.reward-amount {
  color: #10b981;
  font-weight: 500;
}

.no-reward {
  color: #ccc;
}

.actions-col {
  width: 180px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.quality-btn {
  padding: 4px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.quality-btn:hover { background: #f5f5f5; }
.quality-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.quality-btn.low { border-color: #fcd34d; }
.quality-btn.low.active, .quality-btn.low:hover { background: #fef3c7; color: #b45309; }

.quality-btn.medium { border-color: #60a5fa; }
.quality-btn.medium.active, .quality-btn.medium:hover { background: #dbeafe; color: #1d4ed8; }

.quality-btn.high { border-color: #34d399; }
.quality-btn.high.active, .quality-btn.high:hover { background: #d1fae5; color: #047857; }

.quality-btn.clear { border-color: #f87171; color: #dc2626; }
.quality-btn.clear:hover { background: #fee2e2; }

.marked-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.marked-label {
  font-size: 12px;
  color: #10b981;
  font-weight: 500;
}

.loading, .empty {
  padding: 40px;
  text-align: center;
  color: #888;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding: 16px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination span {
  font-size: 14px;
  color: #666;
}

/* 响应式 */
@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-inputs {
    flex-direction: column;
  }
  
  .filter-inputs input,
  .filter-inputs select {
    width: 100%;
  }
  
  .posts-table {
    overflow-x: auto;
  }
  
  table {
    min-width: 800px;
  }
}
</style>
