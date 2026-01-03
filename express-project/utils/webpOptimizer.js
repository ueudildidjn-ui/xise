/**
 * WebP图片优化器
 * 提供WebP转换和水印功能
 * 从PHP-Proj/webp/webp-optimizer.php移植
 * 
 * @description 自动将上传的图片优化为WebP格式，支持压缩、缩放和水印功能
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

/**
 * WebP优化器类
 */
class WebPOptimizer {
  constructor() {
    this.options = this.getDefaultOptions();
  }

  /**
   * 从配置中获取选项，如果没有配置则使用默认值
   */
  getDefaultOptions() {
    const webpConfig = config.webp || {};
    
    return {
      // 基本设置
      enableWebpConversion: webpConfig.enableConversion !== false, // 默认启用
      webpQuality: webpConfig.quality || 85,
      convertJpeg: webpConfig.convertJpeg !== false,
      convertPng: webpConfig.convertPng !== false,
      keepOriginal: webpConfig.keepOriginal || false,
      
      // 尺寸设置
      maxWidth: webpConfig.maxWidth || null,
      maxHeight: webpConfig.maxHeight || null,
      
      // 高级WebP选项
      webpLossless: webpConfig.lossless || false,
      webpAlphaQuality: webpConfig.alphaQuality || 100,
      
      // 水印设置
      enableWatermark: webpConfig.watermark?.enabled || false,
      watermarkType: webpConfig.watermark?.type || 'text', // 'text' 或 'image'
      watermarkText: webpConfig.watermark?.text || '',
      watermarkFontSize: webpConfig.watermark?.fontSize || 24,
      watermarkFontPath: webpConfig.watermark?.fontPath || null,
      watermarkImage: webpConfig.watermark?.imagePath || null,
      watermarkOpacity: webpConfig.watermark?.opacity || 50,
      watermarkPosition: webpConfig.watermark?.position || '9', // 九宫格位置，默认右下
      watermarkPositionMode: webpConfig.watermark?.positionMode || 'grid', // 'grid' 或 'precise'
      watermarkPreciseX: webpConfig.watermark?.preciseX || 0,
      watermarkPreciseY: webpConfig.watermark?.preciseY || 0,
      watermarkImageRatio: webpConfig.watermark?.imageRatio || 4, // 1-10, 表示图片水印占原图比例的1/10到10/10
      watermarkColor: webpConfig.watermark?.color || '#ffffff',
      
      // 用户名水印设置
      enableUsernameWatermark: webpConfig.usernameWatermark?.enabled || false,
      usernameWatermarkFontSize: webpConfig.usernameWatermark?.fontSize || 20,
      usernameWatermarkFontPath: webpConfig.usernameWatermark?.fontPath || null,
      usernameWatermarkOpacity: webpConfig.usernameWatermark?.opacity || 70,
      usernameWatermarkPosition: webpConfig.usernameWatermark?.position || '7', // 默认左下
      usernameWatermarkPositionMode: webpConfig.usernameWatermark?.positionMode || 'grid',
      usernameWatermarkPreciseX: webpConfig.usernameWatermark?.preciseX || 20,
      usernameWatermarkPreciseY: webpConfig.usernameWatermark?.preciseY || 20,
      usernameWatermarkColor: webpConfig.usernameWatermark?.color || '#ffffff',
      usernameWatermarkText: webpConfig.usernameWatermark?.text || '@username'
    };
  }

  /**
   * 检查文件是否支持转换
   * @param {string} mimetype - 文件MIME类型
   * @returns {boolean}
   */
  shouldConvert(mimetype) {
    if (!this.options.enableWebpConversion) {
      return false;
    }

    const mimeType = mimetype.toLowerCase();
    
    if ((mimeType === 'image/jpeg' || mimeType === 'image/jpg') && this.options.convertJpeg) {
      return true;
    }
    
    if (mimeType === 'image/png' && this.options.convertPng) {
      return true;
    }
    
    return false;
  }

  /**
   * 计算水印位置坐标
   * @param {number} position - 九宫格位置 (1-9)
   * @param {number} imageWidth - 图片宽度
   * @param {number} imageHeight - 图片高度
   * @param {number} watermarkWidth - 水印宽度
   * @param {number} watermarkHeight - 水印高度
   * @param {Object} options - 额外选项
   * @returns {{x: number, y: number}}
   */
  getWatermarkPosition(position, imageWidth, imageHeight, watermarkWidth, watermarkHeight, options = {}) {
    const positionMode = options.positionMode || this.options.watermarkPositionMode;
    
    // 精确坐标模式
    if (positionMode === 'precise') {
      return {
        x: options.preciseX || this.options.watermarkPreciseX || 0,
        y: options.preciseY || this.options.watermarkPreciseY || 0
      };
    }
    
    // 九宫格模式
    const padding = 20; // 边距
    let x = 0;
    let y = 0;
    
    switch (String(position)) {
      case '1': // 左上
        x = padding;
        y = padding;
        break;
      case '2': // 上中
        x = Math.floor((imageWidth - watermarkWidth) / 2);
        y = padding;
        break;
      case '3': // 右上
        x = imageWidth - watermarkWidth - padding;
        y = padding;
        break;
      case '4': // 左中
        x = padding;
        y = Math.floor((imageHeight - watermarkHeight) / 2);
        break;
      case '5': // 中心
        x = Math.floor((imageWidth - watermarkWidth) / 2);
        y = Math.floor((imageHeight - watermarkHeight) / 2);
        break;
      case '6': // 右中
        x = imageWidth - watermarkWidth - padding;
        y = Math.floor((imageHeight - watermarkHeight) / 2);
        break;
      case '7': // 左下
        x = padding;
        y = imageHeight - watermarkHeight - padding;
        break;
      case '8': // 下中
        x = Math.floor((imageWidth - watermarkWidth) / 2);
        y = imageHeight - watermarkHeight - padding;
        break;
      case '9': // 右下
      default:
        x = imageWidth - watermarkWidth - padding;
        y = imageHeight - watermarkHeight - padding;
        break;
    }
    
    // 确保坐标不为负数
    x = Math.max(0, x);
    y = Math.max(0, y);
    
    return { x, y };
  }

  /**
   * 创建文字水印SVG
   * @param {string} text - 水印文字
   * @param {number} fontSize - 字体大小
   * @param {string} color - 颜色 (hex格式)
   * @param {number} opacity - 透明度 (0-100)
   * @returns {Buffer} SVG缓冲区
   */
  createTextWatermarkSvg(text, fontSize, color, opacity) {
    // 将hex颜色转换为rgba
    const hexColor = color.replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    const a = opacity / 100;
    
    // 计算文字宽度（估算）
    const charWidth = fontSize * 0.6;
    const width = Math.ceil(text.length * charWidth) + 20;
    const height = fontSize + 10;
    
    // 创建SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <style>
        .watermark-text {
          font-family: "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
          font-size: ${fontSize}px;
          fill: rgba(${r}, ${g}, ${b}, ${a});
          text-shadow: 1px 1px 2px rgba(0, 0, 0, ${a * 0.8});
        }
      </style>
      <text x="10" y="${fontSize}" class="watermark-text">${this.escapeXml(text)}</text>
    </svg>`;
    
    return Buffer.from(svg);
  }

  /**
   * 转义XML特殊字符
   * @param {string} text
   * @returns {string}
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 处理水印文字中的占位符
   * @param {string} text - 水印文字
   * @param {Object} context - 上下文（包含用户信息等）
   * @returns {string}
   */
  processWatermarkText(text, context = {}) {
    let processedText = text;
    
    // 替换@username占位符
    if (processedText.includes('@username')) {
      const username = context.username || 'guest';
      processedText = processedText.replace(/@username/g, username);
    }
    
    return processedText;
  }

  /**
   * 应用文字水印
   * @param {sharp.Sharp} image - Sharp图片对象
   * @param {Object} metadata - 图片元数据
   * @param {Object} context - 上下文
   * @returns {Promise<sharp.Sharp>}
   */
  async applyTextWatermark(image, metadata, context = {}) {
    if (!this.options.enableWatermark || this.options.watermarkType !== 'text') {
      return image;
    }
    
    const text = this.processWatermarkText(this.options.watermarkText, context);
    if (!text) {
      return image;
    }
    
    const fontSize = this.options.watermarkFontSize;
    const opacity = this.options.watermarkOpacity;
    const color = this.options.watermarkColor;
    
    // 创建文字水印SVG
    const svgBuffer = this.createTextWatermarkSvg(text, fontSize, color, opacity);
    
    // 获取SVG尺寸估算
    const charWidth = fontSize * 0.6;
    const watermarkWidth = Math.ceil(text.length * charWidth) + 20;
    const watermarkHeight = fontSize + 10;
    
    // 计算位置
    const position = this.getWatermarkPosition(
      this.options.watermarkPosition,
      metadata.width,
      metadata.height,
      watermarkWidth,
      watermarkHeight,
      {
        positionMode: this.options.watermarkPositionMode,
        preciseX: this.options.watermarkPreciseX,
        preciseY: this.options.watermarkPreciseY
      }
    );
    
    // 应用水印
    return image.composite([{
      input: svgBuffer,
      top: position.y,
      left: position.x
    }]);
  }

  /**
   * 应用图片水印
   * @param {sharp.Sharp} image - Sharp图片对象
   * @param {Object} metadata - 图片元数据
   * @returns {Promise<sharp.Sharp>}
   */
  async applyImageWatermark(image, metadata) {
    if (!this.options.enableWatermark || this.options.watermarkType !== 'image') {
      return image;
    }
    
    const watermarkPath = this.options.watermarkImage;
    if (!watermarkPath || !fs.existsSync(watermarkPath)) {
      console.warn('WebP Optimizer: 水印图片不存在:', watermarkPath);
      return image;
    }
    
    try {
      // 加载水印图片
      let watermark = sharp(watermarkPath);
      const watermarkMeta = await watermark.metadata();
      
      // 计算水印尺寸（基于比例）
      const ratio = this.options.watermarkImageRatio / 10;
      const targetSize = Math.min(metadata.width, metadata.height) * ratio;
      
      let newWidth, newHeight;
      if (watermarkMeta.width > watermarkMeta.height) {
        newWidth = Math.round(targetSize);
        newHeight = Math.round((watermarkMeta.height / watermarkMeta.width) * targetSize);
      } else {
        newHeight = Math.round(targetSize);
        newWidth = Math.round((watermarkMeta.width / watermarkMeta.height) * targetSize);
      }
      
      // 调整水印大小并应用透明度
      const opacity = this.options.watermarkOpacity / 100;
      watermark = watermark
        .resize(newWidth, newHeight)
        .ensureAlpha()
        .modulate({ brightness: 1 });
      
      // 获取水印Buffer并应用透明度
      const watermarkBuffer = await watermark
        .composite([{
          input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
          raw: {
            width: 1,
            height: 1,
            channels: 4
          },
          tile: true,
          blend: 'dest-in'
        }])
        .toBuffer();
      
      // 计算位置
      const position = this.getWatermarkPosition(
        this.options.watermarkPosition,
        metadata.width,
        metadata.height,
        newWidth,
        newHeight,
        {
          positionMode: this.options.watermarkPositionMode,
          preciseX: this.options.watermarkPreciseX,
          preciseY: this.options.watermarkPreciseY
        }
      );
      
      // 应用水印
      return image.composite([{
        input: watermarkBuffer,
        top: position.y,
        left: position.x
      }]);
    } catch (error) {
      console.error('WebP Optimizer: 应用图片水印失败:', error.message);
      return image;
    }
  }

  /**
   * 应用用户名水印
   * @param {sharp.Sharp} image - Sharp图片对象
   * @param {Object} metadata - 图片元数据
   * @param {Object} context - 上下文（包含用户信息）
   * @returns {Promise<sharp.Sharp>}
   */
  async applyUsernameWatermark(image, metadata, context = {}) {
    if (!this.options.enableUsernameWatermark) {
      return image;
    }
    
    const text = this.processWatermarkText(this.options.usernameWatermarkText, context);
    if (!text) {
      return image;
    }
    
    const fontSize = this.options.usernameWatermarkFontSize;
    const opacity = this.options.usernameWatermarkOpacity;
    const color = this.options.usernameWatermarkColor;
    
    // 创建文字水印SVG
    const svgBuffer = this.createTextWatermarkSvg(text, fontSize, color, opacity);
    
    // 获取SVG尺寸估算
    const charWidth = fontSize * 0.6;
    const watermarkWidth = Math.ceil(text.length * charWidth) + 20;
    const watermarkHeight = fontSize + 10;
    
    // 计算位置
    const position = this.getWatermarkPosition(
      this.options.usernameWatermarkPosition,
      metadata.width,
      metadata.height,
      watermarkWidth,
      watermarkHeight,
      {
        positionMode: this.options.usernameWatermarkPositionMode,
        preciseX: this.options.usernameWatermarkPreciseX,
        preciseY: this.options.usernameWatermarkPreciseY
      }
    );
    
    // 应用水印
    return image.composite([{
      input: svgBuffer,
      top: position.y,
      left: position.x
    }]);
  }

  /**
   * 处理图片 - 主入口函数
   * @param {Buffer} fileBuffer - 文件缓冲区
   * @param {string} mimetype - 文件MIME类型
   * @param {Object} context - 上下文（包含用户信息等）
   * @returns {Promise<{buffer: Buffer, filename: string, mimetype: string, processed: boolean}>}
   */
  async processImage(fileBuffer, mimetype, context = {}) {
    // 检查是否需要处理
    const shouldConvertToWebp = this.shouldConvert(mimetype);
    const shouldApplyWatermark = this.options.enableWatermark || this.options.enableUsernameWatermark;
    const shouldResize = this.options.maxWidth || this.options.maxHeight;
    
    // 如果不需要任何处理，直接返回原图
    if (!shouldConvertToWebp && !shouldApplyWatermark && !shouldResize) {
      return {
        buffer: fileBuffer,
        mimetype: mimetype,
        processed: false
      };
    }
    
    try {
      // 创建Sharp实例
      let image = sharp(fileBuffer);
      let metadata = await image.metadata();
      
      console.log(`WebP Optimizer: 处理图片 - 原始尺寸: ${metadata.width}x${metadata.height}, 格式: ${metadata.format}`);
      
      // 1. 尺寸缩放
      if (shouldResize) {
        const resizeOptions = {};
        
        if (this.options.maxWidth && metadata.width > this.options.maxWidth) {
          resizeOptions.width = this.options.maxWidth;
        }
        
        if (this.options.maxHeight && metadata.height > this.options.maxHeight) {
          resizeOptions.height = this.options.maxHeight;
        }
        
        if (Object.keys(resizeOptions).length > 0) {
          resizeOptions.fit = 'inside';
          resizeOptions.withoutEnlargement = true;
          image = image.resize(resizeOptions);
          
          // 更新metadata以反映新尺寸
          const resizedBuffer = await image.toBuffer();
          image = sharp(resizedBuffer);
          metadata = await image.metadata();
          
          console.log(`WebP Optimizer: 已缩放 - 新尺寸: ${metadata.width}x${metadata.height}`);
        }
      }
      
      // 2. 应用水印
      if (shouldApplyWatermark) {
        // 应用文字/图片水印
        if (this.options.enableWatermark) {
          if (this.options.watermarkType === 'text') {
            image = await this.applyTextWatermark(image, metadata, context);
          } else if (this.options.watermarkType === 'image') {
            image = await this.applyImageWatermark(image, metadata);
          }
        }
        
        // 应用用户名水印
        if (this.options.enableUsernameWatermark) {
          image = await this.applyUsernameWatermark(image, metadata, context);
        }
      }
      
      // 3. WebP转换
      let outputBuffer;
      let outputMimetype = mimetype;
      
      if (shouldConvertToWebp) {
        const webpOptions = {
          quality: this.options.webpQuality,
          alphaQuality: this.options.webpAlphaQuality,
          lossless: this.options.webpLossless
        };
        
        outputBuffer = await image.webp(webpOptions).toBuffer();
        outputMimetype = 'image/webp';
        
        console.log(`WebP Optimizer: 已转换为WebP - 质量: ${this.options.webpQuality}, 无损: ${this.options.webpLossless}`);
      } else {
        // 如果不转换WebP，保持原格式输出
        outputBuffer = await image.toBuffer();
      }
      
      console.log(`WebP Optimizer: 处理完成 - 原始大小: ${fileBuffer.length}, 处理后: ${outputBuffer.length}`);
      
      return {
        buffer: outputBuffer,
        mimetype: outputMimetype,
        processed: true
      };
    } catch (error) {
      console.error('WebP Optimizer: 图片处理失败:', error.message);
      // 处理失败时返回原图
      return {
        buffer: fileBuffer,
        mimetype: mimetype,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * 生成WebP文件名
   * @param {string} originalFilename - 原始文件名
   * @returns {string}
   */
  generateWebpFilename(originalFilename) {
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    return `${basename}.webp`;
  }

  /**
   * 检查Sharp模块是否可用
   * @returns {boolean}
   */
  static isAvailable() {
    try {
      require('sharp');
      return true;
    } catch (error) {
      console.warn('WebP Optimizer: Sharp模块不可用:', error.message);
      return false;
    }
  }
}

// 创建单例实例
const webpOptimizer = new WebPOptimizer();

/**
 * 处理图片（便捷函数）
 * @param {Buffer} fileBuffer - 文件缓冲区
 * @param {string} mimetype - 文件MIME类型
 * @param {Object} context - 上下文
 * @returns {Promise<{buffer: Buffer, mimetype: string, processed: boolean}>}
 */
async function processImage(fileBuffer, mimetype, context = {}) {
  return webpOptimizer.processImage(fileBuffer, mimetype, context);
}

/**
 * 生成WebP文件名（便捷函数）
 * @param {string} originalFilename - 原始文件名
 * @returns {string}
 */
function generateWebpFilename(originalFilename) {
  return webpOptimizer.generateWebpFilename(originalFilename);
}

/**
 * 检查是否应该转换为WebP（便捷函数）
 * @param {string} mimetype - 文件MIME类型
 * @returns {boolean}
 */
function shouldConvert(mimetype) {
  return webpOptimizer.shouldConvert(mimetype);
}

/**
 * 刷新配置（重新从config读取）
 */
function refreshConfig() {
  webpOptimizer.options = webpOptimizer.getDefaultOptions();
}

module.exports = {
  WebPOptimizer,
  webpOptimizer,
  processImage,
  generateWebpFilename,
  shouldConvert,
  refreshConfig
};
