-- 内容审核功能数据库迁移脚本
-- 版本: 1.0.0
-- 日期: 2026-01-10
-- 功能: 添加评论和昵称审核相关字段

-- ========================================
-- 1. 更新 comments 表 - 添加审核相关字段
-- ========================================

-- 添加审核状态字段
ALTER TABLE `comments` 
ADD COLUMN `audit_status` TINYINT NOT NULL DEFAULT 1 COMMENT '审核状态：0-待审核，1-审核通过，2-审核拒绝' AFTER `like_count`;

-- 添加公开可见字段
ALTER TABLE `comments` 
ADD COLUMN `is_public` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否公开可见：0-仅自己可见，1-公开可见' AFTER `audit_status`;

-- 添加审核结果JSON字段
ALTER TABLE `comments` 
ADD COLUMN `audit_result` JSON NULL COMMENT '审核结果JSON' AFTER `is_public`;

-- 添加审核状态索引
ALTER TABLE `comments` 
ADD INDEX `idx_audit_status` (`audit_status` ASC);

-- 添加公开可见索引
ALTER TABLE `comments` 
ADD INDEX `idx_is_public` (`is_public` ASC);

-- ========================================
-- 2. 更新 audit 表 - 添加内容审核相关字段
-- ========================================

-- 添加关联目标ID字段
ALTER TABLE `audit` 
ADD COLUMN `target_id` BIGINT NULL DEFAULT NULL COMMENT '关联目标ID（如评论ID）' AFTER `type`;

-- 添加审核结果JSON字段
ALTER TABLE `audit` 
ADD COLUMN `audit_result` JSON NULL COMMENT 'API审核结果JSON' AFTER `content`;

-- 添加风险等级字段
ALTER TABLE `audit` 
ADD COLUMN `risk_level` VARCHAR(20) NULL DEFAULT NULL COMMENT '风险等级' AFTER `audit_result`;

-- 添加违规类别JSON字段
ALTER TABLE `audit` 
ADD COLUMN `categories` JSON NULL COMMENT '违规类别JSON数组' AFTER `risk_level`;

-- 添加审核原因字段
ALTER TABLE `audit` 
ADD COLUMN `reason` TEXT NULL COMMENT '审核原因' AFTER `categories`;

-- 添加重试次数字段
ALTER TABLE `audit` 
ADD COLUMN `retry_count` INT NOT NULL DEFAULT 0 COMMENT 'AI审核重试次数' AFTER `reason`;

-- 添加关联目标ID索引
ALTER TABLE `audit` 
ADD INDEX `idx_target_id` (`target_id` ASC);

-- 更新状态字段注释以支持拒绝状态
ALTER TABLE `audit` 
MODIFY COLUMN `status` TINYINT(1) NULL DEFAULT 0 COMMENT '审核状态：0-待审核，1-审核通过，2-审核拒绝';

-- 更新类型字段注释以支持新的审核类型
ALTER TABLE `audit` 
MODIFY COLUMN `type` TINYINT NOT NULL COMMENT '审核类型：1-用户认证，2-内容审核，3-评论审核，4-昵称审核';

-- ========================================
-- 注意事项
-- ========================================
-- 1. 执行此脚本前请备份数据库
-- 2. 此脚本为增量更新，不会删除现有数据
-- 3. 执行顺序：先执行comments表的更新，再执行audit表的更新
-- 4. 如果字段已存在，ALTER TABLE语句会报错，请忽略该错误

-- ========================================
-- 回滚脚本 (如需回滚)
-- ========================================
-- ALTER TABLE `comments` DROP COLUMN `audit_status`;
-- ALTER TABLE `comments` DROP COLUMN `is_public`;
-- ALTER TABLE `comments` DROP COLUMN `audit_result`;
-- ALTER TABLE `comments` DROP INDEX `idx_audit_status`;
-- ALTER TABLE `comments` DROP INDEX `idx_is_public`;
-- ALTER TABLE `audit` DROP COLUMN `target_id`;
-- ALTER TABLE `audit` DROP COLUMN `audit_result`;
-- ALTER TABLE `audit` DROP COLUMN `risk_level`;
-- ALTER TABLE `audit` DROP COLUMN `categories`;
-- ALTER TABLE `audit` DROP COLUMN `reason`;
-- ALTER TABLE `audit` DROP COLUMN `retry_count`;
-- ALTER TABLE `audit` DROP INDEX `idx_target_id`;
