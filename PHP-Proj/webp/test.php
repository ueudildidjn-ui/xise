<?php
/**
 * WebP Optimizer 测试脚本
 * 用于测试插件的基本功能
 */

// 防止直接访问
if (!defined('ABSPATH')) {
    exit;
}

// 仅在管理员权限下显示测试页面
if (!current_user_can('manage_options')) {
    return;
}

?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>WebP优化插件测试</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .test-section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
        .success { color: green; }
        .error { color: red; }
        .info { color: blue; }
    </style>
</head>
<body>
    <h1>WebP优化插件测试</h1>
    
    <div class="test-section">
        <h2>系统环境检测</h2>
        
        <h3>PHP扩展支持</h3>
        <p>GD库: <?php echo extension_loaded('gd') ? '<span class="success">✓ 支持</span>' : '<span class="error">✗ 不支持</span>'; ?></p>
        <p>ImageMagick: <?php echo extension_loaded('imagick') ? '<span class="success">✓ 支持</span>' : '<span class="error">✗ 不支持</span>'; ?></p>
        
        <?php if (extension_loaded('gd')): ?>
        <h3>GD库信息</h3>
        <?php 
        $gd_info = gd_info();
        foreach ($gd_info as $key => $value): ?>
            <p><?php echo esc_html($key); ?>: <?php echo $value ? '<span class="success">✓ 支持</span>' : '<span class="error">✗ 不支持</span>'; ?></p>
        <?php endforeach; ?>
        <?php endif; ?>
        
        <?php if (extension_loaded('imagick')): ?>
        <h3>ImageMagick支持的格式</h3>
        <?php 
        $formats = \Imagick::queryFormats();
        $important_formats = ['JPEG', 'PNG', 'WEBP', 'GIF'];
        foreach ($important_formats as $format): ?>
            <p><?php echo $format; ?>: <?php echo in_array($format, $formats) ? '<span class="success">✓ 支持</span>' : '<span class="error">✗ 不支持</span>'; ?></p>
        <?php endforeach; ?>
        <?php endif; ?>
    </div>
    
    <div class="test-section">
        <h2>插件状态检测</h2>
        
        <?php
        // 检查插件是否正确加载
        if (class_exists('WebPOptimizer')) {
            echo '<p class="success">✓ WebPOptimizer类已加载</p>';
            
            // 检查选项
            $options = get_option('webp_optimizer_options');
            if ($options !== false) {
                echo '<p class="success">✓ 插件设置已保存</p>';
                echo '<p class="info">当前设置：</p>';
                echo '<pre>' . esc_html(print_r($options, true)) . '</pre>';
            } else {
                echo '<p class="info">- 插件设置尚未保存（首次安装正常）</p>';
            }
            
            // 检查钩子
            if (has_filter('wp_handle_upload')) {
                echo '<p class="success">✓ wp_handle_upload 钩子已注册</p>';
            } else {
                echo '<p class="error">✗ wp_handle_upload 钩子未注册</p>';
            }
            
            if (has_filter('wp_handle_sideload')) {
                echo '<p class="success">✓ wp_handle_sideload 钩子已注册</p>';
            } else {
                echo '<p class="error">✗ wp_handle_sideload 钩子未注册</p>';
            }
            
        } else {
            echo '<p class="error">✗ WebPOptimizer类未加载</p>';
        }
        ?>
    </div>
    
    <div class="test-section">
        <h2>WordPress上传目录信息</h2>
        
        <?php
        $upload_dir = wp_upload_dir();
        ?>
        <p>上传目录: <?php echo esc_html($upload_dir['basedir']); ?></p>
        <p>上传URL: <?php echo esc_html($upload_dir['baseurl']); ?></p>
        <p>当前上传目录: <?php echo esc_html($upload_dir['path']); ?></p>
        <p>当前上传URL: <?php echo esc_html($upload_dir['url']); ?></p>
        
        <?php
        // 检查上传目录权限
        if (is_writable($upload_dir['basedir'])) {
            echo '<p class="success">✓ 上传目录可写</p>';
        } else {
            echo '<p class="error">✗ 上传目录不可写</p>';
        }
        ?>
    </div>
    
    <div class="test-section">
        <h2>测试建议</h2>
        <ol>
            <li>确保系统支持WebP格式</li>
            <li>在设置页面启用WebP转换</li>
            <li>上传一张JPEG或PNG图片进行测试</li>
            <li>检查生成的文件是否为WebP格式</li>
            <li>验证图片质量是否符合预期</li>
        </ol>
        
        <h3>故障排除</h3>
        <ul>
            <li>如果转换失败，检查服务器是否支持WebP</li>
            <li>如果图片质量不理想，调整质量参数</li>
            <li>如果转换时间过长，考虑调整图片尺寸限制</li>
            <li>如果存储空间不足，建议不保留原图</li>
        </ul>
    </div>
    
    <p><a href="<?php echo admin_url('options-general.php?page=webp-optimizer'); ?>">返回插件设置</a></p>
</body>
</html>