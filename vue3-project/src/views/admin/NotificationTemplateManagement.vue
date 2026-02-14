<template>
  <CrudTable 
    title="通知模板管理" 
    entity-name="通知模板" 
    api-endpoint="/admin/notification-templates" 
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
  { key: 'template_key', label: '模板键名', sortable: false },
  { key: 'name', label: '模板名称', sortable: false },
  { key: 'description', label: '描述', sortable: false, maxLength: 40 },
  { key: 'is_active', label: '启用', type: 'boolean', trueText: '是', falseText: '否', sortable: false },
  { key: 'email_subject', label: '邮件主题', sortable: false, maxLength: 30 },
  { key: 'created_at', label: '创建时间', type: 'date', sortable: true },
  { key: 'updated_at', label: '更新时间', type: 'date', sortable: true }
]

const formFields = [
  {
    key: 'template_key',
    label: '模板键名',
    type: 'select',
    required: true,
    options: [
      { value: 'comment', label: 'comment - 评论笔记' },
      { value: 'reply', label: 'reply - 回复评论' },
      { value: 'mention', label: 'mention - @提及（笔记）' },
      { value: 'mention_comment', label: 'mention_comment - @提及（评论）' },
      { value: 'new_post', label: 'new_post - 关注者发布新帖子' },
      { value: 'system_notification', label: 'system_notification - 系统通知' },
      { value: 'activity_notification', label: 'activity_notification - 活动通知' }
    ]
  },
  { key: 'name', label: '模板名称', type: 'text', required: true, placeholder: '如：评论通知模板' },
  { key: 'description', label: '描述', type: 'text', required: false, placeholder: '模板用途说明' },
  { key: 'system_template', label: '系统模板', type: 'textarea', required: false, placeholder: '站内通知模板，支持变量：{senderName}, {postTitle}, {commentContent}, {title}, {content}' },
  { key: 'email_subject', label: '邮件主题', type: 'text', required: false, placeholder: '邮件标题模板，支持变量：{siteName}, {senderName}, {title}' },
  { key: 'email_body', label: '邮件正文（HTML）', type: 'textarea', required: false, placeholder: '邮件HTML内容模板，支持变量：{siteName}, {senderName}, {postTitle}, {commentContent}, {title}, {content}' },
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
  { key: 'name', label: '模板名称', placeholder: '搜索模板名称' },
  {
    key: 'template_key',
    label: '模板键名',
    type: 'select',
    placeholder: '选择模板类型',
    options: [
      { value: '', label: '全部类型' },
      { value: 'comment', label: '评论笔记' },
      { value: 'reply', label: '回复评论' },
      { value: 'mention', label: '@提及（笔记）' },
      { value: 'mention_comment', label: '@提及（评论）' },
      { value: 'new_post', label: '关注者发布新帖子' },
      { value: 'system_notification', label: '系统通知' },
      { value: 'activity_notification', label: '活动通知' }
    ]
  }
]
</script>
