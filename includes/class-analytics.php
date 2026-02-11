<?php
/**
 * Video Analytics Dashboard v2.6
 * Tracks: views, plays, completions, skips, CTA clicks.
 * Displays stats on a dedicated admin dashboard page.
 * Includes CSV/Excel export.
 */

if (!defined('ABSPATH'))
    exit;

class BTV_Analytics
{

    private $table_name;

    public function __construct()
    {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'btv_analytics';

        add_action('admin_menu', array($this, 'add_dashboard_page'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_dashboard_scripts'));
        add_action('admin_post_btv_export_csv', array($this, 'handle_csv_export'));

        // Public-facing tracking
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_tracking'));
        add_action('wp_ajax_btv_track_event', array($this, 'track_event'));
        add_action('wp_ajax_nopriv_btv_track_event', array($this, 'track_event'));

        // AJAX for dashboard data
        add_action('wp_ajax_btv_get_analytics', array($this, 'ajax_get_analytics'));
    }

    public static function create_table()
    {
        global $wpdb;
        $table = $wpdb->prefix . 'btv_analytics';
        $charset = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS $table (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			post_id BIGINT(20) UNSIGNED NOT NULL,
			event_type VARCHAR(30) NOT NULL,
			event_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			user_ip VARCHAR(45) DEFAULT '',
			user_agent VARCHAR(255) DEFAULT '',
			extra TEXT DEFAULT '',
			PRIMARY KEY (id),
			KEY post_id (post_id),
			KEY event_type (event_type),
			KEY event_date (event_date)
		) $charset;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    public function track_event()
    {
        global $wpdb;
        $post_id = intval($_POST['post_id'] ?? 0);
        $event_type = sanitize_text_field($_POST['event_type'] ?? '');
        $extra = sanitize_text_field($_POST['extra'] ?? '');
        $allowed = array('view', 'play', 'complete', 'skip', 'cta_click', 'pause', 'replay');
        if (!$post_id || !in_array($event_type, $allowed))
            wp_send_json_error('Invalid event');

        $wpdb->insert($this->table_name, array(
            'post_id' => $post_id,
            'event_type' => $event_type,
            'event_date' => current_time('mysql'),
            'user_ip' => $this->get_user_ip(),
            'user_agent' => substr(sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            'extra' => $extra,
        ));
        wp_send_json_success();
    }

    private function get_user_ip()
    {
        $ip = '';
        if (!empty($_SERVER['HTTP_CLIENT_IP']))
            $ip = $_SERVER['HTTP_CLIENT_IP'];
        elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR']))
            $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
        else
            $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        return sanitize_text_field($ip);
    }

    public function enqueue_frontend_tracking()
    {
        if (!is_singular())
            return;

        $post_type = get_post_type();
        $public_types = get_post_types(array('public' => true));
        if (!in_array($post_type, $public_types))
            return;

        global $post;
        $video_id = get_post_meta($post->ID, '_blog_video_id', true);
        if (!$video_id)
            return;
        wp_enqueue_script('btv-tracker', BTV_PLUGIN_URL . 'assets/js/tracker.js', array(), '2.6.0', true);
        wp_localize_script('btv-tracker', 'btvTracker', array('ajaxurl' => admin_url('admin-ajax.php'), 'post_id' => $post->ID));
    }

    public function add_dashboard_page()
    {
        add_menu_page('Video Analytics', 'Video Analytics', 'manage_options', 'btv-analytics', array($this, 'render_dashboard'), 'dashicons-chart-area', 30);
    }

    public function enqueue_dashboard_scripts($hook)
    {
        if ('toplevel_page_btv-analytics' !== $hook)
            return;
        wp_enqueue_style('btv-dashboard-css', BTV_PLUGIN_URL . 'assets/css/dashboard.css', array(), '1.0.0');
        wp_enqueue_script('btv-dashboard-js', BTV_PLUGIN_URL . 'assets/js/dashboard.js', array(), '1.0.0', true);
        wp_localize_script('btv-dashboard-js', 'btvDash', array('ajaxurl' => admin_url('admin-ajax.php'), 'nonce' => wp_create_nonce('btv_analytics_nonce')));
    }

    public function ajax_get_analytics()
    {
        check_ajax_referer('btv_analytics_nonce', 'nonce');
        if (!current_user_can('manage_options'))
            wp_send_json_error('Permission denied');

        global $wpdb;
        $t = $this->table_name;
        $range = sanitize_text_field($_POST['range'] ?? '30');
        $days = intval($range) ?: 30;
        $since = date('Y-m-d H:i:s', strtotime("-{$days} days"));

        $summary = array();
        foreach (array('view', 'play', 'complete', 'skip', 'cta_click', 'replay') as $e) {
            $summary[$e] = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE event_type = %s AND event_date >= %s", $e, $since)));
        }
        $total_videos = intval($wpdb->get_var("SELECT COUNT(DISTINCT pm.post_id) FROM {$wpdb->postmeta} pm WHERE pm.meta_key = '_blog_video_id' AND pm.meta_value != ''"));
        $outdated = intval($wpdb->get_var("SELECT COUNT(DISTINCT pm.post_id) FROM {$wpdb->postmeta} pm WHERE pm.meta_key = '_btv_post_updated_after_video' AND pm.meta_value != ''"));
        $daily = $wpdb->get_results($wpdb->prepare("SELECT DATE(event_date) as day, event_type, COUNT(*) as cnt FROM $t WHERE event_date >= %s GROUP BY day, event_type ORDER BY day ASC", $since), ARRAY_A);
        $top_posts = $wpdb->get_results($wpdb->prepare("SELECT post_id, COUNT(*) as views FROM $t WHERE event_type = 'view' AND event_date >= %s GROUP BY post_id ORDER BY views DESC LIMIT 10", $since), ARRAY_A);
        foreach ($top_posts as &$tp) {
            $tp['title'] = get_the_title($tp['post_id']) ?: 'Post #' . $tp['post_id'];
            $tp['plays'] = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE post_id = %d AND event_type = 'play' AND event_date >= %s", $tp['post_id'], $since)));
            $tp['completions'] = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE post_id = %d AND event_type = 'complete' AND event_date >= %s", $tp['post_id'], $since)));
            $tp['cta_clicks'] = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE post_id = %d AND event_type = 'cta_click' AND event_date >= %s", $tp['post_id'], $since)));
        }

        $eng_rate = $summary['view'] > 0 ? round(($summary['play'] / $summary['view']) * 100, 1) : 0;
        $completion_rate = $summary['play'] > 0 ? round(($summary['complete'] / $summary['play']) * 100, 1) : 0;
        $conversion_rate = $summary['view'] > 0 ? round(($summary['cta_click'] / $summary['view']) * 100, 1) : 0;
        $skip_rate = $summary['play'] > 0 ? round(($summary['skip'] / $summary['play']) * 100, 1) : 0;

        wp_send_json_success(array(
            'summary' => $summary, 'total_videos' => $total_videos, 'outdated' => $outdated,
            'daily' => $daily, 'top_posts' => $top_posts,
            'eng_rate' => $eng_rate, 'completion_rate' => $completion_rate, 'conversion_rate' => $conversion_rate, 'skip_rate' => $skip_rate,
        ));
    }

    public function handle_csv_export()
    {
        if (!current_user_can('manage_options'))
            wp_die('Permission Denied');
        global $wpdb;
        $t = $this->table_name;
        $range = intval($_GET['range'] ?? 30);
        $since = date('Y-m-d H:i:s', strtotime("-{$range} days"));

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=video-analytics-' . date('Y-m-d') . '.csv');
        $out = fopen('php://output', 'w');
        fputcsv($out, array('Date', 'Event Type', 'Post ID', 'Post Title', 'User IP', 'User Agent'));

        $rows = $wpdb->get_results($wpdb->prepare("SELECT event_date, event_type, post_id, user_ip, user_agent FROM $t WHERE event_date >= %s ORDER BY event_date DESC LIMIT 5000", $since));
        foreach ($rows as $r) {
            fputcsv($out, array($r->event_date, $r->event_type, $r->post_id, get_the_title($r->post_id), $r->user_ip, $r->user_agent));
        }
        fclose($out);
        exit;
    }

    public function render_dashboard()
    {
?>
		<div class="wrap btv-dashboard-wrap">
			<h1>🎬 Video Analytics Dashboard</h1>
			<p class="btv-dash-subtitle">Track video performance, engagement, and conversions.</p>

			<div class="btv-dash-controls">
				<select id="btv-range">
					<option value="7">Last 7 days</option>
					<option value="30" selected>Last 30 days</option>
					<option value="90">Last 90 days</option>
					<option value="365">Last year</option>
				</select>
				<button id="btv-refresh" class="button">🔄 Refresh</button>
				<form method="post" action="<?php echo admin_url('admin-post.php'); ?>" style="display:inline;">
					<input type="hidden" name="action" value="btv_export_csv">
					<input type="hidden" name="range" id="btv-export-range" value="30">
					<button type="submit" class="button button-primary">📥 Export Report (CSV)</button>
				</form>
			</div>

			<div class="btv-stats-grid">
				<div class="btv-stat-card btv-stat-purple"><div class="btv-stat-icon">🎬</div><div class="btv-stat-number" id="stat-total-videos">—</div><div class="btv-stat-label">Total Videos</div></div>
				<div class="btv-stat-card btv-stat-blue"><div class="btv-stat-icon">👁️</div><div class="btv-stat-number" id="stat-views">—</div><div class="btv-stat-label">Views</div></div>
				<div class="btv-stat-card btv-stat-green"><div class="btv-stat-icon">▶️</div><div class="btv-stat-number" id="stat-plays">—</div><div class="btv-stat-label">Plays</div></div>
				<div class="btv-stat-card btv-stat-teal"><div class="btv-stat-icon">✅</div><div class="btv-stat-number" id="stat-completions">—</div><div class="btv-stat-label">Completions</div></div>
				<div class="btv-stat-card btv-stat-orange"><div class="btv-stat-icon">⏭️</div><div class="btv-stat-number" id="stat-skips">—</div><div class="btv-stat-label">Skipped</div></div>
				<div class="btv-stat-card btv-stat-red"><div class="btv-stat-icon">🔗</div><div class="btv-stat-number" id="stat-cta">—</div><div class="btv-stat-label">CTA Clicks</div></div>
				<div class="btv-stat-card btv-stat-yellow"><div class="btv-stat-icon">⚠️</div><div class="btv-stat-number" id="stat-outdated">—</div><div class="btv-stat-label">Outdated</div></div>
				<div class="btv-stat-card btv-stat-pink"><div class="btv-stat-icon">🔁</div><div class="btv-stat-number" id="stat-replays">—</div><div class="btv-stat-label">Replays</div></div>
			</div>

			<div class="btv-rates-grid">
				<div class="btv-rate-card"><div class="btv-rate-value" id="rate-engagement">—</div><div class="btv-rate-label">Engagement</div><div class="btv-rate-desc">Views → Plays</div></div>
				<div class="btv-rate-card"><div class="btv-rate-value" id="rate-completion">—</div><div class="btv-rate-label">Completion</div><div class="btv-rate-desc">Plays → Finish</div></div>
				<div class="btv-rate-card"><div class="btv-rate-value" id="rate-conversion">—</div><div class="btv-rate-label">Conversion</div><div class="btv-rate-desc">Views → Click</div></div>
				<div class="btv-rate-card"><div class="btv-rate-value" id="rate-skip">—</div><div class="btv-rate-label">Skip Rate</div><div class="btv-rate-desc">Plays → Skip</div></div>
			</div>

			<div class="btv-chart-section"><h2>📈 Daily Trend</h2><canvas id="btv-trend-chart" width="1100" height="300"></canvas></div>
			<div class="btv-top-posts-section">
				<h2>🏆 Top Performing Videos</h2>
				<table class="wp-list-table widefat fixed striped" id="btv-top-table">
					<thead><tr><th>Post</th><th style="width:100px;">Views</th><th style="width:100px;">Plays</th><th style="width:120px;">Completions</th><th style="width:110px;">CTA Clicks</th></tr></thead>
					<tbody id="btv-top-tbody"><tr><td colspan="5" style="text-align:center; color:#999;">Loading...</td></tr></tbody>
				</table>
			</div>

			<hr style="margin-top:40px;">

			<div class="btv-support-section" style="margin-top:20px; padding:20px; background:#fff; border:1px solid #ccd0d4; border-radius:8px;">
				<h2>❤️ Support the Creator</h2>
				<p>Hi! I built this plugin to help you create amazing videos. If you find it useful, consider supporting my work!</p>
					<a href="https://atgfoundation.org/donate/" target="_blank" class="button button-primary" style="background-color: #6c63ff; border-color: #6c63ff;">Donate to ATG Foundation</a>
					&nbsp;
					<a href="https://github.com/silasantosh/blog-to-video-converter" target="_blank" class="button">GitHub Repo</a>
					&nbsp;
					<a href="https://www.linkedin.com/in/silasantosh" target="_blank" class="button">LinkedIn</a>
				</p>
			</div>
		</div>
		<script>
		document.getElementById('btv-range').addEventListener('change', function() {
			document.getElementById('btv-export-range').value = this.value;
		});
		</script>
		<?php
    }
}
