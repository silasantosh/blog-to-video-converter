<?php

if (!defined('ABSPATH')) {
    exit;
}

class BTV_Frontend_Display
{

    public function __construct()
    {
        add_filter('the_content', array($this, 'prepend_video_to_content'));
    }

    public function prepend_video_to_content($content)
    {
        // Only show on single posts and if it's the main query
        if (!is_single() || !in_the_loop() || !is_main_query()) {
            return $content;
        }

        global $post;
        $video_id = get_post_meta($post->ID, '_blog_video_id', true);

        if ($video_id) {
            $video_url = wp_get_attachment_url($video_id);
            if ($video_url) {
                $video_html = '<div class="btv-post-video" style="margin-bottom: 20px;">';
                $video_html .= '<video controls style="width:100%; height:auto;">';
                $video_html .= '<source src="' . esc_url($video_url) . '" type="video/webm">';
                $video_html .= 'Your browser does not support the video tag.';
                $video_html .= '</video>';
                $video_html .= '</div>';

                return $video_html . $content;
            }
        }

        return $content;
    }
}
