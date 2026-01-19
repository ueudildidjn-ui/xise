/**
 * 视频缩略图生成工具模块
 * 使用 FFmpeg 从视频中提取帧作为封面图
 * 
 * @author ZTMYO
 * @description 服务端视频缩略图生成
 */

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// 设置 FFmpeg 和 FFprobe 路径
if (config.videoTranscoding && config.videoTranscoding.ffmpegPath) {
  ffmpeg.setFfmpegPath(config.videoTranscoding.ffmpegPath);
}
if (config.videoTranscoding && config.videoTranscoding.ffprobePath) {
  ffmpeg.setFfprobePath(config.videoTranscoding.ffprobePath);
}

/**
 * 从视频中提取指定时间点的帧作为缩略图
 * @param {string} videoPath - 视频文件路径
 * @param {number|string} userId - 用户ID（用于生成唯一文件名）
 * @param {Object} options - 可选参数
 * @param {number} options.seekTime - 截图时间点（秒），默认1秒
 * @param {number} options.width - 输出宽度，默认保持原比例
 * @param {number} options.height - 输出高度，默认保持原比例
 * @param {string} options.format - 输出格式，默认 'jpg'
 * @returns {Promise<{success: boolean, url?: string, path?: string, message?: string}>}
 */
async function generateVideoThumbnail(videoPath, userId, options = {}) {
  try {
    const {
      seekTime = 1,
      width = null,
      height = null,
      format = 'jpg'
    } = options;

    // 验证视频文件存在
    if (!fs.existsSync(videoPath)) {
      console.warn(`⚠️ 视频文件不存在: ${videoPath}`);
      return { success: false, message: '视频文件不存在' };
    }

    // 确保缩略图输出目录存在
    const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const thumbnailFilename = `thumb_${userId}_${timestamp}_${randomStr}.${format}`;
    const outputPath = path.join(thumbnailDir, thumbnailFilename);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(videoPath)
        .seekInput(seekTime) // 跳转到指定时间点
        .frames(1) // 只提取1帧
        .outputOptions([
          '-f image2',
          '-update 1'
        ]);

      // 设置输出尺寸
      if (width && height) {
        command.size(`${width}x${height}`);
      } else if (width) {
        command.size(`${width}x?`);
      } else if (height) {
        command.size(`?x${height}`);
      }

      command.output(outputPath);

      command.on('start', (commandLine) => {
        console.log(`🖼️ 生成视频缩略图: ${path.basename(videoPath)}`);
      });

      command.on('error', (err) => {
        console.error(`❌ 视频缩略图生成失败: ${err.message}`);
        resolve({
          success: false,
          message: `缩略图生成失败: ${err.message}`
        });
      });

      command.on('end', () => {
        // 验证输出文件存在
        if (!fs.existsSync(outputPath)) {
          resolve({
            success: false,
            message: '缩略图文件未生成'
          });
          return;
        }

        // 生成访问URL
        const baseUrl = config?.upload?.image?.local?.baseUrl || 
                       config?.api?.baseUrl || 
                       'http://localhost:3001';
        const thumbnailUrl = `${baseUrl}/uploads/thumbnails/${thumbnailFilename}`;

        console.log(`✅ 视频缩略图生成成功: ${thumbnailUrl}`);
        resolve({
          success: true,
          url: thumbnailUrl,
          path: outputPath
        });
      });

      command.run();
    });

  } catch (error) {
    console.error(`❌ 生成视频缩略图异常: ${error.message}`);
    return {
      success: false,
      message: error.message || '生成视频缩略图异常'
    };
  }
}

/**
 * 检查视频是否存在且可访问
 * @param {string} videoPath - 视频文件路径
 * @returns {boolean}
 */
function isVideoAccessible(videoPath) {
  try {
    fs.accessSync(videoPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  generateVideoThumbnail,
  isVideoAccessible
};
