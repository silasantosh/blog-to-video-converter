/**
 * BTV Media Engine
 * Handles stock media fetching (Pexels/Pixabay) and smart audio selection.
 */

const MediaEngine = {

    // API Keys (populated from btvData)
    perpelsKey: '',
    pixabayKey: '',

    init(keys) {
        this.pexelsKey = keys.pexels || '';
        this.pixabayKey = keys.pixabay || '';
    },

    async getStockMedia(query, type = 'image') {
        // Try Pexels first if key exists
        if (this.pexelsKey) {
            try {
                const url = type === 'video'
                    ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
                    : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;

                const res = await fetch(url, { headers: { Authorization: this.pexelsKey } });
                const json = await res.json();

                if (type === 'video' && json.videos && json.videos.length > 0) {
                    const videoFiles = json.videos[0].video_files;
                    // Find best fit 720p or similar
                    const best = videoFiles.find(f => f.width >= 1280) || videoFiles[0];
                    return best.link;
                } else if (type === 'image' && json.photos && json.photos.length > 0) {
                    return json.photos[0].src.large2x;
                }
            } catch (e) {
                console.warn('Pexels fetch failed:', e);
            }
        }

        // Fallback to Pixabay
        if (this.pixabayKey) {
            try {
                const q = encodeURIComponent(query);
                const url = type === 'video'
                    ? `https://pixabay.com/api/videos/?key=${this.pixabayKey}&q=${q}&per_page=3`
                    : `https://pixabay.com/api/?key=${this.pixabayKey}&q=${q}&per_page=3&image_type=photo&orientation=horizontal`;

                const res = await fetch(url);
                const json = await res.json();

                if (type === 'video' && json.hits && json.hits.length > 0) {
                    return json.hits[0].videos.medium.url;
                } else if (type === 'image' && json.hits && json.hits.length > 0) {
                    return json.hits[0].largeImageURL;
                }
            } catch (e) {
                console.warn('Pixabay fetch failed:', e);
            }
        }

        return null;
    },

    // Audio selection based on keywords
    selectAudioTrack(text) {
        const t = text.toLowerCase();

        // Define tracks and their keywords
        const tracks = [
            { name: 'Upbeat', file: 'upbeat.mp3', keywords: ['fun', 'happy', 'joy', 'exciting', 'party', 'celebrate', 'win'] },
            { name: 'Corporate', file: 'corporate.mp3', keywords: ['business', 'finance', 'money', 'office', 'work', 'market'] },
            { name: 'Cinematic', file: 'cinematic.mp3', keywords: ['movie', 'film', 'epic', 'story', 'journey', 'history'] },
            { name: 'Relaxing', file: 'relaxing.mp3', keywords: ['peace', 'calm', 'nature', 'yoga', 'health', 'meditate'] },
            { name: 'Tech', file: 'tech.mp3', keywords: ['technology', 'computer', 'code', 'ai', 'robot', 'future', 'science'] }
        ];

        // Default
        let startFile = 'ambient.mp3';
        let maxScore = 0;

        tracks.forEach(track => {
            let score = 0;
            track.keywords.forEach(k => {
                if (t.includes(k)) score++;
            });
            if (score > maxScore) {
                maxScore = score;
                startFile = track.file;
            }
        });

        return startFile;
    }
};

window.BTVMediaEngine = MediaEngine;
