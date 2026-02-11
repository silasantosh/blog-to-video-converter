import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';
import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

// Configure transformers env
env.allowLocalModels = false;
env.useBrowserCache = true;

const canvas = document.getElementById('btv-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const width = canvas ? canvas.width : 1280;
const height = canvas ? canvas.height : 720;

// Config
const FPS = 30;

// State
let ffmpeg = null;
let summarizer = null;
let synthesizer = null;

// Capability Check
const HAS_HEADERS = window.crossOriginIsolated;

// UI Elements
const btn = document.getElementById('btv-generate-btn');
const progressContainer = document.getElementById('btv-progress-container');
const status = document.getElementById('btv-status');
const progressBar = document.getElementById('btv-progress');

// Logger
function log(msg, error = false) {
    console.log(msg);
    if (status) {
        status.textContent = (error ? 'Error: ' : '') + msg;
        if (error) status.style.color = 'red';
        else status.style.color = '#2271b1';
    }
}

if (btn) {
    btn.addEventListener('click', async () => {
        let confirmMsg = 'This process runs AI models in your browser.';
        if (!HAS_HEADERS) {
            confirmMsg += '\n\nWARNING: Your site is missing security headers (COOP/COEP). \nWe will fall back to "Basic Mode" (WebM format, lower quality).';
        } else {
            confirmMsg += '\n\nFull Mode enabled (MP4 support). ~200MB download on first run.';
        }
        
        if (!confirm(confirmMsg + '\n\nContinue?')) {
            return;
        }

        btn.disabled = true;
        progressContainer.style.display = 'block';
        log('Starting initialization...');

        try {
            if (HAS_HEADERS) {
                await startFullProcess();
            } else {
                await startBasicProcess();
            }
        } catch (e) {
            console.error(e);
            log(e.message, true);
            btn.disabled = false;
        }
    });
}

// --- BASIC MODE (MediaRecorder + Simple AI) ---
async function startBasicProcess() {
    // 1. Summarization (Try, but catch errors safely)
    log('Basic Mode: Attempting to summarize content...');
    let scriptText = btvData.post_excerpt || btvData.post_content_full.substring(0, 200);

    try {
        if (!summarizer) {
             // In non-isolated mode, this might be slow or fail depending on browser resources
             summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
        }
        let content = btvData.post_content_full;
        if (content.length > 2000) content = content.substring(0, 2000);
        const summary = await summarizer(content, { max_new_tokens: 60 });
        scriptText = summary[0].summary_text;
        log('Summary created.');
    } catch (e) {
        log('AI Summarization failed/skipped. Using excerpt.', true);
        console.warn(e);
    }

    // 2. TTS (Skip in basic mode to ensure success, it's too unstable without headers usually)
    log('Basic Mode: Skipping AI Voice to ensure stability.');

    // 3. Render and Record
    log('Recording Canvas (WebM)...');
    
    // Set up MediaRecorder
    const stream = canvas.captureStream(FPS);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();

    // Render Scenes
    let mainImage = null;
    if (btvData.post_image) {
        try { mainImage = await loadImage(btvData.post_image); } catch(e){}
    }
    
    // Calculate duration based on reading speed
    const duration = Math.max(5, scriptText.split(' ').length / 2) + 4;
    const totalFrames = Math.ceil(duration * FPS);

    for (let i = 0; i < totalFrames; i++) {
        renderFrame(i, totalFrames, duration, scriptText, mainImage);
        
        // Update UI
        if (i % 30 === 0) {
            progressBar.value = (i / totalFrames) * 100;
            log(`Recording frame ${i}/${totalFrames}`);
            await new Promise(r => setTimeout(r, 0));
        }
        await new Promise(r => requestAnimationFrame(r)); // Needed for stream capture timing
    }

    recorder.stop();
    log('Finalizing video...');
    await new Promise(resolve => recorder.onstop = resolve);
    
    const blob = new Blob(chunks, { type: 'video/webm' });
    await uploadVideo(blob, 'basic-video.webm');
}

// --- FULL MODE (FFmpeg + Full AI) ---
async function startFullProcess() {
    // 1. Initialize AI
    log('Loading AI Models...');
    if (!summarizer) summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
    // Using a lighter TTS model explicitly if possible or stick to SpeechT5
    if (!synthesizer) synthesizer = await pipeline('text-to-speech', 'Xenova/speecht5_tts', { quantized: false });

    // 2. Generate
    log('Generating Script...');
    let content = btvData.post_content_full;
    if (content.length > 2000) content = content.substring(0, 2000);
    const summary = await summarizer(content, { max_new_tokens: 100 });
    const scriptText = summary[0].summary_text;

    log('Generating Audio...');
    let audioBuffer = null;
    try {
        const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
        const result = await synthesizer(scriptText, { speaker_embeddings });
        audioBuffer = result.audio; 
    } catch (e) {
        log('TTS Error: ' + e.message);
    }

    // 3. Load FFmpeg
    log('Loading FFmpeg...');
    if (!ffmpeg) {
        ffmpeg = new FFmpeg();
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
    }

    // 4. Render
    log('Rendering Frames...');
    let hasAudio = false;
    if (audioBuffer) {
        const wavData = encodeWAV(audioBuffer, 16000);
        await ffmpeg.writeFile('audio.wav', wavData);
        hasAudio = true;
    }

    let duration = audioBuffer ? (audioBuffer.length / 16000) : (scriptText.split(' ').length / 2);
    duration += 4;
    const totalFrames = Math.ceil(duration * FPS);

    let mainImage = null;
    if (btvData.post_image) try { mainImage = await loadImage(btvData.post_image); } catch(e){}

    for (let i = 0; i < totalFrames; i++) {
        renderFrame(i, totalFrames, duration, scriptText, mainImage);
        
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8));
        const buff = await blob.arrayBuffer();
        const num = i.toString().padStart(5, '0');
        await ffmpeg.writeFile(`frame_${num}.jpg`, new Uint8Array(buff));
        
        if (i % 30 === 0) {
            progressBar.value = (i / totalFrames) * 100;
            log(`Rendering ${i}/${totalFrames}`);
            await new Promise(r => setTimeout(r, 0));
        }
    }

    // 5. Encode
    log('Encoding MP4...');
    const inputArgs = ['-framerate', '30', '-i', 'frame_%05d.jpg'];
    if (hasAudio) inputArgs.push('-i', 'audio.wav');
    
    // Simpler encoding settings for reliability
    const outputArgs = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-shortest'];
    
    await ffmpeg.exec([...inputArgs, ...outputArgs, 'output.mp4']);

    log('Uploading Video...');
    const data = await ffmpeg.readFile('output.mp4');
    const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
    await uploadVideo(videoBlob, 'ai-video.mp4');
}

// --- SHARED ---

function renderFrame(frame, totalFrames, duration, text, image) {
    const time = frame / FPS;
    if (time < 2) {
        drawTitleScene(ctx, width, height, btvData.post_title, frame);
    } else if (time < duration - 2) {
        drawMainScene(ctx, width, height, image, text, time - 2);
    } else {
        drawOutroScene(ctx, width, height, "Thanks for watching!");
    }
}

// Drawing Functions
function drawTitleScene(ctx, w, h, text, frame) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w/2, h/2);
}

function drawMainScene(ctx, w, h, img, text, time) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (img) {
         const scale = 1 + (time * 0.05);
         const dw = w * scale;
         const dh = (w/img.width*img.height) * scale;
         const dx = -(dw - w) / 2;
         const dy = -(dh - h) / 2;
         ctx.drawImage(img, dx, dy, dw, dh);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, h - 200, w - 40, 180);
    ctx.fillStyle = '#fff';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    wrapText(ctx, text, w/2, h - 150, w - 100, 40);
}

function drawOutroScene(ctx, w, h, text) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f0c';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w/2, h/2);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];
    for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);
    for (let k = 0; k < lines.length && k < 4; k++) {
            ctx.fillText(lines[k], x, y + (k * lineHeight));
    }
}

async function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

async function uploadVideo(blob, filename) {
    const formData = new FormData();
    formData.append('action', 'btv_upload_video');
    formData.append('nonce', btvData.nonce);
    formData.append('post_id', btvData.post_id);
    formData.append('video', blob, filename);

    const response = await fetch(btvData.ajaxurl, {
        method: 'POST',
        body: formData
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.data);
    
    log('Done! Reloading...');
    setTimeout(() => location.reload(), 1500);
}

// WAV Encoder Helper
function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(view, 44, samples);
    return new Uint8Array(buffer);
}

function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
