<?php
/**
 * WebP Optimizer 水印功能测试脚本
 * 这个文件用于测试水印功能，不应在生产环境使用
 */

if (!defined('ABSPATH')) {
    // 如果不在WordPress环境中，设置基本常量用于测试
    define('ABSPATH', '/fake/path/');
}

class WatermarkTest {
    
    public function run_tests() {
        echo "<h1>WebP Optimizer 水印功能测试</h1>";
        echo "<style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .test-section { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
            .success { color: green; }
            .error { color: red; }
            .info { color: blue; }
        </style>";
        
        $this->test_php_extensions();
        $this->test_watermark_position_calculation();
        $this->test_watermark_validation();
        $this->show_feature_overview();
    }
    
    private function test_php_extensions() {
        echo "<div class='test-section'>";
        echo "<h2>PHP扩展支持检测</h2>";
        
        echo "<p>GD库: " . (extension_loaded('gd') ? '<span class="success">✓ 已安装</span>' : '<span class="error">✗ 未安装</span>') . "</p>";
        echo "<p>ImageMagick: " . (extension_loaded('imagick') ? '<span class="success">✓ 已安装</span>' : '<span class="error">✗ 未安装</span>') . "</p>";
        echo "<p>mbstring: " . (extension_loaded('mbstring') ? '<span class="success">✓ 已安装</span>' : '<span class="error">✗ 未安装</span>') . "</p>";
        
        if (extension_loaded('gd')) {
            $gd_info = gd_info();
            echo "<p>WebP支持: " . (isset($gd_info['WebP Support']) && $gd_info['WebP Support'] ? '<span class="success">✓ 支持</span>' : '<span class="error">✗ 不支持</span>') . "</p>";
        }
        
        echo "</div>";
    }
    
    private function test_watermark_position_calculation() {
        echo "<div class='test-section'>";
        echo "<h2>水印位置计算测试</h2>";
        
        // 模拟水印位置计算函数
        $image_width = 800;
        $image_height = 600;
        $watermark_width = 100;
        $watermark_height = 50;
        
        echo "<p><strong>测试图片尺寸:</strong> {$image_width} × {$image_height}px</p>";
        echo "<p><strong>测试水印尺寸:</strong> {$watermark_width} × {$watermark_height}px</p>";
        
        echo "<table border='1' style='border-collapse: collapse; margin: 10px 0;'>";
        echo "<tr><th>位置</th><th>描述</th><th>计算结果 (x, y)</th></tr>";
        
        $positions = array(
            1 => '左上', 2 => '上中', 3 => '右上',
            4 => '左中', 5 => '中心', 6 => '右中',
            7 => '左下', 8 => '下中', 9 => '右下'
        );
        
        foreach ($positions as $pos => $desc) {
            $coords = $this->calculate_position($pos, $image_width, $image_height, $watermark_width, $watermark_height);
            echo "<tr><td>{$pos}</td><td>{$desc}</td><td>({$coords['x']}, {$coords['y']})</td></tr>";
        }
        
        echo "</table>";
        echo "</div>";
    }
    
    private function calculate_position($position, $image_width, $image_height, $watermark_width = 0, $watermark_height = 0) {
        $margin = 20;
        
        switch (intval($position)) {
            case 1: return array('x' => $margin, 'y' => $margin);
            case 2: return array('x' => ($image_width - $watermark_width) / 2, 'y' => $margin);
            case 3: return array('x' => $image_width - $watermark_width - $margin, 'y' => $margin);
            case 4: return array('x' => $margin, 'y' => ($image_height - $watermark_height) / 2);
            case 5: return array('x' => ($image_width - $watermark_width) / 2, 'y' => ($image_height - $watermark_height) / 2);
            case 6: return array('x' => $image_width - $watermark_width - $margin, 'y' => ($image_height - $watermark_height) / 2);
            case 7: return array('x' => $margin, 'y' => $image_height - $watermark_height - $margin);
            case 8: return array('x' => ($image_width - $watermark_width) / 2, 'y' => $image_height - $watermark_height - $margin);
            case 9: return array('x' => $image_width - $watermark_width - $margin, 'y' => $image_height - $watermark_height - $margin);
            default: return array('x' => ($image_width - $watermark_width) / 2, 'y' => ($image_height - $watermark_height) / 2);
        }
    }
    
    private function test_watermark_validation() {
        echo "<div class='test-section'>";
        echo "<h2>水印配置验证测试</h2>";
        
        $test_cases = array(
            array('opacity' => 50, 'expected' => 50, 'desc' => '正常透明度'),
            array('opacity' => 0, 'expected' => 0, 'desc' => '完全透明'),
            array('opacity' => 100, 'expected' => 100, 'desc' => '完全不透明'),
            array('opacity' => 150, 'expected' => 50, 'desc' => '超出范围(应返回默认值)'),
            array('opacity' => -10, 'expected' => 50, 'desc' => '负数(应返回默认值)'),
        );
        
        echo "<table border='1' style='border-collapse: collapse; margin: 10px 0;'>";
        echo "<tr><th>测试用例</th><th>输入值</th><th>期望值</th><th>实际值</th><th>结果</th></tr>";
        
        foreach ($test_cases as $case) {
            $result = $this->validate_opacity($case['opacity']);
            $status = ($result == $case['expected']) ? '<span class="success">✓</span>' : '<span class="error">✗</span>';
            echo "<tr><td>{$case['desc']}</td><td>{$case['opacity']}</td><td>{$case['expected']}</td><td>{$result}</td><td>{$status}</td></tr>";
        }
        
        echo "</table>";
        echo "</div>";
    }
    
    private function validate_opacity($opacity) {
        $opacity = intval($opacity);
        return ($opacity >= 0 && $opacity <= 100) ? $opacity : 50; // 默认值
    }
    
    private function show_feature_overview() {
        echo "<div class='test-section'>";
        echo "<h2>功能特性概览</h2>";
        
        echo "<h3>✅ 已实现的功能:</h3>";
        echo "<ul>";
        echo "<li><strong>文字水印:</strong> 支持自定义文字内容，可调节透明度</li>";
        echo "<li><strong>图片水印:</strong> 支持PNG、JPEG、GIF、WebP格式水印图片</li>";
        echo "<li><strong>九宫格定位:</strong> 提供9个预设位置，支持多位置同时添加</li>";
        echo "<li><strong>透明度控制:</strong> 0-100%可调节透明度</li>";
        echo "<li><strong>无损压缩:</strong> 可选择对带水印图片使用无损压缩</li>";
        echo "<li><strong>智能缩放:</strong> 水印图片自动缩放至合适大小(不超过原图1/4)</li>";
        echo "<li><strong>媒体库集成:</strong> 支持从WordPress媒体库选择水印图片</li>";
        echo "<li><strong>双引擎支持:</strong> 同时支持GD库和ImageMagick处理</li>";
        echo "</ul>";
        
        echo "<h3>🎯 九宫格位置说明:</h3>";
        echo "<table border='1' style='border-collapse: collapse; margin: 10px 0; text-align: center;'>";
        echo "<tr><td>1 - 左上</td><td>2 - 上中</td><td>3 - 右上</td></tr>";
        echo "<tr><td>4 - 左中</td><td>5 - 中心</td><td>6 - 右中</td></tr>";
        echo "<tr><td>7 - 左下</td><td>8 - 下中</td><td>9 - 右下</td></tr>";
        echo "</table>";
        
        echo "<h3>⚙️ 配置选项:</h3>";
        echo "<ul>";
        echo "<li><strong>启用水印:</strong> 总开关，控制是否应用水印</li>";
        echo "<li><strong>水印类型:</strong> 文字水印 或 图片水印</li>";
        echo "<li><strong>文字内容:</strong> 自定义水印文字（默认: CS.Yuelk.com）</li>";
        echo "<li><strong>水印图片:</strong> 支持URL输入或媒体库选择</li>";
        echo "<li><strong>透明度:</strong> 0-100%滑动条控制</li>";
        echo "<li><strong>位置选择:</strong> 九宫格复选框，支持多选</li>";
        echo "<li><strong>无损压缩:</strong> 启用后使用100%质量保存</li>";
        echo "</ul>";
        
        echo "<p class='info'><strong>注意:</strong> 水印功能会在WebP转换完成后自动应用，不会影响原有的WebP转换流程。</p>";
        echo "</div>";
    }
}

// 如果是直接访问该文件，运行测试
if (basename($_SERVER['PHP_SELF']) === 'watermark-test.php') {
    $test = new WatermarkTest();
    $test->run_tests();
}
?>