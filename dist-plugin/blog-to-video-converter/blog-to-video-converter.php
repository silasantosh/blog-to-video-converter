<?php
/**
 * Plugin Name: Blog to Video Converter
 * Plugin URI: https://example.com/
 * Description: Automatically converts blog posts into video content using HTML5 Canvas and MediaRecorder API.
 * Version: 1.0.0
 * Author: Antigravity
 * Author URI: https://example.com/
 * License: GPLv2 or later
 * Text Domain: blog-to-video
 */

if (!defined('ABSPATH')) {
	exit;
}

define('BTV_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BTV_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include required files
require_once BTV_PLUGIN_DIR . 'includes/class-video-uploader.php';
require_once BTV_PLUGIN_DIR . 'includes/class-frontend-display.php';

class Blog_To_Video_Converter
{

	public function __construct()
	{
		// COOP and COEP headers are required for FFmpeg.wasm - shared memory
		add_action('send_headers', array($this, 'add_coop_coep_headers'));

		add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
		add_filter('script_loader_tag', array($this, 'add_type_attribute'), 10, 3);
		add_action('add_meta_boxes', array($this, 'add_video_meta_box'));

		// Initialize helper classes
		new BTV_Video_Uploader();
		new BTV_Frontend_Display();
	}

	public function add_coop_coep_headers()
	{
		if (is_admin()) {
			header('Cross-Origin-Opener-Policy: same-origin');
			header('Cross-Origin-Embedder-Policy: require-corp');
		}
	}

	public function enqueue_admin_scripts($hook)
	{
		// Only load on post edit screens
		global $post;
		if (!$post || ('post.php' !== $hook && 'post-new.php' !== $hook)) {
			return;
		}

		wp_enqueue_style('btv-admin-styles', BTV_PLUGIN_URL . 'assets/css/styles.css', array(), '1.1.0');

		// Enqueue module script
		wp_enqueue_script('btv-admin-script', BTV_PLUGIN_URL . 'assets/js/converter.js', array(), '1.1.0', true);

		// Localize script with data
		wp_localize_script('btv-admin-script', 'btvData', array(
			'ajaxurl' => admin_url('admin-ajax.php'),
			'nonce' => wp_create_nonce('btv_video_upload'),
			'post_id' => $post->ID,
			'post_title' => get_the_title($post->ID),
			'post_image' => get_the_post_thumbnail_url($post->ID, 'full') ?: '',
			'post_excerpt' => get_the_excerpt($post->ID) ?: wp_trim_words($post->post_content, 20),
			'post_content_full' => wp_strip_all_tags($post->post_content),
		));
	}

	public function add_type_attribute($tag, $handle, $src)
	{
		if ('btv-admin-script' === $handle) {
			$tag = '<script type="module" src="' . esc_url($src) . '"></script>';
		}
		return $tag;
	}

	public function add_video_meta_box()
	{
		add_meta_box(
			'btv_video_box',
			__('Blog to Video', 'blog-to-video'),
			array($this, 'render_meta_box'),
			'post',
			'side',
			'high'
		);
	}

	public function render_meta_box($post)
	{
		$video_id = get_post_meta($post->ID, '_blog_video_id', true);
		$video_url = $video_id ? wp_get_attachment_url($video_id) : '';
?>
		<div class="btv-container">
			<?php if ($video_url): ?>
				<div class="btv-preview">
					<p><strong><?php _e('Existing Video:', 'blog-to-video'); ?></strong></p>
					<video src="<?php echo esc_url($video_url); ?>" controls style="max-width:100%;"></video>
				</div>
			<?php
		endif; ?>

			<div class="btv-controls">
				<button type="button" id="btv-generate-btn" class="button button-primary button-large">
					<?php _e('Generate Video', 'blog-to-video'); ?>
				</button>
				<div id="btv-progress-container" style="display:none; margin-top:10px;">
					<div id="btv-status"><?php _e('Initializing...', 'blog-to-video'); ?></div>
					<progress id="btv-progress" value="0" max="100" style="width:100%;"></progress>
				</div>
			</div>
			
			<!-- Hidden Canvas for Processing -->
			<canvas id="btv-canvas" width="1280" height="720" style="display:none; border:1px solid #ccc;"></canvas>
		</div>
		<?php
	}
}

new Blog_To_Video_Converter();
