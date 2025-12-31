-- ================================================
-- 升级 post_videos 表以支持视频转码功能
-- 运行此脚本前请备份数据库
-- ================================================

-- 1. 添加 mpd_path 字段（如果不存在）
-- 用于存储DASH MPD文件路径
ALTER TABLE `post_videos` 
ADD COLUMN IF NOT EXISTS `mpd_path` varchar(500) DEFAULT NULL COMMENT 'DASH MPD文件路径' AFTER `video_url`;

-- 2. 添加 transcode_status 字段（如果不存在）
-- 用于跟踪转码状态
ALTER TABLE `post_videos` 
ADD COLUMN IF NOT EXISTS `transcode_status` ENUM('pending', 'processing', 'completed', 'failed', 'none') DEFAULT 'none' COMMENT '转码状态' AFTER `mpd_path`;

-- 3. 添加 transcode_task_id 字段（如果不存在）
-- 用于关联转码任务
ALTER TABLE `post_videos` 
ADD COLUMN IF NOT EXISTS `transcode_task_id` varchar(100) DEFAULT NULL COMMENT '转码任务ID' AFTER `transcode_status`;

-- 4. 添加 transcode_status 索引（如果不存在）
-- 用于快速查询转码状态
CREATE INDEX IF NOT EXISTS `idx_transcode_status` ON `post_videos` (`transcode_status`);

-- 5. 添加 video_transcode_segment_duration 系统设置（如果不存在）
-- 用于配置DASH切片时长
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_group`, `description`) 
VALUES ('video_transcode_segment_duration', '4', 'video', 'DASH切片时长(秒)')
ON DUPLICATE KEY UPDATE 
  `setting_value` = VALUES(`setting_value`),
  `setting_group` = VALUES(`setting_group`),
  `description` = VALUES(`description`);

-- ================================================
-- 以下是兼容MySQL 5.7的版本（不支持 IF NOT EXISTS 语法）
-- 如果上述语句失败，请使用以下语句
-- ================================================

-- -- 检查并添加 mpd_path 字段
-- -- 首先检查字段是否存在
-- SET @column_exists = (
--     SELECT COUNT(*) 
--     FROM INFORMATION_SCHEMA.COLUMNS 
--     WHERE TABLE_SCHEMA = DATABASE() 
--     AND TABLE_NAME = 'post_videos' 
--     AND COLUMN_NAME = 'mpd_path'
-- );
-- SET @sql = IF(@column_exists = 0, 
--     'ALTER TABLE `post_videos` ADD COLUMN `mpd_path` varchar(500) DEFAULT NULL COMMENT ''DASH MPD文件路径'' AFTER `video_url`', 
--     'SELECT 1');
-- PREPARE stmt FROM @sql;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

-- -- 检查并添加 transcode_status 字段
-- SET @column_exists = (
--     SELECT COUNT(*) 
--     FROM INFORMATION_SCHEMA.COLUMNS 
--     WHERE TABLE_SCHEMA = DATABASE() 
--     AND TABLE_NAME = 'post_videos' 
--     AND COLUMN_NAME = 'transcode_status'
-- );
-- SET @sql = IF(@column_exists = 0, 
--     'ALTER TABLE `post_videos` ADD COLUMN `transcode_status` ENUM(''pending'', ''processing'', ''completed'', ''failed'', ''none'') DEFAULT ''none'' COMMENT ''转码状态'' AFTER `mpd_path`', 
--     'SELECT 1');
-- PREPARE stmt FROM @sql;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

-- -- 检查并添加 transcode_task_id 字段
-- SET @column_exists = (
--     SELECT COUNT(*) 
--     FROM INFORMATION_SCHEMA.COLUMNS 
--     WHERE TABLE_SCHEMA = DATABASE() 
--     AND TABLE_NAME = 'post_videos' 
--     AND COLUMN_NAME = 'transcode_task_id'
-- );
-- SET @sql = IF(@column_exists = 0, 
--     'ALTER TABLE `post_videos` ADD COLUMN `transcode_task_id` varchar(100) DEFAULT NULL COMMENT ''转码任务ID'' AFTER `transcode_status`', 
--     'SELECT 1');
-- PREPARE stmt FROM @sql;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

-- ================================================
-- 验证升级结果
-- ================================================
-- 运行以下查询验证表结构是否正确
-- DESCRIBE `post_videos`;
-- 
-- 预期输出应包含以下字段:
-- id, post_id, cover_url, video_url, mpd_path, transcode_status, transcode_task_id
