<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebP Optimizer 水印功能诊断</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .status-ok { color: green; font-weight: bold; }
        .status-error { color: red; font-weight: bold; }
        .status-warning { color: orange; font-weight: bold; }
        .test-section { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .code { background: #f5f5f5; padding: 10px; font-family: monospace; border-radius: 3px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>WebP Optimizer 水印功能诊断报告</h1>
    <p>生成时间: <?php echo date('Y-m-d H:i:s'); ?></p>
    
    <div class="test-section">
        <h2>1. 系统环境检查</h2>
        <table>
            <tr><th>检查项目</th><th>状态</th><th>说明</th></tr>
            <tr>
                <td>PHP GD扩展</td>
                <td><?php echo extension_loaded('gd') ? '<span class="status-ok">✓ 已安装</span>' : '<span class="status-error">✗ 未安装</span>'; ?></td>
                <td>用于图像处理</td>
            </tr>
            <tr>
                <td>PHP ImageMagick扩展</td>
                <td><?php echo extension_loaded('imagick') ? '<span class="status-ok">✓ 已安装</span>' : '<span class="status-error">✗ 未安装</span>'; ?></td>
                <td>高质量图像处理</td>
            </tr>
            <tr>
                <td>WebP支持</td>
                <td><?php 
                    $webp_support = false;
                    if (extension_loaded('gd')) {
                        $gd_info = gd_info();
                        $webp_support = isset($gd_info['WebP Support']) && $gd_info['WebP Support'];
                    }
                    echo $webp_support ? '<span class="status-ok">✓ 支持</span>' : '<span class="status-error">✗ 不支持</span>';
                ?></td>
                <td>WebP格式支持</td>
            </tr>
            <tr>
                <td>上传目录</td>
                <td><?php 
                    $upload_dir = '/home/runner/work/cs.Yuelk.com/cs.Yuelk.com/wp-content/uploads';
                    echo is_dir($upload_dir) ? '<span class="status-ok">✓ 存在</span>' : '<span class="status-error">✗ 不存在</span>';
                ?></td>
                <td><?php echo $upload_dir; ?></td>
            </tr>
            <tr>
                <td>上传目录写权限</td>
                <td><?php 
                    $upload_dir = '/home/runner/work/cs.Yuelk.com/cs.Yuelk.com/wp-content/uploads';
                    echo is_writable($upload_dir) ? '<span class="status-ok">✓ 可写</span>' : '<span class="status-error">✗ 不可写</span>';
                ?></td>
                <td>需要写权限保存文件</td>
            </tr>
        </table>
    </div>
    
    <div class="test-section">
        <h2>2. 测试文件检查</h2>
        <?php
        $test_files = array(
            'test-image.jpg' => '测试源图片',
            'watermark.png' => '水印图片',
            'test-with-watermark.webp' => 'WebP转换结果',
            'final-with-watermark.webp' => 'ImageMagick水印结果',
            'final-with-watermark-gd.webp' => 'GD水印结果'
        );
        
        echo '<table>';
        echo '<tr><th>文件名</th><th>状态</th><th>大小</th><th>说明</th></tr>';
        
        foreach ($test_files as $filename => $description) {
            $filepath = '/home/runner/work/cs.Yuelk.com/cs.Yuelk.com/wp-content/uploads/2024/08/' . $filename;
            $exists = file_exists($filepath);
            $size = $exists ? filesize($filepath) : 0;
            
            echo '<tr>';
            echo '<td>' . $filename . '</td>';
            echo '<td>' . ($exists ? '<span class="status-ok">✓ 存在</span>' : '<span class="status-error">✗ 不存在</span>') . '</td>';
            echo '<td>' . ($exists ? number_format($size) . ' 字节' : '-') . '</td>';
            echo '<td>' . $description . '</td>';
            echo '</tr>';
        }
        echo '</table>';
        ?>
    </div>
    
    <div class="test-section">
        <h2>3. 水印功能配置检查</h2>
        <p>模拟WordPress配置检查：</p>
        <?php
        $mock_options = array(
            'enable_webp_conversion' => 1,
            'webp_quality' => 85,
            'convert_jpeg' => 1,
            'convert_png' => 1,
            'compression_method' => 'auto',
            'enable_watermark' => 1,
            'watermark_type' => 'image',
            'watermark_text' => 'CS.Yuelk.com',
            'watermark_image' => 'https://cs.yuelk.com/wp-content/uploads/2024/08/watermark.png',
            'watermark_opacity' => 70,
            'watermark_positions' => array('5'),
            'watermark_lossless' => 0
        );
        
        echo '<table>';
        echo '<tr><th>配置项</th><th>值</th><th>状态</th></tr>';
        
        foreach ($mock_options as $key => $value) {
            echo '<tr>';
            echo '<td>' . $key . '</td>';
            
            if (is_array($value)) {
                echo '<td>' . implode(', ', $value) . '</td>';
            } else {
                echo '<td>' . ($value ? ($value === 1 ? '启用' : $value) : '禁用') . '</td>';
            }
            
            // 检查关键设置
            $status = '<span class="status-ok">✓ 正常</span>';
            if ($key === 'enable_watermark' && !$value) {
                $status = '<span class="status-error">✗ 水印未启用</span>';
            } elseif ($key === 'watermark_image' && empty($value)) {
                $status = '<span class="status-error">✗ 未设置水印图片</span>';
            } elseif ($key === 'watermark_image' && !empty($value)) {
                // 检查水印图片是否存在
                $local_path = str_replace('https://cs.yuelk.com/wp-content/uploads', '/home/runner/work/cs.Yuelk.com/cs.Yuelk.com/wp-content/uploads', $value);
                if (!file_exists($local_path)) {
                    $status = '<span class="status-error">✗ 水印图片不存在</span>';
                }
            }
            
            echo '<td>' . $status . '</td>';
            echo '</tr>';
        }
        echo '</table>';
        ?>
    </div>
    
    <div class="test-section">
        <h2>4. 常见问题诊断</h2>
        <h3>可能的问题原因：</h3>
        <ul>
            <li><strong>水印功能未启用</strong> - 检查插件设置中的"启用水印"选项</li>
            <li><strong>水印图片路径错误</strong> - 确保从媒体库选择的图片URL正确</li>
            <li><strong>文件权限问题</strong> - 确保WordPress能够读取水印图片和写入处理后的文件</li>
            <li><strong>图片格式不支持</strong> - 确保水印图片为PNG、JPG、GIF或WebP格式</li>
            <li><strong>内存限制</strong> - 大图片处理可能需要更多内存</li>
        </ul>
        
        <h3>解决方案：</h3>
        <ol>
            <li><strong>检查设置</strong> - 进入WordPress管理后台 → 设置 → WebP优化，确保水印功能已启用</li>
            <li><strong>重新选择水印图片</strong> - 使用媒体库按钮重新选择水印图片</li>
            <li><strong>测试不同图片</strong> - 尝试上传不同格式和大小的图片</li>
            <li><strong>查看错误日志</strong> - 检查WordPress错误日志了解具体错误信息</li>
        </ol>
    </div>
    
    <div class="test-section">
        <h2>5. 功能测试建议</h2>
        <p>建议按以下步骤测试水印功能：</p>
        <div class="code">
1. 进入WordPress管理后台 → 设置 → WebP优化
2. 确保勾选"启用WebP转换"
3. 确保勾选"启用水印" 
4. 选择"图片水印"类型
5. 点击"选择图片"按钮从媒体库选择水印图片
6. 设置合适的透明度（建议50-80%）
7. 选择水印位置（建议选择右下角）
8. 保存设置
9. 上传一张测试图片到媒体库
10. 检查生成的WebP文件是否包含水印
        </div>
    </div>
    
    <div class="test-section">
        <h2>6. 技术支持信息</h2>
        <p>如果问题仍然存在，请提供以下信息：</p>
        <ul>
            <li>WordPress版本</li>
            <li>PHP版本: <?php echo PHP_VERSION; ?></li>
            <li>服务器环境信息</li>
            <li>错误日志内容</li>
            <li>插件设置截图</li>
            <li>测试图片信息（大小、格式）</li>
        </ul>
    </div>
</body>
</html>