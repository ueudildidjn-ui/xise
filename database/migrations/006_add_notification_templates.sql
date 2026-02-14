-- 通知模板表
CREATE TABLE IF NOT EXISTS `notification_templates` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `template_key` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) NULL,
  `system_template` TEXT NULL,
  `email_subject` VARCHAR(500) NULL,
  `email_body` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `notification_templates_template_key_key` (`template_key` ASC),
  INDEX `idx_notification_template_key` (`template_key` ASC),
  INDEX `idx_notification_template_active` (`is_active` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
