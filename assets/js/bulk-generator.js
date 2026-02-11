/**
 * Bulk Video Generator v2.4
 * Processes a queue of posts, generating videos one-by-one using the same engine as the single-post converter.
 * Runs entirely in the browser — no server-side processing.
 */

const canvas = document.getElementById('btv-canvas');
if (!canvas) { console.log('[BTV-Bulk] No canvas on this page'); }
const ctx = canvas ? canvas.getContext('2d') : null;
const W = 1280, H = 720, FPS = 24;

// UI
const selectAllBtn = document.getElementById('btv-select-all');
const selectNoneBtn = document.getElementById('btv-select-none');
const selectNoVideoBtn = document.getElementById('btv-select-novideo');
const selectOutdatedBtn = document.getElementById('btv-select-outdated');
const checkAll = document.getElementById('btv-check-all');
const bulkBtn = document.getElementById('btv-bulk-generate');
const selectedCountEl = document.getElementById('btv-selected-count');
const bulkProgress = document.getElementById('btv-bulk-progress');
const bulkStatus = document.getElementById('btv-bulk-status');
const bulkCounter = document.getElementById('btv-bulk-counter');
const bulkBar = document.getElementById('btv-bulk-bar');
const bulkCurrent = document.getElementById('btv-bulk-current');

const checkboxes = document.querySelectorAll('.btv-post-check');

// ========== SELECTION LOGIC ==========

function updateCount() {
    const checked = document.querySelectorAll('.btv-post-check:checked').length;
    if (selectedCountEl) selectedCountEl.textContent = checked;
    if (bulkBtn) bulkBtn.disabled = checked === 0;
}

if (selectAllBtn) selectAllBtn.addEventListener('click', () => { checkboxes.forEach(c => c.checked = true); updateCount(); });
if (selectNoneBtn) selectNoneBtn.addEventListener('click', () => { checkboxes.forEach(c => c.checked = false); updateCount(); });
if (selectNoVideoBtn) selectNoVideoBtn.addEventListener('click', () => {
    checkboxes.forEach(c => { c.checked = c.closest('tr').dataset.hasVideo === '0'; }); updateCount();
});
if (selectOutdatedBtn) selectOutdatedBtn.addEventListener('click', () => {
    checkboxes.forEach(c => { c.checked = c.closest('tr').dataset.isOutdated === '1'; }); updateCount();
});
if (checkAll) checkAll.addEventListener('change', () => { checkboxes.forEach(c => c.checked = checkAll.checked); updateCount(); });
checkboxes.forEach(c => c.addEventListener('change', updateCount));

// ========== THEME ==========
const T = {
    pri: '#6c63ff', sec: '#ff6b6b', acc: '#ffcc00', bg: '#0f0c29', txt: '#ffffff',
    fH: 'Arial, sans-serif', fB: 'Arial, sans-serif'
};
const CC = ['#6c63ff', '#ff6b6b', '#ffcc00', '#2ed573', '#1e90ff', '#ff6348', '#a29bfe', '#55efc4'];

function adj(hex, a) { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map(c => c + c).join(''); let r = parseInt(hex.substr(0, 2), 16) || 0, g = parseInt(hex.substr(2, 2), 16) || 0, b = parseInt(hex.substr(4, 2), 16) || 0; return `rgb(${Math.min(255, Math.max(0, r + a))},${Math.min(255, Math.max(0, g + a))},${Math.min(255, Math.max(0, b + a))})`; }
function rgba(hex, a) { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map(c => c + c).join(''); return `rgba(${parseInt(hex.substr(0, 2), 16) || 0},${parseInt(hex.substr(2, 2), 16) || 0},${parseInt(hex.substr(4, 2), 16) || 0},${a})`; }
function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// ========== DRAWING (same as converter.js, simplified) ==========
function wrapT(t, x, y, mw, lh) { const w = t.split(' '); let l = ''; const ls = []; for (const v of w) { const tt = l + v + ' '; if (ctx.measureText(tt).width > mw && l) { ls.push(l.trim()); l = v + ' '; } else l = tt; } ls.push(l.trim()); const sy = y - ((ls.length - 1) * lh) / 2; for (let i = 0; i < ls.length; i++)ctx.fillText(ls[i], x, sy + i * lh); }
function wrapL(t, x, y, mw, lh) { const w = t.split(' '); let l = '', ly = y; for (const v of w) { const tt = l + v + ' '; if (ctx.measureText(tt).width > mw && l) { ctx.fillText(l.trim(), x, ly); l = v + ' '; ly += lh; } else l = tt; } ctx.fillText(l.trim(), x, ly); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
function loadImg(u) { return new Promise(r => { if (!u) return r(null); const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => r(i); i.onerror = () => r(null); i.src = u; }); }

function drawIntro(p, s) { const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8); g.addColorStop(0, adj(T.bg, 40)); g.addColorStop(1, T.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((Math.sin(p * 2 + i * 0.7) * 0.5 + 0.5) * W, (Math.cos(p * 2 + i * 0.7) * 0.5 + 0.5) * H, 2, 0, Math.PI * 2); ctx.fillStyle = rgba(T.pri, 0.1); ctx.fill(); } const al = ease(Math.min(1, p * 2.5)); ctx.globalAlpha = al; ctx.fillStyle = T.txt; ctx.font = `bold 72px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.siteName, W / 2, H / 2 - 30); ctx.font = `24px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.6); ctx.fillText(s.siteDesc, W / 2, H / 2 + 30); ctx.font = `18px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.4); ctx.fillText(s.siteUrl, W / 2, H / 2 + 65); ctx.globalAlpha = 1; }
function drawTitle(p, s, img) { if (img) { ctx.filter = 'blur(12px) brightness(0.35)'; ctx.drawImage(img, -20, -20, W + 40, H + 40); ctx.filter = 'none'; } else { ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H); } ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H); const al = ease(Math.min(1, p * 2)); ctx.globalAlpha = al; ctx.fillStyle = T.txt; ctx.font = `bold 56px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; wrapT(s.title, W / 2, H / 2, W - 180, 68); ctx.globalAlpha = 1; }
function drawContent(p, s, img) { if (img) { const sc = 1.05 + p * 0.1; ctx.drawImage(img, -(W * sc - W) / 2, -(H * sc - H) / 2, W * sc, H * sc); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); } else { ctx.fillStyle = adj(T.bg, 20); ctx.fillRect(0, 0, W, H); } ctx.fillStyle = rgba(T.pri, 0.9); rr(30, 25, 130, 40, 20); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold 16px ${T.fB}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${s.sceneNumber}/${s.totalScenes}`, 95, 46); const bH = 190, bY = H - bH - 25; ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(35, bY, W - 70, bH, 14); ctx.fill(); ctx.fillStyle = T.pri; ctx.fillRect(35, bY, W - 70, 3); const ch = Math.floor(ease(Math.min(1, p * 1.3)) * s.text.length); ctx.fillStyle = T.txt; ctx.font = `24px ${T.fB}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; wrapL(s.text.substring(0, ch), 60, bY + 20, W - 140, 34); }
function drawTakeaway(p, s) { ctx.fillStyle = T.sec; ctx.fillRect(0, 0, W, H); const al = ease(Math.min(1, p * 2.5)); ctx.globalAlpha = al; ctx.fillStyle = '#fff'; ctx.font = `bold 32px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; wrapT(s.text, W / 2, H / 2, W - 200, 44); ctx.globalAlpha = 1; }
function drawOutro(p, s) { ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H); const al = ease(Math.min(1, p * 2)); ctx.globalAlpha = al; ctx.fillStyle = T.txt; ctx.font = `bold 48px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Thanks for Watching!', W / 2, H / 2 - 70); ctx.fillStyle = T.pri; ctx.fillRect(W / 2 - 80, H / 2 - 25, 160, 3); ctx.font = `26px ${T.fB}`; ctx.fillStyle = rgba(T.pri, 0.8); wrapT('"' + s.title + '"', W / 2, H / 2 + 20, W - 200, 34); ctx.font = `bold 24px ${T.fB}`; ctx.fillStyle = T.acc; ctx.fillText('Read at ' + s.siteUrl, W / 2, H / 2 + 90); ctx.globalAlpha = 1; }
function drawFade(fp) { ctx.fillStyle = `rgba(0,0,0,${fp})`; ctx.fillRect(0, 0, W, H); }

// ========== GENERATE ONE POST ==========
async function generateForPost(postData) {
    const d = postData;
    const site = btvBulk.site_name || 'Website';
    const siteUrl = btvBulk.site_url || '';
    const siteDesc = btvBulk.site_description || '';
    const imgs = [d.post_image, ...(d.content_images || [])].filter(Boolean);

    // Build scenes
    const scenes = [];
    scenes.push({ type: 'intro', duration: 4, siteName: site, siteDesc, siteUrl });
    scenes.push({ type: 'title', duration: 4, title: d.post_title, image: imgs[0] || null, siteName: site });
    const paras = d.paragraphs || [];
    if (paras.length > 0) {
        paras.forEach((t, i) => scenes.push({ type: 'content', duration: 5, text: t, sceneNumber: i + 1, totalScenes: paras.length, image: imgs[(i + 1) % Math.max(imgs.length, 1)] || null }));
    } else {
        scenes.push({ type: 'content', duration: 8, text: d.post_excerpt || d.post_title, sceneNumber: 1, totalScenes: 1, image: imgs[0] || null });
    }
    scenes.push({ type: 'takeaway', duration: 4, text: d.post_excerpt || paras[0] || d.post_title, siteName: site });
    scenes.push({ type: 'outro', duration: 4, siteName: site, siteUrl, title: d.post_title });

    // Min 30s
    let tot = scenes.reduce((s, v) => s + v.duration, 0);
    if (tot < 30) { const cs = scenes.filter(s => s.type === 'content'); const e = Math.ceil((30 - tot) / Math.max(cs.length, 1)); cs.forEach(s => { s.duration += e; }); }

    // Load images
    const imgMap = new Map();
    for (const s of scenes) { if (s.image) { const i = await loadImg(s.image); if (i) imgMap.set(s.image, i); else s.image = null; } }

    const totDur = scenes.reduce((s, v) => s + v.duration, 0);
    const totFrames = totDur * FPS;
    const FADE = Math.floor(FPS * 0.4);

    const stream = canvas.captureStream(FPS);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8', videoBitsPerSecond: 3000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    rec.start(200);

    let fi = 0;
    const fInt = 1000 / FPS;

    for (const s of scenes) {
        const sf = s.duration * FPS;
        const img = s.image ? imgMap.get(s.image) : null;
        for (let f = 0; f < sf; f++) {
            const p = f / sf;
            ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            switch (s.type) {
                case 'intro': drawIntro(p, s); break;
                case 'title': drawTitle(p, s, img); break;
                case 'content': drawContent(p, s, img); break;
                case 'takeaway': drawTakeaway(p, s); break;
                case 'outro': drawOutro(p, s); break;
            }
            if (f < FADE) drawFade(1 - f / FADE);
            if (f > sf - FADE) drawFade((f - (sf - FADE)) / FADE);
            fi++;
            await new Promise(r => setTimeout(r, fInt));
        }
    }

    await new Promise(r => setTimeout(r, 300));
    rec.stop();
    await new Promise(r => { rec.onstop = r; });

    const blob = new Blob(chunks, { type: 'video/webm' });

    // Upload
    const fd = new FormData();
    fd.append('action', 'btv_upload_video');
    fd.append('nonce', btvBulk.nonce);
    fd.append('post_id', d.post_id);
    fd.append('video', blob, 'blog-video-' + d.post_id + '.webm');
    const res = await fetch(btvBulk.ajaxurl, { method: 'POST', body: fd });
    const json = await res.json();
    if (!json.success) throw new Error(json.data || 'Upload failed');
    return blob.size;
}

// ========== BULK QUEUE ==========

if (bulkBtn) {
    bulkBtn.addEventListener('click', async () => {
        const selected = Array.from(document.querySelectorAll('.btv-post-check:checked')).map(c => ({
            id: parseInt(c.value),
            row: c.closest('tr'),
        }));

        if (selected.length === 0) return;
        if (!confirm(`Generate videos for ${selected.length} posts?\n\nThis will run in the background. Keep this tab open.`)) return;

        bulkBtn.disabled = true;
        bulkProgress.style.display = 'block';
        let completed = 0, failed = 0;

        for (let i = 0; i < selected.length; i++) {
            const item = selected[i];
            const title = item.row.querySelector('td:nth-child(2) a')?.textContent || `Post ${item.id}`;
            bulkStatus.textContent = `Processing ${i + 1} of ${selected.length}...`;
            bulkCounter.textContent = `${completed} done / ${failed} failed`;
            bulkBar.value = Math.round((i / selected.length) * 100);
            bulkCurrent.textContent = `🎬 ${title}`;

            try {
                // Fetch post data
                const fd = new FormData();
                fd.append('action', 'btv_get_post_data');
                fd.append('nonce', btvBulk.bulk_nonce);
                fd.append('post_id', item.id);
                const res = await fetch(btvBulk.ajaxurl, { method: 'POST', body: fd });
                const json = await res.json();
                if (!json.success) throw new Error(json.data || 'Failed to get post data');

                // Generate video
                const size = await generateForPost(json.data);
                completed++;

                // Update UI
                const statusCell = item.row.querySelector('.btv-status-cell');
                if (statusCell) statusCell.innerHTML = '<span style="color:#27ae60;">✅ Generated</span><br><small style="color:#999;">just now</small>';
                item.row.dataset.hasVideo = '1';
                item.row.dataset.isOutdated = '0';
            } catch (e) {
                console.error(`Failed for post ${item.id}:`, e);
                failed++;
                const statusCell = item.row.querySelector('.btv-status-cell');
                if (statusCell) statusCell.innerHTML = `<span style="color:#e74c3c;">❌ Failed</span><br><small>${e.message}</small>`;
            }
        }

        bulkBar.value = 100;
        bulkStatus.textContent = `✅ Complete! ${completed} generated, ${failed} failed.`;
        bulkCounter.textContent = `${completed} / ${selected.length}`;
        bulkCurrent.textContent = '';
        bulkBtn.disabled = false;
    });
}
