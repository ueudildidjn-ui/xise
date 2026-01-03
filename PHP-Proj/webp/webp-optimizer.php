<?php
/*
Plugin Name: WebP Optimizer
Plugin URI: https://cs.yuelk.com
Description: 自动将上传的图片优化为WebP格式，可配置质量参数和转换设置，支持JPEG、PNG转WebP优化
Version: 1.0.0
Author: CS.Yuelk.com
Text Domain: webp-optimizer
License: GPL v2 or later
*/

// 防止直接访问
if (!defined('ABSPATH')) {
    exit;
}

// 定义插件常量
define('WEBP_OPT_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WEBP_OPT_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('WEBP_OPT_VERSION', '1.0.0');

class WebPOptimizer {
    
    private $option_name = 'webp_optimizer_options';
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'admin_init'));
        add_action('init', array($this, 'init_hooks'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        
        // 添加WordPress钩子
        add_filter('wp_handle_upload', array($this, 'convert_to_webp'), 10, 2);
        add_filter('wp_handle_sideload', array($this, 'convert_to_webp'), 10, 2);
    }
    
    public function init_hooks() {
        // 检查插件是否启用
        $options = get_option($this->option_name);
        if (empty($options['enable_webp_conversion'])) {
            return;
        }
    }
    
    /**
     * 添加管理员菜单
     */
    public function add_admin_menu() {
        add_options_page(
            'WebP优化设置',
            'WebP优化',
            'manage_options',
            'webp-optimizer',
            array($this, 'admin_page')
        );
    }
    
    /**
     * 初始化管理员设置
     */
    public function admin_init() {
        register_setting('webp_optimizer_group', $this->option_name, array($this, 'validate_options'));
        
        add_settings_section(
            'webp_optimizer_basic_section',
            '基本设置',
            array($this, 'basic_section_callback'),
            'webp-optimizer'
        );
        
        add_settings_section(
            'webp_optimizer_advanced_section',
            '高级设置',
            array($this, 'advanced_section_callback'),
            'webp-optimizer'
        );
        
        add_settings_section(
            'webp_optimizer_advanced_webp_section',
            '高级WebP优化',
            array($this, 'advanced_webp_section_callback'),
            'webp-optimizer'
        );
        
        add_settings_section(
            'webp_optimizer_watermark_section',
            '水印设置',
            array($this, 'watermark_section_callback'),
            'webp-optimizer'
        );
        
        // 基本设置字段
        add_settings_field(
            'enable_webp_conversion',
            '启用WebP转换',
            array($this, 'enable_webp_conversion_callback'),
            'webp-optimizer',
            'webp_optimizer_basic_section'
        );
        
        add_settings_field(
            'webp_quality',
            'WebP质量 (1-100)',
            array($this, 'webp_quality_callback'),
            'webp-optimizer',
            'webp_optimizer_basic_section'
        );
        
        add_settings_field(
            'convert_jpeg',
            '转换JPEG图片',
            array($this, 'convert_jpeg_callback'),
            'webp-optimizer',
            'webp_optimizer_basic_section'
        );
        
        add_settings_field(
            'convert_png',
            '转换PNG图片',
            array($this, 'convert_png_callback'),
            'webp-optimizer',
            'webp_optimizer_basic_section'
        );
        
        // 高级设置字段
        add_settings_field(
            'keep_original',
            '保留原图',
            array($this, 'keep_original_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_section'
        );
        
        add_settings_field(
            'max_width',
            '最大宽度 (像素)',
            array($this, 'max_width_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_section'
        );
        
        add_settings_field(
            'max_height',
            '最大高度 (像素)',
            array($this, 'max_height_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_section'
        );
        
        add_settings_field(
            'compression_method',
            '压缩方式',
            array($this, 'compression_method_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_section'
        );
        
        // 高级WebP优化字段
        add_settings_field(
            'webp_lossless',
            '无损WebP',
            array($this, 'webp_lossless_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_webp_section'
        );
        
        add_settings_field(
            'webp_filter_strength',
            '滤镜强度',
            array($this, 'webp_filter_strength_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_webp_section'
        );
        
        add_settings_field(
            'webp_filter_sharpness',
            '滤镜锐度',
            array($this, 'webp_filter_sharpness_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_webp_section'
        );
        
        add_settings_field(
            'webp_alpha_filtering',
            '透明度滤镜',
            array($this, 'webp_alpha_filtering_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_webp_section'
        );
        
        add_settings_field(
            'webp_alpha_quality',
            '透明度质量',
            array($this, 'webp_alpha_quality_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_webp_section'
        );
        
        add_settings_field(
            'webp_preprocessing',
            '预处理滤镜',
            array($this, 'webp_preprocessing_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_webp_section'
        );
        
        add_settings_field(
            'webp_segments',
            '压缩段数',
            array($this, 'webp_segments_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_webp_section'
        );
        
        add_settings_field(
            'webp_pass',
            '分析遍数',
            array($this, 'webp_pass_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_webp_section'
        );
        
        add_settings_field(
            'webp_target_size',
            '目标文件大小',
            array($this, 'webp_target_size_callback'),
            'webp-optimizer',
            'webp_optimizer_advanced_webp_section'
        );
        
        // 水印设置字段
        add_settings_field(
            'enable_watermark',
            '启用水印',
            array($this, 'enable_watermark_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_type',
            '水印类型',
            array($this, 'watermark_type_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_text',
            '水印文字',
            array($this, 'watermark_text_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_font_size',
            '字体大小',
            array($this, 'watermark_font_size_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_font_family',
            '字体类型',
            array($this, 'watermark_font_family_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_image',
            '水印图片',
            array($this, 'watermark_image_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_opacity',
            '水印透明度',
            array($this, 'watermark_opacity_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_positions',
            '水印位置',
            array($this, 'watermark_positions_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_position_mode',
            '定位模式',
            array($this, 'watermark_position_mode_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_precise_position',
            '精确坐标',
            array($this, 'watermark_precise_position_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'watermark_image_size',
            '图片水印尺寸',
            array($this, 'watermark_image_size_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        // WordPress用户名水印独立设置
        add_settings_field(
            'enable_username_watermark',
            '启用用户名水印',
            array($this, 'enable_username_watermark_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'username_watermark_font_size',
            '用户名水印字体大小',
            array($this, 'username_watermark_font_size_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'username_watermark_font_family',
            '用户名水印字体类型',
            array($this, 'username_watermark_font_family_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'username_watermark_opacity',
            '用户名水印透明度',
            array($this, 'username_watermark_opacity_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'username_watermark_position_mode',
            '用户名水印定位模式',
            array($this, 'username_watermark_position_mode_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'username_watermark_positions',
            '用户名水印位置',
            array($this, 'username_watermark_positions_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'username_watermark_precise_position',
            '用户名水印精确坐标',
            array($this, 'username_watermark_precise_position_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'username_watermark_color',
            '用户名水印颜色',
            array($this, 'username_watermark_color_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
        
        add_settings_field(
            'username_watermark_text',
            '用户名水印自定义文本',
            array($this, 'username_watermark_text_callback'),
            'webp-optimizer',
            'webp_optimizer_watermark_section'
        );
    }
    
    /**
     * 基本设置部分回调
     */
    public function basic_section_callback() {
        echo '<p>配置WebP转换的基本参数</p>';
    }
    
    /**
     * 高级设置部分回调
     */
    public function advanced_section_callback() {
        echo '<p>高级优化选项，请根据您的需求进行配置</p>';
    }
    
    /**
     * 高级WebP优化部分回调
     */
    public function advanced_webp_section_callback() {
        echo '<p>高级WebP压缩选项，可进一步优化文件大小和质量。这些选项主要在使用ImageMagick时生效。</p>';
        echo '<div style="background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 10px 0;">';
        echo '<strong>⚠️ 注意：</strong>高级选项可能会影响压缩速度，建议根据实际需求调整。默认设置已经适合大多数用户。';
        echo '</div>';
    }
    
    /**
     * 水印设置部分回调
     */
    public function watermark_section_callback() {
        echo '<p>为处理后的图片添加水印，支持文字和图片水印，可设置透明度和位置。现在支持独立的用户名水印功能。</p>';
        
        // 添加水印配置状态检查
        $options = get_option($this->option_name);
        $watermark_enabled = !empty($options['enable_watermark']);
        $username_watermark_enabled = !empty($options['enable_username_watermark']);
        $has_watermark_content = false;
        
        if ($watermark_enabled) {
            $watermark_type = isset($options['watermark_type']) ? $options['watermark_type'] : 'text';
            if ($watermark_type === 'text') {
                $has_watermark_content = !empty($options['watermark_text']);
            } else {
                $has_watermark_content = !empty($options['watermark_image']);
            }
        }
        
        echo '<div style="background: #f9f9f9; padding: 10px; border-left: 4px solid ' . 
             (($watermark_enabled && $has_watermark_content) || $username_watermark_enabled ? '#00a32a' : '#dba617') . 
             '; margin: 10px 0;">';
        
        if (($watermark_enabled && $has_watermark_content) || $username_watermark_enabled) {
            echo '<strong style="color: #00a32a;">✅ 水印功能已配置并启用</strong>';
            if ($watermark_enabled && $has_watermark_content && $username_watermark_enabled) {
                echo ' (文字/图片水印 + 用户名水印)';
            } elseif ($username_watermark_enabled) {
                echo ' (用户名水印)';
            }
        } elseif ($watermark_enabled) {
            echo '<strong style="color: #dba617;">⚠️ 水印功能已启用，但需要设置水印内容</strong>';
        } else {
            echo '<strong style="color: #d63638;">❌ 水印功能未启用</strong>';
        }
        
        echo '</div>';
        
        // 添加功能说明
        echo '<div style="background: #e7f3ff; padding: 10px; border-left: 4px solid #0073aa; margin: 10px 0;">';
        echo '<h4 style="margin-top: 0;">💡 水印功能说明</h4>';
        echo '<ul>';
        echo '<li><strong>文字/图片水印：</strong>支持自定义文字内容（含@username占位符）或图片水印</li>';
        echo '<li><strong>用户名水印：</strong>独立的WordPress用户名水印，可单独设置位置和样式</li>';
        echo '<li><strong>双水印支持：</strong>可同时启用两种水印，实现更丰富的水印组合</li>';
        echo '</ul>';
        echo '</div>';
    }
    
    // 设置字段回调函数
    public function enable_webp_conversion_callback() {
        $options = get_option($this->option_name);
        $enabled = isset($options['enable_webp_conversion']) ? $options['enable_webp_conversion'] : false;
        echo '<input type="checkbox" name="' . $this->option_name . '[enable_webp_conversion]" value="1" ' . checked($enabled, true, false) . ' />';
        echo '<p class="description">启用后，上传的JPEG和PNG图片将自动转换为WebP格式</p>';
    }
    
    public function webp_quality_callback() {
        $options = get_option($this->option_name);
        $quality = isset($options['webp_quality']) ? $options['webp_quality'] : 85;
        echo '<input type="number" name="' . $this->option_name . '[webp_quality]" value="' . esc_attr($quality) . '" min="1" max="100" />';
        echo '<p class="description">推荐值：85（高质量）、75（平衡）、65（高压缩）。数值越高质量越好但文件越大。</p>';
    }
    
    public function convert_jpeg_callback() {
        $options = get_option($this->option_name);
        $enabled = isset($options['convert_jpeg']) ? $options['convert_jpeg'] : true;
        echo '<input type="checkbox" name="' . $this->option_name . '[convert_jpeg]" value="1" ' . checked($enabled, true, false) . ' />';
        echo '<p class="description">将JPEG/JPG图片转换为WebP格式</p>';
    }
    
    public function convert_png_callback() {
        $options = get_option($this->option_name);
        $enabled = isset($options['convert_png']) ? $options['convert_png'] : true;
        echo '<input type="checkbox" name="' . $this->option_name . '[convert_png]" value="1" ' . checked($enabled, true, false) . ' />';
        echo '<p class="description">将PNG图片转换为WebP格式</p>';
    }
    
    public function keep_original_callback() {
        $options = get_option($this->option_name);
        $enabled = isset($options['keep_original']) ? $options['keep_original'] : false;
        echo '<input type="checkbox" name="' . $this->option_name . '[keep_original]" value="1" ' . checked($enabled, true, false) . ' />';
        echo '<p class="description">保留原始图片文件（将占用更多存储空间）</p>';
    }
    
    public function max_width_callback() {
        $options = get_option($this->option_name);
        $max_width = isset($options['max_width']) ? $options['max_width'] : '';
        echo '<input type="number" name="' . $this->option_name . '[max_width]" value="' . esc_attr($max_width) . '" min="100" />';
        echo '<p class="description">如果图片宽度超过此值将被缩放（留空表示不限制）</p>';
    }
    
    public function max_height_callback() {
        $options = get_option($this->option_name);
        $max_height = isset($options['max_height']) ? $options['max_height'] : '';
        echo '<input type="number" name="' . $this->option_name . '[max_height]" value="' . esc_attr($max_height) . '" min="100" />';
        echo '<p class="description">如果图片高度超过此值将被缩放（留空表示不限制）</p>';
    }
    
    public function compression_method_callback() {
        $options = get_option($this->option_name);
        $method = isset($options['compression_method']) ? $options['compression_method'] : 'auto';
        echo '<select name="' . $this->option_name . '[compression_method]">';
        echo '<option value="auto" ' . selected($method, 'auto', false) . '>自动选择</option>';
        echo '<option value="gd" ' . selected($method, 'gd', false) . '>GD库（兼容性好）</option>';
        echo '<option value="imagick" ' . selected($method, 'imagick', false) . '>ImageMagick（质量更好）</option>';
        echo '</select>';
        echo '<p class="description">选择图像处理库。自动模式将优先使用ImageMagick</p>';
    }
    
    // 高级WebP优化设置回调函数
    public function webp_lossless_callback() {
        $options = get_option($this->option_name);
        $enabled = isset($options['webp_lossless']) ? $options['webp_lossless'] : false;
        echo '<input type="checkbox" name="' . $this->option_name . '[webp_lossless]" value="1" ' . checked($enabled, true, false) . ' />';
        echo '<p class="description">启用无损WebP压缩（文件更大但质量完美，适合有透明背景的PNG图片）</p>';
    }
    
    public function webp_filter_strength_callback() {
        $options = get_option($this->option_name);
        $strength = isset($options['webp_filter_strength']) ? $options['webp_filter_strength'] : 60;
        echo '<input type="range" name="' . $this->option_name . '[webp_filter_strength]" value="' . esc_attr($strength) . '" min="0" max="100" oninput="this.nextElementSibling.textContent=this.value" />';
        echo '<span>' . $strength . '</span>';
        echo '<p class="description">去块滤镜强度 (0-100)。较高的值可以减少块状伪影，但可能会让图片变模糊</p>';
    }
    
    public function webp_filter_sharpness_callback() {
        $options = get_option($this->option_name);
        $sharpness = isset($options['webp_filter_sharpness']) ? $options['webp_filter_sharpness'] : 0;
        echo '<input type="range" name="' . $this->option_name . '[webp_filter_sharpness]" value="' . esc_attr($sharpness) . '" min="0" max="7" oninput="this.nextElementSibling.textContent=this.value" />';
        echo '<span>' . $sharpness . '</span>';
        echo '<p class="description">去块滤镜锐度 (0-7)。值为0时禁用，值越大边缘保持越好</p>';
    }
    
    public function webp_alpha_filtering_callback() {
        $options = get_option($this->option_name);
        $filtering = isset($options['webp_alpha_filtering']) ? $options['webp_alpha_filtering'] : 'auto';
        echo '<select name="' . $this->option_name . '[webp_alpha_filtering]">';
        echo '<option value="auto" ' . selected($filtering, 'auto', false) . '>自动选择</option>';
        echo '<option value="none" ' . selected($filtering, 'none', false) . '>不使用滤镜</option>';
        echo '<option value="fast" ' . selected($filtering, 'fast', false) . '>快速滤镜</option>';
        echo '<option value="best" ' . selected($filtering, 'best', false) . '>最佳滤镜</option>';
        echo '</select>';
        echo '<p class="description">透明度通道的滤镜算法。"最佳"质量更好但速度较慢</p>';
    }
    
    public function webp_alpha_quality_callback() {
        $options = get_option($this->option_name);
        $quality = isset($options['webp_alpha_quality']) ? $options['webp_alpha_quality'] : 100;
        echo '<input type="range" name="' . $this->option_name . '[webp_alpha_quality]" value="' . esc_attr($quality) . '" min="0" max="100" oninput="this.nextElementSibling.textContent=this.value+\'%\'" />';
        echo '<span>' . $quality . '%</span>';
        echo '<p class="description">透明度通道的压缩质量 (0-100)。仅对有透明背景的图片有效</p>';
    }
    
    public function webp_preprocessing_callback() {
        $options = get_option($this->option_name);
        $preprocessing = isset($options['webp_preprocessing']) ? $options['webp_preprocessing'] : '0';
        echo '<select name="' . $this->option_name . '[webp_preprocessing]">';
        echo '<option value="0" ' . selected($preprocessing, '0', false) . '>不使用预处理</option>';
        echo '<option value="1" ' . selected($preprocessing, '1', false) . '>段平滑滤镜</option>';
        echo '<option value="2" ' . selected($preprocessing, '2', false) . '>伪随机抖动</option>';
        echo '</select>';
        echo '<p class="description">预处理滤镜可以改善视觉质量，但会增加处理时间</p>';
    }
    
    public function webp_segments_callback() {
        $options = get_option($this->option_name);
        $segments = isset($options['webp_segments']) ? $options['webp_segments'] : 4;
        echo '<input type="range" name="' . $this->option_name . '[webp_segments]" value="' . esc_attr($segments) . '" min="1" max="4" oninput="this.nextElementSibling.textContent=this.value" />';
        echo '<span>' . $segments . '</span>';
        echo '<p class="description">压缩时使用的段数 (1-4)。更多段数可能获得更好压缩，但速度较慢</p>';
    }
    
    public function webp_pass_callback() {
        $options = get_option($this->option_name);
        $pass = isset($options['webp_pass']) ? $options['webp_pass'] : 1;
        echo '<input type="range" name="' . $this->option_name . '[webp_pass]" value="' . esc_attr($pass) . '" min="1" max="10" oninput="this.nextElementSibling.textContent=this.value" />';
        echo '<span>' . $pass . '</span>';
        echo '<p class="description">分析遍数 (1-10)。更多遍数可能获得更好压缩，但会显著增加处理时间</p>';
    }
    
    public function webp_target_size_callback() {
        $options = get_option($this->option_name);
        $target_size = isset($options['webp_target_size']) ? $options['webp_target_size'] : '';
        echo '<input type="number" name="' . $this->option_name . '[webp_target_size]" value="' . esc_attr($target_size) . '" min="1000" placeholder="例如: 50000" />';
        echo '<p class="description">目标文件大小（字节）。设置后会尝试压缩到指定大小，可能会覆盖质量设置。留空使用质量设置。</p>';
    }
    
    // 水印设置回调函数
    public function enable_watermark_callback() {
        $options = get_option($this->option_name);
        $enabled = isset($options['enable_watermark']) ? $options['enable_watermark'] : false;
        echo '<input type="checkbox" name="' . $this->option_name . '[enable_watermark]" value="1" ' . checked($enabled, true, false) . ' />';
        echo '<p class="description">为处理后的图片添加水印</p>';
    }
    
    public function watermark_type_callback() {
        $options = get_option($this->option_name);
        $type = isset($options['watermark_type']) ? $options['watermark_type'] : 'text';
        echo '<select name="' . $this->option_name . '[watermark_type]">';
        echo '<option value="text" ' . selected($type, 'text', false) . '>文字水印</option>';
        echo '<option value="image" ' . selected($type, 'image', false) . '>图片水印</option>';
        echo '</select>';
        echo '<p class="description">选择水印类型</p>';
    }
    
    public function watermark_text_callback() {
        $options = get_option($this->option_name);
        $text = isset($options['watermark_text']) ? $options['watermark_text'] : 'CS.Yuelk.com';
        echo '<input type="text" name="' . $this->option_name . '[watermark_text]" value="' . esc_attr($text) . '" class="regular-text" placeholder="支持中文水印，如：版权所有 © 2024" />';
        echo '<p class="description">文字水印内容，支持中文字符（仅在选择文字水印时生效）。建议选择中文字体以确保中文正确显示。<br><strong>特殊占位符：</strong>使用 <code>@username</code> 将自动替换为当前WordPress用户名。</p>';
    }
    
    public function watermark_font_size_callback() {
        $options = get_option($this->option_name);
        $font_size = isset($options['watermark_font_size']) ? $options['watermark_font_size'] : 24;
        echo '<input type="range" name="' . $this->option_name . '[watermark_font_size]" value="' . esc_attr($font_size) . '" min="10" max="72" oninput="this.nextElementSibling.textContent=this.value+\'px\'" />';
        echo '<span>' . $font_size . 'px</span>';
        echo '<p class="description">文字水印字体大小（10-72像素，仅文字水印生效）</p>';
    }
    
    public function watermark_font_family_callback() {
        $options = get_option($this->option_name);
        $font_family = isset($options['watermark_font_family']) ? $options['watermark_font_family'] : 'system';
        
        // 检查本地字体可用性
        $plugin_fonts_dir = dirname(__FILE__) . '/fonts/';
        $local_fonts = array();
        if (file_exists($plugin_fonts_dir . 'NotoSansCJKsc-Regular.otf')) $local_fonts[] = 'noto-cjk';
        if (file_exists($plugin_fonts_dir . 'SourceHanSansSC-Regular.otf')) $local_fonts[] = 'source-han';
        if (file_exists($plugin_fonts_dir . 'DejaVuSans.ttf')) $local_fonts[] = 'dejavu';
        
        echo '<select name="' . $this->option_name . '[watermark_font_family]">';
        echo '<option value="system" ' . selected($font_family, 'system', false) . '>系统默认字体（本地优先）</option>';
        
        $local_indicator = in_array('noto-cjk', $local_fonts) ? ' 🟢本地' : '';
        echo '<option value="noto-cjk" ' . selected($font_family, 'noto-cjk', false) . '>Noto Sans CJK（中文推荐）' . $local_indicator . '</option>';
        
        $local_indicator = in_array('source-han', $local_fonts) ? ' 🟢本地' : '';
        echo '<option value="source-han" ' . selected($font_family, 'source-han', false) . '>Source Han Sans（思源黑体）' . $local_indicator . '</option>';
        
        echo '<option value="microsoft-yahei" ' . selected($font_family, 'microsoft-yahei', false) . '>Microsoft YaHei（微软雅黑）</option>';
        echo '<option value="pingfang" ' . selected($font_family, 'pingfang', false) . '>PingFang SC（苹方）</option>';
        echo '<option value="wenquanyi" ' . selected($font_family, 'wenquanyi', false) . '>WenQuanYi（文泉驿）</option>';
        echo '<option value="arial" ' . selected($font_family, 'arial', false) . '>Arial</option>';
        
        $local_indicator = in_array('dejavu', $local_fonts) ? ' 🟢本地' : '';
        echo '<option value="dejavu" ' . selected($font_family, 'dejavu', false) . '>DejaVu Sans' . $local_indicator . '</option>';
        
        echo '<option value="helvetica" ' . selected($font_family, 'helvetica', false) . '>Helvetica</option>';
        echo '<option value="times" ' . selected($font_family, 'times', false) . '>Times New Roman</option>';
        echo '</select>';
        
        $local_count = count($local_fonts);
        echo '<p class="description">文字水印字体类型。🟢标记表示插件已内置该字体，无需依赖系统字体。当前本地字体: ' . $local_count . ' 个</p>';
        if ($local_count > 0) {
            echo '<p class="description"><strong>本地字体优势：</strong>不依赖系统环境，确保在任何服务器上都能正常显示中文水印</p>';
        }
    }
    
    public function watermark_image_callback() {
        $options = get_option($this->option_name);
        $image_url = isset($options['watermark_image']) ? $options['watermark_image'] : '';
        echo '<input type="url" name="' . $this->option_name . '[watermark_image]" id="watermark_image_url" value="' . esc_attr($image_url) . '" class="regular-text" placeholder="https://example.com/watermark.png" />';
        echo '<br><button type="button" class="button" onclick="openMediaLibrary(this)">选择图片</button>';
        echo '<button type="button" class="button" onclick="testWatermarkImage()" style="margin-left: 10px;">测试水印图片</button>';
        echo '<div id="watermark_preview" style="margin-top: 10px;"></div>';
        echo '<p class="description">水印图片URL（仅在选择图片水印时生效，建议使用PNG格式支持透明度）</p>';
        
        // 添加媒体库选择脚本和测试功能
        echo '<script>
        function openMediaLibrary(button) {
            var frame = wp.media({
                title: "选择水印图片",
                button: { text: "使用此图片" },
                library: { type: "image" },
                multiple: false
            });
            frame.on("select", function() {
                var attachment = frame.state().get("selection").first().toJSON();
                var input = document.getElementById("watermark_image_url");
                input.value = attachment.url;
                // 自动测试选中的图片
                testWatermarkImage();
            });
            frame.open();
        }
        
        function testWatermarkImage() {
            var url = document.getElementById("watermark_image_url").value;
            var preview = document.getElementById("watermark_preview");
            
            if (!url) {
                preview.innerHTML = "<span style=\"color: red;\">❌ 请先选择水印图片</span>";
                return;
            }
            
            preview.innerHTML = "<span style=\"color: blue;\">⏳ 正在测试水印图片...</span>";
            
            var img = new Image();
            img.onload = function() {
                preview.innerHTML = "<span style=\"color: green;\">✅ 水印图片可以访问</span><br><img src=\"" + url + "\" style=\"max-width: 100px; max-height: 50px; border: 1px solid #ddd; margin-top: 5px;\">";
            };
            img.onerror = function() {
                preview.innerHTML = "<span style=\"color: red;\">❌ 水印图片无法访问，请检查URL或重新选择</span>";
            };
            img.src = url;
        }
        
        // 页面加载时自动测试现有的水印图片
        document.addEventListener("DOMContentLoaded", function() {
            if (document.getElementById("watermark_image_url").value) {
                testWatermarkImage();
            }
        });
        </script>';
    }
    
    public function watermark_opacity_callback() {
        $options = get_option($this->option_name);
        $opacity = isset($options['watermark_opacity']) ? $options['watermark_opacity'] : 50;
        echo '<input type="range" name="' . $this->option_name . '[watermark_opacity]" value="' . esc_attr($opacity) . '" min="0" max="100" oninput="this.nextElementSibling.textContent=this.value+\'%\'" />';
        echo '<span>' . $opacity . '%</span>';
        echo '<p class="description">水印透明度，0为完全透明，100为完全不透明</p>';
    }
    
    public function watermark_positions_callback() {
        $options = get_option($this->option_name);
        $positions = isset($options['watermark_positions']) ? $options['watermark_positions'] : array('5'); // 默认中心位置
        
        echo '<div class="watermark-positions-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; width: 200px; margin-bottom: 10px;">';
        
        $position_labels = array(
            '1' => '左上', '2' => '上中', '3' => '右上',
            '4' => '左中', '5' => '中心', '6' => '右中', 
            '7' => '左下', '8' => '下中', '9' => '右下'
        );
        
        for ($i = 1; $i <= 9; $i++) {
            $checked = is_array($positions) && in_array((string)$i, $positions) ? 'checked' : '';
            echo '<label style="text-align: center; padding: 8px; border: 1px solid #ddd; cursor: pointer;" title="' . $position_labels[$i] . '">';
            echo '<input type="checkbox" name="' . $this->option_name . '[watermark_positions][]" value="' . $i . '" ' . $checked . ' style="margin: 0;" />';
            echo '<br><small>' . $position_labels[$i] . '</small>';
            echo '</label>';
        }
        
        echo '</div>';
        echo '<p class="description">选择水印位置，可选择多个位置（九宫格布局，仅在"九宫格模式"时有效）</p>';
    }
    
    public function watermark_position_mode_callback() {
        $options = get_option($this->option_name);
        $mode = isset($options['watermark_position_mode']) ? $options['watermark_position_mode'] : 'grid';
        echo '<select name="' . $this->option_name . '[watermark_position_mode]" onchange="togglePositionMode(this)">';
        echo '<option value="grid" ' . selected($mode, 'grid', false) . '>九宫格模式</option>';
        echo '<option value="precise" ' . selected($mode, 'precise', false) . '>精确坐标模式</option>';
        echo '</select>';
        echo '<p class="description">选择水印定位方式：九宫格模式或精确坐标模式</p>';
        
        echo '<script>
        function togglePositionMode(select) {
            var preciseFields = document.getElementById("watermark_precise_fields");
            var gridFields = document.querySelector(".watermark-positions-grid").parentElement;
            var xInput = document.querySelector("input[name*=\'watermark_precise_x\']");
            var yInput = document.querySelector("input[name*=\'watermark_precise_y\']");
            
            if (select.value === "precise") {
                if (preciseFields) preciseFields.style.display = "block";
                if (gridFields) gridFields.style.display = "none";
                // Enable fields when visible
                if (xInput) xInput.disabled = false;
                if (yInput) yInput.disabled = false;
            } else {
                if (preciseFields) preciseFields.style.display = "none"; 
                if (gridFields) gridFields.style.display = "block";
                // Disable fields when hidden to prevent validation errors
                if (xInput) xInput.disabled = true;
                if (yInput) yInput.disabled = true;
            }
        }
        
        document.addEventListener("DOMContentLoaded", function() {
            var select = document.querySelector("select[name*=\'watermark_position_mode\']");
            if (select) togglePositionMode(select);
        });
        </script>';
    }
    
    public function watermark_precise_position_callback() {
        $options = get_option($this->option_name);
        $x = isset($options['watermark_precise_x']) ? $options['watermark_precise_x'] : 0;
        $y = isset($options['watermark_precise_y']) ? $options['watermark_precise_y'] : 0;
        $mode = isset($options['watermark_position_mode']) ? $options['watermark_position_mode'] : 'grid';
        
        $display_style = ($mode === 'precise') ? 'block' : 'none';
        
        echo '<div id="watermark_precise_fields" style="display: ' . $display_style . ';">';
        echo '<label>X坐标: <input type="number" name="' . $this->option_name . '[watermark_precise_x]" value="' . esc_attr($x) . '" min="0" style="width: 80px;" /> px</label>';
        echo ' <label>Y坐标: <input type="number" name="' . $this->option_name . '[watermark_precise_y]" value="' . esc_attr($y) . '" min="0" style="width: 80px;" /> px</label>';
        echo '<br><small>距离图片左上角的精确像素位置</small>';
        echo '</div>';
    }
    
    public function watermark_image_size_callback() {
        $options = get_option($this->option_name);
        $size_mode = isset($options['watermark_image_size_mode']) ? $options['watermark_image_size_mode'] : 'ratio';
        // Handle legacy 'auto' mode by converting to ratio mode with 4/10 (similar to old 1/4)
        if ($size_mode === 'auto') {
            $size_mode = 'ratio';
        }
        $ratio = isset($options['watermark_image_ratio']) ? intval($options['watermark_image_ratio']) : 4; // Default to 4/10 (0.4)
        $width = isset($options['watermark_image_width']) ? $options['watermark_image_width'] : '';
        $height = isset($options['watermark_image_height']) ? $options['watermark_image_height'] : '';
        
        echo '<div>';
        echo '<label><input type="radio" name="' . $this->option_name . '[watermark_image_size_mode]" value="ratio" ' . checked($size_mode, 'ratio', false) . ' onchange="toggleImageSizeMode()" /> 比例调整</label><br>';
        echo '<label><input type="radio" name="' . $this->option_name . '[watermark_image_size_mode]" value="manual" ' . checked($size_mode, 'manual', false) . ' onchange="toggleImageSizeMode()" /> 手动设置尺寸</label>';
        echo '</div>';
        
        // Ratio selection
        $ratio_display_style = ($size_mode === 'ratio') ? 'block' : 'none';
        echo '<div id="watermark_ratio_size" style="display: ' . $ratio_display_style . '; margin-top: 10px;">';
        echo '<label>水印尺寸比例: ';
        echo '<select name="' . $this->option_name . '[watermark_image_ratio]">';
        for ($i = 1; $i <= 10; $i++) {
            $selected = ($ratio == $i) ? 'selected' : '';
            echo '<option value="' . $i . '" ' . $selected . '>' . $i . '/10 (' . ($i * 10) . '%)</option>';
        }
        echo '</select>';
        echo '</label>';
        echo '<br><small>水印相对于原图的尺寸比例，保持宽高比自动缩放</small>';
        echo '</div>';
        
        // Manual sizing (keep for backward compatibility)
        $manual_display_style = ($size_mode === 'manual') ? 'block' : 'none';
        echo '<div id="watermark_manual_size" style="display: ' . $manual_display_style . '; margin-top: 10px;">';
        echo '<label>宽度: <input type="number" name="' . $this->option_name . '[watermark_image_width]" value="' . esc_attr($width) . '" min="10" max="1000" style="width: 80px;" /> px</label>';
        echo ' <label>高度: <input type="number" name="' . $this->option_name . '[watermark_image_height]" value="' . esc_attr($height) . '" min="10" max="1000" style="width: 80px;" /> px</label>';
        echo '<br><small>留空则保持宽高比例自动缩放</small>';
        echo '</div>';
        
        echo '<script>
        function toggleImageSizeMode() {
            var ratioSize = document.getElementById("watermark_ratio_size");
            var manualSize = document.getElementById("watermark_manual_size");
            var ratioRadio = document.querySelector("input[name*=\'watermark_image_size_mode\'][value=\'ratio\']:checked");
            var manualRadio = document.querySelector("input[name*=\'watermark_image_size_mode\'][value=\'manual\']:checked");
            var widthInput = document.querySelector("input[name*=\'watermark_image_width\']");
            var heightInput = document.querySelector("input[name*=\'watermark_image_height\']");
            
            if (ratioRadio && ratioSize && manualSize) {
                ratioSize.style.display = "block";
                manualSize.style.display = "none";
                // Disable manual fields when not visible
                if (widthInput) widthInput.disabled = true;
                if (heightInput) heightInput.disabled = true;
            } else if (manualRadio && ratioSize && manualSize) {
                ratioSize.style.display = "none";
                manualSize.style.display = "block";
                // Enable fields when visible
                if (widthInput) widthInput.disabled = false;
                if (heightInput) heightInput.disabled = false;
            }
        }
        
        // Initialize on page load
        document.addEventListener("DOMContentLoaded", function() {
            toggleImageSizeMode();
        });
        </script>';
        
        echo '<p class="description">选择图片水印尺寸控制方式（仅对图片水印有效）</p>';
        echo '<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e5e5;">';
        echo '<h3 style="color: #0073aa; margin: 20px 0 10px;">📝 WordPress用户名水印 (独立功能)</h3>';
        echo '<p style="color: #666; font-style: italic;">WordPress用户名水印是独立于上方文字/图片水印的功能，可同时使用并分别设置位置和样式。</p>';
    }
    
    // WordPress用户名水印设置回调函数
    public function enable_username_watermark_callback() {
        $options = get_option($this->option_name);
        $enabled = isset($options['enable_username_watermark']) ? $options['enable_username_watermark'] : false;
        echo '<input type="checkbox" name="' . $this->option_name . '[enable_username_watermark]" value="1" ' . checked($enabled, true, false) . ' />';
        echo '<p class="description">为图片添加当前WordPress用户名作为独立水印（与上方文字/图片水印分开设置）</p>';
    }
    
    public function username_watermark_font_size_callback() {
        $options = get_option($this->option_name);
        $font_size = isset($options['username_watermark_font_size']) ? $options['username_watermark_font_size'] : 20;
        echo '<input type="range" name="' . $this->option_name . '[username_watermark_font_size]" value="' . esc_attr($font_size) . '" min="10" max="72" oninput="this.nextElementSibling.textContent=this.value+\'px\'" />';
        echo '<span>' . $font_size . 'px</span>';
        echo '<p class="description">用户名水印字体大小（10-72像素）</p>';
    }
    
    public function username_watermark_font_family_callback() {
        $options = get_option($this->option_name);
        $font_family = isset($options['username_watermark_font_family']) ? $options['username_watermark_font_family'] : 'system';
        
        // 检查本地字体可用性
        $plugin_fonts_dir = dirname(__FILE__) . '/fonts/';
        $local_fonts = array();
        if (file_exists($plugin_fonts_dir . 'NotoSansCJKsc-Regular.otf')) $local_fonts[] = 'noto-cjk';
        if (file_exists($plugin_fonts_dir . 'SourceHanSansSC-Regular.otf')) $local_fonts[] = 'source-han';
        if (file_exists($plugin_fonts_dir . 'DejaVuSans.ttf')) $local_fonts[] = 'dejavu';
        
        echo '<select name="' . $this->option_name . '[username_watermark_font_family]">';
        echo '<option value="system" ' . selected($font_family, 'system', false) . '>系统默认字体（本地优先）</option>';
        
        $local_indicator = in_array('noto-cjk', $local_fonts) ? ' 🟢本地' : '';
        echo '<option value="noto-cjk" ' . selected($font_family, 'noto-cjk', false) . '>Noto Sans CJK（中文推荐）' . $local_indicator . '</option>';
        
        $local_indicator = in_array('source-han', $local_fonts) ? ' 🟢本地' : '';
        echo '<option value="source-han" ' . selected($font_family, 'source-han', false) . '>Source Han Sans（思源黑体）' . $local_indicator . '</option>';
        
        echo '<option value="microsoft-yahei" ' . selected($font_family, 'microsoft-yahei', false) . '>Microsoft YaHei（微软雅黑）</option>';
        echo '<option value="pingfang" ' . selected($font_family, 'pingfang', false) . '>PingFang SC（苹方）</option>';
        echo '<option value="wenquanyi" ' . selected($font_family, 'wenquanyi', false) . '>WenQuanYi（文泉驿）</option>';
        echo '<option value="arial" ' . selected($font_family, 'arial', false) . '>Arial</option>';
        
        $local_indicator = in_array('dejavu', $local_fonts) ? ' 🟢本地' : '';
        echo '<option value="dejavu" ' . selected($font_family, 'dejavu', false) . '>DejaVu Sans' . $local_indicator . '</option>';
        
        echo '<option value="helvetica" ' . selected($font_family, 'helvetica', false) . '>Helvetica</option>';
        echo '<option value="times" ' . selected($font_family, 'times', false) . '>Times New Roman</option>';
        echo '</select>';
        
        $local_count = count($local_fonts);
        echo '<p class="description">用户名水印字体类型。🟢标记表示插件已内置该字体，当前本地字体: ' . $local_count . ' 个</p>';
    }
    
    public function username_watermark_opacity_callback() {
        $options = get_option($this->option_name);
        $opacity = isset($options['username_watermark_opacity']) ? $options['username_watermark_opacity'] : 70;
        echo '<input type="range" name="' . $this->option_name . '[username_watermark_opacity]" value="' . esc_attr($opacity) . '" min="0" max="100" oninput="this.nextElementSibling.textContent=this.value+\'%\'" />';
        echo '<span>' . $opacity . '%</span>';
        echo '<p class="description">用户名水印透明度，0为完全透明，100为完全不透明</p>';
    }
    
    public function username_watermark_position_mode_callback() {
        $options = get_option($this->option_name);
        $mode = isset($options['username_watermark_position_mode']) ? $options['username_watermark_position_mode'] : 'grid';
        echo '<select name="' . $this->option_name . '[username_watermark_position_mode]" onchange="toggleUsernamePositionMode(this)">';
        echo '<option value="grid" ' . selected($mode, 'grid', false) . '>九宫格模式</option>';
        echo '<option value="precise" ' . selected($mode, 'precise', false) . '>精确坐标模式</option>';
        echo '</select>';
        echo '<p class="description">选择用户名水印定位方式：九宫格模式或精确坐标模式</p>';
        
        echo '<script>
        function toggleUsernamePositionMode(select) {
            var preciseFields = document.getElementById("username_watermark_precise_fields");
            var gridFields = document.querySelector(".username-watermark-positions-grid");
            if (gridFields) gridFields = gridFields.parentElement;
            var xInput = document.querySelector("input[name*=\'username_watermark_precise_x\']");
            var yInput = document.querySelector("input[name*=\'username_watermark_precise_y\']");
            
            if (select.value === "precise") {
                if (preciseFields) preciseFields.style.display = "block";
                if (gridFields) gridFields.style.display = "none";
                // Enable fields when visible
                if (xInput) xInput.disabled = false;
                if (yInput) yInput.disabled = false;
            } else {
                if (preciseFields) preciseFields.style.display = "none"; 
                if (gridFields) gridFields.style.display = "block";
                // Disable fields when hidden to prevent validation errors
                if (xInput) xInput.disabled = true;
                if (yInput) yInput.disabled = true;
            }
        }
        
        document.addEventListener("DOMContentLoaded", function() {
            var select = document.querySelector("select[name*=\'username_watermark_position_mode\']");
            if (select) toggleUsernamePositionMode(select);
        });
        </script>';
    }
    
    public function username_watermark_positions_callback() {
        $options = get_option($this->option_name);
        $positions = isset($options['username_watermark_positions']) ? $options['username_watermark_positions'] : array('7'); // 默认左下位置
        
        echo '<div class="username-watermark-positions-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; width: 200px; margin-bottom: 10px;">';
        
        $position_labels = array(
            '1' => '左上', '2' => '上中', '3' => '右上',
            '4' => '左中', '5' => '中心', '6' => '右中', 
            '7' => '左下', '8' => '下中', '9' => '右下'
        );
        
        for ($i = 1; $i <= 9; $i++) {
            $checked = is_array($positions) && in_array((string)$i, $positions) ? 'checked' : '';
            echo '<label style="text-align: center; padding: 8px; border: 1px solid #ddd; cursor: pointer;" title="' . $position_labels[$i] . '">';
            echo '<input type="checkbox" name="' . $this->option_name . '[username_watermark_positions][]" value="' . $i . '" ' . $checked . ' style="margin: 0;" />';
            echo '<br><small>' . $position_labels[$i] . '</small>';
            echo '</label>';
        }
        
        echo '</div>';
        echo '<p class="description">选择用户名水印位置，可选择多个位置（九宫格布局，仅在"九宫格模式"时有效）</p>';
    }
    
    public function username_watermark_precise_position_callback() {
        $options = get_option($this->option_name);
        $x = isset($options['username_watermark_precise_x']) ? $options['username_watermark_precise_x'] : 20;
        $y = isset($options['username_watermark_precise_y']) ? $options['username_watermark_precise_y'] : 20;
        $mode = isset($options['username_watermark_position_mode']) ? $options['username_watermark_position_mode'] : 'grid';
        
        $display_style = ($mode === 'precise') ? 'block' : 'none';
        
        echo '<div id="username_watermark_precise_fields" style="display: ' . $display_style . ';">';
        echo '<label>X坐标: <input type="number" name="' . $this->option_name . '[username_watermark_precise_x]" value="' . esc_attr($x) . '" min="0" style="width: 80px;" /> px</label>';
        echo ' <label>Y坐标: <input type="number" name="' . $this->option_name . '[username_watermark_precise_y]" value="' . esc_attr($y) . '" min="0" style="width: 80px;" /> px</label>';
        echo '<br><small>距离图片左上角的精确像素位置</small>';
        echo '</div>';
    }
    
    public function username_watermark_color_callback() {
        $options = get_option($this->option_name);
        $color = isset($options['username_watermark_color']) ? $options['username_watermark_color'] : '#ffffff';
        
        echo '<input type="color" name="' . $this->option_name . '[username_watermark_color]" value="' . esc_attr($color) . '" />';
        echo '<p class="description">用户名水印的文字颜色（默认为白色）</p>';
    }
    
    public function username_watermark_text_callback() {
        $options = get_option($this->option_name);
        $text = isset($options['username_watermark_text']) ? $options['username_watermark_text'] : '@username';
        
        echo '<input type="text" name="' . $this->option_name . '[username_watermark_text]" value="' . esc_attr($text) . '" class="regular-text" placeholder="@username" />';
        echo '<p class="description">自定义用户名水印文本。使用 <code>@username</code> 占位符代表当前用户名。<br>例如："用户: @username" 将显示为 "用户: admin"</p>';
    }
    
    /**
     * 加载管理员样式
     */
    public function admin_enqueue_scripts($hook) {
        if ($hook !== 'settings_page_webp-optimizer') {
            return;
        }
        
        wp_enqueue_style(
            'webp-optimizer-admin',
            WEBP_OPT_PLUGIN_URL . 'admin-style.css',
            array(),
            WEBP_OPT_VERSION
        );
        
        // 加载WordPress媒体库
        wp_enqueue_media();
    }
    
    /**
     * 管理员页面
     */
    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>WebP优化设置</h1>
            <p>此插件可以自动将上传的JPEG和PNG图片转换为WebP格式，大幅减小文件大小并提高网站加载速度。</p>
            
            <!-- 系统信息 -->
            <div class="card" style="max-width: none; margin-top: 20px; margin-bottom: 20px;">
                <h2>系统信息</h2>
                <table class="form-table">
                    <tr>
                        <th>GD库支持</th>
                        <td><?php echo extension_loaded('gd') ? '<span style="color: green;">✓ 已安装</span>' : '<span style="color: red;">✗ 未安装</span>'; ?></td>
                    </tr>
                    <tr>
                        <th>ImageMagick支持</th>
                        <td><?php echo extension_loaded('imagick') ? '<span style="color: green;">✓ 已安装</span>' : '<span style="color: red;">✗ 未安装</span>'; ?></td>
                    </tr>
                    <tr>
                        <th>WebP支持</th>
                        <td><?php 
                            $webp_support = false;
                            if (extension_loaded('gd')) {
                                $gd_info = gd_info();
                                $webp_support = isset($gd_info['WebP Support']) && $gd_info['WebP Support'];
                            }
                            echo $webp_support ? '<span style="color: green;">✓ 支持</span>' : '<span style="color: red;">✗ 不支持</span>';
                        ?></td>
                    </tr>
                </table>
            </div>
            
            <!-- 推荐设置 -->
            <div class="card" style="max-width: none; margin-bottom: 20px;">
                <h2>推荐设置</h2>
                <ul>
                    <li><strong>WebP质量：</strong>85（适合大多数网站，平衡质量和文件大小）</li>
                    <li><strong>转换格式：</strong>同时启用JPEG和PNG转换</li>
                    <li><strong>保留原图：</strong>建议不保留（节省存储空间）</li>
                    <li><strong>最大尺寸：</strong>根据网站需求设置，推荐宽度1920像素</li>
                    <li><strong>压缩方式：</strong>自动选择（系统会优先使用最佳方案）</li>
                </ul>
                
                <h3>高级WebP优化建议</h3>
                <ul>
                    <li><strong>无损WebP：</strong>仅对有透明背景的PNG图片启用</li>
                    <li><strong>滤镜强度：</strong>60（默认值，平衡块状伪影和清晰度）</li>
                    <li><strong>透明度滤镜：</strong>自动选择（系统自动优化）</li>
                    <li><strong>透明度质量：</strong>100%（保持透明度完美）</li>
                    <li><strong>压缩段数：</strong>4（最大值，获得最佳压缩）</li>
                    <li><strong>分析遍数：</strong>1（默认值，过高会显著增加处理时间）</li>
                    <li><strong>目标文件大小：</strong>留空使用质量控制（推荐）</li>
                </ul>
            </div>
            
            <form method="post" action="options.php">
                <?php
                settings_fields('webp_optimizer_group');
                do_settings_sections('webp-optimizer');
                submit_button('保存设置');
                ?>
            </form>
            
            <!-- 使用说明 -->
            <div class="card" style="max-width: none; margin-top: 20px;">
                <h2>使用说明</h2>
                <ol>
                    <li><strong>启用插件：</strong>勾选"启用WebP转换"后插件开始工作</li>
                    <li><strong>自动转换：</strong>新上传的JPEG/PNG图片将自动转换为WebP</li>
                    <li><strong>质量控制：</strong>推荐质量值85，可根据需求调整</li>
                    <li><strong>高级优化：</strong>启用ImageMagick可使用更多高级选项</li>
                    <li><strong>兼容性：</strong>现代浏览器都支持WebP格式</li>
                    <li><strong>文件大小：</strong>WebP通常比JPEG小25-35%，比PNG小80%以上</li>
                </ol>
                
                <h3>高级WebP优化功能</h3>
                <ol>
                    <li><strong>无损压缩：</strong>完美保持PNG图片的透明度和细节</li>
                    <li><strong>滤镜调节：</strong>精确控制去块和锐化效果</li>
                    <li><strong>透明度优化：</strong>专门优化有透明背景的图片</li>
                    <li><strong>预处理滤镜：</strong>改善视觉质量，减少压缩伪影</li>
                    <li><strong>多遍分析：</strong>通过多次分析获得更好的压缩效果</li>
                    <li><strong>目标大小：</strong>精确控制输出文件大小</li>
                </ol>
                
                <h3>水印功能</h3>
                <ul>
                    <li><strong>文字水印：</strong>支持中文字符，建议选择中文字体</li>
                    <li><strong>图片水印：</strong>支持PNG、JPG等格式，推荐使用透明PNG</li>
                    <li><strong>用户名水印：</strong>独立的WordPress用户名水印功能，可单独设置位置和样式</li>
                    <li><strong>双水印支持：</strong>可同时启用文字/图片水印和用户名水印</li>
                    <li><strong>字体支持：</strong>系统自动检测中文字体，优先使用Noto CJK或文泉驿字体</li>
                    <li><strong>位置选择：</strong>支持九宫格位置或精确坐标定位，可选择多个位置</li>
                    <li><strong>透明度控制：</strong>0-100%可调，推荐50-80%</li>
                </ul>
                
                <h3>注意事项</h3>
                <ul>
                    <li>转换仅对新上传的图片生效，不会影响已存在的文件</li>
                    <li>如果保留原图，将占用双倍存储空间</li>
                    <li>高级选项可能会增加处理时间，建议根据实际需求使用</li>
                    <li>建议在启用前备份重要图片</li>
                    <li>无损WebP文件比有损WebP大，但比原PNG小</li>
                </ul>
            </div>
            
            <!-- 水印功能故障排除 -->
            <?php $options = get_option($this->option_name); ?>
            <?php if (!empty($options['enable_watermark'])): ?>
            <div class="card" style="max-width: none; margin-top: 20px;">
                <h2>水印功能故障排除</h2>
                
                <h3>如果水印没有显示，请检查以下项目：</h3>
                <ol>
                    <li><strong>确认设置已保存：</strong>修改水印设置后，请点击"保存设置"按钮</li>
                    <li><strong>检查水印图片：</strong>使用上方的"测试水印图片"按钮验证图片可以正常访问</li>
                    <li><strong>确认图片格式：</strong>只有JPEG和PNG图片会被转换并添加水印</li>
                    <li><strong>重新上传测试：</strong>水印只对新上传的图片生效，不会影响已存在的文件</li>
                    <li><strong>检查透明度设置：</strong>如果透明度设置过低，水印可能不易察觉</li>
                </ol>
                
                <h3>常见问题：</h3>
                <ul>
                    <li><strong>水印图片无法访问：</strong>请从媒体库重新选择水印图片</li>
                    <li><strong>水印位置不对：</strong>尝试不同的九宫格位置设置</li>
                    <li><strong>水印太透明：</strong>增加透明度值（推荐50-80%）</li>
                    <li><strong>文字水印不显示：</strong>切换到图片水印类型测试</li>
                </ul>
                
                <p><strong>建议测试步骤：</strong></p>
                <div style="background: #f0f8ff; padding: 10px; border-radius: 3px;">
                    1. 确保"启用水印"已勾选<br>
                    2. 选择"图片水印"类型<br>
                    3. 使用"选择图片"按钮从媒体库选择PNG格式的水印图片<br>
                    4. 设置透明度为70%<br>
                    5. 选择右下角位置（位置9）<br>
                    6. 点击"保存设置"<br>
                    7. 上传一张新的JPEG图片到媒体库进行测试
                </div>
            </div>
            <?php endif; ?>
        </div>
        <?php
    }
    
    /**
     * 主要的WebP转换功能
     */
    public function convert_to_webp($upload, $context = 'upload') {
        $options = get_option($this->option_name);
        
        // 检查是否启用转换
        if (empty($options['enable_webp_conversion'])) {
            return $upload;
        }
        
        // 检查是否是错误上传
        if (isset($upload['error']) && $upload['error'] !== false) {
            return $upload;
        }
        
        $file_path = $upload['file'];
        $file_type = $upload['type'];
        
        // 检查是否是支持的图片格式
        $supported_types = array();
        if (!empty($options['convert_jpeg'])) {
            $supported_types[] = 'image/jpeg';
            $supported_types[] = 'image/jpg';
        }
        if (!empty($options['convert_png'])) {
            $supported_types[] = 'image/png';
        }
        
        if (!in_array($file_type, $supported_types)) {
            return $upload;
        }
        
        // 检查WebP支持
        if (!$this->is_webp_supported()) {
            return $upload;
        }
        
        // 执行转换
        $webp_result = $this->process_image_to_webp($file_path, $file_type, $options);
        
        if ($webp_result['success']) {
            // 更新上传信息
            $upload['file'] = $webp_result['webp_file'];
            $upload['url'] = str_replace(basename($upload['url']), basename($webp_result['webp_file']), $upload['url']);
            $upload['type'] = 'image/webp';
            
            // 是否保留原文件
            if (empty($options['keep_original']) && file_exists($file_path)) {
                unlink($file_path);
            }
        }
        
        return $upload;
    }
    
    /**
     * 检查WebP支持
     */
    private function is_webp_supported() {
        if (extension_loaded('imagick')) {
            return in_array('WEBP', \Imagick::queryFormats());
        }
        
        if (extension_loaded('gd')) {
            $gd_info = gd_info();
            return isset($gd_info['WebP Support']) && $gd_info['WebP Support'];
        }
        
        return false;
    }
    
    /**
     * 处理图像转换为WebP
     */
    private function process_image_to_webp($file_path, $file_type, $options) {
        $result = array('success' => false, 'error' => '', 'webp_file' => '');
        
        // 生成WebP文件路径
        $pathinfo = pathinfo($file_path);
        $webp_file = $pathinfo['dirname'] . '/' . $pathinfo['filename'] . '.webp';
        
        $quality = isset($options['webp_quality']) ? intval($options['webp_quality']) : 85;
        $max_width = isset($options['max_width']) && !empty($options['max_width']) ? intval($options['max_width']) : null;
        $max_height = isset($options['max_height']) && !empty($options['max_height']) ? intval($options['max_height']) : null;
        $compression_method = isset($options['compression_method']) ? $options['compression_method'] : 'auto';
        
        // 选择压缩方法
        $use_imagick = false;
        if ($compression_method === 'imagick' && extension_loaded('imagick')) {
            $use_imagick = true;
        } elseif ($compression_method === 'auto' && extension_loaded('imagick')) {
            $use_imagick = true;
        }
        
        try {
            if ($use_imagick) {
                $result = $this->convert_with_imagick($file_path, $webp_file, $quality, $max_width, $max_height);
            } else {
                $result = $this->convert_with_gd($file_path, $webp_file, $file_type, $quality, $max_width, $max_height);
            }
            
            // 如果转换成功且启用了水印，添加水印
            if ($result['success'] && (!empty($options['enable_watermark']) || !empty($options['enable_username_watermark']))) {
                error_log('WebP Optimizer: Starting watermark application for: ' . $webp_file);
                $watermark_result = $this->apply_watermark($webp_file, $options);
                if (!$watermark_result['success']) {
                    // 水印添加失败，记录错误但不影响主要功能
                    error_log('WebP Optimizer: 水印添加失败 - ' . $watermark_result['error']);
                } else {
                    error_log('WebP Optimizer: 水印添加成功');
                }
            } else {
                if (!$result['success']) {
                    error_log('WebP Optimizer: WebP conversion failed, skipping watermark');
                } elseif (empty($options['enable_watermark']) && empty($options['enable_username_watermark'])) {
                    error_log('WebP Optimizer: Watermark is disabled');
                }
            }
        } catch (Exception $e) {
            $result['error'] = $e->getMessage();
        }
        
        return $result;
    }
    
    /**
     * 使用ImageMagick转换
     */
    private function convert_with_imagick($file_path, $webp_file, $quality, $max_width = null, $max_height = null) {
        $result = array('success' => false, 'error' => '', 'webp_file' => $webp_file);
        $options = get_option($this->option_name);
        
        try {
            $imagick = new \Imagick($file_path);
            
            // 调整大小
            if ($max_width || $max_height) {
                $imagick->resizeImage($max_width, $max_height, \Imagick::FILTER_LANCZOS, 1, true);
            }
            
            // 设置WebP格式
            $imagick->setImageFormat('webp');
            
            // 检查是否启用无损压缩
            if (!empty($options['webp_lossless'])) {
                $imagick->setOption('webp:lossless', 'true');
                $imagick->setOption('webp:quality', '100');
            } else {
                // 设置质量
                $imagick->setImageCompressionQuality($quality);
                
                // 目标文件大小优先
                if (!empty($options['webp_target_size'])) {
                    $target_size = intval($options['webp_target_size']);
                    $imagick->setOption('webp:target-size', (string)$target_size);
                } else {
                    $imagick->setOption('webp:quality', (string)$quality);
                }
            }
            
            // 高级优化选项
            $imagick->setOption('webp:method', '6'); // 默认使用最高质量方法
            
            // 滤镜强度
            if (isset($options['webp_filter_strength'])) {
                $filter_strength = intval($options['webp_filter_strength']);
                $imagick->setOption('webp:filter-strength', (string)$filter_strength);
            }
            
            // 滤镜锐度
            if (isset($options['webp_filter_sharpness'])) {
                $filter_sharpness = intval($options['webp_filter_sharpness']);
                if ($filter_sharpness > 0) {
                    $imagick->setOption('webp:filter-sharpness', (string)$filter_sharpness);
                }
            }
            
            // 透明度质量
            $alpha_quality = isset($options['webp_alpha_quality']) ? intval($options['webp_alpha_quality']) : 100;
            $imagick->setOption('webp:alpha-quality', (string)$alpha_quality);
            
            // 透明度滤镜
            if (isset($options['webp_alpha_filtering']) && $options['webp_alpha_filtering'] !== 'auto') {
                $alpha_filtering = $options['webp_alpha_filtering'];
                switch ($alpha_filtering) {
                    case 'none':
                        $imagick->setOption('webp:alpha-filtering', '0');
                        break;
                    case 'fast':
                        $imagick->setOption('webp:alpha-filtering', '1');
                        break;
                    case 'best':
                        $imagick->setOption('webp:alpha-filtering', '2');
                        break;
                }
            }
            
            // 预处理滤镜
            if (isset($options['webp_preprocessing'])) {
                $preprocessing = $options['webp_preprocessing'];
                $imagick->setOption('webp:preprocessing', $preprocessing);
            }
            
            // 压缩段数
            if (isset($options['webp_segments'])) {
                $segments = intval($options['webp_segments']);
                $imagick->setOption('webp:segments', (string)$segments);
            }
            
            // 分析遍数
            if (isset($options['webp_pass'])) {
                $pass = intval($options['webp_pass']);
                $imagick->setOption('webp:pass', (string)$pass);
            }
            
            // 保存文件
            $imagick->writeImage($webp_file);
            $imagick->destroy();
            
            $result['success'] = true;
        } catch (Exception $e) {
            $result['error'] = 'ImageMagick转换失败: ' . $e->getMessage();
        }
        
        return $result;
    }
    
    /**
     * 使用GD库转换
     */
    private function convert_with_gd($file_path, $webp_file, $file_type, $quality, $max_width = null, $max_height = null) {
        $result = array('success' => false, 'error' => '', 'webp_file' => $webp_file);
        
        try {
            // 创建图像资源
            switch ($file_type) {
                case 'image/jpeg':
                case 'image/jpg':
                    $image = imagecreatefromjpeg($file_path);
                    break;
                case 'image/png':
                    $image = imagecreatefrompng($file_path);
                    imagealphablending($image, false);
                    imagesavealpha($image, true);
                    break;
                default:
                    $result['error'] = '不支持的图像格式';
                    return $result;
            }
            
            if (!$image) {
                $result['error'] = '无法创建图像资源';
                return $result;
            }
            
            $width = imagesx($image);
            $height = imagesy($image);
            
            // 调整大小
            if (($max_width && $width > $max_width) || ($max_height && $height > $max_height)) {
                $ratio = min(
                    $max_width ? $max_width / $width : 1,
                    $max_height ? $max_height / $height : 1
                );
                
                $new_width = intval($width * $ratio);
                $new_height = intval($height * $ratio);
                
                $resized_image = imagecreatetruecolor($new_width, $new_height);
                
                if ($file_type === 'image/png') {
                    imagealphablending($resized_image, false);
                    imagesavealpha($resized_image, true);
                    $transparent = imagecolorallocatealpha($resized_image, 255, 255, 255, 127);
                    imagefill($resized_image, 0, 0, $transparent);
                }
                
                imagecopyresampled($resized_image, $image, 0, 0, 0, 0, $new_width, $new_height, $width, $height);
                imagedestroy($image);
                $image = $resized_image;
            }
            
            // 保存为WebP
            if (imagewebp($image, $webp_file, $quality)) {
                $result['success'] = true;
            } else {
                $result['error'] = 'WebP保存失败';
            }
            
            imagedestroy($image);
            
        } catch (Exception $e) {
            $result['error'] = 'GD转换失败: ' . $e->getMessage();
        }
        
        return $result;
    }
    
    /**
     * 应用水印到图片
     */
    private function apply_watermark($image_path, $options) {
        $result = array('success' => false, 'error' => '');
        
        error_log('WebP Optimizer Watermark: Applying watermark to: ' . $image_path);
        
        if (!file_exists($image_path)) {
            $result['error'] = '目标图片不存在: ' . $image_path;
            error_log('WebP Optimizer Watermark Error: ' . $result['error']);
            return $result;
        }
        
        $watermark_enabled = !empty($options['enable_watermark']);
        $username_watermark_enabled = !empty($options['enable_username_watermark']);
        
        if (!$watermark_enabled && !$username_watermark_enabled) {
            $result['error'] = '没有启用任何水印功能';
            return $result;
        }
        
        error_log('WebP Optimizer Watermark: Regular watermark=' . ($watermark_enabled ? 'enabled' : 'disabled') . ', Username watermark=' . ($username_watermark_enabled ? 'enabled' : 'disabled'));
        
        // 使用与原始转换相同的方法
        $compression_method = isset($options['compression_method']) ? $options['compression_method'] : 'auto';
        $use_imagick = false;
        if ($compression_method === 'imagick' && extension_loaded('imagick')) {
            $use_imagick = true;
        } elseif ($compression_method === 'auto' && extension_loaded('imagick')) {
            $use_imagick = true;
        }
        
        error_log('WebP Optimizer Watermark: Using ' . ($use_imagick ? 'ImageMagick' : 'GD'));
        
        try {
            if ($use_imagick) {
                $result = $this->apply_watermarks_imagick($image_path, $options, $watermark_enabled, $username_watermark_enabled);
            } else {
                $result = $this->apply_watermarks_gd($image_path, $options, $watermark_enabled, $username_watermark_enabled);
            }
            
            if ($result['success']) {
                error_log('WebP Optimizer Watermark: Successfully applied watermarks');
            } else {
                error_log('WebP Optimizer Watermark Error: ' . $result['error']);
            }
        } catch (Exception $e) {
            $result['error'] = $e->getMessage();
            error_log('WebP Optimizer Watermark Exception: ' . $result['error']);
        }
        
        return $result;
    }
    
    /**
     * 使用ImageMagick应用水印（支持双水印）
     */
    private function apply_watermarks_imagick($image_path, $options, $watermark_enabled, $username_watermark_enabled) {
        $result = array('success' => false, 'error' => '');
        
        try {
            $image = new \Imagick($image_path);
            $image_width = $image->getImageWidth();
            $image_height = $image->getImageHeight();
            
            // 应用常规水印
            if ($watermark_enabled) {
                $watermark_type = isset($options['watermark_type']) ? $options['watermark_type'] : 'text';
                $opacity = isset($options['watermark_opacity']) ? intval($options['watermark_opacity']) : 50;
                $positions = isset($options['watermark_positions']) ? $options['watermark_positions'] : array('5');
                
                foreach ($positions as $position) {
                    if ($watermark_type === 'text') {
                        $this->apply_text_watermark_imagick($image, $options, $opacity, $position, $image_width, $image_height);
                    } else {
                        $this->apply_image_watermark_imagick($image, $options, $opacity, $position, $image_width, $image_height);
                    }
                }
            }
            
            // 应用用户名水印
            if ($username_watermark_enabled) {
                $username_opacity = isset($options['username_watermark_opacity']) ? intval($options['username_watermark_opacity']) : 70;
                $username_positions = isset($options['username_watermark_positions']) ? $options['username_watermark_positions'] : array('7');
                
                foreach ($username_positions as $position) {
                    $this->apply_username_watermark_imagick($image, $options, $username_opacity, $position, $image_width, $image_height);
                }
            }
            
            // 应用全局无损压缩选项
            if (!empty($options['webp_lossless'])) {
                $image->setOption('webp:lossless', 'true');
                $image->setOption('webp:quality', '100');
            } else {
                // 应用高级WebP优化选项
                $image->setOption('webp:method', '6'); // 默认使用最高质量方法
                
                // 滤镜强度
                if (isset($options['webp_filter_strength'])) {
                    $filter_strength = intval($options['webp_filter_strength']);
                    $image->setOption('webp:filter-strength', (string)$filter_strength);
                }
                
                // 滤镜锐度
                if (isset($options['webp_filter_sharpness'])) {
                    $filter_sharpness = intval($options['webp_filter_sharpness']);
                    if ($filter_sharpness > 0) {
                        $image->setOption('webp:filter-sharpness', (string)$filter_sharpness);
                    }
                }
                
                // 透明度质量
                $alpha_quality = isset($options['webp_alpha_quality']) ? intval($options['webp_alpha_quality']) : 100;
                $image->setOption('webp:alpha-quality', (string)$alpha_quality);
                
                // 透明度滤镜
                if (isset($options['webp_alpha_filtering']) && $options['webp_alpha_filtering'] !== 'auto') {
                    $alpha_filtering = $options['webp_alpha_filtering'];
                    switch ($alpha_filtering) {
                        case 'none':
                            $image->setOption('webp:alpha-filtering', '0');
                            break;
                        case 'fast':
                            $image->setOption('webp:alpha-filtering', '1');
                            break;
                        case 'best':
                            $image->setOption('webp:alpha-filtering', '2');
                            break;
                    }
                }
                
                // 预处理滤镜
                if (isset($options['webp_preprocessing'])) {
                    $preprocessing = $options['webp_preprocessing'];
                    $image->setOption('webp:preprocessing', $preprocessing);
                }
                
                // 压缩段数
                if (isset($options['webp_segments'])) {
                    $segments = intval($options['webp_segments']);
                    $image->setOption('webp:segments', (string)$segments);
                }
                
                // 分析遍数
                if (isset($options['webp_pass'])) {
                    $pass = intval($options['webp_pass']);
                    $image->setOption('webp:pass', (string)$pass);
                }
            }
            
            $image->writeImage($image_path);
            $image->destroy();
            
            $result['success'] = true;
        } catch (Exception $e) {
            $result['error'] = 'ImageMagick水印应用失败: ' . $e->getMessage();
        }
        
        return $result;
    }
    
    /**
     * 使用GD库应用水印（支持双水印）
     */
    private function apply_watermarks_gd($image_path, $options, $watermark_enabled, $username_watermark_enabled) {
        $result = array('success' => false, 'error' => '');
        
        try {
            $image = imagecreatefromwebp($image_path);
            if (!$image) {
                $result['error'] = '无法读取WebP图片';
                return $result;
            }
            
            imagealphablending($image, true);
            imagesavealpha($image, true);
            
            $image_width = imagesx($image);
            $image_height = imagesy($image);
            
            // 应用常规水印
            if ($watermark_enabled) {
                $watermark_type = isset($options['watermark_type']) ? $options['watermark_type'] : 'text';
                $opacity = isset($options['watermark_opacity']) ? intval($options['watermark_opacity']) : 50;
                $positions = isset($options['watermark_positions']) ? $options['watermark_positions'] : array('5');
                
                foreach ($positions as $position) {
                    if ($watermark_type === 'text') {
                        $this->apply_text_watermark_gd($image, $options, $opacity, $position, $image_width, $image_height);
                    } else {
                        $this->apply_image_watermark_gd($image, $options, $opacity, $position, $image_width, $image_height);
                    }
                }
            }
            
            // 应用用户名水印
            if ($username_watermark_enabled) {
                $username_opacity = isset($options['username_watermark_opacity']) ? intval($options['username_watermark_opacity']) : 70;
                $username_positions = isset($options['username_watermark_positions']) ? $options['username_watermark_positions'] : array('7');
                
                foreach ($username_positions as $position) {
                    $this->apply_username_watermark_gd($image, $options, $username_opacity, $position, $image_width, $image_height);
                }
            }
            
            // 保存图片，根据全局无损设置决定质量
            if (!empty($options['webp_lossless'])) {
                $quality = 100;
            } else {
                $quality = isset($options['webp_quality']) ? $options['webp_quality'] : 85;
            }
            
            if (imagewebp($image, $image_path, $quality)) {
                $result['success'] = true;
            } else {
                $result['error'] = 'WebP保存失败';
            }
            
            imagedestroy($image);
            
        } catch (Exception $e) {
            $result['error'] = 'GD水印应用失败: ' . $e->getMessage();
        }
        
        return $result;
    }
    
    /**
     * 处理水印文字，替换占位符
     */
    private function process_watermark_text($text) {
        if (empty($text)) return $text;
        
        // 替换 @username 为当前用户名
        if (strpos($text, '@username') !== false) {
            $current_user = wp_get_current_user();
            $username = $current_user->user_login;
            if (empty($username)) {
                $username = 'guest'; // 如果没有用户，使用默认值
            }
            $text = str_replace('@username', $username, $text);
        }
        
        return $text;
    }

    /**
     * 计算水印位置坐标（支持九宫格和精确坐标）
     */
    private function get_watermark_position($position, $image_width, $image_height, $watermark_width = 0, $watermark_height = 0, $options = null, $is_username = false) {
        // 检查是否使用精确坐标模式
        $position_mode_key = $is_username ? 'username_watermark_position_mode' : 'watermark_position_mode';
        $precise_x_key = $is_username ? 'username_watermark_precise_x' : 'watermark_precise_x';
        $precise_y_key = $is_username ? 'username_watermark_precise_y' : 'watermark_precise_y';
        
        if ($options && isset($options[$position_mode_key]) && $options[$position_mode_key] === 'precise') {
            $x = isset($options[$precise_x_key]) ? intval($options[$precise_x_key]) : 0;
            $y = isset($options[$precise_y_key]) ? intval($options[$precise_y_key]) : 0;
            
            // 确保坐标在图片范围内
            $x = max(0, min($x, $image_width - $watermark_width));
            $y = max(0, min($y, $image_height - $watermark_height));
            
            return array('x' => $x, 'y' => $y);
        }
        
        // 使用九宫格模式
        $margin = 20; // 边距
        
        switch (intval($position)) {
            case 1: // 左上
                return array('x' => $margin, 'y' => $margin);
            case 2: // 上中
                return array('x' => ($image_width - $watermark_width) / 2, 'y' => $margin);
            case 3: // 右上
                return array('x' => $image_width - $watermark_width - $margin, 'y' => $margin);
            case 4: // 左中
                return array('x' => $margin, 'y' => ($image_height - $watermark_height) / 2);
            case 5: // 中心
                return array('x' => ($image_width - $watermark_width) / 2, 'y' => ($image_height - $watermark_height) / 2);
            case 6: // 右中
                return array('x' => $image_width - $watermark_width - $margin, 'y' => ($image_height - $watermark_height) / 2);
            case 7: // 左下
                return array('x' => $margin, 'y' => $image_height - $watermark_height - $margin);
            case 8: // 下中
                return array('x' => ($image_width - $watermark_width) / 2, 'y' => $image_height - $watermark_height - $margin);
            case 9: // 右下
                return array('x' => $image_width - $watermark_width - $margin, 'y' => $image_height - $watermark_height - $margin);
            default:
                return array('x' => ($image_width - $watermark_width) / 2, 'y' => ($image_height - $watermark_height) / 2);
        }
    }
    
    /**
     * 应用用户名水印 - ImageMagick版本
     */
    private function apply_username_watermark_imagick($image, $options, $opacity, $position, $image_width, $image_height) {
        // 获取自定义文本（支持@username占位符）
        $watermark_text = isset($options['username_watermark_text']) ? $options['username_watermark_text'] : '@username';
        
        // 处理@username占位符
        if (strpos($watermark_text, '@username') !== false) {
            $current_user = wp_get_current_user();
            $username = $current_user->user_login;
            if (empty($username)) {
                $username = 'guest'; // 如果没有用户，使用默认值
            }
            $watermark_text = str_replace('@username', $username, $watermark_text);
        }
        
        error_log('WebP Optimizer: Applying username watermark: "' . $watermark_text . '"');
        
        // 获取字体设置
        $font_size = isset($options['username_watermark_font_size']) ? intval($options['username_watermark_font_size']) : 20;
        $font_family = isset($options['username_watermark_font_family']) ? $options['username_watermark_font_family'] : 'system';
        
        // 获取颜色设置
        $color = isset($options['username_watermark_color']) ? $options['username_watermark_color'] : '#ffffff';
        
        $draw = new \ImagickDraw();
        $draw->setFontSize($font_size);
        $draw->setFillColor($color);
        $draw->setFillOpacity($opacity / 100);
        $draw->setStrokeColor('#000000');
        $draw->setStrokeWidth(1);
        $draw->setStrokeOpacity($opacity / 100 * 0.8);
        
        // 设置文字编码
        $draw->setTextEncoding('UTF-8');
        
        // 尝试设置字体
        $font_path = $this->get_default_font($font_family);
        if (is_string($font_path) && file_exists($font_path)) {
            try {
                $draw->setFont($font_path);
                error_log('WebP Optimizer: Username watermark using font: ' . $font_path);
            } catch (Exception $e) {
                error_log('WebP Optimizer: Username watermark font loading failed, using default - ' . $e->getMessage());
            }
        } else {
            error_log('WebP Optimizer: Username watermark using ImageMagick default font');
        }
        
        // 获取文字尺寸以便准确定位
        try {
            $metrics = $image->queryFontMetrics($draw, $watermark_text);
            $text_width = $metrics['textWidth'];
            $text_height = $metrics['textHeight'];
        } catch (Exception $e) {
            // 如果获取字体尺寸失败，使用估算值
            $text_width = mb_strlen($watermark_text) * ($font_size * 0.7);
            $text_height = $font_size;
        }
        
        // 计算位置
        $pos_coords = $this->get_watermark_position($position, $image_width, $image_height, $text_width, $text_height, $options, true);
        
        error_log('WebP Optimizer: Username watermark position: (' . $pos_coords['x'] . ', ' . $pos_coords['y'] . ')');
        
        try {
            $image->annotateImage($draw, $pos_coords['x'], $pos_coords['y'] + $text_height, 0, $watermark_text);
            error_log('WebP Optimizer: Successfully applied username watermark with ImageMagick');
        } catch (Exception $e) {
            error_log('WebP Optimizer: Failed to apply username watermark - ' . $e->getMessage());
        }
        
        $draw->destroy();
    }
    
    /**
     * 应用用户名水印 - GD版本
     */
    private function apply_username_watermark_gd($image, $options, $opacity, $position, $image_width, $image_height) {
        // 获取自定义文本（支持@username占位符）
        $watermark_text = isset($options['username_watermark_text']) ? $options['username_watermark_text'] : '@username';
        
        // 处理@username占位符
        if (strpos($watermark_text, '@username') !== false) {
            $current_user = wp_get_current_user();
            $username = $current_user->user_login;
            if (empty($username)) {
                $username = 'guest'; // 如果没有用户，使用默认值
            }
            $watermark_text = str_replace('@username', $username, $watermark_text);
        }
        
        error_log('WebP Optimizer: Applying GD username watermark: "' . $watermark_text . '"');
        
        // 获取字体设置
        $font_size = isset($options['username_watermark_font_size']) ? intval($options['username_watermark_font_size']) : 20;
        $font_family = isset($options['username_watermark_font_family']) ? $options['username_watermark_font_family'] : 'system';
        $angle = 0;
        
        // 获取颜色设置
        $color = isset($options['username_watermark_color']) ? $options['username_watermark_color'] : '#ffffff';
        
        // 解析颜色
        $hex_color = str_replace('#', '', $color);
        $r = hexdec(substr($hex_color, 0, 2));
        $g = hexdec(substr($hex_color, 2, 2));
        $b = hexdec(substr($hex_color, 4, 2));
        
        // 创建文字颜色（带透明度）
        $text_alpha = intval(127 - ($opacity / 100) * 127);
        $text_color = imagecolorallocatealpha($image, $r, $g, $b, $text_alpha);
        $shadow_color = imagecolorallocatealpha($image, 0, 0, 0, intval($text_alpha * 0.8));
        
        // 获取字体
        $font = $this->get_default_font($font_family);
        $text_width = 0;
        $text_height = 0;
        $use_ttf = false;
        
        if (is_string($font) && file_exists($font)) {
            // 使用TTF字体
            try {
                $text_box = imagettfbbox($font_size, $angle, $font, $watermark_text);
                $text_width = abs($text_box[4] - $text_box[0]);
                $text_height = abs($text_box[5] - $text_box[1]);
                $use_ttf = true;
                error_log('WebP Optimizer: Username watermark using TTF font: ' . $font);
            } catch (Exception $e) {
                error_log('WebP Optimizer: Username watermark TTF font failed, falling back to built-in: ' . $e->getMessage());
                $use_ttf = false;
            }
        }
        
        if (!$use_ttf) {
            // 使用内置字体
            $font = min(5, max(1, intval($font_size / 12))); // 将字体大小映射到1-5
            $char_count = mb_strlen($watermark_text, 'UTF-8');
            $text_width = $char_count * ($font_size * 0.7);
            $text_height = $font_size;
            error_log('WebP Optimizer: Username watermark using built-in font ' . $font);
        }
        
        // 计算位置
        $pos_coords = $this->get_watermark_position($position, $image_width, $image_height, $text_width, $text_height, $options, true);
        
        error_log('WebP Optimizer: GD username watermark position: (' . $pos_coords['x'] . ', ' . $pos_coords['y'] . ')');
        
        // 添加阴影效果和主文字
        try {
            if ($use_ttf) {
                // 使用TTF字体
                imagettftext($image, $font_size, $angle, $pos_coords['x'] + 1, $pos_coords['y'] + $text_height + 1, $shadow_color, $font, $watermark_text);
                imagettftext($image, $font_size, $angle, $pos_coords['x'], $pos_coords['y'] + $text_height, $text_color, $font, $watermark_text);
                error_log('WebP Optimizer: Successfully applied TTF username watermark');
            } else {
                // 使用内置字体
                imagestring($image, $font, $pos_coords['x'] + 1, $pos_coords['y'] + 1, $watermark_text, $shadow_color);
                imagestring($image, $font, $pos_coords['x'], $pos_coords['y'], $watermark_text, $text_color);
                error_log('WebP Optimizer: Applied built-in font username watermark');
            }
        } catch (Exception $e) {
            error_log('WebP Optimizer: Failed to apply GD username watermark - ' . $e->getMessage());
        }
    }
    
    /**
     * 应用文字水印 - ImageMagick版本，支持中文字符
     */
    private function apply_text_watermark_imagick($image, $options, $opacity, $position, $image_width, $image_height) {
        $text = isset($options['watermark_text']) ? $options['watermark_text'] : 'CS.Yuelk.com';
        if (empty($text)) return;
        
        // 处理文字占位符
        $text = $this->process_watermark_text($text);
        
        // 确保文字使用UTF-8编码
        if (!mb_check_encoding($text, 'UTF-8')) {
            $text = mb_convert_encoding($text, 'UTF-8', 'auto');
        }
        
        error_log('WebP Optimizer: Applying text watermark: "' . $text . '" (encoding: ' . mb_detect_encoding($text) . ')');
        
        // 获取字体设置
        $font_size = isset($options['watermark_font_size']) ? intval($options['watermark_font_size']) : 24;
        $font_family = isset($options['watermark_font_family']) ? $options['watermark_font_family'] : 'system';
        
        $draw = new \ImagickDraw();
        $draw->setFontSize($font_size);
        $draw->setFillColor('#FFFFFF');
        $draw->setFillOpacity($opacity / 100);
        $draw->setStrokeColor('#000000');
        $draw->setStrokeWidth(1);
        $draw->setStrokeOpacity($opacity / 100 * 0.8);
        
        // 设置文字编码
        $draw->setTextEncoding('UTF-8');
        
        // 尝试设置字体
        $font_path = $this->get_default_font($font_family);
        if (is_string($font_path) && file_exists($font_path)) {
            try {
                $draw->setFont($font_path);
                error_log('WebP Optimizer: Using font: ' . $font_path);
            } catch (Exception $e) {
                // 字体加载失败，使用默认字体
                error_log('WebP Optimizer: 字体加载失败，使用默认字体 - ' . $e->getMessage());
                // ImageMagick 在没有设置字体的情况下会使用默认字体
            }
        } else {
            error_log('WebP Optimizer: No TTF font found, using ImageMagick default font');
        }
        
        // 获取文字尺寸以便准确定位
        try {
            $metrics = $image->queryFontMetrics($draw, $text);
            $text_width = $metrics['textWidth'];
            $text_height = $metrics['textHeight'];
            error_log('WebP Optimizer: Text dimensions: ' . $text_width . 'x' . $text_height);
        } catch (Exception $e) {
            // 如果获取字体尺寸失败，使用估算值
            error_log('WebP Optimizer: Failed to get font metrics, using estimates - ' . $e->getMessage());
            $text_width = mb_strlen($text) * ($font_size * 0.7);
            $text_height = $font_size;
        }
        
        // 计算位置
        $pos_coords = $this->get_watermark_position($position, $image_width, $image_height, $text_width, $text_height, $options);
        
        error_log('WebP Optimizer: Text position: (' . $pos_coords['x'] . ', ' . $pos_coords['y'] . ')');
        
        try {
            $image->annotateImage($draw, $pos_coords['x'], $pos_coords['y'] + $text_height, 0, $text);
            error_log('WebP Optimizer: Successfully applied text watermark with ImageMagick');
        } catch (Exception $e) {
            error_log('WebP Optimizer: Failed to apply text watermark - ' . $e->getMessage());
        }
        
        $draw->destroy();
    }
    
    /**
     * 应用文字水印 - GD版本，支持中文字符
     */
    private function apply_text_watermark_gd($image, $options, $opacity, $position, $image_width, $image_height) {
        $text = isset($options['watermark_text']) ? $options['watermark_text'] : 'CS.Yuelk.com';
        if (empty($text)) return;
        
        // 处理文字占位符
        $text = $this->process_watermark_text($text);
        
        // 确保文字使用UTF-8编码
        if (!mb_check_encoding($text, 'UTF-8')) {
            $text = mb_convert_encoding($text, 'UTF-8', 'auto');
        }
        
        error_log('WebP Optimizer: Applying GD text watermark: "' . $text . '" (encoding: ' . mb_detect_encoding($text) . ')');
        
        // 获取字体设置
        $font_size = isset($options['watermark_font_size']) ? intval($options['watermark_font_size']) : 20;
        $font_family = isset($options['watermark_font_family']) ? $options['watermark_font_family'] : 'system';
        $angle = 0;
        
        // 创建文字颜色（白色，带透明度）
        $text_alpha = intval(127 - ($opacity / 100) * 127);
        $text_color = imagecolorallocatealpha($image, 255, 255, 255, $text_alpha);
        $shadow_color = imagecolorallocatealpha($image, 0, 0, 0, intval($text_alpha * 0.8));
        
        // 获取字体
        $font = $this->get_default_font($font_family);
        $text_width = 0;
        $text_height = 0;
        $use_ttf = false;
        
        if (is_string($font) && file_exists($font)) {
            // 使用TTF字体
            try {
                $text_box = imagettfbbox($font_size, $angle, $font, $text);
                $text_width = abs($text_box[4] - $text_box[0]);
                $text_height = abs($text_box[5] - $text_box[1]);
                $use_ttf = true;
                error_log('WebP Optimizer: Using TTF font: ' . $font . ', dimensions: ' . $text_width . 'x' . $text_height);
            } catch (Exception $e) {
                error_log('WebP Optimizer: TTF font failed, falling back to built-in: ' . $e->getMessage());
                $use_ttf = false;
            }
        }
        
        if (!$use_ttf) {
            // 使用内置字体，但中文字符可能显示为方框
            $font = min(5, max(1, intval($font_size / 12))); // 将字体大小映射到1-5
            // 对于中文文本，使用UTF-8字符长度而不是字节长度
            $char_count = mb_strlen($text, 'UTF-8');
            $text_width = $char_count * ($font_size * 0.7); // 估算宽度，考虑中文字符较宽
            $text_height = $font_size;
            error_log('WebP Optimizer: Using built-in font ' . $font . ', estimated dimensions: ' . $text_width . 'x' . $text_height . ', chars: ' . $char_count);
        }
        
        // 计算位置
        $pos_coords = $this->get_watermark_position($position, $image_width, $image_height, $text_width, $text_height, $options);
        
        error_log('WebP Optimizer: GD text position: (' . $pos_coords['x'] . ', ' . $pos_coords['y'] . ')');
        
        // 添加阴影效果和主文字
        try {
            if ($use_ttf) {
                // 使用TTF字体，支持中文
                imagettftext($image, $font_size, $angle, $pos_coords['x'] + 1, $pos_coords['y'] + $text_height + 1, $shadow_color, $font, $text);
                imagettftext($image, $font_size, $angle, $pos_coords['x'], $pos_coords['y'] + $text_height, $text_color, $font, $text);
                error_log('WebP Optimizer: Successfully applied TTF text watermark');
            } else {
                // 使用内置字体，中文可能显示为方框
                imagestring($image, $font, $pos_coords['x'] + 1, $pos_coords['y'] + 1, $text, $shadow_color);
                imagestring($image, $font, $pos_coords['x'], $pos_coords['y'], $text, $text_color);
                error_log('WebP Optimizer: Applied built-in font text watermark (Chinese may not display correctly)');
            }
        } catch (Exception $e) {
            error_log('WebP Optimizer: Failed to apply GD text watermark - ' . $e->getMessage());
        }
    }
    
    /**
     * 应用图片水印 - ImageMagick版本
     */
    private function apply_image_watermark_imagick($image, $options, $opacity, $position, $image_width, $image_height) {
        $watermark_url = isset($options['watermark_image']) ? $options['watermark_image'] : '';
        if (empty($watermark_url)) {
            error_log('WebP Optimizer Watermark: No watermark image URL provided');
            return;
        }
        
        error_log('WebP Optimizer Watermark: Processing image watermark with ImageMagick: ' . $watermark_url);
        
        // 下载或获取水印图片
        $watermark_path = $this->get_watermark_image($watermark_url);
        if (!$watermark_path || !file_exists($watermark_path)) {
            error_log('WebP Optimizer Watermark: Failed to get watermark image: ' . $watermark_url);
            return;
        }
        
        try {
            $watermark = new \Imagick($watermark_path);
            // Use the newer method instead of deprecated setImageOpacity
            $watermark->evaluateImage(\Imagick::EVALUATE_MULTIPLY, $opacity / 100, \Imagick::CHANNEL_ALPHA);
            
            // 调整水印大小
            $wm_width = $watermark->getImageWidth();
            $wm_height = $watermark->getImageHeight();
            
            // 检查尺寸设置模式
            $size_mode = isset($options['watermark_image_size_mode']) ? $options['watermark_image_size_mode'] : 'ratio';
            
            // Handle legacy 'auto' mode by converting to ratio mode
            if ($size_mode === 'auto') {
                $size_mode = 'ratio';
            }
            
            if ($size_mode === 'ratio') {
                // 使用比例模式
                $ratio = isset($options['watermark_image_ratio']) ? intval($options['watermark_image_ratio']) : 4;
                $ratio_decimal = $ratio / 10; // 转换为小数，如4/10 = 0.4
                
                // 计算目标尺寸（基于图片较小的一边来保持美观）
                $target_size = min($image_width, $image_height) * $ratio_decimal;
                
                // 保持水印的宽高比进行缩放
                if ($wm_width > $wm_height) {
                    $new_width = $target_size;
                    $new_height = ($wm_height / $wm_width) * $target_size;
                } else {
                    $new_height = $target_size;
                    $new_width = ($wm_width / $wm_height) * $target_size;
                }
                
                $watermark->resizeImage($new_width, $new_height, \Imagick::FILTER_LANCZOS, 1, true);
                error_log('WebP Optimizer Watermark: Ratio resize (' . $ratio . '/10) to: ' . $new_width . 'x' . $new_height);
                
            } elseif ($size_mode === 'manual') {
                $manual_width = isset($options['watermark_image_width']) ? intval($options['watermark_image_width']) : 0;
                $manual_height = isset($options['watermark_image_height']) ? intval($options['watermark_image_height']) : 0;
                
                if ($manual_width > 0 && $manual_height > 0) {
                    // 指定了宽高，直接设置
                    $watermark->resizeImage($manual_width, $manual_height, \Imagick::FILTER_LANCZOS, 1, false);
                    error_log('WebP Optimizer Watermark: Manual resize to: ' . $manual_width . 'x' . $manual_height);
                } elseif ($manual_width > 0) {
                    // 只指定宽度，保持比例
                    $watermark->resizeImage($manual_width, 0, \Imagick::FILTER_LANCZOS, 1, true);
                    error_log('WebP Optimizer Watermark: Manual resize width to: ' . $manual_width);
                } elseif ($manual_height > 0) {
                    // 只指定高度，保持比例
                    $watermark->resizeImage(0, $manual_height, \Imagick::FILTER_LANCZOS, 1, true);
                    error_log('WebP Optimizer Watermark: Manual resize height to: ' . $manual_height);
                }
            }
            
            // 更新水印尺寸
            $wm_width = $watermark->getImageWidth();
            $wm_height = $watermark->getImageHeight();
            
            // 计算位置
            $pos_coords = $this->get_watermark_position($position, $image_width, $image_height, $wm_width, $wm_height, $options);
            
            error_log('WebP Optimizer Watermark: Applying watermark at position ' . $position . ': (' . $pos_coords['x'] . ', ' . $pos_coords['y'] . ')');
            
            $image->compositeImage($watermark, \Imagick::COMPOSITE_OVER, intval($pos_coords['x']), intval($pos_coords['y']));
            $watermark->destroy();
            
            error_log('WebP Optimizer Watermark: Successfully applied image watermark with ImageMagick');
            
            // 清理临时文件
            if (strpos($watermark_path, sys_get_temp_dir()) !== false) {
                unlink($watermark_path);
                error_log('WebP Optimizer Watermark: Cleaned up temp file: ' . $watermark_path);
            }
        } catch (Exception $e) {
            error_log('WebP Optimizer Watermark: 图片水印处理失败 - ' . $e->getMessage());
        }
    }
    
    /**
     * 应用图片水印 - GD版本
     */
    private function apply_image_watermark_gd($image, $options, $opacity, $position, $image_width, $image_height) {
        $watermark_url = isset($options['watermark_image']) ? $options['watermark_image'] : '';
        if (empty($watermark_url)) {
            error_log('WebP Optimizer Watermark: No watermark image URL provided');
            return;
        }
        
        error_log('WebP Optimizer Watermark: Processing image watermark with GD: ' . $watermark_url);
        
        // 下载或获取水印图片
        $watermark_path = $this->get_watermark_image($watermark_url);
        if (!$watermark_path || !file_exists($watermark_path)) {
            error_log('WebP Optimizer Watermark: Failed to get watermark image: ' . $watermark_url);
            return;
        }
        
        // 根据文件扩展名创建图片资源
        $watermark = $this->create_image_resource($watermark_path);
        if (!$watermark) {
            error_log('WebP Optimizer Watermark: Failed to create image resource from: ' . $watermark_path);
            return;
        }
        
        // 调整水印大小
        $wm_width = imagesx($watermark);
        $wm_height = imagesy($watermark);
        
        // 检查尺寸设置模式
        $size_mode = isset($options['watermark_image_size_mode']) ? $options['watermark_image_size_mode'] : 'ratio';
        
        // Handle legacy 'auto' mode by converting to ratio mode
        if ($size_mode === 'auto') {
            $size_mode = 'ratio';
        }
        
        if ($size_mode === 'ratio') {
            // 使用比例模式
            $ratio = isset($options['watermark_image_ratio']) ? intval($options['watermark_image_ratio']) : 4;
            $ratio_decimal = $ratio / 10; // 转换为小数，如4/10 = 0.4
            
            // 计算目标尺寸（基于图片较小的一边来保持美观）
            $target_size = min($image_width, $image_height) * $ratio_decimal;
            
            // 保持水印的宽高比进行缩放
            if ($wm_width > $wm_height) {
                $new_width = $target_size;
                $new_height = intval(($wm_height / $wm_width) * $target_size);
            } else {
                $new_height = $target_size;
                $new_width = intval(($wm_width / $wm_height) * $target_size);
            }
            
            error_log('WebP Optimizer Watermark: Ratio resize (' . $ratio . '/10) to: ' . $new_width . 'x' . $new_height);
            
            $resized_watermark = imagecreatetruecolor($new_width, $new_height);
            imagealphablending($resized_watermark, false);
            imagesavealpha($resized_watermark, true);
            imagecopyresampled($resized_watermark, $watermark, 0, 0, 0, 0, $new_width, $new_height, $wm_width, $wm_height);
            imagedestroy($watermark);
            $watermark = $resized_watermark;
            $wm_width = $new_width;
            $wm_height = $new_height;
            
        } elseif ($size_mode === 'manual') {
            $manual_width = isset($options['watermark_image_width']) ? intval($options['watermark_image_width']) : 0;
            $manual_height = isset($options['watermark_image_height']) ? intval($options['watermark_image_height']) : 0;
            
            if ($manual_width > 0 || $manual_height > 0) {
                // 计算新尺寸
                if ($manual_width > 0 && $manual_height > 0) {
                    // 指定了宽高，直接设置
                    $new_width = $manual_width;
                    $new_height = $manual_height;
                } elseif ($manual_width > 0) {
                    // 只指定宽度，保持比例
                    $new_width = $manual_width;
                    $new_height = intval(($manual_width / $wm_width) * $wm_height);
                } else {
                    // 只指定高度，保持比例
                    $new_height = $manual_height;
                    $new_width = intval(($manual_height / $wm_height) * $wm_width);
                }
                
                error_log('WebP Optimizer Watermark: Manual resize to: ' . $new_width . 'x' . $new_height);
                
                $resized_watermark = imagecreatetruecolor($new_width, $new_height);
                imagealphablending($resized_watermark, false);
                imagesavealpha($resized_watermark, true);
                imagecopyresampled($resized_watermark, $watermark, 0, 0, 0, 0, $new_width, $new_height, $wm_width, $wm_height);
                imagedestroy($watermark);
                $watermark = $resized_watermark;
                $wm_width = $new_width;
                $wm_height = $new_height;
            }
        }
        
        // 计算位置
        $pos_coords = $this->get_watermark_position($position, $image_width, $image_height, $wm_width, $wm_height, $options);
        
        error_log('WebP Optimizer Watermark: Applying watermark at position ' . $position . ': (' . $pos_coords['x'] . ', ' . $pos_coords['y'] . ')');
        
        // 应用透明度并复制到目标图片
        $this->imagecopymerge_alpha($image, $watermark, $pos_coords['x'], $pos_coords['y'], 0, 0, $wm_width, $wm_height, $opacity);
        
        imagedestroy($watermark);
        
        error_log('WebP Optimizer Watermark: Successfully applied image watermark with GD');
        
        // 清理临时文件
        if (strpos($watermark_path, sys_get_temp_dir()) !== false) {
            unlink($watermark_path);
            error_log('WebP Optimizer Watermark: Cleaned up temp file: ' . $watermark_path);
        }
    }
    
    /**
     * 获取水印图片文件路径
     */
    private function get_watermark_image($url) {
        if (empty($url)) {
            error_log('WebP Optimizer Watermark: Empty watermark URL provided');
            return false;
        }
        
        // 如果是本地路径，直接返回
        if (file_exists($url)) {
            error_log('WebP Optimizer Watermark: Using local path: ' . $url);
            return $url;
        }
        
        // 如果是WordPress媒体库的URL，转换为本地路径
        $upload_dir = wp_upload_dir();
        if (strpos($url, $upload_dir['baseurl']) === 0) {
            $local_path = str_replace($upload_dir['baseurl'], $upload_dir['basedir'], $url);
            error_log('WebP Optimizer Watermark: Converted URL to path: ' . $url . ' -> ' . $local_path);
            
            if (file_exists($local_path)) {
                error_log('WebP Optimizer Watermark: Local file found: ' . $local_path);
                return $local_path;
            } else {
                error_log('WebP Optimizer Watermark: Local file not found: ' . $local_path);
                return false;
            }
        }
        
        // 如果是外部URL，下载到临时文件
        error_log('WebP Optimizer Watermark: Downloading external URL: ' . $url);
        $temp_file = tempnam(sys_get_temp_dir(), 'watermark_');
        $image_data = wp_remote_get($url, array('timeout' => 30));
        
        if (is_wp_error($image_data)) {
            error_log('WebP Optimizer Watermark: Failed to download external URL: ' . $image_data->get_error_message());
            return false;
        }
        
        $body = wp_remote_retrieve_body($image_data);
        if (empty($body)) {
            error_log('WebP Optimizer Watermark: Empty response body from external URL');
            return false;
        }
        
        file_put_contents($temp_file, $body);
        error_log('WebP Optimizer Watermark: Downloaded to temp file: ' . $temp_file . ' (' . filesize($temp_file) . ' bytes)');
        return $temp_file;
    }
    
    /**
     * 创建图片资源（支持多种格式）
     */
    private function create_image_resource($path) {
        $info = getimagesize($path);
        if (!$info) return false;
        
        switch ($info[2]) {
            case IMAGETYPE_JPEG:
                return imagecreatefromjpeg($path);
            case IMAGETYPE_PNG:
                $image = imagecreatefrompng($path);
                imagealphablending($image, false);
                imagesavealpha($image, true);
                return $image;
            case IMAGETYPE_GIF:
                return imagecreatefromgif($path);
            case IMAGETYPE_WEBP:
                return imagecreatefromwebp($path);
            default:
                return false;
        }
    }
    
    /**
     * 获取默认字体路径，支持中文字体
     */
    private function get_default_font($font_family = 'system') {
        $font_paths = array();
        $plugin_fonts_dir = dirname(__FILE__) . '/fonts/';
        
        switch ($font_family) {
            case 'noto-cjk':
                $font_paths = array(
                    $plugin_fonts_dir . 'NotoSansCJKsc-Regular.otf', // 插件本地字体（优先）
                    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', // Linux
                    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf', // Linux alternative
                    '/System/Library/Fonts/NotoSansCJK.ttc', // macOS
                    '/Windows/Fonts/NotoSansCJK-Regular.ttc', // Windows
                );
                break;
            case 'source-han':
                $font_paths = array(
                    $plugin_fonts_dir . 'SourceHanSansSC-Regular.otf', // 插件本地字体（优先）
                    '/usr/share/fonts/opentype/source-han-sans/SourceHanSansSC-Regular.otf', // Linux
                    '/usr/share/fonts/truetype/source-han-sans/SourceHanSansSC-Regular.ttf', // Linux
                    '/System/Library/Fonts/SourceHanSansSC.ttc', // macOS
                    '/Windows/Fonts/SourceHanSansSC-Regular.ttf', // Windows
                );
                break;
            case 'microsoft-yahei':
                $font_paths = array(
                    $plugin_fonts_dir . 'msyh.ttf', // 插件本地字体（优先）
                    '/Windows/Fonts/msyh.ttf', // Windows 微软雅黑
                    '/Windows/Fonts/msyhbd.ttf', // Windows 微软雅黑粗体
                    '/usr/share/fonts/truetype/microsoft/msyh.ttf', // Linux
                );
                break;
            case 'pingfang':
                $font_paths = array(
                    $plugin_fonts_dir . 'PingFangSC-Regular.ttf', // 插件本地字体（优先）
                    '/System/Library/Fonts/PingFang.ttc', // macOS 苹方
                    '/System/Library/Fonts/PingFangSC-Regular.otf', // macOS 苹方简体
                );
                break;
            case 'wenquanyi':
                $font_paths = array(
                    $plugin_fonts_dir . 'wqy-microhei.ttf', // 插件本地字体（优先）
                    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', // Linux 文泉驿微米黑
                    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', // Linux 文泉驿正黑
                );
                break;
            case 'arial':
                $font_paths = array(
                    $plugin_fonts_dir . 'arial.ttf', // 插件本地字体（优先）
                    '/System/Library/Fonts/Arial.ttf', // macOS
                    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', // Linux
                    '/Windows/Fonts/arial.ttf', // Windows
                );
                break;
            case 'dejavu':
                $font_paths = array(
                    $plugin_fonts_dir . 'DejaVuSans.ttf', // 插件本地字体（优先）
                    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', // Linux
                    '/System/Library/Fonts/DejaVuSans.ttf', // macOS
                );
                break;
            case 'helvetica':
                $font_paths = array(
                    $plugin_fonts_dir . 'helvetica.ttf', // 插件本地字体（优先）
                    '/System/Library/Fonts/Helvetica.ttc', // macOS
                    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', // Linux fallback
                );
                break;
            case 'times':
                $font_paths = array(
                    $plugin_fonts_dir . 'times.ttf', // 插件本地字体（优先）
                    '/System/Library/Fonts/Times.ttc', // macOS
                    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf', // Linux
                    '/Windows/Fonts/times.ttf', // Windows
                );
                break;
            case 'system':
            default:
                // 系统默认：优先使用插件本地中文字体，再回退到系统字体
                $font_paths = array(
                    // 插件本地中文字体优先
                    $plugin_fonts_dir . 'NotoSansCJKsc-Regular.otf', // Noto CJK 本地
                    $plugin_fonts_dir . 'SourceHanSansSC-Regular.otf', // Source Han Sans 本地
                    $plugin_fonts_dir . 'DejaVuSans.ttf', // DejaVu Sans 本地
                    // 系统中文字体回退
                    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', // Linux Noto
                    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', // Linux 文泉驿
                    '/System/Library/Fonts/PingFang.ttc', // macOS 苹方
                    '/Windows/Fonts/msyh.ttf', // Windows 微软雅黑
                    // 系统西文字体回退
                    '/System/Library/Fonts/Arial.ttf', // macOS
                    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', // Linux
                    '/Windows/Fonts/arial.ttf', // Windows
                );
                break;
        }
        
        foreach ($font_paths as $font) {
            if (file_exists($font)) {
                error_log('WebP Optimizer: Found font: ' . $font . ' for family: ' . $font_family);
                return $font;
            }
        }
        
        error_log('WebP Optimizer: No TTF font found for family: ' . $font_family . ', using built-in font');
        // 如果找不到TTF字体，使用内置字体
        return 5; // GD内置字体编号
    }
    
    /**
     * 带透明度的图片复制函数
     */
    private function imagecopymerge_alpha($dst_im, $src_im, $dst_x, $dst_y, $src_x, $src_y, $src_w, $src_h, $pct) {
        if (!isset($pct)) return false;
        $pct /= 100;
        
        // Get image width and height
        $w = imagesx($src_im);
        $h = imagesy($src_im);
        
        // Turn alpha blending off
        imagealphablending($src_im, false);
        
        // Find the most opaque pixel in the image (the one with the smallest alpha value)
        $minalpha = 127;
        for ($x = 0; $x < $w; $x++) {
            for ($y = 0; $y < $h; $y++) {
                $alpha = (imagecolorat($src_im, $x, $y) >> 24) & 0xFF;
                if ($alpha < $minalpha) {
                    $minalpha = $alpha;
                }
            }
        }
        
        // Loop through image pixels and modify alpha for each
        for ($x = 0; $x < $w; $x++) {
            for ($y = 0; $y < $h; $y++) {
                $colorxy = imagecolorat($src_im, $x, $y);
                $alpha = ($colorxy >> 24) & 0xFF;
                
                // Calculate new alpha
                if ($minalpha !== 127) {
                    $alpha = 127 + 127 * $pct * ($alpha - 127) / (127 - $minalpha);
                } else {
                    $alpha += 127 * $pct;
                }
                
                $alphacolorxy = imagecolorallocatealpha($dst_im, ($colorxy >> 16) & 0xFF, ($colorxy >> 8) & 0xFF, $colorxy & 0xFF, $alpha);
                imagesetpixel($dst_im, $dst_x + $x, $dst_y + $y, $alphacolorxy);
            }
        }
        return true;
    }
    
    /**
     * 验证设置选项
     */
    public function validate_options($input) {
        $valid = array();
        $errors = array();
        
        // 验证启用转换选项
        $valid['enable_webp_conversion'] = isset($input['enable_webp_conversion']) ? 1 : 0;
        
        // 验证WebP质量
        if (isset($input['webp_quality'])) {
            $quality = intval($input['webp_quality']);
            if ($quality >= 1 && $quality <= 100) {
                $valid['webp_quality'] = $quality;
            } else {
                $errors[] = 'WebP质量必须在1-100之间';
                $valid['webp_quality'] = 85; // 默认值
            }
        } else {
            $valid['webp_quality'] = 85;
        }
        
        // 验证转换格式选项
        $valid['convert_jpeg'] = isset($input['convert_jpeg']) ? 1 : 0;
        $valid['convert_png'] = isset($input['convert_png']) ? 1 : 0;
        
        // 至少要选择一种格式
        if (empty($valid['convert_jpeg']) && empty($valid['convert_png'])) {
            $errors[] = '至少需要选择一种图片格式进行转换';
            $valid['convert_jpeg'] = 1; // 默认启用JPEG
        }
        
        // 验证保留原图选项
        $valid['keep_original'] = isset($input['keep_original']) ? 1 : 0;
        
        // 验证最大宽度
        if (!empty($input['max_width'])) {
            $max_width = intval($input['max_width']);
            if ($max_width >= 100) {
                $valid['max_width'] = $max_width;
            } else {
                $errors[] = '最大宽度不能小于100像素';
                $valid['max_width'] = '';
            }
        } else {
            $valid['max_width'] = '';
        }
        
        // 验证最大高度
        if (!empty($input['max_height'])) {
            $max_height = intval($input['max_height']);
            if ($max_height >= 100) {
                $valid['max_height'] = $max_height;
            } else {
                $errors[] = '最大高度不能小于100像素';
                $valid['max_height'] = '';
            }
        } else {
            $valid['max_height'] = '';
        }
        
        // 验证压缩方式
        $compression_methods = array('auto', 'gd', 'imagick');
        if (isset($input['compression_method']) && in_array($input['compression_method'], $compression_methods)) {
            $valid['compression_method'] = $input['compression_method'];
        } else {
            $valid['compression_method'] = 'auto';
        }
        
        // 验证高级WebP选项
        $valid['webp_lossless'] = isset($input['webp_lossless']) ? 1 : 0;
        
        // 验证滤镜强度
        if (isset($input['webp_filter_strength'])) {
            $filter_strength = intval($input['webp_filter_strength']);
            if ($filter_strength >= 0 && $filter_strength <= 100) {
                $valid['webp_filter_strength'] = $filter_strength;
            } else {
                $valid['webp_filter_strength'] = 60;
            }
        } else {
            $valid['webp_filter_strength'] = 60;
        }
        
        // 验证滤镜锐度
        if (isset($input['webp_filter_sharpness'])) {
            $filter_sharpness = intval($input['webp_filter_sharpness']);
            if ($filter_sharpness >= 0 && $filter_sharpness <= 7) {
                $valid['webp_filter_sharpness'] = $filter_sharpness;
            } else {
                $valid['webp_filter_sharpness'] = 0;
            }
        } else {
            $valid['webp_filter_sharpness'] = 0;
        }
        
        // 验证透明度滤镜
        $alpha_filtering_options = array('auto', 'none', 'fast', 'best');
        if (isset($input['webp_alpha_filtering']) && in_array($input['webp_alpha_filtering'], $alpha_filtering_options)) {
            $valid['webp_alpha_filtering'] = $input['webp_alpha_filtering'];
        } else {
            $valid['webp_alpha_filtering'] = 'auto';
        }
        
        // 验证透明度质量
        if (isset($input['webp_alpha_quality'])) {
            $alpha_quality = intval($input['webp_alpha_quality']);
            if ($alpha_quality >= 0 && $alpha_quality <= 100) {
                $valid['webp_alpha_quality'] = $alpha_quality;
            } else {
                $valid['webp_alpha_quality'] = 100;
            }
        } else {
            $valid['webp_alpha_quality'] = 100;
        }
        
        // 验证预处理滤镜
        $preprocessing_options = array('0', '1', '2');
        if (isset($input['webp_preprocessing']) && in_array($input['webp_preprocessing'], $preprocessing_options)) {
            $valid['webp_preprocessing'] = $input['webp_preprocessing'];
        } else {
            $valid['webp_preprocessing'] = '0';
        }
        
        // 验证压缩段数
        if (isset($input['webp_segments'])) {
            $segments = intval($input['webp_segments']);
            if ($segments >= 1 && $segments <= 4) {
                $valid['webp_segments'] = $segments;
            } else {
                $valid['webp_segments'] = 4;
            }
        } else {
            $valid['webp_segments'] = 4;
        }
        
        // 验证分析遍数
        if (isset($input['webp_pass'])) {
            $pass = intval($input['webp_pass']);
            if ($pass >= 1 && $pass <= 10) {
                $valid['webp_pass'] = $pass;
            } else {
                $valid['webp_pass'] = 1;
            }
        } else {
            $valid['webp_pass'] = 1;
        }
        
        // 验证目标文件大小
        if (!empty($input['webp_target_size'])) {
            $target_size = intval($input['webp_target_size']);
            if ($target_size >= 1000) {
                $valid['webp_target_size'] = $target_size;
            } else {
                $errors[] = '目标文件大小不能小于1000字节';
                $valid['webp_target_size'] = '';
            }
        } else {
            $valid['webp_target_size'] = '';
        }
        
        // 验证水印设置
        $valid['enable_watermark'] = isset($input['enable_watermark']) ? 1 : 0;
        
        $watermark_types = array('text', 'image');
        if (isset($input['watermark_type']) && in_array($input['watermark_type'], $watermark_types)) {
            $valid['watermark_type'] = $input['watermark_type'];
        } else {
            $valid['watermark_type'] = 'text';
        }
        
        $valid['watermark_text'] = isset($input['watermark_text']) ? sanitize_text_field($input['watermark_text']) : 'CS.Yuelk.com';
        $valid['watermark_image'] = isset($input['watermark_image']) ? esc_url_raw($input['watermark_image']) : '';
        
        // 验证字体大小
        if (isset($input['watermark_font_size'])) {
            $font_size = intval($input['watermark_font_size']);
            if ($font_size >= 10 && $font_size <= 72) {
                $valid['watermark_font_size'] = $font_size;
            } else {
                $errors[] = '字体大小必须在10-72像素之间';
                $valid['watermark_font_size'] = 24;
            }
        } else {
            $valid['watermark_font_size'] = 24;
        }
        
        // 验证字体类型
        $valid_fonts = array('system', 'noto-cjk', 'source-han', 'microsoft-yahei', 'pingfang', 'wenquanyi', 'arial', 'dejavu', 'helvetica', 'times');
        if (isset($input['watermark_font_family']) && in_array($input['watermark_font_family'], $valid_fonts)) {
            $valid['watermark_font_family'] = $input['watermark_font_family'];
        } else {
            $valid['watermark_font_family'] = 'system';
        }
        
        // 验证透明度
        if (isset($input['watermark_opacity'])) {
            $opacity = intval($input['watermark_opacity']);
            if ($opacity >= 0 && $opacity <= 100) {
                $valid['watermark_opacity'] = $opacity;
            } else {
                $errors[] = '水印透明度必须在0-100之间';
                $valid['watermark_opacity'] = 50;
            }
        } else {
            $valid['watermark_opacity'] = 50;
        }
        
        // 验证水印位置
        $valid_positions = array();
        if (isset($input['watermark_positions']) && is_array($input['watermark_positions'])) {
            foreach ($input['watermark_positions'] as $pos) {
                $pos = intval($pos);
                if ($pos >= 1 && $pos <= 9) {
                    $valid_positions[] = (string)$pos;
                }
            }
        }
        if (empty($valid_positions)) {
            $valid_positions = array('5'); // 默认中心位置
        }
        $valid['watermark_positions'] = $valid_positions;
        
        // 验证水印定位模式
        $valid['watermark_position_mode'] = isset($input['watermark_position_mode']) && in_array($input['watermark_position_mode'], array('grid', 'precise')) ? $input['watermark_position_mode'] : 'grid';
        
        // 验证精确坐标
        $valid['watermark_precise_x'] = isset($input['watermark_precise_x']) ? max(0, intval($input['watermark_precise_x'])) : 0;
        $valid['watermark_precise_y'] = isset($input['watermark_precise_y']) ? max(0, intval($input['watermark_precise_y'])) : 0;
        
        // 验证图片水印尺寸设置
        $valid['watermark_image_size_mode'] = isset($input['watermark_image_size_mode']) && in_array($input['watermark_image_size_mode'], array('ratio', 'manual', 'auto')) ? $input['watermark_image_size_mode'] : 'ratio';
        
        // Handle legacy 'auto' mode conversion
        if ($valid['watermark_image_size_mode'] === 'auto') {
            $valid['watermark_image_size_mode'] = 'ratio';
        }
        
        // 验证图片水印比例
        if (isset($input['watermark_image_ratio'])) {
            $ratio = intval($input['watermark_image_ratio']);
            if ($ratio >= 1 && $ratio <= 10) {
                $valid['watermark_image_ratio'] = $ratio;
            } else {
                $errors[] = '图片水印比例必须在1-10之间';
                $valid['watermark_image_ratio'] = 4;
            }
        } else {
            $valid['watermark_image_ratio'] = 4;
        }
        
        $valid['watermark_image_width'] = isset($input['watermark_image_width']) ? max(0, min(1000, intval($input['watermark_image_width']))) : 0;
        $valid['watermark_image_height'] = isset($input['watermark_image_height']) ? max(0, min(1000, intval($input['watermark_image_height']))) : 0;
        
        // 验证用户名水印设置
        $valid['enable_username_watermark'] = isset($input['enable_username_watermark']) ? 1 : 0;
        
        // 验证用户名水印字体大小
        if (isset($input['username_watermark_font_size'])) {
            $username_font_size = intval($input['username_watermark_font_size']);
            if ($username_font_size >= 10 && $username_font_size <= 72) {
                $valid['username_watermark_font_size'] = $username_font_size;
            } else {
                $errors[] = '用户名水印字体大小必须在10-72像素之间';
                $valid['username_watermark_font_size'] = 20;
            }
        } else {
            $valid['username_watermark_font_size'] = 20;
        }
        
        // 验证用户名水印字体类型
        if (isset($input['username_watermark_font_family']) && in_array($input['username_watermark_font_family'], $valid_fonts)) {
            $valid['username_watermark_font_family'] = $input['username_watermark_font_family'];
        } else {
            $valid['username_watermark_font_family'] = 'system';
        }
        
        // 验证用户名水印透明度
        if (isset($input['username_watermark_opacity'])) {
            $username_opacity = intval($input['username_watermark_opacity']);
            if ($username_opacity >= 0 && $username_opacity <= 100) {
                $valid['username_watermark_opacity'] = $username_opacity;
            } else {
                $errors[] = '用户名水印透明度必须在0-100之间';
                $valid['username_watermark_opacity'] = 70;
            }
        } else {
            $valid['username_watermark_opacity'] = 70;
        }
        
        // 验证用户名水印定位模式
        $valid['username_watermark_position_mode'] = isset($input['username_watermark_position_mode']) && in_array($input['username_watermark_position_mode'], array('grid', 'precise')) ? $input['username_watermark_position_mode'] : 'grid';
        
        // 验证用户名水印位置
        $valid_username_positions = array();
        if (isset($input['username_watermark_positions']) && is_array($input['username_watermark_positions'])) {
            foreach ($input['username_watermark_positions'] as $pos) {
                $pos = intval($pos);
                if ($pos >= 1 && $pos <= 9) {
                    $valid_username_positions[] = (string)$pos;
                }
            }
        }
        if (empty($valid_username_positions)) {
            $valid_username_positions = array('7'); // 默认左下位置
        }
        $valid['username_watermark_positions'] = $valid_username_positions;
        
        // 验证用户名水印精确坐标
        $valid['username_watermark_precise_x'] = isset($input['username_watermark_precise_x']) ? max(0, intval($input['username_watermark_precise_x'])) : 20;
        $valid['username_watermark_precise_y'] = isset($input['username_watermark_precise_y']) ? max(0, intval($input['username_watermark_precise_y'])) : 20;
        
        // 验证用户名水印颜色
        if (isset($input['username_watermark_color']) && preg_match('/^#[a-fA-F0-9]{6}$/', $input['username_watermark_color'])) {
            $valid['username_watermark_color'] = $input['username_watermark_color'];
        } else {
            $valid['username_watermark_color'] = '#ffffff'; // 默认白色
        }
        
        // 验证用户名水印自定义文本
        if (isset($input['username_watermark_text']) && !empty(trim($input['username_watermark_text']))) {
            $valid['username_watermark_text'] = sanitize_text_field($input['username_watermark_text']);
        } else {
            $valid['username_watermark_text'] = '@username'; // 默认使用用户名占位符
        }
        
        // 检查系统支持
        if ($valid['compression_method'] === 'imagick' && !extension_loaded('imagick')) {
            $errors[] = 'ImageMagick未安装，已自动切换为GD库';
            $valid['compression_method'] = 'gd';
        }
        
        if ($valid['compression_method'] === 'gd' && !extension_loaded('gd')) {
            $errors[] = 'GD库未安装，WebP转换将不可用';
        }
        
        // 显示错误信息
        if (!empty($errors)) {
            add_settings_error(
                $this->option_name,
                'webp_optimizer_validation_error',
                '设置保存时发现以下问题：' . implode('；', $errors),
                'error'
            );
        } else {
            add_settings_error(
                $this->option_name,
                'webp_optimizer_validation_success',
                '设置保存成功！',
                'updated'
            );
        }
        
        return $valid;
    }
}

// 初始化插件
new WebPOptimizer();
?>