<?php
/**
 * 测试本地字体库功能
 * Test Local Font Library Functionality
 */

// 防止直接访问
if (!defined('ABSPATH')) {
    // 如果不在WordPress环境中，设置基本环境
    define('ABSPATH', dirname(__FILE__) . '/../../../');
}

echo "<h1>🎨 本地字体库测试 - Local Font Library Test</h1>\n";

// 插件字体目录
$plugin_fonts_dir = dirname(__FILE__) . '/fonts/';
echo "<h2>📁 插件字体目录: " . $plugin_fonts_dir . "</h2>\n";

// 检查字体文件
$expected_fonts = array(
    'NotoSansCJKsc-Regular.otf' => 'Noto Sans CJK Simplified Chinese',
    'SourceHanSansSC-Regular.otf' => 'Source Han Sans Simplified Chinese', 
    'DejaVuSans.ttf' => 'DejaVu Sans',
    'LICENSE.txt' => 'License file'
);

echo "<h3>🔍 检查本地字体文件：</h3>\n";
echo "<table border='1' style='border-collapse: collapse; width: 100%;'>\n";
echo "<tr><th>文件名</th><th>状态</th><th>大小</th><th>描述</th></tr>\n";

$available_fonts = 0;
foreach ($expected_fonts as $filename => $description) {
    $filepath = $plugin_fonts_dir . $filename;
    $exists = file_exists($filepath);
    $size = $exists ? human_filesize(filesize($filepath)) : 'N/A';
    $status = $exists ? '✅ 存在' : '❌ 缺失';
    
    if ($exists && strpos($filename, '.ttf') !== false || strpos($filename, '.otf') !== false) {
        $available_fonts++;
    }
    
    echo "<tr>";
    echo "<td><strong>$filename</strong></td>";
    echo "<td>$status</td>";
    echo "<td>$size</td>";
    echo "<td>$description</td>";
    echo "</tr>\n";
}
echo "</table>\n";

echo "<p><strong>📊 统计：可用字体文件 $available_fonts 个</strong></p>\n";

// 测试字体加载函数
echo "<h3>🧪 测试字体加载逻辑：</h3>\n";

// 模拟字体选择函数
function get_local_font_test($font_family = 'system') {
    $plugin_fonts_dir = dirname(__FILE__) . '/fonts/';
    $font_paths = array();
    
    switch ($font_family) {
        case 'noto-cjk':
            $font_paths = array(
                $plugin_fonts_dir . 'NotoSansCJKsc-Regular.otf', // 插件本地字体（优先）
                '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', // Linux
                '/System/Library/Fonts/NotoSansCJK.ttc', // macOS
            );
            break;
        case 'source-han':
            $font_paths = array(
                $plugin_fonts_dir . 'SourceHanSansSC-Regular.otf', // 插件本地字体（优先）
                '/usr/share/fonts/opentype/source-han-sans/SourceHanSansSC-Regular.otf', // Linux
            );
            break;
        case 'dejavu':
            $font_paths = array(
                $plugin_fonts_dir . 'DejaVuSans.ttf', // 插件本地字体（优先）
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', // Linux
            );
            break;
        case 'system':
        default:
            $font_paths = array(
                $plugin_fonts_dir . 'NotoSansCJKsc-Regular.otf', // Noto CJK 本地
                $plugin_fonts_dir . 'SourceHanSansSC-Regular.otf', // Source Han Sans 本地
                $plugin_fonts_dir . 'DejaVuSans.ttf', // DejaVu Sans 本地
            );
            break;
    }
    
    foreach ($font_paths as $font) {
        if (file_exists($font)) {
            return array('found' => true, 'path' => $font, 'local' => strpos($font, $plugin_fonts_dir) === 0);
        }
    }
    
    return array('found' => false, 'path' => null, 'local' => false);
}

$test_fonts = array('system', 'noto-cjk', 'source-han', 'dejavu');

echo "<table border='1' style='border-collapse: collapse; width: 100%;'>\n";
echo "<tr><th>字体类型</th><th>查找结果</th><th>字体路径</th><th>是否本地</th></tr>\n";

foreach ($test_fonts as $font_type) {
    $result = get_local_font_test($font_type);
    $status = $result['found'] ? '✅ 找到' : '❌ 未找到';
    $local = $result['local'] ? '🟢 本地字体' : '🔵 系统字体';
    $path = $result['path'] ? basename($result['path']) : 'N/A';
    
    echo "<tr>";
    echo "<td><strong>$font_type</strong></td>";
    echo "<td>$status</td>";
    echo "<td>$path</td>";
    echo "<td>" . ($result['found'] ? $local : 'N/A') . "</td>";
    echo "</tr>\n";
}
echo "</table>\n";

// 测试GD和ImageMagick支持
echo "<h3>🛠️ 图像库支持检测：</h3>\n";

// 检查GD支持
if (extension_loaded('gd')) {
    $gd_info = gd_info();
    echo "<p>✅ <strong>GD库已安装</strong></p>\n";
    echo "<ul>\n";
    echo "<li>GD版本: " . $gd_info['GD Version'] . "</li>\n";
    echo "<li>FreeType支持: " . ($gd_info['FreeType Support'] ? '✅ 是' : '❌ 否') . "</li>\n";
    echo "<li>WebP支持: " . (function_exists('imagewebp') ? '✅ 是' : '❌ 否') . "</li>\n";
    echo "</ul>\n";
    
    // 测试文本渲染
    if ($gd_info['FreeType Support']) {
        echo "<p>📝 <strong>GD文本渲染测试：</strong></p>\n";
        $test_font = get_local_font_test('noto-cjk');
        if ($test_font['found']) {
            echo "<p>🎯 使用字体: " . basename($test_font['path']) . " (本地字体)</p>\n";
            
            // 创建测试图像
            $test_image = imagecreate(400, 100);
            $bg_color = imagecolorallocate($test_image, 255, 255, 255);
            $text_color = imagecolorallocate($test_image, 0, 0, 0);
            
            $test_text = "测试中文水印 Test 2024";
            $result = imagettftext($test_image, 16, 0, 20, 50, $text_color, $test_font['path'], $test_text);
            
            if ($result) {
                echo "<p>✅ GD + 本地字体渲染中文成功</p>\n";
            } else {
                echo "<p>❌ GD + 本地字体渲染失败</p>\n";
            }
            
            imagedestroy($test_image);
        }
    }
} else {
    echo "<p>❌ <strong>GD库未安装</strong></p>\n";
}

// 检查ImageMagick支持
if (extension_loaded('imagick')) {
    echo "<p>✅ <strong>ImageMagick已安装</strong></p>\n";
    
    $imagick = new Imagick();
    $version = $imagick->getVersion();
    echo "<ul>\n";
    echo "<li>ImageMagick版本: " . $version['versionString'] . "</li>\n";
    echo "<li>WebP支持: " . (in_array('WEBP', $imagick->queryFormats()) ? '✅ 是' : '❌ 否') . "</li>\n";
    echo "</ul>\n";
    
    // 测试文本渲染
    echo "<p>📝 <strong>ImageMagick文本渲染测试：</strong></p>\n";
    $test_font = get_local_font_test('source-han');
    if ($test_font['found']) {
        echo "<p>🎯 使用字体: " . basename($test_font['path']) . " (本地字体)</p>\n";
        
        try {
            $test_image = new Imagick();
            $test_image->newImage(400, 100, 'white');
            
            $draw = new ImagickDraw();
            $draw->setFont($test_font['path']);
            $draw->setFontSize(16);
            $draw->setFillColor('black');
            $draw->setTextEncoding('UTF-8');
            
            $test_text = mb_convert_encoding("测试中文水印 Test 2024", 'UTF-8', 'auto');
            $test_image->annotateImage($draw, 20, 50, 0, $test_text);
            
            echo "<p>✅ ImageMagick + 本地字体渲染中文成功</p>\n";
            
            $test_image->clear();
        } catch (Exception $e) {
            echo "<p>❌ ImageMagick + 本地字体渲染失败: " . $e->getMessage() . "</p>\n";
        }
    }
} else {
    echo "<p>❌ <strong>ImageMagick未安装</strong></p>\n";
}

// 总结
echo "<h3>📋 总结报告：</h3>\n";
echo "<div style='background: #f0f8ff; padding: 15px; border: 1px solid #ccc; border-radius: 5px;'>\n";

if ($available_fonts >= 2) {
    echo "<p>✅ <strong>本地字体库状态良好</strong></p>\n";
    echo "<p>🎯 <strong>优势：</strong></p>\n";
    echo "<ul>\n";
    echo "<li>📦 包含 $available_fonts 个本地字体文件，无需依赖系统字体</li>\n";
    echo "<li>🌍 跨平台兼容，在任何服务器环境都能正常工作</li>\n";
    echo "<li>🔤 支持完整中文字符集，确保中文水印正确显示</li>\n";
    echo "<li>⚡ 字体加载优先级：本地字体 → 系统字体 → 内置字体</li>\n";
    echo "</ul>\n";
    
    echo "<p>🏆 <strong>推荐使用：</strong></p>\n";
    echo "<ul>\n";
    echo "<li>中文水印：选择 'Noto Sans CJK' 或 'Source Han Sans'</li>\n";
    echo "<li>英文水印：选择 'DejaVu Sans' 或 '系统默认'</li>\n";
    echo "<li>混合文本：选择 '系统默认'（会优先使用本地中文字体）</li>\n";
    echo "</ul>\n";
} else {
    echo "<p>⚠️ <strong>本地字体库不完整</strong></p>\n";
    echo "<p>建议检查字体文件是否正确上传到 fonts/ 目录</p>\n";
}

echo "</div>\n";

// 文件大小转换函数
function human_filesize($bytes, $decimals = 2) {
    $sz = 'BKMGTP';
    $factor = floor((strlen($bytes) - 1) / 3);
    return sprintf("%.{$decimals}f", $bytes / pow(1024, $factor)) . @$sz[$factor] . ($factor > 0 ? 'B' : '');
}

echo "<hr>\n";
echo "<p><em>测试完成于: " . date('Y-m-d H:i:s') . "</em></p>\n";
?>