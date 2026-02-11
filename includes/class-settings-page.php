<?php

if (!defined('ABSPATH')) {
    exit;
}

class BTV_Settings_Page
{

    public function __construct()
    {
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    public function add_settings_page()
    {
        add_options_page(
            'Blog to Video Settings',
            'Blog to Video',
            'manage_options',
            'btv-settings',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings()
    {
        register_setting('btv_options_group', 'btv_pexels_key');
        register_setting('btv_options_group', 'btv_pixabay_key');
        register_setting('btv_options_group', 'btv_show_branding');
    }

    public function render_settings_page()
    {
?>
		<div class="wrap">
			<h1>Blog to Video Converter Settings</h1>
			<form method="post" action="options.php">
				<?php settings_fields('btv_options_group'); ?>
				<?php do_settings_sections('btv_options_group'); ?>
				
				<table class="form-table">
					<tr valign="top">
						<th scope="row">Pexels API Key</th>
						<td>
                            <input type="text" name="btv_pexels_key" value="<?php echo esc_attr(get_option('btv_pexels_key')); ?>" class="regular-text" />
                            <p class="description">Get your free key from <a href="https://www.pexels.com/api/" target="_blank">Pexels API</a>.</p>
                        </td>
					</tr>
					
					<tr valign="top">
						<th scope="row">Pixabay API Key</th>
						<td>
                            <input type="text" name="btv_pixabay_key" value="<?php echo esc_attr(get_option('btv_pixabay_key')); ?>" class="regular-text" />
                            <p class="description">Get your free key from <a href="https://pixabay.com/api/docs/" target="_blank">Pixabay API</a>.</p>
                        </td>
					</tr>

                    <tr valign="top">
                        <th scope="row">Show Author Branding</th>
                        <td>
                            <input type="checkbox" name="btv_show_branding" value="1" <?php checked(1, get_option('btv_show_branding'), true); ?> />
                            <p class="description">Show the "Support the Creator" section in the meta box.</p>
                        </td>
                    </tr>
				</table>
				
				<?php submit_button(); ?>
			</form>

            <hr>

            <div class="btv-support-section" style="margin-top:40px; padding:20px; background:#fff; border:1px solid #ccd0d4; border-radius:8px;">
                <h2>❤️ Support the Creator</h2>
                <p>Hi! I built this plugin to help you create amazing videos. If you find it useful, consider supporting my work!</p>
                <p>
                    <a href="https://atgfoundation.org/donate/" target="_blank" class="button button-primary" style="background-color: #6c63ff; border-color: #6c63ff;">Donate to ATG Foundation</a>
                    &nbsp;
                    <a href="https://www.linkedin.com/in/silasantosh" target="_blank" class="button">Contact & Follow on LinkedIn</a>
                </p>
                <p style="font-size:12px; color:#666; margin-top:10px;">
                    Stay connected for more updates and ethical AI tools!
                </p>
            </div>
		</div>
		<?php
    }
}
