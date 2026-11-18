/**
 * Hawas AI — WhatsApp Cloud & Local Bridge (Powered by Baileys & Express)
 * Provides both terminal QR, Web-based visual QR, and keep-alive server for 24/7 hosting!
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const HAWAS_API_URL = process.env.HAWAS_API_URL || 'https://hawas-worker.hawas-alertai.workers.dev/api/chat';
const SESSION_DIR = process.env.SESSION_DIR || path.join(__dirname, '..', 'data', 'whatsapp_session');

if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Global state for web UI
let currentQrCodeDataUrl = null;
let isConnected = false;
let userPhoneNumber = null;

// Setup Express Web Dashboard
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (isConnected) {
        res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>حواس — متصل بنجاح</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 40px; text-align: center; max-width: 450px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                .badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 999px; font-weight: bold; font-size: 14px; display: inline-block; margin-bottom: 20px; }
                h1 { margin: 0 0 10px; font-size: 26px; }
                p { color: #94a3b8; line-height: 1.6; margin: 0 0 20px; }
                .pulse { width: 14px; height: 14px; background: #10b981; border-radius: 50%; display: inline-block; margin-left: 8px; animation: pulse 1.5s infinite; }
                @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="badge"><span class="pulse"></span> متصل لايف 24/7</div>
                <h1>🤖 بوت "حواس" شغال بنجاح!</h1>
                <p>تم ربط واتساب بنجاح عبر الرقم: <b>${userPhoneNumber || 'الرقم المسجل'}</b>.</p>
                <p>حواس الآن يستقبل الرسائل ويرد عليها فوراً بالذكاء الاصطناعي على مدار الساعة.</p>
            </div>
        </body>
        </html>
        `);
    } else if (currentQrCodeDataUrl) {
        res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta http-equiv="refresh" content="5">
            <title>ربط حواس بواتساب — QR Code</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
                .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 35px; text-align: center; max-width: 420px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                h1 { margin: 0 0 15px; font-size: 24px; }
                p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 25px; }
                .qr-box { background: white; padding: 15px; border-radius: 16px; display: inline-block; margin-bottom: 20px; }
                .qr-box img { display: block; width: 250px; height: 250px; }
                .steps { background: #0f172a; border-radius: 12px; padding: 15px; text-align: right; font-size: 14px; color: #cbd5e1; }
                .steps ol { margin: 0; padding-right: 20px; }
                .steps li { margin-bottom: 6px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>📲 ربط "حواس" بالرقم الثاني</h1>
                <p>امسح رمز الـ QR التالي من تطبيق واتساب لربط البوت في ثوانٍ:</p>
                <div class="qr-box">
                    <img src="${currentQrCodeDataUrl}" alt="WhatsApp QR Code">
                </div>
                <div class="steps">
                    <ol>
                        <li>افتح واتساب على هاتفك (الرقم الثاني).</li>
                        <li>اضغط على <b>الإعدادات</b> ⬅️ <b>الأجهزة المرتبطة</b>.</li>
                        <li>اضغط <b>ربط جهاز</b> ووجّه الكاميرا نحو الرمز.</li>
                    </ol>
                </div>
            </div>
        </body>
        </html>
        `);
    } else {
        res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="utf-8">
            <meta http-equiv="refresh" content="3">
            <title>جاري تحضير البوت...</title>
            <style>
                body { font-family: system-ui; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            </style>
        </head>
        <body>
            <div>
                <h2>⏳ جاري إنشاء رمز QR جديد...</h2>
                <p style="color: #94a3b8;">الصفحة ستتحدث تلقائياً خلال ثوانٍ.</p>
            </div>
        </body>
        </html>
        `);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', connected: isConnected, phone: userPhoneNumber });
});

app.listen(PORT, () => {
    console.log(`🌐 واجهة التحكم بالويب تعمل الآن على: http://localhost:${PORT}`);
});

async function startHawasWhatsApp() {
    console.log('\n====================================================');
    console.log('🤖 جاري تشغيل بوت "حواس" للواتساب (Baileys Engine)...');
    console.log('====================================================\n');

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Hawas AI', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            currentQrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            console.log('\n📲 امسح كود الـ QR التالي من واتساب (أو افتح http://localhost:' + PORT + ' في المتصفح):\n');
            qrcodeTerminal.generate(qr, { small: true });
            console.log('\n⏳ بانتظار مسح الرمز من هاتفك...\n');
        }

        if (connection === 'close') {
            isConnected = false;
            currentQrCodeDataUrl = null;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440;

            console.log(`⚠️ انقطع الاتصال (كود: ${statusCode || 'غير معروف'}).`);
            if (shouldReconnect) {
                console.log('🔄 جاري إعادة الاتصال تلقائياً خلال 3 ثوانٍ...');
                setTimeout(startHawasWhatsApp, 3000);
            } else if (statusCode === 440) {
                console.log('ℹ️ تم فتح الاتصال في جلسة أخرى (Connection Replaced).');
            } else {
                console.log('❌ تم تسجيل الخروج. لإعادة الربط احذف مجلد data/whatsapp_session.');
            }
        } else if (connection === 'open') {
            isConnected = true;
            currentQrCodeDataUrl = null;
            userPhoneNumber = sock.user?.id ? sock.user.id.split(':')[0] : 'Unknown';

            console.log('\n🎉 ====================================================');
            console.log(`✅ تم ربط البوت بنجاح! حواس لايف الآن على رقمك: ${userPhoneNumber}`);
            console.log('====================================================');
            console.log('✨ حواس جاهز للرد على أي رسالة تصل لهذا الرقم بالذكاء الاصطناعي 24/7.\n');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const m of messages) {
            if (m.key.fromMe) continue;

            const remoteJid = m.key.remoteJid;
            if (!remoteJid || remoteJid.includes('@broadcast') || remoteJid.includes('status@broadcast')) continue;

            const isImage = !!m.message?.imageMessage;
            const isAudio = !!(m.message?.audioMessage || m.message?.voiceMessage);
            const isVideo = !!m.message?.videoMessage;

            const caption = (m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '').trim();
            const textContent = (m.message?.conversation || m.message?.extendedTextMessage?.text || caption || '').trim();

            // Skip if not text, image, or audio
            if (!textContent && !isImage && !isAudio) continue;

            const senderName = m.pushName || 'صديق';
            const cleanPhone = remoteJid.split('@')[0];

            let payload = {
                userId: cleanPhone,
                name: senderName,
                text: textContent
            };

            // 📸 Handle Incoming Images (Convert to Base64 for Gemini Vision)
            if (isImage) {
                try {
                    console.log(`\n📸 جاري تنزيل الصورة من: ${senderName} (${cleanPhone})...`);
                    const imgBuffer = await downloadMediaMessage(m, 'buffer', {});
                    if (imgBuffer && imgBuffer.length > 0) {
                        payload.imageBase64 = imgBuffer.toString('base64');
                        payload.mimeType = m.message.imageMessage.mimetype || 'image/jpeg';
                        console.log(`✅ تم استلام الصورة بنجاح (${(imgBuffer.length / 1024).toFixed(1)} KB)`);
                    }
                } catch (mediaErr) {
                    console.error('❌ تعذر تحميل بيانات الصورة:', mediaErr.message);
                }
            }

            // 🎙️ Handle Incoming Audio / Voice Notes (Convert to Base64 for Gemini Transcription)
            if (isAudio) {
                try {
                    console.log(`\n🎙️ جاري تنزيل الرسالة الصوتية من: ${senderName} (${cleanPhone})...`);
                    const audioBuffer = await downloadMediaMessage(m, 'buffer', {});
                    if (audioBuffer && audioBuffer.length > 0) {
                        payload.audioBase64 = audioBuffer.toString('base64');
                        payload.mimeType = m.message.audioMessage?.mimetype || 'audio/ogg';
                        console.log(`✅ تم استلام الصوت بنجاح (${(audioBuffer.length / 1024).toFixed(1)} KB)`);
                    }
                } catch (audioErr) {
                    console.error('❌ تعذر تحميل الصوت:', audioErr.message);
                }
            }

            console.log(`\n📩 رسالة جديدة من: ${senderName} (${cleanPhone}) | النوع: ${isImage ? 'صورة 📸' : (isAudio ? 'صوت 🎙️' : 'نص 💬')}`);
            if (textContent) console.log(`💬 المحتوى: "${textContent}"`);

            try {
                await sock.sendPresenceUpdate('composing', remoteJid);

                const response = await fetch(HAWAS_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    console.error('خطأ استجابة حواس:', response.status);
                    continue;
                }

                const data = await response.json();
                const replyText = data.reply;

                if (replyText) {
                    console.log(`🤖 رد حواس:\n${replyText}\n`);
                    await sock.sendMessage(remoteJid, { text: replyText }, { quoted: m });
                    await sock.sendPresenceUpdate('paused', remoteJid);
                }
            } catch (err) {
                console.error('❌ خطأ أثناء معالجة رسالة واتساب:', err.message);
            }
        }
    });
}

startHawasWhatsApp().catch(err => {
    console.error('فشل بدء تشغيل البوت:', err);
});
