/**
 * Video Analytics Dashboard Script
 * Fetches data via AJAX and renders stats, charts, and tables.
 */

document.addEventListener('DOMContentLoaded', () => {
    const rangeSelect = document.getElementById('btv-range');
    const refreshBtn = document.getElementById('btv-refresh');
    const chartCanvas = document.getElementById('btv-trend-chart');
    const ctx = chartCanvas ? chartCanvas.getContext('2d') : null;

    if (!rangeSelect || !refreshBtn) return;

    function fetchAnalytics() {
        const range = rangeSelect.value;
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Loading...';

        const fd = new FormData();
        fd.append('action', 'btv_get_analytics');
        fd.append('nonce', btvDash.nonce);
        fd.append('range', range);

        fetch(btvDash.ajaxurl, { method: 'POST', body: fd })
            .then(res => res.json())
            .then(json => {
                if (json.success) {
                    renderStats(json.data);
                    renderChart(json.data.daily);
                    renderTopPosts(json.data.top_posts);
                } else {
                    console.error('Analytics Error:', json.data);
                }
            })
            .catch(err => console.error(err))
            .finally(() => {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Refresh';
            });
    }

    function renderStats(data) {
        // Summary counts
        document.getElementById('stat-total-videos').textContent = data.total_videos;
        document.getElementById('stat-views').textContent = formatNum(data.summary.view);
        document.getElementById('stat-plays').textContent = formatNum(data.summary.play);
        document.getElementById('stat-completions').textContent = formatNum(data.summary.complete);
        document.getElementById('stat-skips').textContent = formatNum(data.summary.skip);
        document.getElementById('stat-cta').textContent = formatNum(data.summary.cta_click);
        document.getElementById('stat-outdated').textContent = data.outdated;
        document.getElementById('stat-replays').textContent = formatNum(data.summary.replay);

        // Rates
        document.getElementById('rate-engagement').textContent = data.eng_rate + '%';
        document.getElementById('rate-completion').textContent = data.completion_rate + '%';
        document.getElementById('rate-conversion').textContent = data.conversion_rate + '%';
        document.getElementById('rate-skip').textContent = data.skip_rate + '%';
    }

    function renderTopPosts(posts) {
        const tbody = document.getElementById('btv-top-tbody');
        tbody.innerHTML = '';
        if (posts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No data yet.</td></tr>';
            return;
        }

        posts.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><a href="post.php?post=${p.post_id}&action=edit" target="_blank">${p.title}</a></td>
                <td>${formatNum(p.views)}</td>
                <td>${formatNum(p.plays)}</td>
                <td>${formatNum(p.completions)}</td>
                <td>${formatNum(p.cta_clicks)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderChart(dailyData) {
        if (!ctx) return;
        const W = chartCanvas.width;
        const H = chartCanvas.height;
        ctx.clearRect(0, 0, W, H);

        if (dailyData.length === 0) {
            ctx.fillStyle = '#666'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('No play data for this period.', W / 2, H / 2);
            return;
        }

        // Process data into Views vs Plays
        const dates = [...new Set(dailyData.map(d => d.day))];
        const viewsMap = {}, playsMap = {};
        dailyData.forEach(d => {
            if (d.event_type === 'view') viewsMap[d.day] = parseInt(d.cnt);
            if (d.event_type === 'play') playsMap[d.day] = parseInt(d.cnt);
        });
        const views = dates.map(d => viewsMap[d] || 0);
        const plays = dates.map(d => playsMap[d] || 0);

        const maxVal = Math.max(...views, ...plays, 5);
        const padding = 40;
        const chartW = W - padding * 2;
        const chartH = H - padding * 2;

        // Draw Axes
        ctx.beginPath();
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
        ctx.moveTo(padding, padding); ctx.lineTo(padding, H - padding); // Y
        ctx.lineTo(W - padding, H - padding); // X
        ctx.stroke();

        // Draw Line function
        const drawLine = (data, color) => {
            ctx.beginPath();
            ctx.strokeStyle = color; ctx.lineWidth = 3;
            const stepX = chartW / (Math.max(data.length, 2) - 1);
            data.forEach((val, i) => {
                const x = padding + i * stepX;
                const y = H - padding - (val / maxVal) * chartH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                // Dot
                ctx.fillStyle = color; ctx.fillRect(x - 3, y - 3, 6, 6);
            });
            ctx.stroke();
        };

        if (dates.length > 1) {
            drawLine(views, '#6c63ff'); // Blue for Views
            drawLine(plays, '#27ae60'); // Green for Plays
        } else {
            // Single point - draw bar
            const x = W / 2;
            const vH = (views[0] / maxVal) * chartH;
            const pH = (plays[0] / maxVal) * chartH;
            ctx.fillStyle = '#6c63ff'; ctx.fillRect(x - 20, H - padding - vH, 15, vH);
            ctx.fillStyle = '#27ae60'; ctx.fillRect(x + 5, H - padding - pH, 15, pH);
        }

        // Legend
        ctx.fillStyle = '#6c63ff'; ctx.fillRect(W - 200, 20, 15, 15);
        ctx.fillStyle = '#333'; ctx.fillText('Views', W - 180, 32);
        ctx.fillStyle = '#27ae60'; ctx.fillRect(W - 120, 20, 15, 15);
        ctx.fillStyle = '#333'; ctx.fillText('Plays', W - 100, 32);
    }

    function formatNum(n) {
        return new Intl.NumberFormat().format(n || 0);
    }

    // Init
    refreshBtn.addEventListener('click', fetchAnalytics);
    rangeSelect.addEventListener('change', fetchAnalytics);
    fetchAnalytics();
});
