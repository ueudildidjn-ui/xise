/**
 * Video Transcoder Unit Tests
 * Tests for aspect ratio preservation, resolution selection, rotation handling,
 * and HEVC portrait video compatibility
 */

const { calculateAspectRatioSize, selectResolutions, buildScaleFilter, extractRotation, isRotationAlreadyApplied } = require('../videoTranscoder');
const config = require('../../config/config');

describe('Video Transcoder - Aspect Ratio Preservation', () => {
  describe('calculateAspectRatioSize', () => {
    test('should maintain 16:9 aspect ratio for landscape video', () => {
      const result = calculateAspectRatioSize(1920, 1080, 720);
      expect(result.width).toBe(1280);
      expect(result.height).toBe(720);
      // Verify aspect ratio is preserved (within small margin for rounding)
      const originalRatio = 1920 / 1080;
      const resultRatio = result.width / result.height;
      expect(Math.abs(originalRatio - resultRatio)).toBeLessThan(0.01);
    });

    test('should maintain 9:16 aspect ratio for portrait video', () => {
      const result = calculateAspectRatioSize(720, 1280, 360);
      // 720/1280 * 360 = 202.5 → Math.round() = 203 → adjust to even = 204
      expect(result.width).toBe(204);
      expect(result.height).toBe(360);
      // Verify aspect ratio is preserved
      const originalRatio = 720 / 1280;
      const resultRatio = result.width / result.height;
      expect(Math.abs(originalRatio - resultRatio)).toBeLessThan(0.01);
    });

    test('should maintain 4:3 aspect ratio', () => {
      const result = calculateAspectRatioSize(640, 480, 360);
      expect(result.width).toBe(480);
      expect(result.height).toBe(360);
      const originalRatio = 640 / 480;
      const resultRatio = result.width / result.height;
      expect(Math.abs(originalRatio - resultRatio)).toBeLessThan(0.01);
    });

    test('should return even dimensions for H.264 encoding', () => {
      const result = calculateAspectRatioSize(1921, 1081, 721);
      expect(result.width % 2).toBe(0);
      expect(result.height % 2).toBe(0);
    });
  });

  describe('selectResolutions', () => {
    const testResolutions = config.videoTranscoding.dash.resolutions;

    test('should include original quality option', () => {
      const result = selectResolutions(1920, 1080, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      const originalResolution = result.find(r => r.isOriginal);
      expect(originalResolution).toBeDefined();
      expect(originalResolution.width).toBe(1920);
      expect(originalResolution.height).toBe(1080);
      expect(originalResolution.bitrate).toBe(8000);
      expect(originalResolution.label).toBe('原始');
    });

    test('should generate at least 4 quality options for 1080p video', () => {
      const result = selectResolutions(1920, 1080, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      expect(result.length).toBeGreaterThanOrEqual(4);
      // Should have: 原始, 720p, 480p, 360p
      const labels = result.map(r => r.label || (r.height + 'p'));
      expect(labels).toContain('原始');
      expect(labels).toContain('720p');
      expect(labels).toContain('480p');
      expect(labels).toContain('360p');
    });

    test('should preserve aspect ratio for portrait video', () => {
      const result = selectResolutions(720, 1280, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      const sourceRatio = 720 / 1280;
      
      result.forEach(resolution => {
        if (!resolution.isOriginal) {
          const resolutionRatio = resolution.width / resolution.height;
          expect(Math.abs(sourceRatio - resolutionRatio)).toBeLessThan(0.01);
        }
      });
    });

    test('should not transcode to resolutions higher than source', () => {
      const result = selectResolutions(640, 360, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      result.forEach(resolution => {
        expect(resolution.height).toBeLessThanOrEqual(360);
      });
    });

    test('should skip resolutions equal to or higher than source height', () => {
      const result = selectResolutions(1920, 1080, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      // Should not include 1080p as target (source is 1080p)
      const nonOriginal = result.filter(r => !r.isOriginal);
      nonOriginal.forEach(resolution => {
        expect(resolution.height).toBeLessThan(1080);
      });
    });

    test('should handle 4K video correctly', () => {
      const result = selectResolutions(3840, 2160, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      expect(result.length).toBeGreaterThanOrEqual(5);
      // Should have: 原始, 1080p, 720p, 480p, 360p
      const labels = result.map(r => r.label || (r.height + 'p'));
      expect(labels).toContain('原始');
      expect(labels).toContain('1080p');
      expect(labels).toContain('720p');
    });

    test('should provide only original quality for very low resolution video', () => {
      const result = selectResolutions(320, 240, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      expect(result.length).toBe(1);
      expect(result[0].isOriginal).toBe(true);
      expect(result[0].width).toBe(320);
      expect(result[0].height).toBe(240);
    });

    test('should not distort aspect ratio (avoid 720x1280 to 640x360)', () => {
      const result = selectResolutions(720, 1280, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      // Find 360p resolution
      const resolution360p = result.find(r => r.height === 360);
      
      if (resolution360p) {
        // Should be approximately 203-204 x 360, NOT 640 x 360
        expect(resolution360p.width).toBeLessThan(300);
        expect(resolution360p.width).toBeGreaterThan(200);
        expect(resolution360p.height).toBe(360);
      }
    });

    test('should respect originalMaxBitrate configuration', () => {
      const customBitrate = 10000;
      const result = selectResolutions(1920, 1080, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: customBitrate
      });
      
      const originalResolution = result.find(r => r.isOriginal);
      expect(originalResolution.bitrate).toBe(customBitrate);
    });
  });

  describe('buildScaleFilter', () => {
    test('should use scale=-2:height format with lanczos flag (no rotation)', () => {
      const result = buildScaleFilter(0, { width: 1280, height: 720 });
      expect(result).toBe('-filter:v:0 scale=-2:720:flags=lanczos');
    });

    test('should use correct stream index', () => {
      const result = buildScaleFilter(2, { width: 854, height: 480 });
      expect(result).toBe('-filter:v:2 scale=-2:480:flags=lanczos');
    });

    test('should not fix both dimensions (avoid stretching)', () => {
      const result = buildScaleFilter(0, { width: 1920, height: 1080 });
      // Should NOT contain fixed width like "1920:1080"
      expect(result).not.toContain('1920:1080');
      // Should contain -2 for auto width calculation
      expect(result).toContain('scale=-2:1080');
    });

    test('should include lanczos flag for high-quality scaling', () => {
      const result = buildScaleFilter(0, { width: 640, height: 360 });
      expect(result).toContain('flags=lanczos');
    });

    test('should handle original resolution the same way', () => {
      const result = buildScaleFilter(0, { width: 1920, height: 1080, isOriginal: true });
      expect(result).toBe('-filter:v:0 scale=-2:1080:flags=lanczos');
    });

    test('should handle portrait video resolution', () => {
      const result = buildScaleFilter(1, { width: 204, height: 360 });
      expect(result).toBe('-filter:v:1 scale=-2:360:flags=lanczos');
    });

    // Rotation handling tests (Android portrait video compatibility)
    test('should prepend transpose=1 for 90° rotation (Android portrait video)', () => {
      const result = buildScaleFilter(0, { width: 1080, height: 1920 }, 90);
      expect(result).toBe('-filter:v:0 transpose=1,scale=-2:1920:flags=lanczos');
    });

    test('should prepend transpose=2 for 270° rotation', () => {
      const result = buildScaleFilter(0, { width: 1080, height: 1920 }, 270);
      expect(result).toBe('-filter:v:0 transpose=2,scale=-2:1920:flags=lanczos');
    });

    test('should prepend hflip,vflip for 180° rotation', () => {
      const result = buildScaleFilter(0, { width: 1920, height: 1080 }, 180);
      expect(result).toBe('-filter:v:0 hflip,vflip,scale=-2:1080:flags=lanczos');
    });

    test('should not add rotation filter for 0° rotation', () => {
      const result = buildScaleFilter(0, { width: 1920, height: 1080 }, 0);
      expect(result).toBe('-filter:v:0 scale=-2:1080:flags=lanczos');
      expect(result).not.toContain('transpose');
      expect(result).not.toContain('hflip');
    });

    test('should handle rotation with correct stream index', () => {
      const result = buildScaleFilter(2, { width: 720, height: 1280 }, 90);
      expect(result).toBe('-filter:v:2 transpose=1,scale=-2:1280:flags=lanczos');
    });

    test('should default to no rotation when rotation parameter is omitted', () => {
      const result = buildScaleFilter(0, { width: 1920, height: 1080 });
      expect(result).toBe('-filter:v:0 scale=-2:1080:flags=lanczos');
      expect(result).not.toContain('transpose');
    });
  });

  describe('extractRotation', () => {
    test('should extract rotation from tags.rotate (Android common format)', () => {
      const stream = { tags: { rotate: '90' } };
      expect(extractRotation(stream)).toBe(90);
    });

    test('should extract 270° rotation from tags', () => {
      const stream = { tags: { rotate: '270' } };
      expect(extractRotation(stream)).toBe(270);
    });

    test('should extract 180° rotation from tags', () => {
      const stream = { tags: { rotate: '180' } };
      expect(extractRotation(stream)).toBe(180);
    });

    test('should return 0 for no rotation metadata', () => {
      const stream = {};
      expect(extractRotation(stream)).toBe(0);
    });

    test('should return 0 for stream with empty tags', () => {
      const stream = { tags: {} };
      expect(extractRotation(stream)).toBe(0);
    });

    test('should extract rotation from side_data Display Matrix (iOS/newer FFmpeg)', () => {
      const stream = {
        side_data_list: [
          { side_data_type: 'Display Matrix', rotation: -90 }
        ]
      };
      // side_data rotation=-90 → negated → 90
      expect(extractRotation(stream)).toBe(90);
    });

    test('should extract 270° from side_data rotation=90', () => {
      const stream = {
        side_data_list: [
          { side_data_type: 'Display Matrix', rotation: 90 }
        ]
      };
      // side_data rotation=90 → negated → -90 → normalized → 270
      expect(extractRotation(stream)).toBe(270);
    });

    test('should prefer tags.rotate over side_data', () => {
      const stream = {
        tags: { rotate: '90' },
        side_data_list: [
          { side_data_type: 'Display Matrix', rotation: -270 }
        ]
      };
      expect(extractRotation(stream)).toBe(90);
    });

    test('should handle non-standard rotation values and normalize', () => {
      const stream = { tags: { rotate: '450' } };
      // 450 % 360 = 90
      expect(extractRotation(stream)).toBe(90);
    });

    test('should handle negative rotation from tags', () => {
      const stream = { tags: { rotate: '-90' } };
      // -90 → normalize → 270
      expect(extractRotation(stream)).toBe(270);
    });

    test('should handle side_data without Display Matrix', () => {
      const stream = {
        side_data_list: [
          { side_data_type: 'Other Data' }
        ]
      };
      expect(extractRotation(stream)).toBe(0);
    });

    test('should handle typical Redmi K80 Pro portrait video metadata', () => {
      // Android devices like Redmi K80 Pro record portrait as landscape+rotation=90
      const stream = {
        width: 1920,
        height: 1080,
        tags: { rotate: '90' }
      };
      expect(extractRotation(stream)).toBe(90);
    });
  });

  describe('isRotationAlreadyApplied (HEVC portrait video fix)', () => {
    // HEVC编码器已应用旋转的场景（应跳过旋转）
    test('should detect HEVC portrait video with rotation=90 as already applied', () => {
      // HEVC编码器直接以竖屏编码(1080x1920) + rotation=90元数据
      expect(isRotationAlreadyApplied(1080, 1920, 90)).toBe(true);
    });

    test('should detect HEVC portrait video with rotation=270 as already applied', () => {
      expect(isRotationAlreadyApplied(1080, 1920, 270)).toBe(true);
    });

    test('should detect non-standard portrait resolution as already applied', () => {
      // 非标准竖屏分辨率（如某些新机型）
      expect(isRotationAlreadyApplied(720, 1280, 90)).toBe(true);
    });

    // H.264标准行为（编码为横屏+rotation，不应跳过旋转）
    test('should NOT skip rotation for H.264-style landscape encoding with rotation=90', () => {
      // H.264标准行为：横屏编码(1920x1080) + rotation=90
      expect(isRotationAlreadyApplied(1920, 1080, 90)).toBe(false);
    });

    test('should NOT skip rotation for H.264-style landscape encoding with rotation=270', () => {
      expect(isRotationAlreadyApplied(1920, 1080, 270)).toBe(false);
    });

    // 无旋转或180°旋转（不受影响）
    test('should NOT skip for rotation=0 (no rotation)', () => {
      expect(isRotationAlreadyApplied(1080, 1920, 0)).toBe(false);
    });

    test('should NOT skip for rotation=180 (flip only, no orientation change)', () => {
      // 180°旋转只是翻转，不改变宽高方向，始终需要应用
      expect(isRotationAlreadyApplied(1080, 1920, 180)).toBe(false);
    });

    test('should NOT skip for landscape video with rotation=180', () => {
      expect(isRotationAlreadyApplied(1920, 1080, 180)).toBe(false);
    });

    // 正方形视频（宽=高）
    test('should NOT skip for square video with rotation=90', () => {
      // 正方形视频无所谓方向，编码宽度不小于高度
      expect(isRotationAlreadyApplied(1080, 1080, 90)).toBe(false);
    });

    // 模拟真实设备场景
    test('should handle Redmi K80 Pro HEVC portrait video (1080x1920+rotation=90)', () => {
      // Redmi K80 Pro HEVC编码：直接以竖屏1080x1920编码，但保留rotation=90
      expect(isRotationAlreadyApplied(1080, 1920, 90)).toBe(true);
    });

    test('should handle H.264 portrait video from older Android (1920x1080+rotation=90)', () => {
      // 旧版Android H.264编码：横屏1920x1080编码 + rotation=90
      expect(isRotationAlreadyApplied(1920, 1080, 90)).toBe(false);
    });
  });
});

module.exports = {
  // Export for potential integration tests
};
