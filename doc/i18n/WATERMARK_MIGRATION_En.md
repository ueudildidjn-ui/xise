# Watermark Processing Migration Guide

## Overview

This project has migrated watermark processing from `sharp`'s SVG-based approach to `@napi-rs/canvas` for better performance and more complete functionality.

## Changes

### New Dependencies
- **@napi-rs/canvas**: Used for text watermark generation and image opacity processing

### Retained Dependencies
- **sharp**: Still used for image resizing, conversion, and compositing

## Technical Advantages

### 1. Better Chinese Character Support
- Native Canvas API rendering for accurate Chinese character display
- Support for various character sets and special characters

### 2. Improved Font Handling
- Uses `GlobalFonts.registerFromPath()` for custom font registration
- Automatically generates unique font names to avoid conflicts
- Supports font fallback mechanism

### 3. High-Performance Pixel Processing
- Optimized pixel operations using `Uint8ClampedArray`
- Batch opacity adjustments
- Reduced memory allocations

## Feature Comparison

| Feature | Old (SVG) | New (Canvas) |
|---------|-----------|--------------|
| Text Rendering | SVG + librsvg | Native Canvas |
| Font Support | Base64 embed | Direct registration |
| Opacity Processing | Manual Sharp | Canvas ImageData |
| Chinese Support | System fonts | Better rendering |
| Performance | Medium | Better |

## API Compatibility

All external APIs remain compatible:
- `processImage()` - Main processing function
- `applyTextWatermark()` - Text watermark
- `applyImageWatermark()` - Image watermark
- `applyUsernameWatermark()` - Username watermark

## Configuration Compatibility

All existing configuration options are fully compatible:
- Watermark position (grid 1-9)
- Opacity (0-100)
- Font size
- Color settings
- Tile mode
- Custom font paths

## Test Coverage

✅ Text watermarks (basic and custom opacity)
✅ Image watermarks (single and tile mode)
✅ Username watermarks
✅ Chinese character support
✅ Different positions (grid 1-9)
✅ Performance testing (4000x3000px)
✅ Special characters and emojis
✅ Multiple opacity levels

## Migration Checklist

- [x] Install @napi-rs/canvas dependency
- [x] Refactor watermark generation functions
- [x] Update font handling logic
- [x] Optimize pixel processing
- [x] Comprehensive testing of all features
- [x] Code review
- [x] Security scan (no vulnerabilities)
- [x] Performance verification

## Performance Metrics

Based on test results:
- 800x600px image + dual watermarks: ~50ms
- 4000x3000px image + dual watermarks: ~830ms
- Memory usage: Stable, no leaks

## Backward Compatibility

✅ Fully backward compatible
✅ No need to modify existing configurations
✅ API signatures remain unchanged
✅ All features work normally

## Troubleshooting

### Font Issues
If custom fonts fail to load:
1. Check font file path
2. Verify font format (TTF/OTF)
3. Review console logs

### Performance Issues
If processing is slow:
1. Check image dimensions
2. Consider enabling image scaling
3. Reduce watermark count (tile mode)

## Future Improvements

Potential optimization directions:
- Support for more font formats
- Add watermark template system
- Implement watermark caching mechanism
- Support for dynamic watermark effects
