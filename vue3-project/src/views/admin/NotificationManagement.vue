<template>
  <CrudTable 
    title="系统通知管理" 
    entity-name="系统通知" 
    api-endpoint="/admin/system-notifications" 
    :columns="columns"
    :form-fields="formFields" 
    :search-fields="searchFields"
    default-sort-field="created_at"
    default-sort-order="desc"
  />
</template>

<script setup>
import CrudTable from '@/views/admin/components/CrudTable.vue'

const columns = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'title', label: '标题', sortable: false, maxLength: 30 },
  { key: 'content', label: '内容', sortable: false, maxLength: 50 },
  { key: 'type', label: '类型', sortable: false, type: 'enum', enumMap: { system: '系统通知', activity: '活动通知' } },
  { key: 'content_format', label: '内容格式', sortable: false, type: 'enum', enumMap: { text: '纯文本', html: 'HTML', image: '图片', url: 'URL' } },
  { key: 'show_popup', label: '弹窗显示', type: 'boolean', trueText: '是', falseText: '否', sortable: false },
  { key: 'is_active', label: '启用状态', type: 'boolean', trueText: '启用', falseText: '禁用', sortable: false },
  { key: 'image_url', label: '图片', type: 'link', maxLength: 20, sortable: false },
  { key: 'link_url', label: '链接', type: 'link', maxLength: 20, sortable: false },
  { key: 'start_time', label: '开始时间', type: 'date', sortable: true },
  { key: 'end_time', label: '结束时间', type: 'date', sortable: true },
  { key: 'created_at', label: '创建时间', type: 'date', sortable: true }
]

const formFields = [
  { key: 'title', label: '通知标题', type: 'text', required: true, placeholder: '请输入通知标题' },
  { key: 'content', label: '通知内容', type: 'textarea', required: true, placeholder: '请输入通知内容（支持HTML格式）' },
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
  {
    key: 'content_format',
    label: '内容格式',
    type: 'select',
    required: false,
    options: [
      { value: 'text', label: '纯文本' },
      { value: 'html', label: 'HTML格式' },
      { value: 'image', label: '图片格式' },
      { value: 'url', label: 'URL链接' }
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
  },
  {
    key: 'is_active',
    label: '启用状态',
    type: 'select',
    required: false,
    options: [
      { value: true, label: '启用' },
      { value: false, label: '禁用' }
    ]
  },
  { key: 'start_time', label: '开始时间', type: 'datetime-local', required: false, placeholder: '可选，定时开始时间' },
  { key: 'end_time', label: '结束时间', type: 'datetime-local', required: false, placeholder: '可选，定时结束时间' }
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
  },
  {
    key: 'is_active',
    label: '启用状态',
    type: 'select',
    placeholder: '启用状态',
    options: [
      { value: '', label: '全部状态' },
      { value: 'true', label: '启用' },
      { value: 'false', label: '禁用' }
    ]
  }
]
</script>
