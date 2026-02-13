-- 黑名单表
CREATE TABLE IF NOT EXISTS `blacklist` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `blocker_id` BIGINT NOT NULL,
  `blocked_id` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_blacklist` (`blocker_id` ASC, `blocked_id` ASC),
  INDEX `idx_blacklist_blocker_id` (`blocker_id` ASC),
  INDEX `idx_blacklist_blocked_id` (`blocked_id` ASC),
  CONSTRAINT `fk_blacklist_blocker` FOREIGN KEY (`blocker_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_blacklist_blocked` FOREIGN KEY (`blocked_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
