/**
 * 视频转码工具模块
 * 支持将视频转换为DASH格式，智能检测分辨率，自动生成多码率版本
 * 
 * @author ZTMYO
 * @description 视频转码和DASH格式转换
 */

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// 设置 FFmpeg 和 FFprobe 路径
if (config.videoTranscoding.ffmpegPath) {
  ffmpeg.setFfmpegPath(config.videoTranscoding.ffmpegPath);
}
if (config.videoTranscoding.ffprobePath) {
  ffmpeg.setFfprobePath(config.videoTranscoding.ffprobePath);
}

/**
 * 使用 ffprobe 分析视频信息
 * @param {string} videoPath - 视频文件路径
 * @returns {Promise<Object>} 视频信息
 */
async function analyzeVideo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('❌ FFprobe 分析视频失败:', err.message);
        return reject(err);
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      if (!videoStream) {
        return reject(new Error('未找到视频流'));
      }

      const info = {
        width: videoStream.width,
        height: videoStream.height,
        duration: metadata.format.duration,
        bitrate: metadata.format.bit_rate,
        codec: videoStream.codec_name,
        hasAudio: !!audioStream,
        fps: videoStream.r_frame_rate ? 
          (() => {
            const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
            return den ? num / den : num;
          })() : 30
      };

      console.log('📊 视频分析结果:', info);
      resolve(info);
    });
  });
}

/**
 * 计算保持宽高比的缩放尺寸
 * @param {number} sourceWidth - 原视频宽度
 * @param {number} sourceHeight - 原视频高度
 * @param {number} targetHeight - 目标高度
 * @returns {Object} 缩放后的宽度和高度
 */
function calculateAspectRatioSize(sourceWidth, sourceHeight, targetHeight) {
  // 输入验证
  if (!sourceWidth || !sourceHeight || !targetHeight || 
      sourceWidth <= 0 || sourceHeight <= 0 || targetHeight <= 0) {
    throw new Error('Invalid dimensions: width, height, and targetHeight must be positive numbers');
  }
  
  const aspectRatio = sourceWidth / sourceHeight;
  const targetWidth = Math.round(targetHeight * aspectRatio);
  
  // 确保宽度是偶数（H.264编码要求）
  const evenWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
  const evenHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;
  
  return { width: evenWidth, height: evenHeight };
}

/**
 * 智能选择适合的分辨率（支持非标准分辨率和等比例缩放）
 * @param {number} videoWidth - 视频宽度
 * @param {number} videoHeight - 视频高度
 * @param {Array} configResolutions - 配置的分辨率列表
 * @param {Object} options - 选项
 * @param {boolean} options.includeOriginal - 是否包含原始分辨率
 * @param {number} options.originalMaxBitrate - 原始视频最大码率
 * @returns {Array} 适合的分辨率列表
 */
function selectResolutions(videoWidth, videoHeight, configResolutions, options = {}) {
  const { includeOriginal = true, originalMaxBitrate = config.videoTranscoding.dash.originalMaxBitrate } = options;
  const selectedResolutions = [];
  
  // 计算源视频的宽高比
  const sourceAspectRatio = videoWidth / videoHeight;
  console.log(`📐 原视频尺寸: ${videoWidth}x${videoHeight}, 宽高比: ${sourceAspectRatio.toFixed(3)}`);

  // 标准分辨率高度列表
  const standardHeights = [2160, 1080, 720, 480, 360];
  
  // 为每个标准高度生成等比例缩放的分辨率
  for (const targetHeight of standardHeights) {
    // 只处理小于原视频高度的分辨率
    if (targetHeight >= videoHeight) {
      console.log(`⏭️ 跳过分辨率 ${targetHeight}p (大于或等于原视频高度 ${videoHeight})`);
      continue;
    }
    
    // 计算保持宽高比的尺寸
    const scaledSize = calculateAspectRatioSize(videoWidth, videoHeight, targetHeight);
    
    // 从配置中查找匹配的码率，如果没有则根据高度估算
    let bitrate;
    const matchedConfig = configResolutions.find(r => r.height === targetHeight);
    
    if (matchedConfig) {
      bitrate = matchedConfig.bitrate;
    } else {
      // 根据分辨率估算码率（每像素0.1 bits，30fps）
      const DEFAULT_FPS = 30;
      const BIT_DEPTH = 0.1;
      const COMPRESSION_RATIO = 1000;
      bitrate = Math.floor(
        (scaledSize.width * scaledSize.height * DEFAULT_FPS * BIT_DEPTH) / COMPRESSION_RATIO
      );
      // 限制在最小和最大码率之间
      bitrate = Math.max(
        config.videoTranscoding.dash.minBitrate,
        Math.min(bitrate, config.videoTranscoding.dash.maxBitrate)
      );
    }
    
    selectedResolutions.push({
      width: scaledSize.width,
      height: scaledSize.height,
      bitrate: bitrate,
      label: `${targetHeight}p`
    });
    
    console.log(`✅ 添加分辨率 ${targetHeight}p: ${scaledSize.width}x${scaledSize.height}@${bitrate}kbps (等比例缩放)`);
  }

  // 添加原始分辨率（压缩但保持原始尺寸）
  if (includeOriginal) {
    // 确保原始分辨率的宽高是偶数
    const evenWidth = videoWidth % 2 === 0 ? videoWidth : videoWidth + 1;
    const evenHeight = videoHeight % 2 === 0 ? videoHeight : videoHeight + 1;
    
    selectedResolutions.unshift({
      width: evenWidth,
      height: evenHeight,
      bitrate: originalMaxBitrate,
      label: '原始',
      isOriginal: true
    });
    
    console.log(`✅ 添加原始分辨率: ${evenWidth}x${evenHeight}@${originalMaxBitrate}kbps (压缩)`);
  }

  // 如果没有找到任何合适的分辨率（视频太小），至少包含原始分辨率
  if (selectedResolutions.length === 0 || (selectedResolutions.length === 1 && !selectedResolutions[0].isOriginal)) {
    console.log('⚠️ 视频分辨率较低，仅使用原始分辨率');
    
    const evenWidth = videoWidth % 2 === 0 ? videoWidth : videoWidth + 1;
    const evenHeight = videoHeight % 2 === 0 ? videoHeight : videoHeight + 1;
    
    // 计算基于像素数和帧率的比特率
    const DEFAULT_FPS = 30;
    const BIT_DEPTH = 0.1;
    const COMPRESSION_RATIO = 1000;
    const calculatedBitrate = Math.floor(
      (evenWidth * evenHeight * DEFAULT_FPS * BIT_DEPTH) / COMPRESSION_RATIO
    );
    
    selectedResolutions.push({
      width: evenWidth,
      height: evenHeight,
      bitrate: Math.min(calculatedBitrate, originalMaxBitrate),
      label: '原始',
      isOriginal: true
    });
  }

  console.log(`✅ 最终选择的分辨率 (${selectedResolutions.length}个):`, 
    selectedResolutions.map(r => `${r.label || r.height + 'p'} ${r.width}x${r.height}:${r.bitrate}kbps`).join(', '));
  
  return selectedResolutions;
}

/**
 * 生成输出目录路径
 * @param {number} userId - 用户ID
 * @returns {string} 输出目录路径
 */
function generateOutputPath(userId) {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = Date.now();

  let outputFormat = config.videoTranscoding.outputFormat;
  
  // 替换变量
  outputFormat = outputFormat
    .replace('{date}', date)
    .replace('{userId}', userId.toString())
    .replace('{timestamp}', timestamp.toString());

  const baseDir = path.join(process.cwd(), config.upload.video.local.uploadDir, 'dash');
  const outputDir = path.join(baseDir, outputFormat);

  // 创建目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`📁 输出目录: ${outputDir}`);
  return outputDir;
}

/**
 * 转换视频为 DASH 格式
 * @param {string} inputPath - 输入视频路径
 * @param {number} userId - 用户ID
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise<Object>} 转码结果
 */
async function convertToDash(inputPath, userId, progressCallback) {
  try {
    if (!config.videoTranscoding.enabled) {
      console.log('⚠️ 视频转码未启用');
      return {
        success: false,
        message: '视频转码未启用'
      };
    }

    console.log('🎬 开始转码视频:', inputPath);

    // 1. 分析视频
    const videoInfo = await analyzeVideo(inputPath);

    // 2. 选择合适的分辨率
    const selectedResolutions = selectResolutions(
      videoInfo.width,
      videoInfo.height,
      config.videoTranscoding.dash.resolutions
    );

    // 3. 生成输出目录
    const outputDir = generateOutputPath(userId);
    const manifestFile = path.join(outputDir, 'manifest.mpd');

    // 4. 构建 FFmpeg 命令
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);

      // 设置视频编码器
      command.videoCodec('libx264');
      
      // 获取 FFmpeg 优化参数
      const ffmpegOpts = config.videoTranscoding.ffmpeg;
      
      // 添加线程数限制，避免资源占用过多
      // maxThreads > 0 使用指定线程数，0表示不限制（使用所有可用线程）
      const maxThreads = config.videoTranscoding.maxThreads;
      if (maxThreads > 0) {
        command.outputOptions([`-threads ${maxThreads}`]);
        console.log(`⚙️ 使用线程数限制: ${maxThreads}`);
      } else {
        console.log(`⚙️ 不限制线程数，使用所有可用线程`);
      }
      
      // 添加硬件加速（如果启用）
      if (ffmpegOpts.hardwareAccel && ffmpegOpts.hardwareAccelType) {
        // 验证硬件加速类型，防止命令注入
        const validAccelTypes = ['cuda', 'qsv', 'videotoolbox', 'vaapi', 'dxva2', 'amf', 'vdpau'];
        const accelType = ffmpegOpts.hardwareAccelType.toLowerCase().trim();
        
        if (validAccelTypes.includes(accelType)) {
          command.inputOptions([`-hwaccel ${accelType}`]);
          console.log(`⚡ 启用硬件加速: ${accelType}`);
        } else {
          console.warn(`⚠️ 不支持的硬件加速类型: ${accelType}，跳过硬件加速`);
        }
      }
      
      // 为每个分辨率添加输出流
      selectedResolutions.forEach((resolution, index) => {
        const videoOptions = [
          `-map 0:v:0`,
          `-s:v:${index} ${resolution.width}x${resolution.height}`,
          `-c:v:${index} libx264`,
          `-profile:v:${index} ${ffmpegOpts.profile}`,
          `-preset:v:${index} ${ffmpegOpts.preset}`,
          `-pix_fmt:v:${index} ${ffmpegOpts.pixelFormat}`
        ];
        
        // 如果设置了 CRF，使用恒定质量模式（CRF本身就是动态码率）
        // CRF范围: 10-51，值越小质量越高（0-9 接近无损，文件过大）
        if (ffmpegOpts.crf !== null && ffmpegOpts.crf >= 10 && ffmpegOpts.crf <= 51) {
          videoOptions.push(`-crf:v:${index} ${ffmpegOpts.crf}`);
          // CRF模式下设置最大码率上限，确保不会超出预期
          videoOptions.push(`-maxrate:v:${index} ${Math.floor(resolution.bitrate * 1.2)}k`);
          videoOptions.push(`-bufsize:v:${index} ${Math.floor(resolution.bitrate * 2)}k`);
          console.log(`📊 流${index} CRF模式: CRF=${ffmpegOpts.crf}, 最大码率=${Math.floor(resolution.bitrate * 1.2)}k`);
        } else if (ffmpegOpts.crf !== null) {
          // CRF 值无效，回退到 VBR 模式
          console.warn(`⚠️ CRF 值 ${ffmpegOpts.crf} 无效（有效范围10-51），使用 VBR 模式`);
          videoOptions.push(`-b:v:${index} ${resolution.bitrate}k`);
          videoOptions.push(`-maxrate:v:${index} ${Math.floor(resolution.bitrate * 1.5)}k`);
          videoOptions.push(`-bufsize:v:${index} ${Math.floor(resolution.bitrate * 3)}k`);
          console.log(`📊 流${index} VBR模式: 目标=${resolution.bitrate}k, 最大=${Math.floor(resolution.bitrate * 1.5)}k, 缓冲=${Math.floor(resolution.bitrate * 3)}k`);
        } else {
          // 使用动态码率模式 (VBR - Variable Bitrate)
          // -b:v 设置平均目标码率
          // -maxrate 设置最大码率上限（不会超过此值）
          // -bufsize 设置码率控制缓冲区大小
          // 这种配置允许码率在0到maxrate之间动态变化，平均接近b:v
          videoOptions.push(`-b:v:${index} ${resolution.bitrate}k`);
          // 最大码率设为目标码率的1.5倍，提供足够的动态空间
          videoOptions.push(`-maxrate:v:${index} ${Math.floor(resolution.bitrate * 1.5)}k`);
          // bufsize设为maxrate的2倍，确保平滑的码率变化
          videoOptions.push(`-bufsize:v:${index} ${Math.floor(resolution.bitrate * 3)}k`);
          // 不设置 -minrate，允许码率降到0，实现真正的动态码率
          console.log(`📊 流${index} VBR模式: 目标=${resolution.bitrate}k, 最大=${Math.floor(resolution.bitrate * 1.5)}k, 缓冲=${Math.floor(resolution.bitrate * 3)}k`);
        }
        
        // GOP 大小（关键帧间隔）
        if (ffmpegOpts.gopSize !== null && ffmpegOpts.gopSize > 0) {
          videoOptions.push(`-g:v:${index} ${ffmpegOpts.gopSize}`);
        } else {
          // 默认使用帧率的2倍作为GOP大小
          const gopSize = Math.round(videoInfo.fps * 2);
          videoOptions.push(`-g:v:${index} ${gopSize}`);
        }
        
        // B帧数量
        if (ffmpegOpts.bFrames !== null && ffmpegOpts.bFrames >= 0) {
          videoOptions.push(`-bf:v:${index} ${ffmpegOpts.bFrames}`);
        }
        
        // 参考帧数量
        if (ffmpegOpts.refFrames !== null && ffmpegOpts.refFrames > 0) {
          videoOptions.push(`-refs:v:${index} ${ffmpegOpts.refFrames}`);
        }
        
        command.outputOptions(videoOptions);
      });

      // 添加音频流（如果存在）
      if (videoInfo.hasAudio) {
        command.outputOptions([
          '-map 0:a:0',
          '-c:a aac',
          `-b:a ${ffmpegOpts.audioBitrate}k`,
          `-ar ${ffmpegOpts.audioSampleRate}`,
          '-ac 2'
        ]);
        console.log(`🔊 音频配置: ${ffmpegOpts.audioBitrate}kbps @ ${ffmpegOpts.audioSampleRate}Hz`);
      }

      // DASH 输出配置
      // 注意: 不需要 adaptation_sets 选项，FFmpeg 会自动根据映射的流创建 adaptation sets
      const dashOptions = [
        '-f dash',
        `-seg_duration ${config.videoTranscoding.dash.segmentDuration}`,
        '-use_template 1',
        '-use_timeline 1',
        '-init_seg_name init-stream$RepresentationID$.$ext$',
        '-media_seg_name chunk-stream$RepresentationID$-$Number%05d$.$ext$',
        '-single_file 0'
      ];

      command
        .outputOptions(dashOptions)
        .output(manifestFile);

      // 添加命令开始监听（用于调试）
      command.on('start', (commandLine) => {
        console.log('🎬 FFmpeg 命令:', commandLine);
        console.log('📊 编码参数:', {
          preset: ffmpegOpts.preset,
          profile: ffmpegOpts.profile,
          crf: ffmpegOpts.crf || '未设置（使用码率模式）',
          gopSize: ffmpegOpts.gopSize || '自动（帧率x2）',
          bFrames: ffmpegOpts.bFrames || '默认',
          refFrames: ffmpegOpts.refFrames || '默认'
        });
      });

      // 进度监听
      command.on('progress', (progress) => {
        if (progressCallback && progress.percent) {
          progressCallback(Math.floor(progress.percent));
        }
        if (progress.percent) {
          console.log(`⏳ 转码进度: ${Math.floor(progress.percent)}%`);
        }
      });

      // 错误处理
      command.on('error', (err, stdout, stderr) => {
        console.error('❌ 视频转码失败:', err.message);
        if (stderr) {
          console.error('FFmpeg stderr:', stderr);
        }
        reject({
          success: false,
          message: `视频转码失败: ${err.message}`
        });
      });

      // 完成处理
      command.on('end', () => {
        console.log('✅ 视频转码完成');

        // 删除原始文件（如果配置启用）
        if (config.videoTranscoding.deleteOriginal && fs.existsSync(inputPath)) {
          try {
            fs.unlinkSync(inputPath);
            console.log('🗑️ 已删除原始视频文件');
          } catch (err) {
            console.warn('⚠️ 删除原始文件失败:', err.message);
          }
        }

        // 生成相对路径的 URL
        const relativePath = path.relative(
          path.join(process.cwd(), config.upload.video.local.uploadDir),
          outputDir
        ).replace(/\\/g, '/');
        
        const baseUrl = config.upload.video.local.baseUrl;
        const videoDir = config.upload.video.local.uploadDir;
        const manifestUrl = `${baseUrl}/${videoDir}/${relativePath}/manifest.mpd`;

        resolve({
          success: true,
          manifestUrl: manifestUrl,
          outputDir: outputDir,
          resolutions: selectedResolutions,
          videoInfo: videoInfo
        });
      });

      // 执行转码
      command.run();
    });

  } catch (error) {
    console.error('❌ 转码过程异常:', error);
    return {
      success: false,
      message: error.message || '转码过程异常'
    };
  }
}

/**
 * 检查 FFmpeg 是否可用
 * @returns {Promise<boolean>}
 */
async function checkFFmpegAvailable() {
  return new Promise((resolve) => {
    try {
      ffmpeg.getAvailableFormats((err) => {
        if (err) {
          console.error('❌ FFmpeg 不可用:', err.message);
          resolve(false);
        } else {
          console.log('✅ FFmpeg 可用');
          resolve(true);
        }
      });
    } catch (error) {
      console.error('❌ FFmpeg 检查失败:', error.message);
      resolve(false);
    }
  });
}

/**
 * 验证视频文件是否为有效的媒体文件
 * 使用 ffprobe 检查视频流是否存在且可读
 * @param {string} videoPath - 视频文件路径
 * @returns {Promise<{valid: boolean, message?: string, info?: Object}>}
 */
async function validateVideoMedia(videoPath) {
  try {
    if (!fs.existsSync(videoPath)) {
      return { valid: false, message: '视频文件不存在' };
    }

    // 使用 ffprobe 分析视频
    const info = await analyzeVideo(videoPath);
    
    // 验证基本视频属性
    if (!info.width || !info.height || info.width <= 0 || info.height <= 0) {
      return { valid: false, message: '无效的视频分辨率' };
    }
    
    if (!info.duration || info.duration <= 0) {
      return { valid: false, message: '无效的视频时长' };
    }
    
    if (!info.codec) {
      return { valid: false, message: '无法识别视频编解码器' };
    }
    
    console.log(`✅ 视频验证通过: ${path.basename(videoPath)}, ` +
      `分辨率: ${info.width}x${info.height}, ` +
      `时长: ${info.duration.toFixed(2)}秒, ` +
      `编解码器: ${info.codec}`);
    
    return { valid: true, info };
  } catch (error) {
    console.error(`❌ 视频验证失败 [${videoPath}]:`, error.message);
    return { 
      valid: false, 
      message: error.message || '视频文件无法解析，可能已损坏或格式不支持'
    };
  }
}

/**
 * 删除无效的视频文件
 * @param {string} videoPath - 视频文件路径
 * @returns {Promise<boolean>}
 */
async function deleteInvalidVideo(videoPath) {
  try {
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
      console.log(`🗑️ 已删除无效视频文件: ${videoPath}`);
      return true;
    }
    return true;
  } catch (error) {
    console.error(`❌ 删除无效视频文件失败 [${videoPath}]:`, error.message);
    return false;
  }
}

module.exports = {
  analyzeVideo,
  selectResolutions,
  calculateAspectRatioSize,
  generateOutputPath,
  convertToDash,
  checkFFmpegAvailable,
  validateVideoMedia,
  deleteInvalidVideo
};
