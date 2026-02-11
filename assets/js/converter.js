/**
 * Blog to Video Converter v1.0.0
 * Speed optimized, enhanced audio, debuggable stock media.
 */

const canvas = document.getElementById('btv-canvas');
if (!canvas) throw new Error('Canvas not found');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height, FPS = 30; // Increased FPS for smoothness

const btn = document.getElementById('btv-generate-btn');
const progressContainer = document.getElementById('btv-progress-container');
const statusEl = document.getElementById('btv-status');
const sceneLabelEl = document.getElementById('btv-scene-label');
const progressBar = document.getElementById('btv-progress');
const percentEl = document.getElementById('btv-percent');
const etaEl = document.getElementById('btv-eta');
const previewSection = document.getElementById('btv-preview-section');
const previewPlayer = document.getElementById('btv-preview-player');
const uploadBtn = document.getElementById('btv-upload-btn');
const downloadBtn = document.getElementById('btv-download-btn');
const regenerateBtn = document.getElementById('btv-regenerate-btn');

let currentBlob = null;
function log(msg) { console.log('[BTV]', msg); if (statusEl) statusEl.textContent = msg; }

// ========== THEME ==========
const ts = (typeof btvData !== 'undefined' && btvData.theme_style) ? btvData.theme_style : {};
function cleanFont(r) { return r ? r.replace(/var\([^)]+\)/g, '').replace(/["']/g, '').trim() : ''; }
const T = {
    pri: ts.primary || '#6c63ff', sec: ts.secondary || '#ff6b6b',
    acc: ts.accent || '#ffcc00', bg: ts.background || '#0f0c29',
    txt: ts.text || '#ffffff',
    fH: cleanFont(ts.fontHeading) || 'Arial, sans-serif',
    fB: cleanFont(ts.fontBody) || 'Arial, sans-serif',
};
const CHART_COLORS = ['#6c63ff', '#ff6b6b', '#ffcc00', '#2ed573', '#1e90ff', '#ff6348', '#a29bfe', '#55efc4'];

function adj(hex, a) {
    hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.substr(0, 2), 16) || 0, g = parseInt(hex.substr(2, 2), 16) || 0, b = parseInt(hex.substr(4, 2), 16) || 0;
    return `rgb(${Math.min(255, Math.max(0, r + a))},${Math.min(255, Math.max(0, g + a))},${Math.min(255, Math.max(0, b + a))})`;
}
function rgba(hex, a) {
    hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return `rgba(${parseInt(hex.substr(0, 2), 16) || 0},${parseInt(hex.substr(2, 2), 16) || 0},${parseInt(hex.substr(4, 2), 16) || 0},${a})`;
}
function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

const LABELS = {
    brand_intro: '\u{1F3E0} Intro', title_card: '\u{1F4F0} Title', content: '\u{1F4DD} Content',
    image_slide: '\u{1F5BC} Image', bar_chart: '\u{1F4CA} Bar Chart', pie_chart: '\u{1F4C8} Pie Chart',
    takeaway: '\u{1F4A1} Takeaway', outro: '\u{1F44B} Outro'
};

// ========== MUSIC GENERATOR (IMPROVED) ==========
let audioCtx = null, musicDest = null;
function createMusic(dur, mood = 'ambient') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicDest = audioCtx.createMediaStreamDestination();
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.15, audioCtx.currentTime); // Slightly louder
    master.connect(musicDest);
    const now = audioCtx.currentTime;

    // Faster tempos, brighter tones
    const configs = {
        'upbeat': { tempo: 0.2, notes: [261.63, 329.63, 392, 523.25, 587.33, 783.99], type: 'square', arpSpeed: 0.12, chance: 0.4 },
        'cinematic': { tempo: 1.0, notes: [196, 261.63, 311.13, 392, 523.25], type: 'sawtooth', arpSpeed: 0.3, chance: 0.3 },
        'relaxing': { tempo: 1.5, notes: [261.63, 329.63, 392, 493.88], type: 'sine', arpSpeed: 0.4, chance: 0.3 },
        'tech': { tempo: 0.15, notes: [220, 261.63, 329.63, 440, 523.25], type: 'triangle', arpSpeed: 0.1, chance: 0.5 },
        'ambient.mp3': { tempo: 0.8, notes: [261.63, 329.63, 392, 440, 523.25], type: 'sine', arpSpeed: 0.25, chance: 0.3 }
    };

    let mKey = mood.replace('.mp3', '').toLowerCase();
    if (!configs[mKey]) mKey = 'ambient.mp3';
    const C = configs[mKey];

    // Pad / Chords
    for (let i = 0; i < C.notes.length; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = C.type === 'square' ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(C.notes[i], now);

        const lfo = audioCtx.createOscillator(), lg = audioCtx.createGain();
        lfo.type = 'sine'; lfo.frequency.setValueAtTime(0.1 + i * 0.05, now); lg.gain.setValueAtTime(2, now);
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(now); lfo.stop(now + dur + 1);

        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04, now + 2 + i * 0.5);
        g.gain.setValueAtTime(0.04, now + dur - 3); g.gain.linearRampToValueAtTime(0, now + dur);

        o.connect(g); g.connect(master); o.start(now + i * 0.3); o.stop(now + dur + 1);
    }

    // Arpeggios / Melody
    const steps = Math.floor(dur / C.arpSpeed);
    for (let i = 0; i < steps; i++) {
        if (Math.random() < C.chance) {
            const t = now + i * C.arpSpeed;
            const note = C.notes[Math.floor(Math.random() * C.notes.length)] * (Math.random() > 0.8 ? 2 : 1);

            const osc = audioCtx.createOscillator(), env = audioCtx.createGain();
            osc.type = C.type;
            osc.frequency.setValueAtTime(note, t);

            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.04, t + 0.03); // Faster attack
            env.gain.exponentialRampToValueAtTime(0.001, t + C.arpSpeed * 0.8); // Faster decay

            osc.connect(env); env.connect(master);
            osc.start(t); osc.stop(t + C.arpSpeed);
        }
    }

    return musicDest.stream;
}

// ========== HELPERS ==========
function wrapT(t, x, y, mw, lh) { const w = t.split(' '); let l = ''; const ls = []; for (const v of w) { const tt = l + v + ' '; if (ctx.measureText(tt).width > mw && l) { ls.push(l.trim()); l = v + ' '; } else l = tt; } ls.push(l.trim()); const sy = y - ((ls.length - 1) * lh) / 2; for (let i = 0; i < ls.length; i++)ctx.fillText(ls[i], x, sy + i * lh); }
function wrapL(t, x, y, mw, lh) { const w = t.split(' '); let l = '', ly = y; for (const v of w) { const tt = l + v + ' '; if (ctx.measureText(tt).width > mw && l) { ctx.fillText(l.trim(), x, ly); l = v + ' '; ly += lh; } else l = tt; } ctx.fillText(l.trim(), x, ly); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
function loadImg(u) { return new Promise(r => { if (!u) return r(null); const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => r(i); i.onerror = () => r(null); i.src = u; }); }

// ========== STORYLINE (FASTER PACING) ==========
function buildStoryline() {
    const sc = [], site = btvData.site_name || 'Our Website', url = btvData.site_url || '', desc = btvData.site_description || '',
        title = btvData.post_title || 'Untitled', exc = btvData.post_excerpt || '',
        paras = btvData.paragraphs || [], imgs = [btvData.post_image, ...(btvData.content_images || [])].filter(Boolean),
        imgData = btvData.image_data || [], charts = btvData.chart_data || [], stats = btvData.stats || [];

    // Faster Intro & Title (3.5s)
    sc.push({ type: 'brand_intro', duration: 3.5, siteName: site, siteDesc: desc, siteUrl: url });
    sc.push({ type: 'title_card', duration: 3.5, title, image: imgs[0] || null, siteName: site });

    // Faster Slides (3.5s)
    const slideImgs = imgData.slice(0, 3);
    for (const im of slideImgs) {
        sc.push({ type: 'image_slide', duration: 3.5, image: im.src, caption: im.alt || '', siteName: site });
    }

    // Faster Content (4.5s)
    if (paras.length > 0) {
        paras.forEach((t, i) => sc.push({
            type: 'content', duration: 4.5, text: t, sceneNumber: i + 1, totalScenes: paras.length,
            image: imgs[(i + 1) % Math.max(imgs.length, 1)] || null, siteName: site
        }));
    } else {
        sc.push({ type: 'content', duration: 6, text: exc, sceneNumber: 1, totalScenes: 1, image: imgs[0] || null, siteName: site });
    }

    // Faster Charts (4s)
    if (stats.length >= 2) {
        const pctStats = stats.filter(s => s.unit === '%');
        const numStats = stats.filter(s => s.unit !== '%');
        if (pctStats.length >= 2) sc.push({ type: 'pie_chart', duration: 4, data: pctStats.slice(0, 6), siteName: site, title: 'Key Statistics' });
        if (numStats.length >= 2) sc.push({ type: 'bar_chart', duration: 4, data: numStats.slice(0, 6), siteName: site, title: 'By the Numbers' });
        else if (pctStats.length >= 2 && numStats.length === 0) sc.push({ type: 'bar_chart', duration: 4, data: pctStats.slice(0, 6), siteName: site, title: 'Key Metrics' });
    }
    if (charts.length > 0) {
        const tbl = charts[0];
        if (tbl.rows.length >= 2) {
            const barData = [];
            for (let r = 1; r < Math.min(tbl.rows.length, 7); r++) {
                const row = tbl.rows[r];
                const label = row[0] || `Item ${r}`;
                const val = parseFloat((row[1] || '0').replace(/[^0-9.]/g, '')) || 0;
                barData.push({ label, value: val, unit: '' });
            }
            if (barData.length >= 2) sc.push({ type: 'bar_chart', duration: 4, data: barData, siteName: site, title: tbl.rows[0][0] || 'Data Overview' });
        }
    }

    // Faster Outro (4s)
    sc.push({ type: 'takeaway', duration: 4, text: exc || paras[0] || title, siteName: site });
    sc.push({ type: 'outro', duration: 4, siteName: site, siteUrl: url, title });

    // Ensure min 20s (was 30) for social media shorts
    let tot = sc.reduce((s, v) => s + v.duration, 0);
    if (tot < 20) { const cs = sc.filter(s => s.type === 'content'); const e = Math.ceil((20 - tot) / Math.max(cs.length, 1)); cs.forEach(s => { s.duration += e; }); }
    return sc;
}

// ========== SCENE RENDERERS (Same as before) ==========
function drawBrandIntro(p, s) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8);
    g.addColorStop(0, adj(T.bg, 40)); g.addColorStop(1, T.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 50; i++) {
        const a = p * 2 + i * 0.7, r = 150 + Math.sin(i * 0.5) * 250;
        ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a * 0.6) * r * 0.5, 2 + Math.sin(i) * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = rgba(T.pri, 0.08 + Math.sin(p * 3 + i) * 0.06); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 180 + Math.sin(p * 3) * 20, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(T.pri, 0.15 * ease(p)); ctx.lineWidth = 2; ctx.stroke();
    const al = ease(Math.min(1, p * 2.5)); ctx.globalAlpha = al;
    ctx.fillStyle = T.txt; ctx.font = `bold 76px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = rgba(T.pri, 0.6); ctx.shadowBlur = 30; ctx.fillText(s.siteName, W / 2, H / 2 - 35); ctx.shadowBlur = 0;
    const lw = 240 * al; ctx.fillStyle = T.pri; ctx.fillRect(W / 2 - lw / 2, H / 2 + 10, lw, 3);
    ctx.font = `26px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.65); ctx.fillText(s.siteDesc, W / 2, H / 2 + 45);
    ctx.font = `18px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.4); ctx.fillText(s.siteUrl, W / 2, H / 2 + 80); ctx.globalAlpha = 1;
}

function drawTitleCard(p, s, img) {
    if (img) { ctx.filter = 'blur(12px) brightness(0.35)'; const sc = 1.1 + p * 0.1, dw = W * sc, dh = H * sc; ctx.drawImage(img, -(dw - W) / 2, -(dh - H) / 2, dw, dh); ctx.filter = 'none'; }
    else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, adj(T.bg, 15)); g.addColorStop(1, T.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    const ov = ctx.createLinearGradient(0, 0, 0, H); ov.addColorStop(0, 'rgba(0,0,0,0.3)'); ov.addColorStop(0.5, 'rgba(0,0,0,0.6)'); ov.addColorStop(1, 'rgba(0,0,0,0.4)'); ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
    if (img) {
        const al = ease(Math.min(1, p * 3)); ctx.globalAlpha = al; const iw = 400, ih = 250, ix = W / 2 - iw / 2, iy = 80;
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; rr(ix - 4, iy - 4, iw + 8, ih + 8, 12); ctx.fillStyle = T.pri; ctx.fill();
        ctx.shadowBlur = 0; ctx.save(); rr(ix, iy, iw, ih, 10); ctx.clip(); ctx.drawImage(img, ix, iy, iw, ih); ctx.restore(); ctx.globalAlpha = 1;
    }
    const oy = Math.max(0, (1 - p * 2) * 40), al = ease(Math.min(1, p * 2)), ty = img ? 420 : H / 2 - 20;
    ctx.globalAlpha = al; ctx.fillStyle = T.txt; ctx.font = `bold 58px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12; wrapT(s.title, W / 2, ty + oy, W - 180, 68); ctx.shadowBlur = 0;
    ctx.fillStyle = T.pri; const bw = 100 * al; ctx.fillRect(W / 2 - bw / 2, ty + 60 + oy, bw, 3);
    ctx.font = `20px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.5); ctx.textAlign = 'left'; ctx.fillText(s.siteName, 30, H - 30); ctx.globalAlpha = 1;
}

function drawImageSlide(p, s, img) {
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    if (!img) { drawContent(p, { ...s, type: 'content', text: s.caption || 'Image', sceneNumber: 1, totalScenes: 1 }, null); return; }
    const al = ease(Math.min(1, p * 2.5)); ctx.globalAlpha = al;
    const maxW = W - 160, maxH = H - 200; const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
    const iw = img.width * ratio, ih = img.height * ratio; const ix = (W - iw) / 2, iy = 60;
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 25; rr(ix - 5, iy - 5, iw + 10, ih + 10, 10); ctx.fillStyle = T.pri; ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); rr(ix, iy, iw, ih, 8); ctx.clip(); const scale = 1 + p * 0.05; const sw = iw * scale, sh = ih * scale; ctx.drawImage(img, ix - (sw - iw) / 2, iy - (sh - ih) / 2, sw, sh); ctx.restore();
    if (s.caption) { const captionY = iy + ih + 30; ctx.fillStyle = rgba(T.txt, 0.8); ctx.font = `italic 24px ${T.fB}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; wrapT(s.caption, W / 2, captionY, W - 120, 32); }
    ctx.font = `16px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.4); ctx.textAlign = 'right'; ctx.fillText(s.siteName, W - 30, H - 25); ctx.globalAlpha = 1;
}

function drawContent(p, s, img) {
    if (img) {
        const sc = 1.05 + p * 0.12, dw = W * sc, r = img.height / img.width, dh = Math.max(H * sc, dw * r);
        ctx.drawImage(img, -(dw - W) / 2 + Math.sin(p * 1.5) * 15, -(dh - H) / 2, dw, dh);
        const ov = ctx.createLinearGradient(0, 0, 0, H); ov.addColorStop(0, 'rgba(0,0,0,0.15)'); ov.addColorStop(0.5, 'rgba(0,0,0,0.3)'); ov.addColorStop(0.75, 'rgba(0,0,0,0.7)'); ov.addColorStop(1, 'rgba(0,0,0,0.85)'); ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
    } else {
        const h1 = (s.sceneNumber * 35 + 220) % 360; const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, `hsl(${h1},35%,12%)`); g.addColorStop(1, `hsl(${(h1 + 25) % 360},45%,20%)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(100 + i * 280, 150 + Math.sin(p * 2 + i) * 40, 60 + Math.sin(i) * 30, 0, Math.PI * 2); ctx.fillStyle = `hsla(${h1},50%,40%,0.08)`; ctx.fill(); }
    }
    ctx.fillStyle = rgba(T.pri, 0.9); rr(30, 25, 130, 40, 20); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold 16px ${T.fB}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`Scene ${s.sceneNumber} / ${s.totalScenes}`, 95, 46);
    ctx.font = `16px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.45); ctx.textAlign = 'right'; ctx.fillText(s.siteName, W - 30, 46);
    const bH = 200, bY = H - bH - 25; ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(35, bY, W - 70, bH, 14); ctx.fill(); ctx.fillStyle = T.pri; ctx.fillRect(35, bY, W - 70, 3);
    const ch = Math.floor(ease(Math.min(1, p * 1.3)) * s.text.length); ctx.fillStyle = T.txt; ctx.font = `26px ${T.fB}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; wrapL(s.text.substring(0, ch), 60, bY + 22, W - 140, 36);
    if (ch < s.text.length && Math.sin(p * 20) > 0) { ctx.fillStyle = T.acc; ctx.fillRect(62, bY + 22, 2, 28); }
}

function drawBarChart(p, s) {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, adj(T.bg, 20)); g.addColorStop(1, T.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const data = s.data || [], n = data.length; if (n === 0) return;
    ctx.fillStyle = T.txt; ctx.font = `bold 36px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.title || 'Data', W / 2, 50);
    const chartX = 120, chartY = 100, chartW = W - 240, chartH = H - 200;
    const barW = Math.min(80, (chartW / n) * 0.6), gap = (chartW - barW * n) / (n + 1), maxVal = Math.max(...data.map(d => d.value), 1);
    ctx.strokeStyle = rgba(T.txt, 0.2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(chartX, chartY); ctx.lineTo(chartX, chartY + chartH); ctx.lineTo(chartX + chartW, chartY + chartH); ctx.stroke();
    for (let i = 0; i <= 4; i++) {
        const gy = chartY + chartH - (chartH * i / 4); ctx.beginPath(); ctx.moveTo(chartX, gy); ctx.lineTo(chartX + chartW, gy); ctx.strokeStyle = rgba(T.txt, 0.08); ctx.stroke();
        ctx.fillStyle = rgba(T.txt, 0.4); ctx.font = `14px ${T.fB}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; const gridVal = (maxVal * i / 4); ctx.fillText(gridVal > 1000 ? (gridVal / 1000).toFixed(1) + 'K' : gridVal.toFixed(0), chartX - 10, gy);
    }
    const animP = ease(Math.min(1, p * 1.8));
    for (let i = 0; i < n; i++) {
        const d = data[i], x = chartX + gap + i * (barW + gap), barH = (d.value / maxVal) * chartH * animP, y = chartY + chartH - barH;
        const bg = ctx.createLinearGradient(x, y, x, chartY + chartH); bg.addColorStop(0, CHART_COLORS[i % CHART_COLORS.length]); bg.addColorStop(1, adj(CHART_COLORS[i % CHART_COLORS.length], -40)); ctx.fillStyle = bg; rr(x, y, barW, barH, 4); ctx.fill();
        ctx.shadowColor = CHART_COLORS[i % CHART_COLORS.length]; ctx.shadowBlur = 10; rr(x, y, barW, 2, 1); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = T.txt; ctx.font = `bold 18px ${T.fB}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; const vLabel = d.unit === '%' ? d.value.toFixed(0) + '%' : (d.value > 1000 ? (d.value / 1000).toFixed(1) + 'K' : d.value.toFixed(0)); if (animP > 0.3) ctx.fillText(vLabel, x + barW / 2, y - 8);
        ctx.fillStyle = rgba(T.txt, 0.75); ctx.font = `14px ${T.fB}`; ctx.textBaseline = 'top'; const lbl = d.label.length > 12 ? d.label.substring(0, 11) + '…' : d.label; ctx.fillText(lbl, x + barW / 2, chartY + chartH + 10);
    }
    ctx.font = `16px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.35); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(s.siteName, W - 30, H - 25);
}

function drawPieChart(p, s) {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, adj(T.bg, 20)); g.addColorStop(1, T.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const data = s.data || []; if (data.length === 0) return;
    ctx.fillStyle = T.txt; ctx.font = `bold 36px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.title || 'Distribution', W / 2, 45);
    const cx = W / 2 - 150, cy = H / 2 + 20, radius = Math.min(W, H) * 0.28, total = data.reduce((s, d) => s + d.value, 0) || 1, animP = ease(Math.min(1, p * 1.8)); let startAngle = -Math.PI / 2;
    for (let i = 0; i < data.length; i++) {
        const d = data[i], sliceAngle = (d.value / total) * Math.PI * 2 * animP;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle); ctx.closePath(); ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length]; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
        if (animP > 0.5) {
            const midAngle = startAngle + sliceAngle / 2, lx = cx + Math.cos(midAngle) * (radius + 25), ly = cy + Math.sin(midAngle) * (radius + 25);
            ctx.fillStyle = rgba(T.txt, 0.6); ctx.font = `14px ${T.fB}`; ctx.textAlign = midAngle > Math.PI / 2 || midAngle < -Math.PI / 2 ? 'right' : 'left'; ctx.fillText(`${d.value.toFixed(0)}%`, lx, ly);
        }
        startAngle += sliceAngle;
    }
    ctx.beginPath(); ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2); ctx.fillStyle = T.bg; ctx.fill(); ctx.fillStyle = rgba(T.txt, 0.3); ctx.font = `bold 22px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Total', cx, cy - 10); ctx.fillStyle = T.txt; ctx.font = `bold 28px ${T.fH}`; ctx.fillText(total.toFixed(0) + (data[0]?.unit === '%' ? '%' : ''), cx, cy + 18);
    const legX = W / 2 + 80, legY = H / 2 - data.length * 20;
    for (let i = 0; i < data.length; i++) {
        const d = data[i], y = legY + i * 42;
        ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length]; rr(legX, y, 18, 18, 4); ctx.fill(); ctx.fillStyle = T.txt; ctx.font = `18px ${T.fB}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(d.label, legX + 28, y + 9);
    }
    ctx.font = `16px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.35); ctx.textAlign = 'right'; ctx.fillText(s.siteName, W - 30, H - 25);
}

function drawTakeaway(p, s) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7); g.addColorStop(0, T.sec); g.addColorStop(1, adj(T.sec, -50)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.06; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(W / 2 + Math.cos(i * 0.8) * 200, H / 2 + Math.sin(i * 0.8) * 150, 80 + i * 20, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.font = 'bold 280px Georgia,serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u201C', W / 2 - 200, H / 2 - 60);
    const al = ease(Math.min(1, p * 2.5)); ctx.globalAlpha = al; ctx.fillStyle = '#fff'; ctx.font = `bold 34px ${T.fH}`; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 8; wrapT(s.text, W / 2, H / 2, W - 200, 46); ctx.shadowBlur = 0;
    ctx.font = `18px ${T.fB}`; ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillText('\u2014 Key Takeaway \u2014', W / 2, H - 70); ctx.fillText(s.siteName, W / 2, H - 42); ctx.globalAlpha = 1;
}

function drawOutro(p, s) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8); g.addColorStop(0, adj(T.bg, 35)); g.addColorStop(1, T.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) { ctx.beginPath(); ctx.arc((Math.sin(i * 7.3) * 0.5 + 0.5) * W, (Math.cos(i * 4.1) * 0.5 + 0.5) * H, 1.5, 0, Math.PI * 2); ctx.fillStyle = rgba(T.txt, 0.1 + Math.sin(p * 3 + i) * 0.1); ctx.fill(); }
    const al = ease(Math.min(1, p * 2)); ctx.globalAlpha = al; ctx.fillStyle = T.txt; ctx.font = `bold 50px ${T.fH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Thanks for Watching!', W / 2, H / 2 - 90); ctx.fillStyle = T.pri; ctx.fillRect(W / 2 - 80, H / 2 - 40, 160, 3);
    ctx.font = `28px ${T.fB}`; ctx.fillStyle = rgba(T.pri, 0.85); wrapT('\u201C' + s.title + '\u201D', W / 2, H / 2 + 10, W - 200, 36);
    ctx.font = `bold 26px ${T.fB}`; ctx.fillStyle = T.acc; ctx.fillText('Read the full article at', W / 2, H / 2 + 80); ctx.font = `bold 30px ${T.fH}`; ctx.fillStyle = T.txt; ctx.fillText(s.siteUrl, W / 2, H / 2 + 120);
    ctx.font = `18px ${T.fB}`; ctx.fillStyle = rgba(T.txt, 0.35); ctx.fillText('\u00A9 ' + s.siteName, W / 2, H - 35); ctx.globalAlpha = 1;
}

function drawFade(fp) { ctx.fillStyle = `rgba(0,0,0,${fp})`; ctx.fillRect(0, 0, W, H); }

// ========== GENERATE ==========
async function generate() {
    log('Building storyline...');
    const scenes = buildStoryline();

    // Initialize Media Engine Force Check
    if (window.BTVMediaEngine) {
        if (btvData.api_keys) {
            window.BTVMediaEngine.init(btvData.api_keys);
            log('Media Engine Initialized.');
        } else {
            log('Media Engine Missing Keys.');
        }
    } else {
        log('Media Engine Not Loaded.');
    }

    log('Loading media...');
    const imgMap = new Map();

    // Determine Audio Mood
    let mood = 'ambient.mp3';
    if (window.BTVMediaEngine) {
        const fullText = btvData.post_title + ' ' + (btvData.post_excerpt || '');
        mood = window.BTVMediaEngine.selectAudioTrack(fullText);
        log(`Mood: ${mood.replace('.mp3', '')}`);
    }

    // Load Checks
    for (const s of scenes) {
        if (s.image) {
            const i = await loadImg(s.image);
            if (i) imgMap.set(s.image, i); else s.image = null;
        }

        // Stock Media Fallback
        if (s.type === 'content' && !s.image && window.BTVMediaEngine) {
            const kw = s.text.split(' ').filter(w => w.length > 5).slice(0, 3).join(' '); // Better kw quality
            if (kw) {
                log(`Fetching stock: ${kw}...`);
                const u = await window.BTVMediaEngine.getStockMedia(kw, 'image');
                if (u) {
                    const i = await loadImg(u);
                    if (i) { s.image = u; imgMap.set(u, i); }
                }
            }
        }

        // Pollinations Fallback
        if (s.type === 'content' && !s.image) {
            const kw = s.text.split(' ').filter(w => w.length > 4).slice(0, 5).join(' ');
            if (kw) {
                const u = `https://image.pollinations.ai/prompt/${encodeURIComponent(kw + ' cinematic')}?width=1280&height=720&nologo=true`;
                const i = await loadImg(u); if (i) { s.image = u; imgMap.set(u, i); }
            }
        }
    }

    const FADE = Math.floor(FPS * 0.5);
    let totDur = scenes.reduce((s, v) => s + v.duration, 0);
    const totFrames = totDur * FPS;

    log('Starting music...');
    let mStream = null;
    try { mStream = createMusic(totDur + 2, mood); } catch (e) { console.warn('Music:', e); }

    log('Recording...');
    const cStream = canvas.captureStream(FPS);
    const tracks = [...cStream.getTracks()];
    if (mStream) tracks.push(...mStream.getAudioTracks());
    const fStream = new MediaStream(tracks);
    const rec = new MediaRecorder(fStream, { mimeType: 'video/webm; codecs=vp8,opus', videoBitsPerSecond: 4500000, audioBitsPerSecond: 128000 }); // Bump bitrate
    const chunks = []; rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); }; rec.start(200);

    const t0 = performance.now(); let fi = 0; const fInt = 1000 / FPS;

    for (let si = 0; si < scenes.length; si++) {
        const s = scenes[si], sf = s.duration * FPS, img = s.image ? imgMap.get(s.image) : null;
        const lbl = LABELS[s.type] || s.type;
        if (sceneLabelEl) sceneLabelEl.textContent = `Scene ${si + 1}/${scenes.length}: ${lbl}`;

        for (let f = 0; f < sf; f++) {
            const p = f / sf; ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            switch (s.type) {
                case 'brand_intro': drawBrandIntro(p, s); break;
                case 'title_card': drawTitleCard(p, s, img); break;
                case 'image_slide': drawImageSlide(p, s, img); break;
                case 'content': drawContent(p, s, img); break;
                case 'bar_chart': drawBarChart(p, s); break;
                case 'pie_chart': drawPieChart(p, s); break;
                case 'takeaway': drawTakeaway(p, s); break;
                case 'outro': drawOutro(p, s); break;
            }
            if (f < FADE) drawFade(1 - f / FADE);
            if (f > sf - FADE) drawFade((f - (sf - FADE)) / FADE);
            fi++;
            if (fi % 15 === 0) {
                const pc = Math.round(fi / totFrames * 100); if (progressBar) progressBar.value = pc; if (percentEl) percentEl.textContent = pc + '%';
                const el = (performance.now() - t0) / 1000, rt = fi / el, rm = Math.ceil((totFrames - fi) / rt);
                if (etaEl) etaEl.textContent = rm > 1 ? `~${rm}s left` : 'Finishing...'; log(`${pc}% \u2014 ${lbl}`);
            }
            await new Promise(r => setTimeout(r, fInt));
        }
    }
    await new Promise(r => setTimeout(r, 500)); rec.stop(); log('Finalizing...');
    if (audioCtx) { try { audioCtx.close(); } catch (e) { } audioCtx = null; }
    await new Promise(r => { rec.onstop = r; });

    currentBlob = new Blob(chunks, { type: 'video/webm' });
    const mb = (currentBlob.size / 1024 / 1024).toFixed(1);
    const dur = Math.round(scenes.reduce((s, v) => s + v.duration, 0));
    log(`\u2705 Done! ${dur}s video (${mb} MB)`);
    if (previewPlayer) previewPlayer.src = URL.createObjectURL(currentBlob);
    if (previewSection) previewSection.style.display = 'block';
    if (progressContainer) progressContainer.style.display = 'none';
    if (btn) btn.style.display = 'none';
}

async function upload() {
    if (!currentBlob) return; log('\u{1F4E4} Uploading...'); if (progressContainer) progressContainer.style.display = 'block';
    const fd = new FormData(); fd.append('action', 'btv_upload_video'); fd.append('nonce', btvData.nonce); fd.append('post_id', btvData.post_id);
    fd.append('video', currentBlob, 'blog-video-' + btvData.post_id + '.webm');
    try {
        const r = await fetch(btvData.ajaxurl, { method: 'POST', body: fd }); const j = await r.json();
        if (j.success) { log('\u2705 Uploaded!'); setTimeout(() => location.reload(), 1500); } else throw new Error(j.data || 'Failed');
    } catch (e) { log('\u274C ' + e.message); }
}

function download() { if (!currentBlob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(currentBlob); a.download = `blog-video-${btvData.post_id}.webm`; a.click(); }
function resetUI() { if (previewSection) previewSection.style.display = 'none'; if (progressContainer) progressContainer.style.display = 'none'; if (btn) { btn.style.display = 'block'; btn.disabled = false; } currentBlob = null; }

if (btn) btn.addEventListener('click', async () => {
    if (!confirm('Generate video from this post?')) return;
    btn.disabled = true; if (progressContainer) progressContainer.style.display = 'block'; if (previewSection) previewSection.style.display = 'none';
    log('Starting...'); try { await generate(); } catch (e) { console.error(e); log('\u274C ' + e.message); btn.disabled = false; }
});
if (uploadBtn) uploadBtn.addEventListener('click', upload);
if (downloadBtn) downloadBtn.addEventListener('click', download);
if (regenerateBtn) regenerateBtn.addEventListener('click', () => { resetUI(); btn.click(); });
