/**
 * Video Transcoder Unit Tests
 * Tests for aspect ratio preservation and resolution selection
 */

// Mock the config module to avoid Prisma dependency
jest.mock('../../config/config', () => ({
  videoTranscoding: {
    dash: {
      resolutions: [
        { width: 1920, height: 1080, bitrate: 5000 },
        { width: 1280, height: 720, bitrate: 2500 },
        { width: 854, height: 480, bitrate: 1000 },
        { width: 640, height: 360, bitrate: 750 }
      ],
      originalMaxBitrate: 8000,
      minBitrate: 500,
      maxBitrate: 5000,
      segmentDuration: 4
    },
    ffmpegPath: '',
    ffprobePath: '',
    enabled: false,
    ffmpeg: {}
  }
}));

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

  describe('Unconventional aspect ratios', () => {
    const testResolutions = config.videoTranscoding.dash.resolutions;

    test('should handle 1:1 square video (1080x1080)', () => {
      const result = selectResolutions(1080, 1080, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      result.forEach(resolution => {
        // Square videos must stay square (width == height)
        expect(resolution.width).toBe(resolution.height);
      });
    });

    test('should handle 4:5 Instagram portrait (1080x1350)', () => {
      const result = selectResolutions(1080, 1350, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      const sourceRatio = 1080 / 1350;
      result.forEach(resolution => {
        // Portrait must stay portrait (width < height)
        expect(resolution.width).toBeLessThan(resolution.height);
        const resRatio = resolution.width / resolution.height;
        expect(Math.abs(sourceRatio - resRatio)).toBeLessThan(0.02);
      });
    });

    test('should handle 9:16 full HD portrait (1080x1920)', () => {
      const result = selectResolutions(1080, 1920, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      const sourceRatio = 1080 / 1920;
      result.forEach(resolution => {
        expect(resolution.width).toBeLessThan(resolution.height);
        const resRatio = resolution.width / resolution.height;
        expect(Math.abs(sourceRatio - resRatio)).toBeLessThan(0.02);
      });
    });

    test('should handle 9:21 ultra-tall portrait (1080x2520)', () => {
      const result = selectResolutions(1080, 2520, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      const sourceRatio = 1080 / 2520;
      result.forEach(resolution => {
        expect(resolution.width).toBeLessThan(resolution.height);
        const resRatio = resolution.width / resolution.height;
        expect(Math.abs(sourceRatio - resRatio)).toBeLessThan(0.02);
      });
    });

    test('should handle 21:9 ultra-wide landscape (2560x1080)', () => {
      const result = selectResolutions(2560, 1080, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      const sourceRatio = 2560 / 1080;
      result.forEach(resolution => {
        // Landscape must stay landscape (width > height)
        expect(resolution.width).toBeGreaterThan(resolution.height);
        const resRatio = resolution.width / resolution.height;
        expect(Math.abs(sourceRatio - resRatio)).toBeLessThan(0.02);
      });
    });

    test('should handle 3:4 portrait (960x1280)', () => {
      const result = selectResolutions(960, 1280, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      const sourceRatio = 960 / 1280;
      result.forEach(resolution => {
        expect(resolution.width).toBeLessThan(resolution.height);
        const resRatio = resolution.width / resolution.height;
        expect(Math.abs(sourceRatio - resRatio)).toBeLessThan(0.02);
      });
    });

    test('should handle 9:16 low resolution portrait (540x960)', () => {
      const result = selectResolutions(540, 960, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      const sourceRatio = 540 / 960;
      result.forEach(resolution => {
        expect(resolution.width).toBeLessThan(resolution.height);
        const resRatio = resolution.width / resolution.height;
        expect(Math.abs(sourceRatio - resRatio)).toBeLessThan(0.02);
      });
    });

    test('should handle 2:1 wide cinema (2160x1080)', () => {
      const result = selectResolutions(2160, 1080, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      result.forEach(resolution => {
        expect(resolution.width).toBeGreaterThan(resolution.height);
      });
    });

    test('should handle very narrow portrait (320x1280)', () => {
      const result = selectResolutions(320, 1280, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      const sourceRatio = 320 / 1280;
      result.forEach(resolution => {
        expect(resolution.width).toBeLessThan(resolution.height);
        const resRatio = resolution.width / resolution.height;
        expect(Math.abs(sourceRatio - resRatio)).toBeLessThan(0.02);
      });
    });

    test('should handle phone screen recording portrait (1284x2778)', () => {
      const result = selectResolutions(1284, 2778, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      const sourceRatio = 1284 / 2778;
      result.forEach(resolution => {
        expect(resolution.width).toBeLessThan(resolution.height);
        const resRatio = resolution.width / resolution.height;
        expect(Math.abs(sourceRatio - resRatio)).toBeLessThan(0.02);
      });
    });

    test('should handle non-standard resolution (1000x1500)', () => {
      const result = selectResolutions(1000, 1500, testResolutions, {
        includeOriginal: true,
        originalMaxBitrate: 8000
      });

      const sourceRatio = 1000 / 1500;
      result.forEach(resolution => {
        expect(resolution.width).toBeLessThan(resolution.height);
        const resRatio = resolution.width / resolution.height;
        expect(Math.abs(sourceRatio - resRatio)).toBeLessThan(0.02);
      });
    });
  });

  describe('Portrait video must never become landscape', () => {
    const testResolutions = config.videoTranscoding.dash.resolutions;

    const portraitVideos = [
      { w: 720, h: 1280, name: '9:16 (720x1280)' },
      { w: 1080, h: 1920, name: '9:16 HD (1080x1920)' },
      { w: 1080, h: 1350, name: '4:5 Instagram (1080x1350)' },
      { w: 960, h: 1280, name: '3:4 (960x1280)' },
      { w: 540, h: 960, name: '9:16 low-res (540x960)' },
      { w: 320, h: 1280, name: '1:4 very narrow (320x1280)' },
      { w: 1080, h: 2400, name: '9:20 tall phone (1080x2400)' },
      { w: 1284, h: 2778, name: 'iPhone 13 Pro Max (1284x2778)' },
      { w: 1080, h: 2520, name: '9:21 ultra-tall (1080x2520)' },
      { w: 1000, h: 1500, name: '2:3 non-standard (1000x1500)' },
      { w: 480, h: 854, name: '~9:16 low-res (480x854)' },
      { w: 360, h: 640, name: '9:16 very low-res (360x640)' },
    ];

    test.each(portraitVideos)(
      'portrait $name must not become landscape in any output resolution',
      ({ w, h }) => {
        const result = selectResolutions(w, h, testResolutions, {
          includeOriginal: true,
          originalMaxBitrate: 8000
        });

        expect(result.length).toBeGreaterThanOrEqual(1);
        result.forEach(resolution => {
          expect(resolution.width).toBeLessThan(resolution.height);
        });
      }
    );

    const landscapeVideos = [
      { w: 1920, h: 1080, name: '16:9 (1920x1080)' },
      { w: 3840, h: 2160, name: '16:9 4K (3840x2160)' },
      { w: 2560, h: 1080, name: '21:9 ultra-wide (2560x1080)' },
      { w: 1280, h: 720, name: '16:9 (1280x720)' },
      { w: 854, h: 480, name: '~16:9 (854x480)' },
    ];

    test.each(landscapeVideos)(
      'landscape $name must not become portrait in any output resolution',
      ({ w, h }) => {
        const result = selectResolutions(w, h, testResolutions, {
          includeOriginal: true,
          originalMaxBitrate: 8000
        });

        expect(result.length).toBeGreaterThanOrEqual(1);
        result.forEach(resolution => {
          expect(resolution.width).toBeGreaterThan(resolution.height);
        });
      }
    );
  });

  describe('calculateAspectRatioSize - unconventional ratios', () => {
    test('should handle 1:1 square (1080x1080) scaled to 720', () => {
      const result = calculateAspectRatioSize(1080, 1080, 720);
      expect(result.width).toBe(720);
      expect(result.height).toBe(720);
    });

    test('should handle 4:5 portrait (1080x1350) scaled to 720', () => {
      const result = calculateAspectRatioSize(1080, 1350, 720);
      // 1080/1350 * 720 = 576
      expect(result.width).toBe(576);
      expect(result.height).toBe(720);
      expect(result.width).toBeLessThan(result.height);
    });

    test('should handle 9:16 portrait (1080x1920) scaled to 720', () => {
      const result = calculateAspectRatioSize(1080, 1920, 720);
      // 1080/1920 * 720 = 405 → 406 (even)
      expect(result.width).toBe(406);
      expect(result.height).toBe(720);
      expect(result.width).toBeLessThan(result.height);
    });

    test('should handle 21:9 ultra-wide (2560x1080) scaled to 720', () => {
      const result = calculateAspectRatioSize(2560, 1080, 720);
      // 2560/1080 * 720 ≈ 1706.67 → 1707 → 1708 (even)
      expect(result.width).toBe(1708);
      expect(result.height).toBe(720);
      expect(result.width).toBeGreaterThan(result.height);
    });

    test('should handle very narrow portrait (320x1280) scaled to 720', () => {
      const result = calculateAspectRatioSize(320, 1280, 720);
      // 320/1280 * 720 = 180
      expect(result.width).toBe(180);
      expect(result.height).toBe(720);
      expect(result.width).toBeLessThan(result.height);
    });

    test('should handle 9:20 tall phone (1080x2400) scaled to 720', () => {
      const result = calculateAspectRatioSize(1080, 2400, 720);
      // 1080/2400 * 720 = 324
      expect(result.width).toBe(324);
      expect(result.height).toBe(720);
      expect(result.width).toBeLessThan(result.height);
    });

    test('should always return even dimensions', () => {
      const testCases = [
        { sw: 1080, sh: 1920, th: 721 },
        { sw: 999, sh: 1777, th: 719 },
        { sw: 321, sh: 1281, th: 481 },
        { sw: 1081, sh: 1351, th: 361 },
      ];

      testCases.forEach(({ sw, sh, th }) => {
        const result = calculateAspectRatioSize(sw, sh, th);
        expect(result.width % 2).toBe(0);
        expect(result.height % 2).toBe(0);
      });
    });

    test('should throw error for invalid dimensions', () => {
      expect(() => calculateAspectRatioSize(0, 1080, 720)).toThrow();
      expect(() => calculateAspectRatioSize(1920, 0, 720)).toThrow();
      expect(() => calculateAspectRatioSize(1920, 1080, 0)).toThrow();
      expect(() => calculateAspectRatioSize(-1, 1080, 720)).toThrow();
    });
  });
});

module.exports = {
  // Export for potential integration tests
};
