<?php
/**
 * Text Watermark Test Script
 * 测试文字水印功能和字体设置
 */

// 模拟插件环境
class WebPOptimizerTest {
    
    /**
     * 获取默认字体路径
     */
    private function get_default_font($font_family = 'system') {
        $font_paths = array();
        
        switch ($font_family) {
            case 'arial':
                $font_paths = array(
                    '/System/Library/Fonts/Arial.ttf', // macOS
                    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', // Linux
                    '/Windows/Fonts/arial.ttf', // Windows
                    dirname(__FILE__) . '/fonts/arial.ttf', // 插件目录
                );
                break;
            case 'dejavu':
                $font_paths = array(
                    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', // Linux
                    '/System/Library/Fonts/DejaVuSans.ttf', // macOS
                    dirname(__FILE__) . '/fonts/dejavu.ttf', // 插件目录
                );
                break;
            case 'helvetica':
                $font_paths = array(
                    '/System/Library/Fonts/Helvetica.ttc', // macOS
                    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', // Linux fallback
                    dirname(__FILE__) . '/fonts/helvetica.ttf', // 插件目录
                );
                break;
            case 'times':
                $font_paths = array(
                    '/System/Library/Fonts/Times.ttc', // macOS
                    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf', // Linux
                    '/Windows/Fonts/times.ttf', // Windows
                    dirname(__FILE__) . '/fonts/times.ttf', // 插件目录
                );
                break;
            case 'system':
            default:
                $font_paths = array(
                    '/System/Library/Fonts/Arial.ttf', // macOS
                    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', // Linux
                    '/Windows/Fonts/arial.ttf', // Windows
                    dirname(__FILE__) . '/fonts/arial.ttf', // 插件目录
                );
                break;
        }
        
        foreach ($font_paths as $font) {
            if (file_exists($font)) {
                return $font;
            }
        }
        
        // 如果找不到TTF字体，使用内置字体
        return 5; // GD内置字体编号
    }
    
    /**
     * 测试字体加载功能
     */
    public function test_font_loading() {
        echo "<h2>字体加载测试</h2>";
        
        $font_families = array('system', 'arial', 'dejavu', 'helvetica', 'times');
        
        foreach ($font_families as $family) {
            $font = $this->get_default_font($family);
            $status = is_string($font) && file_exists($font) ? '✅ 找到TTF字体' : '⚠️ 使用内置字体';
            $path = is_string($font) ? $font : '内置字体 #' . $font;
            
            echo "<p><strong>{$family}:</strong> {$status} - {$path}</p>";
        }
    }
    
    /**
     * 测试文字水印参数验证
     */
    public function test_parameter_validation() {
        echo "<h2>参数验证测试</h2>";
        
        // 测试字体大小验证
        $test_sizes = array(5, 10, 24, 48, 72, 100);
        foreach ($test_sizes as $size) {
            if ($size >= 10 && $size <= 72) {
                echo "<p>字体大小 {$size}px: ✅ 有效</p>";
            } else {
                echo "<p>字体大小 {$size}px: ❌ 无效（应在10-72之间）</p>";
            }
        }
        
        // 测试字体类型验证
        $valid_fonts = array('system', 'arial', 'dejavu', 'helvetica', 'times');
        $test_fonts = array('system', 'arial', 'comic-sans', 'invalid');
        
        foreach ($test_fonts as $font) {
            if (in_array($font, $valid_fonts)) {
                echo "<p>字体类型 {$font}: ✅ 有效</p>";
            } else {
                echo "<p>字体类型 {$font}: ❌ 无效</p>";
            }
        }
    }
    
    /**
     * 测试系统扩展支持
     */
    public function test_system_extensions() {
        echo "<h2>系统扩展测试</h2>";
        
        // 检查GD扩展
        if (extension_loaded('gd')) {
            echo "<p>GD扩展: ✅ 已安装</p>";
            $gd_info = gd_info();
            echo "<p>GD版本: " . $gd_info['GD Version'] . "</p>";
            echo "<p>WebP支持: " . (isset($gd_info['WebP Support']) && $gd_info['WebP Support'] ? '✅' : '❌') . "</p>";
            echo "<p>FreeType支持: " . (isset($gd_info['FreeType Support']) && $gd_info['FreeType Support'] ? '✅' : '❌') . "</p>";
        } else {
            echo "<p>GD扩展: ❌ 未安装</p>";
        }
        
        // 检查ImageMagick扩展
        if (extension_loaded('imagick')) {
            echo "<p>ImageMagick扩展: ✅ 已安装</p>";
            $imagick = new Imagick();
            $formats = $imagick->queryFormats();
            echo "<p>WebP支持: " . (in_array('WEBP', $formats) ? '✅' : '❌') . "</p>";
        } else {
            echo "<p>ImageMagick扩展: ❌ 未安装</p>";
        }
    }
}

// 运行测试
if (php_sapi_name() === 'cli') {
    // 命令行运行
    $test = new WebPOptimizerTest();
    echo "WebP Optimizer 文字水印功能测试\n";
    echo "===============================\n\n";
    
    echo "字体加载测试:\n";
    $test->test_font_loading();
    
    echo "\n参数验证测试:\n";
    $test->test_parameter_validation();
    
    echo "\n系统扩展测试:\n";
    $test->test_system_extensions();
} else {
    // Web界面运行
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>WebP Optimizer 文字水印测试</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            h2 { color: #666; border-bottom: 1px solid #eee; }
            p { margin: 5px 0; }
        </style>
    </head>
    <body>
        <h1>WebP Optimizer 文字水印功能测试</h1>
        
        <?php
        $test = new WebPOptimizerTest();
        $test->test_font_loading();
        $test->test_parameter_validation();
        $test->test_system_extensions();
        ?>
        
        <hr>
        <p><small>测试完成于: <?php echo date('Y-m-d H:i:s'); ?></small></p>
    </body>
    </html>
    <?php
}
?>