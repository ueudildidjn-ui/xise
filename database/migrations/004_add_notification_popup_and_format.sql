-- 为系统通知表添加弹窗显示和内容格式字段
-- Migration: 004_add_notification_popup_and_format
-- Description: 添加 show_popup 弹窗配置和 content_format 内容格式（支持text/html/image/url）

-- 添加内容格式枚举字段
ALTER TABLE `system_notifications` 
ADD COLUMN `content_format` enum('text','html','image','url') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text' AFTER `type`;

-- 添加弹窗显示配置字段
ALTER TABLE `system_notifications` 
ADD COLUMN `show_popup` tinyint(1) NOT NULL DEFAULT 0 AFTER `link_url`;
