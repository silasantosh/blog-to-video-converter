<?php
/**
 * Bulk Video Generator admin page.
 * Lists all posts with video status and provides queue-based bulk generation.
 */

if (!defined('ABSPATH'))
    exit;

class BTV_Bulk_Generator
{

    public function __construct()
    {
        add_action('admin_menu', array($this, 'add_menu_page'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_ajax_btv_get_post_data', array($this, 'ajax_get_post_data'));
        add_action('save_post', array($this, 'on_post_save'), 20, 2);
    }

    public function add_menu_page()
    {
        add_submenu_page(
            'options-general.php',
            'Bulk Video Generator',
            'Bulk Videos',
            'manage_options',
            'btv-bulk-generate',
            array($this, 'render_page')
        );
    }

    public function enqueue_scripts($hook)
    {
        if ('settings_page_btv-bulk-generate' !== $hook)
            return;

        wp_enqueue_style('btv-admin-styles', BTV_PLUGIN_URL . 'assets/css/styles.css', array(), '1.0.0');
        wp_enqueue_script('btv-bulk-script', BTV_PLUGIN_URL . 'assets/js/bulk-generator.js', array(), '1.0.0', true);

        wp_localize_script('btv-bulk-script', 'btvBulk', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('btv_video_upload'),
            'bulk_nonce' => wp_create_nonce('btv_bulk_nonce'),
            'site_name' => get_bloginfo('name'),
            'site_url' => home_url(),
            'site_description' => get_bloginfo('description'),
        ));
    }

    /**
     * When a post is saved/updated, mark video as outdated if it exists.
     */
    public function on_post_save($post_id, $post)
    {
        if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id))
            return;

        $public_types = get_post_types(array('public' => true));
        if (!in_array($post->post_type, $public_types))
            return;

        if ($post->post_status !== 'publish')
            return;

        $video_id = get_post_meta($post_id, '_blog_video_id', true);
        if ($video_id) {
            // Mark video as outdated by storing the last update time
            update_post_meta($post_id, '_btv_post_updated_after_video', current_time('timestamp'));
        }
    }

    /**
     * AJAX: Return post data for bulk video generation (one post at a time).
     */
    public function ajax_get_post_data()
    {
        check_ajax_referer('btv_bulk_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Permission denied');
        }

        $post_id = intval($_POST['post_id'] ?? 0);
        $post = get_post($post_id);
        if (!$post) {
            wp_send_json_error('Post not found');
        }

        // Extract the same data as the single-post editor
        $content_images = array();
        if (preg_match_all('/<img[^>]+src=[\'"]([^\'"]+)[\'"][^>]*>/i', $post->post_content, $m)) {
            $content_images = array_values(array_unique($m[1]));
        }

        $image_data = array();
        if (preg_match_all('/<img[^>]+src=[\'"]([^\'"]+)[\'"](?:[^>]*alt=[\'"]([^\'"]*)[\'"])?[^>]*>/i', $post->post_content, $im, PREG_SET_ORDER)) {
            foreach ($im as $m) {
                $image_data[] = array('src' => $m[1], 'alt' => isset($m[2]) ? $m[2] : '');
            }
        }

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

        // Tables
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

        // Stats
        $stats = array();
        $txt = wp_strip_all_tags($post->post_content);
        if (preg_match_all('/(\d+(?:\.\d+)?)\s*%\s+(?:of\s+)?([a-zA-Z ]{2,30})/i', $txt, $pm, PREG_SET_ORDER)) {
            foreach ($pm as $m)
                $stats[] = array('value' => floatval($m[1]), 'label' => trim($m[2]), 'unit' => '%');
        }
        $stats = array_slice($stats, 0, 8);

        wp_send_json_success(array(
            'post_id' => $post->ID,
            'post_title' => get_the_title($post->ID),
            'post_image' => get_the_post_thumbnail_url($post->ID, 'full') ?: '',
            'post_excerpt' => get_the_excerpt($post->ID) ?: wp_trim_words($post->post_content, 30, '...'),
            'paragraphs' => $paragraphs,
            'content_images' => $content_images,
            'image_data' => $image_data,
            'chart_data' => $chart_data,
            'stats' => $stats,
        ));
    }

    /**
     * Render the bulk generation admin page.
     */
    public function render_page()
    {
        $post_types = get_post_types(array('public' => true));
        $posts = get_posts(array(
            'post_type' => $post_types,
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'orderby' => 'date',
            'order' => 'DESC',
        ));
?>
		<div class="wrap">
			<h1>🎬 Bulk Video Generator</h1>
			<p>Generate videos for all your posts at once. Videos are created in your browser — no server cost.</p>

			<div style="margin:20px 0; padding:15px; background:#fff; border:1px solid #ccd0d4; border-left:4px solid #6c63ff;">
				<strong>How it works:</strong> Select posts below and click "Generate Selected". Videos will be created one by one in queue.
				Posts marked ⚠️ have been updated since their last video — they need regeneration.
			</div>

			<div style="margin-bottom:15px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
				<button id="btv-select-all" class="button">☑ Select All</button>
				<button id="btv-select-none" class="button">☐ Deselect All</button>
				<button id="btv-select-novideo" class="button">📭 Select Without Video</button>
				<button id="btv-select-outdated" class="button">⚠️ Select Outdated</button>
				<span style="flex:1;"></span>
				<button id="btv-bulk-generate" class="button button-primary button-large" disabled>
					🎬 Generate Selected (<span id="btv-selected-count">0</span>)
				</button>
			</div>

			<!-- Bulk progress -->
			<div id="btv-bulk-progress" style="display:none; margin:15px 0; padding:15px; background:#fff; border:1px solid #ccd0d4;">
				<div style="display:flex; justify-content:space-between; margin-bottom:8px;">
					<strong id="btv-bulk-status">Processing...</strong>
					<span id="btv-bulk-counter">0 / 0</span>
				</div>
				<progress id="btv-bulk-bar" value="0" max="100" style="width:100%; height:22px;"></progress>
				<div id="btv-bulk-current" style="font-size:12px; color:#666; margin-top:6px;"></div>
			</div>

			<table class="wp-list-table widefat fixed striped" id="btv-posts-table">
				<thead>
					<tr>
						<th style="width:40px;"><input type="checkbox" id="btv-check-all"></th>
						<th>Post Title</th>
						<th style="width:120px;">Type</th>
						<th style="width:180px;">Last Modified</th>
						<th style="width:160px;">Video Status</th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ($posts as $p):
            $vid_id = get_post_meta($p->ID, '_blog_video_id', true);
            $vid_ts = get_post_meta($p->ID, '_btv_video_generated_at', true);
            $outdated = get_post_meta($p->ID, '_btv_post_updated_after_video', true);
            $has_video = !empty($vid_id);
            $is_outdated = $has_video && !empty($outdated);

            if ($is_outdated) {
                $status = '<span style="color:#e67e22;">⚠️ Outdated</span>';
            }
            elseif ($has_video) {
                $status = '<span style="color:#27ae60;">✅ Generated</span>';
                if ($vid_ts)
                    $status .= '<br><small style="color:#999;">' . human_time_diff($vid_ts, current_time('timestamp')) . ' ago</small>';
            }
            else {
                $status = '<span style="color:#999;">No video</span>';
            }
?>
					<tr data-post-id="<?php echo $p->ID; ?>"
						data-has-video="<?php echo $has_video ? '1' : '0'; ?>"
						data-is-outdated="<?php echo $is_outdated ? '1' : '0'; ?>">
						<td><input type="checkbox" class="btv-post-check" value="<?php echo $p->ID; ?>"></td>
						<td>
							<a href="<?php echo get_edit_post_link($p->ID); ?>" target="_blank">
								<?php echo esc_html(get_the_title($p->ID)); ?>
							</a>
						</td>
						<td><?php echo ucfirst($p->post_type); ?></td>
						<td><?php echo get_the_modified_date('M j, Y g:i a', $p->ID); ?></td>
						<td class="btv-status-cell"><?php echo $status; ?></td>
					</tr>
					<?php
        endforeach; ?>
				</tbody>
			</table>

			<!-- Hidden canvas for bulk generation -->
			<canvas id="btv-canvas" width="1280" height="720" style="display:none;"></canvas>
		</div>
		<?php
    }
}
