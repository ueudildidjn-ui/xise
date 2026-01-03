<?php
/*
Test script for Chinese font support in watermarks
Run this from the plugin directory to check available fonts
*/

// Include WordPress bootstrap if available
if (!defined('ABSPATH')) {
    // Try to load WordPress
    $wp_root = dirname(dirname(dirname(dirname(__FILE__))));
    if (file_exists($wp_root . '/wp-config.php')) {
        require_once($wp_root . '/wp-config.php');
    }
}

echo "<h1>中文字体支持测试</h1>\n";
echo "<p>测试系统中可用的中文字体...</p>\n";

// Test function similar to the plugin's get_default_font method
function test_chinese_fonts() {
    $font_families = array(
        'noto-cjk' => array(
            '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf',
            '/System/Library/Fonts/NotoSansCJK.ttc',
            '/Windows/Fonts/NotoSansCJK-Regular.ttc'
        ),
        'source-han' => array(
            '/usr/share/fonts/opentype/source-han-sans/SourceHanSansSC-Regular.otf',
            '/usr/share/fonts/truetype/source-han-sans/SourceHanSansSC-Regular.ttf',
            '/System/Library/Fonts/SourceHanSansSC.ttc',
            '/Windows/Fonts/SourceHanSansSC-Regular.ttf'
        ),
        'microsoft-yahei' => array(
            '/Windows/Fonts/msyh.ttf',
            '/Windows/Fonts/msyhbd.ttf',
            '/usr/share/fonts/truetype/microsoft/msyh.ttf'
        ),
        'pingfang' => array(
            '/System/Library/Fonts/PingFang.ttc',
            '/System/Library/Fonts/PingFangSC-Regular.otf'
        ),
        'wenquanyi' => array(
            '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
            '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
        )
    );
    
    $found_fonts = array();
    
    foreach ($font_families as $family => $paths) {
        echo "<h2>$family</h2>\n";
        $found = false;
        foreach ($paths as $path) {
            if (file_exists($path)) {
                echo "<p style='color: green;'>✓ 找到字体: $path</p>\n";
                $found_fonts[$family] = $path;
                $found = true;
                break;
            } else {
                echo "<p style='color: #999;'>✗ 未找到: $path</p>\n";
            }
        }
        if (!$found) {
            echo "<p style='color: red;'><strong>该字体系列未找到任何可用字体</strong></p>\n";
        }
    }
    
    return $found_fonts;
}

// Test system extensions
echo "<h2>系统扩展检测</h2>\n";
echo "<p>GD库支持: " . (extension_loaded('gd') ? '<span style="color: green;">✓ 已安装</span>' : '<span style="color: red;">✗ 未安装</span>') . "</p>\n";
echo "<p>ImageMagick支持: " . (extension_loaded('imagick') ? '<span style="color: green;">✓ 已安装</span>' : '<span style="color: red;">✗ 未安装</span>') . "</p>\n";

if (extension_loaded('gd')) {
    $gd_info = gd_info();
    echo "<p>WebP支持: " . (isset($gd_info['WebP Support']) && $gd_info['WebP Support'] ? '<span style="color: green;">✓ 支持</span>' : '<span style="color: red;">✗ 不支持</span>') . "</p>\n";
    echo "<p>FreeType支持: " . (isset($gd_info['FreeType Support']) && $gd_info['FreeType Support'] ? '<span style="color: green;">✓ 支持</span>' : '<span style="color: red;">✗ 不支持</span>') . "</p>\n";
    
    if (isset($gd_info['GD Version'])) {
        echo "<p>GD版本: " . $gd_info['GD Version'] . "</p>\n";
    }
}

if (extension_loaded('imagick')) {
    $imagick = new Imagick();
    $formats = $imagick->queryFormats();
    echo "<p>ImageMagick WebP支持: " . (in_array('WEBP', $formats) ? '<span style="color: green;">✓ 支持</span>' : '<span style="color: red;">✗ 不支持</span>') . "</p>\n";
}

// Test fonts
echo "<h2>中文字体检测</h2>\n";
$found_fonts = test_chinese_fonts();

if (!empty($found_fonts)) {
    echo "<h2>可用中文字体汇总</h2>\n";
    foreach ($found_fonts as $family => $path) {
        echo "<p style='color: green;'><strong>$family</strong>: $path</p>\n";
    }
} else {
    echo "<p style='color: red;'><strong>未找到任何中文字体！</strong></p>\n";
    echo "<p>建议安装以下字体包：</p>\n";
    echo "<ul>\n";
    echo "<li><strong>Ubuntu/Debian:</strong> sudo apt-get install fonts-noto-cjk fonts-wqy-microhei</li>\n";
    echo "<li><strong>CentOS/RHEL:</strong> yum install google-noto-cjk-fonts wqy-microhei-fonts</li>\n";
    echo "<li><strong>macOS:</strong> 系统自带苹方字体</li>\n";
    echo "<li><strong>Windows:</strong> 系统自带微软雅黑</li>\n";
    echo "</ul>\n";
}

// Test text encoding
echo "<h2>文本编码测试</h2>\n";
$test_text = "测试中文水印 © 2024";
echo "<p>测试文本: $test_text</p>\n";
echo "<p>编码检测: " . mb_detect_encoding($test_text) . "</p>\n";
echo "<p>UTF-8检查: " . (mb_check_encoding($test_text, 'UTF-8') ? '<span style="color: green;">✓ 有效</span>' : '<span style="color: red;">✗ 无效</span>') . "</p>\n";
echo "<p>字符长度: " . mb_strlen($test_text, 'UTF-8') . " 字符</p>\n";

echo "<h2>建议</h2>\n";
echo "<ul>\n";
echo "<li>推荐使用 <strong>ImageMagick + 中文字体</strong> 组合以获得最佳中文支持</li>\n";
echo "<li>如果只有GD库，请确保安装了支持中文的TTF字体文件</li>\n";
echo "<li>测试时使用中文水印文本，如 \"版权所有 © 2024\"</li>\n";
echo "</ul>\n";

?>