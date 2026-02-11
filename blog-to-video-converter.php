<?php
/**
 * Plugin Name: Blog to Video Converter
 * Plugin URI: https://www.linkedin.com/in/silasantosh
 * Description: Converts blog posts into stunning videos with website branding, storyline, charts, and stock media.
 * Version: S 1.0.0
 * Author: Sila Santosh Kumar
 * Author URI: https://www.linkedin.com/in/silasantosh
 * License: GPLv2 or later
 * Text Domain: blog-to-video
 */

if (!defined('ABSPATH'))
	exit;

define('BTV_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BTV_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once BTV_PLUGIN_DIR . 'includes/class-video-uploader.php';
require_once BTV_PLUGIN_DIR . 'includes/class-frontend-display.php';
require_once BTV_PLUGIN_DIR . 'includes/class-settings-page.php';
require_once BTV_PLUGIN_DIR . 'includes/class-bulk-generator.php';
require_once BTV_PLUGIN_DIR . 'includes/class-analytics.php';
require_once BTV_PLUGIN_DIR . 'includes/class-admin-features.php';
require_once BTV_PLUGIN_DIR . 'includes/class-compliance.php';

class Blog_To_Video_Converter
{

	public function __construct()
	{
		add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
		add_filter('script_loader_tag', array($this, 'add_type_attribute'), 10, 3);
		add_action('add_meta_boxes', array($this, 'add_video_meta_box'));
		new BTV_Video_Uploader();
		new BTV_Frontend_Display();
		new BTV_Settings_Page();
		new BTV_Bulk_Generator();
		new BTV_Analytics();
		new BTV_Admin_Features();
		new BTV_Compliance();
	}

	public function enqueue_admin_scripts($hook)
	{
		global $post;
		if (!$post || ('post.php' !== $hook && 'post-new.php' !== $hook))
			return;

		wp_enqueue_style('btv-admin-styles', BTV_PLUGIN_URL . 'assets/css/styles.css', array(), '1.0.0');
		wp_enqueue_script('btv-media-engine', BTV_PLUGIN_URL . 'assets/js/media-engine.js', array(), '1.0.0', true);
		wp_enqueue_script('btv-admin-script', BTV_PLUGIN_URL . 'assets/js/converter.js', array('btv-media-engine'), '1.0.0', true);

		// Images from content
		$content_images = array();
		if (preg_match_all('/<img[^>]+src=[\'"]([^\'"]+)[\'"][^>]*>/i', $post->post_content, $m)) {
			$content_images = array_values(array_unique($m[1]));
		}

		// Image data with alt text
		$image_data = array();
		if (preg_match_all('/<img[^>]+src=[\'"]([^\'"]+)[\'"](?:[^>]*alt=[\'"]([^\'"]*)[\'"])?[^>]*>/i', $post->post_content, $im, PREG_SET_ORDER)) {
			foreach ($im as $m) {
				$image_data[] = array('src' => $m[1], 'alt' => isset($m[2]) ? $m[2] : '');
			}
		}

		// Paragraphs
		$raw = wp_strip_all_tags($post->post_content);
		$raw = preg_replace('/\s+/', ' ', $raw);
		$sents = preg_split('/(?<=[.!?])\s+/', $raw, -1, PREG_SPLIT_NO_EMPTY);
		$paragraphs = array();
		$chunk = '';
		foreach ($sents as $i => $s) {
			$chunk .= $s . ' ';
			if (($i + 1) % 2 === 0 || $i === count($sents) - 1) {
				$t = trim($chunk);
				if (strlen($t) > 10)
					$paragraphs[] = $t;
				$chunk = '';
			}
		}
		$paragraphs = array_slice($paragraphs, 0, 8);

		// Table data for charts
		$chart_data = array();
		if (preg_match_all('/<table[^>]*>(.*?)<\/table>/is', $post->post_content, $tbl)) {
			foreach ($tbl[1] as $th) {
				$rows = array();
				if (preg_match_all('/<tr[^>]*>(.*?)<\/tr>/is', $th, $rm)) {
					foreach ($rm[1] as $rh) {
						$cells = array();
						if (preg_match_all('/<t[dh][^>]*>(.*?)<\/t[dh]>/is', $rh, $cm)) {
							foreach ($cm[1] as $c)
								$cells[] = wp_strip_all_tags(trim($c));
						}
						if (!empty($cells))
							$rows[] = $cells;
					}
				}
				if (count($rows) >= 2)
					$chart_data[] = array('type' => 'table', 'rows' => $rows);
			}
		}

		// Extract percentages & numbers
		$stats = array();
		$txt = wp_strip_all_tags($post->post_content);
		if (preg_match_all('/(\d+(?:\.\d+)?)\s*%\s+(?:of\s+)?([a-zA-Z ]{2,30})/i', $txt, $pm, PREG_SET_ORDER)) {
			foreach ($pm as $m)
				$stats[] = array('value' => floatval($m[1]), 'label' => trim($m[2]), 'unit' => '%');
		}
		if (preg_match_all('/\$?([\d,]+(?:\.\d+)?)\s*([KMBkmb]?)\s+([a-zA-Z ]{2,25})/i', $txt, $nm, PREG_SET_ORDER)) {
			foreach ($nm as $m) {
				$v = floatval(str_replace(',', '', $m[1]));
				$su = strtoupper($m[2]);
				if ($su === 'K')
					$v *= 1000;
				elseif ($su === 'M')
					$v *= 1000000;
				elseif ($su === 'B')
					$v *= 1000000000;
				$l = trim($m[3]);
				$dup = false;
				foreach ($stats as $s) {
					if ($s['label'] === $l) {
						$dup = true;
						break;
					}
				}
				if (!$dup && $v > 0)
					$stats[] = array('value' => $v, 'label' => $l, 'unit' => '');
			}
		}
		$stats = array_slice($stats, 0, 8);

		// Theme colors & fonts
		$ts = array('primary' => '', 'secondary' => '', 'background' => '', 'text' => '', 'accent' => '', 'fontHeading' => '', 'fontBody' => '');
		if (function_exists('wp_get_global_styles')) {
			$col = wp_get_global_styles(array('color'));
			if (!empty($col['text']))
				$ts['text'] = $col['text'];
			if (!empty($col['background']))
				$ts['background'] = $col['background'];
			$ty = wp_get_global_styles(array('typography'));
			if (!empty($ty['fontFamily']))
				$ts['fontBody'] = $ty['fontFamily'];
		}
		if (empty($ts['primary'])) {
			$hc = get_theme_mod('header_textcolor', '');
			if ($hc && $hc !== 'blank')
				$ts['primary'] = '#' . ltrim($hc, '#');
			$bg = get_background_color();
			if ($bg)
				$ts['background'] = '#' . ltrim($bg, '#');
		}
		if (function_exists('wp_get_global_settings')) {
			$pal = wp_get_global_settings(array('color', 'palette', 'theme'));
			if (is_array($pal))
				foreach ($pal as $p) {
					$sl = $p['slug'] ?? '';
					$cl = $p['color'] ?? '';
					if (strpos($sl, 'primary') !== false && empty($ts['primary']))
						$ts['primary'] = $cl;
					if (strpos($sl, 'secondary') !== false && empty($ts['secondary']))
						$ts['secondary'] = $cl;
					if (strpos($sl, 'accent') !== false && empty($ts['accent']))
						$ts['accent'] = $cl;
				}
			$fts = wp_get_global_settings(array('typography', 'fontFamilies', 'theme'));
			if (is_array($fts) && count($fts) > 0) {
				$ts['fontHeading'] = $fts[0]['fontFamily'] ?? '';
				if (count($fts) > 1)
					$ts['fontBody'] = $fts[1]['fontFamily'] ?? $fts[0]['fontFamily'] ?? '';
			}
		}

		wp_localize_script('btv-admin-script', 'btvData', array(
			'ajaxurl' => admin_url('admin-ajax.php'),
			'nonce' => wp_create_nonce('btv_video_upload'),
			'post_id' => $post->ID,
			'post_title' => get_the_title($post->ID),
			'post_image' => get_the_post_thumbnail_url($post->ID, 'full') ?: '',
			'post_excerpt' => get_the_excerpt($post->ID) ?: wp_trim_words($post->post_content, 30, '...'),
			'paragraphs' => $paragraphs,
			'content_images' => $content_images,
			'image_data' => $image_data,
			'chart_data' => $chart_data,
			'stats' => $stats,
			'site_name' => get_bloginfo('name'),
			'site_url' => home_url(),
			'site_description' => get_bloginfo('description'),
			'theme_style' => $ts,
			'api_keys' => array(
				'pexels' => get_option('btv_pexels_key', ''),
				'pixabay' => get_option('btv_pixabay_key', ''),
			),
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
		$post_types = get_post_types(array('public' => true));
		foreach ($post_types as $pt) {
			add_meta_box('btv_video_box', __('🎬 Blog to Video', 'blog-to-video'), array($this, 'render_meta_box'), $pt, 'side', 'high');
		}
	}

	public function render_meta_box($post)
	{
		$video_id = get_post_meta($post->ID, '_blog_video_id', true);
		$video_url = $video_id ? wp_get_attachment_url($video_id) : '';
		$outdated = get_post_meta($post->ID, '_btv_post_updated_after_video', true);
?>
		<div class="btv-container">
			<?php if ($video_url): ?>
				<div class="btv-existing">
					<p><strong>✅ Current Video:</strong></p>
					<video src="<?php echo esc_url($video_url); ?>" controls style="max-width:100%; border-radius:8px;"></video>
				</div>
				<?php if ($outdated): ?>
					<div style="margin:10px 0; padding:10px; background:#fff3cd; border:1px solid #ffc107; border-radius:6px; font-size:13px;">
						⚠️ <strong>Video outdated!</strong> This post was updated after the video was generated.
						Click <em>Generate Video</em> to create an updated version.
					</div>
				<?php
			endif; ?>
				<hr style="margin:12px 0;">
			<?php
		endif; ?>

			<div class="btv-controls">
				<button type="button" id="btv-generate-btn" class="button button-primary button-large" style="width:100%;">
					🎬 <?php _e('Generate Video', 'blog-to-video'); ?>
				</button>
				<p class="description" style="margin-top:6px; font-size:11px;">Uses your post content, images, charts & branding.</p>
				<?php
		$k1 = get_option('btv_pexels_key');
		$k2 = get_option('btv_pixabay_key');
		if (!$k1 && !$k2): ?>
					<p style="margin-top:8px; font-size:11px; color:#d63638;">
						⚠️ <strong>Tip:</strong> <a href="options-general.php?page=btv-settings" target="_blank">Add API Keys</a> to use stock videos/images!
					</p>
				<?php
		endif; ?>
			</div>

			<div id="btv-progress-container" style="display:none; margin-top:12px;">
				<div id="btv-status" style="font-weight:bold; color:#2271b1; margin-bottom:6px;">Initializing...</div>
				<div id="btv-scene-label" style="font-size:11px; color:#666; margin-bottom:4px;"></div>
				<progress id="btv-progress" value="0" max="100" style="width:100%; height:22px;"></progress>
				<div style="display:flex; justify-content:space-between; font-size:11px; color:#888; margin-top:4px;">
					<span id="btv-percent">0%</span>
					<span id="btv-eta">Calculating...</span>
				</div>
			</div>

			<div id="btv-preview-section" style="display:none; margin-top:14px;">
				<p><strong>🎥 Preview Your Video:</strong></p>
				<video id="btv-preview-player" controls style="max-width:100%; border-radius:8px; border:2px solid #6c63ff;"></video>
				<div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
					<button type="button" id="btv-upload-btn" class="button button-primary" style="flex:1;">📤 Use This Video</button>
					<button type="button" id="btv-download-btn" class="button" style="flex:1;">💾 Download</button>
				</div>
				<button type="button" id="btv-regenerate-btn" class="button" style="width:100%; margin-top:6px;">🔄 Regenerate</button>
			</div>

			<canvas id="btv-canvas" width="1280" height="720" style="display:none;"></canvas>

			<?php if (get_option('btv_show_branding', 1)): ?>
				<div class="btv-branding" style="margin-top:20px; padding:12px; background:#f6f6f7; border-radius:6px; font-size:12px;">
					<p style="margin:0 0 8px 0;"><strong>Hi!</strong> I built this plugin to help you create amazing videos. If you find it useful, consider supporting my work!</p>
					<div style="display:flex; justify-content:space-between; align-items:center;">
						<span>By <a href="https://www.linkedin.com/in/silasantosh" target="_blank">Sila Santosh Kumar</a> | <a href="https://github.com/silasantosh/blog-to-video-converter" target="_blank">GitHub</a></span>
						<a href="https://atgfoundation.org/donate/" target="_blank" class="button button-small btv-donate-btn" style="background:#6c63ff; border:none; color:#fff;">❤️ Support</a>
					</div>
				</div>
			<?php
		endif; ?>
		</div>
		<?php
	}
}

register_activation_hook(__FILE__, array('BTV_Analytics', 'create_table'));
new Blog_To_Video_Converter();
