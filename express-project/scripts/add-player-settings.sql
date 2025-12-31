-- 视频播放器设置升级脚本
-- 添加 Shaka Player 相关配置到系统设置表

USE `xiaoshiliu`;

-- 插入播放器设置（如果不存在）
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_group`, `description`) VALUES 
-- 播放器基本设置
('player_autoplay', 'false', 'player', '是否自动播放视频'),
('player_loop', 'false', 'player', '是否循环播放视频'),
('player_muted', 'false', 'player', '是否默认静音'),
('player_default_volume', '0.5', 'player', '默认音量(0-1)'),
('player_show_controls', 'true', 'player', '是否显示播放控件'),

-- Shaka Player 流媒体设置
('player_buffering_goal', '30', 'player', '缓冲目标时长(秒)'),
('player_rebuffering_goal', '2', 'player', '重新缓冲目标时长(秒)'),
('player_buffer_behind', '30', 'player', '保留已播放缓冲时长(秒)'),

-- 自适应码率(ABR)设置
('player_abr_enabled', 'true', 'player', '是否启用自适应码率'),
('player_abr_default_bandwidth', '1000000', 'player', '默认带宽估计(bps)'),

-- 播放器UI设置
('player_prefer_mpd', 'true', 'player', '优先使用MPD格式(当可用时)')
ON DUPLICATE KEY UPDATE `setting_key` = VALUES(`setting_key`);

-- 查询插入的设置
SELECT * FROM `system_settings` WHERE `setting_group` = 'player' ORDER BY `setting_key`;

SELECT '播放器设置升级完成！' AS message;
