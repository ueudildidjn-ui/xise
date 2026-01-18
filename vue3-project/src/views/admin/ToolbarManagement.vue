<template>
  <CrudTable 
    title="用户工具栏管理" 
    entity-name="工具栏项" 
    api-endpoint="/admin/user-toolbar" 
    :columns="columns"
    :form-fields="formFields" 
    :search-fields="searchFields" 
  />
</template>

<script setup>
import CrudTable from '@/views/admin/components/CrudTable.vue'

const columns = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: '工具名称', sortable: false },
  { key: 'icon', label: '图标', type: 'icon', sortable: false },
  { key: 'url', label: '跳转链接', type: 'link', maxLength: 30, sortable: false },
  { key: 'sort_order', label: '排序', sortable: true },
  { key: 'is_active', label: '启用状态', type: 'boolean', trueText: '启用', falseText: '禁用', sortable: false },
  { key: 'created_at', label: '创建时间', type: 'date', sortable: true }
]

const formFields = [
  { key: 'name', label: '工具名称', type: 'text', required: true, placeholder: '请输入工具名称（如：浏览历史）' },
  { key: 'icon', label: '选择图标', type: 'icon-picker', required: true, placeholder: '点击选择图标' },
  { key: 'url', label: '跳转链接', type: 'text', required: true, placeholder: '请输入跳转链接或路由（如：/history）' },
  { key: 'sort_order', label: '排序顺序', type: 'number', required: false, placeholder: '数字越小越靠前' },
  {
    key: 'is_active',
    label: '启用状态',
    type: 'select',
    required: false,
    options: [
      { value: true, label: '启用' },
      { value: false, label: '禁用' }
    ]
  }
]

const searchFields = [
  { key: 'name', label: '工具名称', placeholder: '搜索工具名称' },
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
