<?php

if (!defined('ABSPATH')) {
    exit;
}

class BTV_Video_Uploader
{

    public function __construct()
    {
        add_action('wp_ajax_btv_upload_video', array($this, 'handle_upload'));
    }

    public function handle_upload()
    {
        check_ajax_referer('btv_video_upload', 'nonce');

        if (!current_user_can('edit_posts')) {
            wp_send_json_error('Permission denied');
        }

        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        if (!$post_id) {
            wp_send_json_error('Invalid Post ID');
        }

        if (empty($_FILES['video'])) {
            wp_send_json_error('No video file received');
        }

        // Handle file upload
        $file = $_FILES['video'];

        // Use wp_handle_upload to save the file
        $upload_overrides = array('test_form' => false);
        $movefile = wp_handle_upload($file, $upload_overrides);

        if ($movefile && !isset($movefile['error'])) {
            // File is uploaded successfully.
            $filename = $movefile['file'];
            $filetype = wp_check_filetype(basename($filename), null);

            $attachment = array(
                'post_mime_type' => $filetype['type'],
                'post_title' => 'Video for Post ' . $post_id,
                'post_content' => '',
                'post_status' => 'inherit'
            );

            $attach_id = wp_insert_attachment($attachment, $filename, $post_id);

            // Generate attachment metadata (thumbnails, etc)
            require_once(ABSPATH . 'wp-admin/includes/image.php');
            $attach_data = wp_generate_attachment_metadata($attach_id, $filename);
            wp_update_attachment_metadata($attach_id, $attach_data);

            // Save the attachment ID to the post meta
            update_post_meta($post_id, '_blog_video_id', $attach_id);
            update_post_meta($post_id, '_blog_video_url', $movefile['url']);

            wp_send_json_success(array('url' => $movefile['url'], 'id' => $attach_id));
        }
        else {
            // Handle error
            $error_msg = isset($movefile['error']) ? $movefile['error'] : 'Unknown upload error';
            wp_send_json_error($error_msg);
        }
    }
}
