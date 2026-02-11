<?php
/**
 * BTV Compliance & Transparency
 * Handles the "Charity & Privacy" page and ethical disclosures.
 */

if (!defined('ABSPATH'))
	exit;

class BTV_Compliance
{

	public function __construct()
	{
		add_action('admin_menu', array($this, 'add_menu_page'));
		add_action('admin_notices', array($this, 'charity_notice'));
	}

	public function add_menu_page()
	{
		add_submenu_page(
			'options-general.php',
			'Charity & Privacy',
			'Charity & Privacy',
			'manage_options',
			'btv-compliance',
			array($this, 'render_page')
		);
	}

	/**
	 * Render the Compliance Page
	 */
	public function render_page()
	{
?>
		<div class="wrap">
			<h1>⚕️ Charity, Privacy & Transparency</h1>
			
			<div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px; margin-top:20px;">
				
				<!-- Left Column: Privacy & Standards -->
				<div>
					<div class="card" style="padding:0 20px 20px 20px; max-width:100%;">
						<h2>🔒 Privacy Policy & Data Usage</h2>
						<p>We believe in <strong>Privacy First</strong>. Here is exactly how your data is handled:</p>
						<ul style="list-style:disc; margin-left:20px;">
							<li><strong>Local Processing:</strong> Video generation happens 100% inside your browser using HTML5 Canvas. No content is sent to our servers for rendering.</li>
							<li><strong>No Tracking:</strong> We do not track your site visitors or collect personal data. The "Video Analytics" feature runs entirely on your own server (self-hosted).</li>
							<li><strong>External Calls:</strong>
								<ul style="list-style:circle; margin-left:20px; margin-top:5px;">
									<li>If you enable <a href="options-general.php?page=btv-settings">Stock Media</a>, your search keywords are sent to Pexels/Pixabay APIs to fetch images. This only happens if you add API keys.</li>
								</ul>
							</li>
						</ul>
						<p><em>This plugin allows you to be fully GDPR & DPDP Act (India) compliant.</em></p>
					</div>

					<div class="card" style="padding:0 20px 20px 20px; max-width:100%; margin-top:20px;">
						<h2>🇮🇳 Made in India</h2>
						<p>
							This plugin is proudly <strong>Built & Maintained by Developers in India</strong>.
							<br>
							We adhere to the highest standards of code quality, security, and ethics.
						</p>
					</div>

					<div class="card" style="padding:0 20px 20px 20px; max-width:100%; margin-top:20px;">
						<h2>🤝 Open Source & Ethics</h2>
						<p>
							<strong>License:</strong> GPLv2 or later (100% Free Software).<br>
							<strong>GitHub:</strong> <a href="https://github.com/silasantosh/blog-to-video-converter" target="_blank">silasantosh/blog-to-video-converter</a><br>
							<strong>Transparency:</strong> No hidden costs, no locked features, no "fake free" barriers.
						</p>
					</div>
				</div>

				<!-- Right Column: Charity -->
				<div>
					<div style="background:#fff; border:1px solid #ccd0d4; padding:20px; text-align:center; border-top:4px solid #6c63ff;">
						<h2 style="margin-top:0;">❤️ Supported by ATG HealthCare</h2>
						<p>This plugin is a free initiative supported by the <strong>ATG HealthCare Foundation</strong>.</p>
						<p>Our mission is to use technology to support healthcare initiatives for the underprivileged.</p>
						
						<hr style="margin:15px 0; border:0; border-top:1px solid #eee;">
						
						<p style="font-size:13px; color:#666;">
							<em>Plugin usage is completely free and <strong>not</strong> linked to donations.</em>
						</p>

						<a href="https://atgfoundation.org/donate/" target="_blank" class="button button-primary button-large" style="width:100%; text-align:center; justify-content:center;">
							Donate to ATG Foundation (Optional)
						</a>
						<p style="font-size:12px; margin-top:10px; color:#888;">
							Direct link to official donation page.
						</p>
					</div>
				</div>

			</div>
		</div>
		<?php
	}

	/**
	 * Unobtrusive admin notice (only once, dismissible)
	 */
	public function charity_notice()
	{
		$screen = get_current_screen();
		if (!$screen || $screen->id !== 'dashboard')
			return;

		// This serves as a gentle "Made in India" & Charity nod, compliant with WP rules
		// In a real plugin, we'd use user meta to dismiss this permanently.
		// For this demo, we'll keep it simple.
?>
		<!-- 
		<div class="notice notice-info is-dismissible">
			<p>
				<strong>Blog to Video Converter</strong> is free & open source, built in 🇮🇳 India. 
				Check out our <a href="options-general.php?page=btv-compliance">Transparency Page</a> to see how we protect privacy & support healthcare.
			</p>
		</div>
		-->
		<?php
	}
}
