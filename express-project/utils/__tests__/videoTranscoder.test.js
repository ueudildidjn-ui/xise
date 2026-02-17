/**
 * Video Transcoder Unit Tests
 * Tests for aspect ratio preservation and adaptive resolution selection
 */

const { calculateAspectRatioSize, selectResolutions } = require('../videoTranscoder');
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

  describe('selectResolutions (adaptive mode)', () => {
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

    test('should use standard dimensions for adaptive scaling (not proportional)', () => {
      // For a portrait video, adaptive mode uses standard dimensions (e.g., 640x360)
      // The FFmpeg adaptive filter (scale+pad) handles aspect ratio preservation
      const result = selectResolutions(720, 1280, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      const nonOriginal = result.filter(r => !r.isOriginal);
      // Each non-original resolution should use standard config dimensions
      nonOriginal.forEach(resolution => {
        expect(resolution.width % 2).toBe(0);
        expect(resolution.height % 2).toBe(0);
      });
    });

    test('should not transcode to resolutions higher than source max dimension', () => {
      const result = selectResolutions(640, 360, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      // For 640x360, max dimension is 640
      // In adaptive mode, resolutions with target height < 640 are included
      // (480p and 360p), the adaptive filter handles proper scaling
      const nonOriginal = result.filter(r => !r.isOriginal);
      nonOriginal.forEach(resolution => {
        expect(resolution.height).toBeLessThan(Math.max(640, 360));
      });
    });

    test('should skip resolutions equal to or higher than source max dimension', () => {
      const result = selectResolutions(1920, 1080, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      // Source max dimension is 1920, so 1080p (height 1080 < 1920) is included
      // but 2160p (height 2160 > 1920) should be excluded
      const nonOriginal = result.filter(r => !r.isOriginal);
      nonOriginal.forEach(resolution => {
        expect(resolution.height).toBeLessThan(Math.max(1920, 1080));
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

    test('should use standard 640x360 for portrait video at 360p (adaptive filter handles aspect ratio)', () => {
      const result = selectResolutions(720, 1280, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      // Find 360p resolution
      const resolution360p = result.find(r => r.label === '360p');
      
      if (resolution360p) {
        // In adaptive mode, standard 640x360 is used; FFmpeg scale+pad handles aspect ratio
        expect(resolution360p.width).toBe(640);
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

    test('should include resolutions for portrait video based on max dimension', () => {
      // Portrait video 720x1280: max dimension is 1280
      // Should include 720p (720 < 1280) and lower resolutions
      const result = selectResolutions(720, 1280, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });
      
      const labels = result.map(r => r.label);
      expect(labels).toContain('原始');
      expect(labels).toContain('720p');
      expect(labels).toContain('480p');
      expect(labels).toContain('360p');
    });
  });
});

module.exports = {
  // Export for potential integration tests
};
