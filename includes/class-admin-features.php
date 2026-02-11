<?php
/**
 * BTV Admin Features
 * Handles Admin Columns and Dashboard Widget.
 */

if (!defined('ABSPATH'))
    exit;

class BTV_Admin_Features
{

    public function __construct()
    {
        add_action('admin_init', array($this, 'init_columns'));
        add_action('wp_dashboard_setup', array($this, 'add_dashboard_widget'));
    }

    public function init_columns()
    {
        $post_types = get_post_types(array('public' => true), 'names');
        foreach ($post_types as $pt) {
            add_filter("manage_{$pt}_posts_columns", array($this, 'add_video_column'));
            add_action("manage_{$pt}_posts_custom_column", array($this, 'render_video_column'), 10, 2);
        }
    }

    public function add_video_column($columns)
    {
        $columns['btv_status'] = 'Video Status';
        return $columns;
    }

    public function render_video_column($column, $post_id)
    {
        if ('btv_status' !== $column)
            return;

        $video_id = get_post_meta($post_id, '_blog_video_id', true);
        $outdated = get_post_meta($post_id, '_btv_post_updated_after_video', true);

        if ($video_id) {
            if ($outdated) {
                echo '<span style="color:#e67e22; font-weight:bold;">⚠️ Outdated</span>';
            }
            else {
                echo '<span style="color:#27ae60; font-weight:bold;">✅ Generated</span>';
            }
        }
        else {
            echo '<span style="color:#999;">—</span>';
        }
    }

    public function add_dashboard_widget()
    {
        wp_add_dashboard_widget(
            'btv_dashboard_widget',
            '🎬 Video Analytics Summary',
            array($this, 'render_dashboard_widget')
        );
    }

    public function render_dashboard_widget()
    {
        global $wpdb;
        $table = $wpdb->prefix . 'btv_analytics';

        // Check if table exists
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") != $table) {
            echo '<p>No analytics data yet.</p>';
            return;
        }

        $total_videos = intval($wpdb->get_var("SELECT COUNT(DISTINCT pm.post_id) FROM {$wpdb->postmeta} pm WHERE pm.meta_key = '_blog_video_id' AND pm.meta_value != ''"));
        $views = intval($wpdb->get_var("SELECT COUNT(*) FROM $table WHERE event_type = 'view'"));
        $plays = intval($wpdb->get_var("SELECT COUNT(*) FROM $table WHERE event_type = 'play'"));
        $clicks = intval($wpdb->get_var("SELECT COUNT(*) FROM $table WHERE event_type = 'cta_click'"));

?>
		<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center;">
			<div style="background:#f0f0f1; padding:10px; border-radius:4px;">
				<div style="font-size:24px; font-weight:bold; color:#6c63ff;"><?php echo $total_videos; ?></div>
				<div style="font-size:12px; color:#666;">Videos</div>
			</div>
			<div style="background:#f0f0f1; padding:10px; border-radius:4px;">
				<div style="font-size:24px; font-weight:bold; color:#3498db;"><?php echo $views; ?></div>
				<div style="font-size:12px; color:#666;">Total Views</div>
			</div>
			<div style="background:#f0f0f1; padding:10px; border-radius:4px;">
				<div style="font-size:24px; font-weight:bold; color:#27ae60;"><?php echo $plays; ?></div>
				<div style="font-size:12px; color:#666;">Total Plays</div>
			</div>
			<div style="background:#f0f0f1; padding:10px; border-radius:4px;">
				<div style="font-size:24px; font-weight:bold; color:#e74c3c;"><?php echo $clicks; ?></div>
				<div style="font-size:12px; color:#666;">CTA Clicks</div>
			</div>
		</div>
		<p style="text-align:right; margin-top:10px;">
			<a href="<?php echo admin_url('admin.php?page=btv-analytics'); ?>" class="button button-small">View Full Report</a>
		</p>
		<?php
    }
}
