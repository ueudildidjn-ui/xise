<?php
/*
Test Chinese watermark functionality
Creates sample images with Chinese text watermarks to verify functionality
*/

// Try to include WordPress if available
$wp_root = dirname(dirname(dirname(dirname(__FILE__))));
if (file_exists($wp_root . '/wp-config.php')) {
    define('WP_USE_THEMES', false);
    require_once($wp_root . '/wp-config.php');
}

// Include the WebP optimizer plugin
require_once('webp-optimizer.php');

echo "<h1>中文水印功能测试</h1>\n";

// Create a test image
function create_test_image($width = 400, $height = 300, $filename = 'test-image.jpg') {
    $image = imagecreatetruecolor($width, $height);
    
    // Create a blue background
    $blue = imagecolorallocate($image, 70, 130, 180);
    imagefill($image, 0, 0, $blue);
    
    // Add some white text
    $white = imagecolorallocate($image, 255, 255, 255);
    imagestring($image, 5, 50, 50, 'Test Image ' . $width . 'x' . $height, $white);
    imagestring($image, 3, 50, 80, 'For Chinese Watermark Testing', $white);
    
    // Save as JPEG
    imagejpeg($image, $filename, 90);
    imagedestroy($image);
    
    return $filename;
}

// Test the get_default_font method
class TestWebPOptimizer extends WebPOptimizer {
    public function test_get_default_font($font_family) {
        return $this->get_default_font($font_family);
    }
    
    public function test_apply_text_watermark_imagick($image_path, $text, $font_family, $font_size, $opacity) {
        if (!extension_loaded('imagick')) {
            return array('success' => false, 'error' => 'ImageMagick not available');
        }
        
        try {
            $image = new \Imagick($image_path);
            $image_width = $image->getImageWidth();
            $image_height = $image->getImageHeight();
            
            $options = array(
                'watermark_text' => $text,
                'watermark_font_family' => $font_family,
                'watermark_font_size' => $font_size
            );
            
            $this->apply_text_watermark_imagick($image, $options, $opacity, 5, $image_width, $image_height);
            
            $output_path = 'watermarked_' . $font_family . '_imagick.jpg';
            $image->setImageFormat('jpeg');
            $image->writeImage($output_path);
            $image->destroy();
            
            return array('success' => true, 'file' => $output_path);
        } catch (Exception $e) {
            return array('success' => false, 'error' => $e->getMessage());
        }
    }
    
    public function test_apply_text_watermark_gd($image_path, $text, $font_family, $font_size, $opacity) {
        try {
            $image = imagecreatefromjpeg($image_path);
            if (!$image) {
                return array('success' => false, 'error' => 'Failed to load image');
            }
            
            $image_width = imagesx($image);
            $image_height = imagesy($image);
            
            $options = array(
                'watermark_text' => $text,
                'watermark_font_family' => $font_family,
                'watermark_font_size' => $font_size
            );
            
            $this->apply_text_watermark_gd($image, $options, $opacity, 5, $image_width, $image_height);
            
            $output_path = 'watermarked_' . $font_family . '_gd.jpg';
            imagejpeg($image, $output_path, 90);
            imagedestroy($image);
            
            return array('success' => true, 'file' => $output_path);
        } catch (Exception $e) {
            return array('success' => false, 'error' => $e->getMessage());
        }
    }
}

$test_optimizer = new TestWebPOptimizer();

// Test font detection
echo "<h2>字体检测测试</h2>\n";
$font_families = array('system', 'noto-cjk', 'wenquanyi', 'arial');
foreach ($font_families as $font_family) {
    $font = $test_optimizer->test_get_default_font($font_family);
    if (is_string($font)) {
        echo "<p><strong>$font_family:</strong> <span style='color: green;'>找到字体文件: $font</span></p>\n";
    } else {
        echo "<p><strong>$font_family:</strong> <span style='color: orange;'>使用内置字体 (编号: $font)</span></p>\n";
    }
}

// Create test image
echo "<h2>创建测试图片</h2>\n";
$test_image = create_test_image(600, 400, 'test-chinese-watermark.jpg');
echo "<p>测试图片已创建: <a href='$test_image'>$test_image</a></p>\n";

// Test Chinese watermarks
$test_text = "版权所有 © 2024 测试";
$font_size = 24;
$opacity = 70;

echo "<h2>中文水印测试</h2>\n";
echo "<p>测试文字: <strong>$test_text</strong></p>\n";
echo "<p>字体大小: $font_size px, 透明度: $opacity%</p>\n";

// Test with different fonts and methods
$test_fonts = array('noto-cjk', 'wenquanyi', 'system');

foreach ($test_fonts as $font_family) {
    echo "<h3>字体: $font_family</h3>\n";
    
    // Test ImageMagick
    if (extension_loaded('imagick')) {
        $result = $test_optimizer->test_apply_text_watermark_imagick($test_image, $test_text, $font_family, $font_size, $opacity);
        if ($result['success']) {
            echo "<p>✓ ImageMagick 测试成功: <a href='{$result['file']}'>{$result['file']}</a></p>\n";
        } else {
            echo "<p style='color: red;'>✗ ImageMagick 测试失败: {$result['error']}</p>\n";
        }
    } else {
        echo "<p style='color: orange;'>ImageMagick 未安装，跳过测试</p>\n";
    }
    
    // Test GD
    $result = $test_optimizer->test_apply_text_watermark_gd($test_image, $test_text, $font_family, $font_size, $opacity);
    if ($result['success']) {
        echo "<p>✓ GD 测试成功: <a href='{$result['file']}'>{$result['file']}</a></p>\n";
    } else {
        echo "<p style='color: red;'>✗ GD 测试失败: {$result['error']}</p>\n";
    }
}

echo "<h2>测试完成</h2>\n";
echo "<p>请查看生成的图片文件，确认中文水印是否正确显示。</p>\n";
echo "<p>如果中文字符显示为方框或问号，说明字体不支持中文，请选择支持中文的字体。</p>\n";

?>