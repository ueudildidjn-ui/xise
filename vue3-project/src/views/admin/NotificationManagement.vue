<template>
  <CrudTable 
    title="消息管理" 
    entity-name="消息通知" 
    api-endpoint="/admin/system-notifications" 
    :columns="columns"
    :form-fields="formFields" 
    :search-fields="searchFields"
    default-sort-field="created_at"
    default-sort-order="desc"
    :custom-actions="customActions"
    @custom-action="handleCustomAction"
  />
</template>

<script setup>
import CrudTable from '@/views/admin/components/CrudTable.vue'
import request from '@/api/request.js'
import messageManager from '@/utils/messageManager'

const columns = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'title', label: '标题', sortable: false, maxLength: 30 },
  { key: 'content', label: '内容', sortable: false, maxLength: 50 },
  { key: 'type', label: '类型', sortable: false, type: 'enum', enumMap: { system: '系统通知', activity: '活动通知' } },
  { key: 'show_popup', label: '弹窗显示', type: 'boolean', trueText: '是', falseText: '否', sortable: false },
  { key: 'image_url', label: '图片', type: 'link', maxLength: 20, sortable: false },
  { key: 'link_url', label: '链接', type: 'link', maxLength: 20, sortable: false },
  { key: 'confirmed_count', label: '已读', sortable: false },
  { key: 'unread_count', label: '未读', sortable: false },
  { key: 'created_at', label: '创建时间', type: 'date', sortable: true }
]

const formFields = [
  { key: 'title', label: '通知标题', type: 'text', required: true, placeholder: '请输入通知标题' },
  { key: 'content', label: '通知内容', type: 'textarea', required: true, placeholder: '请输入通知内容' },
  {
    key: 'type',
    label: '通知类型',
    type: 'select',
    required: true,
    options: [
      { value: 'system', label: '系统通知' },
      { value: 'activity', label: '活动通知' }
    ]
  },
  { key: 'image_url', label: '图片URL', type: 'text', required: false, placeholder: '可选，通知关联的图片地址' },
  { key: 'link_url', label: '链接URL', type: 'text', required: false, placeholder: '可选，点击跳转的链接地址' },
  {
    key: 'show_popup',
    label: '弹窗显示',
    type: 'select',
    required: false,
    options: [
      { value: true, label: '是 - 用户登录后弹窗提醒' },
      { value: false, label: '否 - 仅在通知列表显示' }
    ]
  }
]

const searchFields = [
  { key: 'title', label: '标题', placeholder: '搜索通知标题' },
  {
    key: 'type',
    label: '类型',
    type: 'select',
    placeholder: '通知类型',
    options: [
      { value: '', label: '全部类型' },
      { value: 'system', label: '系统通知' },
      { value: 'activity', label: '活动通知' }
    ]
  }
]

const customActions = [
  { key: 'resend', icon: 'reload', title: '重新发送给未读用户' }
]

const handleCustomAction = async ({ action, item }) => {
  if (action === 'resend') {
    try {
      const response = await request.post(`/admin/system-notifications/${item.id}/resend`)
      if (response.success) {
        messageManager.success(response.message || '已重新发送给未读用户')
      } else {
        messageManager.error(response.message || '操作失败')
      }
    } catch (error) {
      messageManager.error('操作失败')
    }
  }
}
</script>
