/**
 * Blog to Video Tracker
 * Tracks video engagement events: view, play, pause, complete, cta_click.
 */

(function () {
    const videoContainers = document.querySelectorAll('.btv-post-video');
    if (videoContainers.length === 0) return;

    const endpoint = btvTracker.ajaxurl;
    const postId = btvTracker.post_id;

    function track(eventType, extra = '') {
        if (!endpoint || !postId) return;
        const fd = new FormData();
        fd.append('action', 'btv_track_event');
        fd.append('post_id', postId);
        fd.append('event_type', eventType);
        fd.append('extra', extra);
        navigator.sendBeacon ? navigator.sendBeacon(endpoint, fd) : fetch(endpoint, { method: 'POST', body: fd, keepalive: true });
    }

    // View tracking (IntersectionObserver)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const vid = entry.target.querySelector('video');
                if (vid && !vid.dataset.viewed) {
                    vid.dataset.viewed = 'true';
                    track('view');
                }
            }
        });
    }, { threshold: 0.5 });

    videoContainers.forEach(container => {
        const video = container.querySelector('video');
        if (!video) return;

        // View
        observer.observe(container);

        // Play
        video.addEventListener('play', () => {
            if (!video.dataset.played) {
                video.dataset.played = 'true';
                track('play');
            }
        });

        // Pause (if not ended)
        video.addEventListener('pause', () => {
            if (!video.ended && video.currentTime > 1) {
                track('pause', `Time: ${Math.round(video.currentTime)}s`);
            }
        });

        // Ended (Complete)
        video.addEventListener('ended', () => {
            track('complete');
            // Show replay overlay if not already there
            let overlay = container.querySelector('.btv-replay-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'btv-replay-overlay';
                overlay.innerHTML = `
                    <div class="btv-overlay-content">
                        <button class="btv-replay-btn">🔄 Replay</button>
                        <a href="${window.location.href}" class="btv-cta-btn">🔗 Read Article</a>
                    </div>
                `;
                container.appendChild(overlay);
                container.style.position = 'relative';

                overlay.querySelector('.btv-replay-btn').onclick = () => {
                    video.play();
                    overlay.style.display = 'none';
                    track('replay');
                };
                overlay.querySelector('.btv-cta-btn').onclick = () => {
                    track('cta_click');
                };
            }
            overlay.style.display = 'flex';
        });

        // seeked (Skip)
        let lastTime = 0;
        video.addEventListener('timeupdate', () => {
            if (Math.abs(video.currentTime - lastTime) > 2) {
                // Seek detected
                if (video.currentTime > lastTime) {
                    track('skip', `Seek: ${Math.round(lastTime)}s -> ${Math.round(video.currentTime)}s`);
                }
            }
            lastTime = video.currentTime;
        });
    });

    // CSS for overlay
    const style = document.createElement('style');
    style.innerHTML = `
        .btv-replay-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center;
            border-radius: 8px; z-index: 10;
        }
        .btv-overlay-content { text-align: center; }
        .btv-replay-btn, .btv-cta-btn {
            display: inline-block; margin: 10px; padding: 10px 20px;
            background: #fff; color: #333; text-decoration: none;
            border-radius: 25px; font-weight: bold; border: none; cursor: pointer;
            transition: transform 0.2s;
        }
        .btv-replay-btn:hover, .btv-cta-btn:hover { transform: scale(1.05); }
        .btv-cta-btn { background: #6c63ff; color: #fff; }
    `;
    document.head.appendChild(style);

})();
