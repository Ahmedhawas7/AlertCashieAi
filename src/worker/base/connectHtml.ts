export function renderConnectPage(telegramUserId: string, botUsername: string = 'HawasAgentBot'): string {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ربط محفظة Base السيادية | HAWAS×Agent</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #030712;
            --surface: #0b1120;
            --surface-border: #1f293d;
            --base-blue: #0052FF;
            --base-hover: #0045d8;
            --text-main: #f9fafb;
            --text-muted: #94a3b8;
            --success: #10b981;
            --card-glow: rgba(0, 82, 255, 0.15);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Cairo', 'Outfit', sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background-image: 
                radial-gradient(circle at 50% 0%, rgba(0, 82, 255, 0.25) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 40%);
        }

        .container {
            width: 100%;
            max-width: 460px;
            background: var(--surface);
            border: 1px solid var(--surface-border);
            border-radius: 24px;
            padding: 36px 28px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 40px var(--card-glow);
            backdrop-filter: blur(16px);
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(0, 82, 255, 0.12);
            border: 1px solid rgba(0, 82, 255, 0.3);
            color: #60a5fa;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
        }

        .pulse-dot {
            width: 8px;
            height: 8px;
            background: #3b82f6;
            border-radius: 50%;
            box-shadow: 0 0 10px #3b82f6;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.3); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.8; }
        }

        h1 {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #ffffff 0%, #93c5fd 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        p.desc {
            font-size: 14px;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 28px;
        }

        .wallet-card {
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: right;
        }

        .wallet-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 13px;
        }

        .wallet-item:last-child {
            border-bottom: none;
        }

        .label {
            color: var(--text-muted);
        }

        .value {
            font-weight: 600;
            font-family: 'Outfit', monospace;
            color: #e2e8f0;
        }

        .btn {
            width: 100%;
            padding: 16px;
            border-radius: 14px;
            border: none;
            background: var(--base-blue);
            color: white;
            font-size: 16px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 4px 20px rgba(0, 82, 255, 0.4);
        }

        .btn:hover:not(:disabled) {
            background: var(--base-hover);
            transform: translateY(-1px);
            box-shadow: 0 6px 25px rgba(0, 82, 255, 0.6);
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .status-box {
            margin-top: 18px;
            font-size: 13px;
            padding: 12px;
            border-radius: 12px;
            display: none;
        }

        .status-box.error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            display: block;
        }

        .status-box.success {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #6ee7b7;
            display: block;
        }

        .security-note {
            margin-top: 24px;
            font-size: 12px;
            color: #64748b;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="badge">
            <span class="pulse-dot"></span>
            شبكة Base الرسمية (Chain ID 8453)
        </div>

        <h1>ربط محفظتك بـ HAWAS×Agent</h1>
        <p class="desc">
            ربط سيادي مباشر عبر توقيع تشفيري مجاني. يتيح للبوت الاستعلام عن أصولك واقتراح خطط التداول دون تحريك سنت واحد إلا بعد موافقتك الصريحة.
        </p>

        <div class="wallet-card">
            <div class="wallet-item">
                <span class="label">معرف تيليجرام:</span>
                <span class="value" id="disp-uid">${telegramUserId || 'غير محدد'}</span>
            </div>
            <div class="wallet-item">
                <span class="label">الشبكة:</span>
                <span class="value">Base Mainnet (L2)</span>
            </div>
            <div class="wallet-item">
                <span class="label">المحفظة المتصلة:</span>
                <span class="value" id="disp-addr">غير متصلة</span>
            </div>
        </div>

        <button class="btn" id="btn-action" onclick="handleConnectAndSign()">
            <span>🔵 اتصال وتوقيع عبر Base</span>
        </button>

        <div id="status-msg" class="status-box"></div>

        <div class="security-note">
            🛡️ <span>توقيع آمن 100% بدون أي رسوم غاز وبدون منح صلاحية سحب تلقائي.</span>
        </div>
    </div>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const TELEGRAM_USER_ID = urlParams.get('uid') || "${telegramUserId}" || "";
        const BASE_CHAIN_ID_HEX = "0x2105"; // 8453 in hex

        if (TELEGRAM_USER_ID) {
            const uidEl = document.getElementById('disp-uid');
            if (uidEl) uidEl.innerText = TELEGRAM_USER_ID;
        }

        function showStatus(text, type = 'error') {
            const el = document.getElementById('status-msg');
            el.className = 'status-box ' + type;
            el.innerText = text;
        }

        function stringToHex(str) {
            const bytes = new TextEncoder().encode(str);
            let hex = '0x';
            for (let i = 0; i < bytes.length; i++) {
                hex += bytes[i].toString(16).padStart(2, '0');
            }
            return hex;
        }

        async function ensureBaseNetwork() {
            if (!window.ethereum) throw new Error("يرجى فتح الصفحة من متصفح يدعم محافظ Web3 (مثل Coinbase Wallet أو MetaMask أو متصفح الهاتف).");
            
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: BASE_CHAIN_ID_HEX }]
                });
            } catch (switchError) {
                // Chain 8453 not added yet, add it
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: BASE_CHAIN_ID_HEX,
                            chainName: 'Base Mainnet',
                            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                            rpcUrls: ['https://mainnet.base.org'],
                            blockExplorerUrls: ['https://basescan.org']
                        }]
                    });
                } else {
                    throw switchError;
                }
            }
        }

        async function requestSignatureWithFallback(message, walletAddress) {
            const hexMsg = stringToHex(message);
            let signature = null;

            // Attempt 1: Standard EIP-191 [hexMessage, address] (MetaMask, Coinbase Wallet, Rabby)
            try {
                signature = await window.ethereum.request({
                    method: 'personal_sign',
                    params: [hexMsg, walletAddress]
                });
            } catch (err1) {
                console.warn("Attempt 1 [hexMsg, address] failed:", err1);
                // Attempt 2: Reversed order [address, hexMessage]
                try {
                    signature = await window.ethereum.request({
                        method: 'personal_sign',
                        params: [walletAddress, hexMsg]
                    });
                } catch (err2) {
                    console.warn("Attempt 2 [address, hexMsg] failed:", err2);
                    // Attempt 3: Plain text [message, address]
                    signature = await window.ethereum.request({
                        method: 'personal_sign',
                        params: [message, walletAddress]
                    });
                }
            }

            // Some wallets return signature as an object { result: ... }
            if (signature && typeof signature === 'object') {
                signature = signature.signature || signature.result || signature.data || '';
            }

            return signature;
        }

        async function handleConnectAndSign() {
            const btn = document.getElementById('btn-action');
            try {
                btn.disabled = true;
                btn.innerText = "⏳ جاري الاتصال بالمحفظة...";

                if (!TELEGRAM_USER_ID) {
                    throw new Error("معرف تيليجرام غير موجود برابط الصفحة. يرجى فتح الرابط من البوت.");
                }

                if (!window.ethereum) {
                    throw new Error("لم يتم العثور على محفظة Web3. افتح الرابط من داخل محفظة Coinbase أو MetaMask.");
                }

                await ensureBaseNetwork();

                // 1. Request Accounts
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (!accounts || accounts.length === 0) throw new Error("لم يتم اختيار أي حساب.");
                const walletAddress = accounts[0];
                document.getElementById('disp-addr').innerText = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);

                btn.innerText = "⏳ جاري توليد جلسة الأمان...";

                // 2. Fetch Session Nonce from Worker API
                const sessRes = await fetch('/api/base/session?uid=' + encodeURIComponent(TELEGRAM_USER_ID));
                if (!sessRes.ok) throw new Error("فشل توليد جلسة الربط من السيرفر.");
                const sessData = await sessRes.json();
                const { nonce, message } = sessData;

                if (!nonce || !message) {
                    throw new Error("فشل استلام بيانات الجلسة من الخادم.");
                }

                btn.innerText = "✍️ يرجى تأكيد التوقيع في المحفظة...";

                // 3. Request Signature from Wallet (EIP-191 personal_sign)
                const signature = await requestSignatureWithFallback(message, walletAddress);

                if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
                    throw new Error("لم يتم الحصول على توقيع صالح من المحفظة. يرجى الموافقة على طلب التوقيع.");
                }

                btn.innerText = "🔍 جاري التحقق من التوقيع...";

                // 4. Verify & Link on Backend
                const verifyRes = await fetch('/api/base/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegramUserId: TELEGRAM_USER_ID,
                        walletAddress: walletAddress,
                        signature: signature,
                        nonce: nonce
                    })
                });

                const verifyData = await verifyRes.json();
                if (!verifyData.success) {
                    throw new Error(verifyData.error || "فشل التحقق من التوقيع.");
                }

                showStatus("🎉 تم ربط محفظتك السيادية على Base بنجاح! يمكنك الآن العودة لشات تيليجرام.", "success");
                btn.innerText = "✅ تم الربط بنجاح";

                // Auto return to Telegram after 2.5 seconds
                setTimeout(() => {
                    window.location.href = "https://t.me/${botUsername}";
                }, 2500);

            } catch (err) {
                console.error(err);
                const msg = (err && (err.code === 4001 || err.message?.includes('User rejected'))) 
                    ? "تم إلغاء طلب التوقيع من المحفظة." 
                    : (err.message || "حدث خطأ أثناء الاتصال.");
                showStatus(msg, "error");
                btn.disabled = false;
                btn.innerText = "🔄 إعادة المحاولة";
            }
        }

        window.addEventListener('DOMContentLoaded', async () => {
            if (window.ethereum && window.ethereum.selectedAddress) {
                const addr = window.ethereum.selectedAddress;
                const disp = document.getElementById('disp-addr');
                if (disp) disp.innerText = addr.slice(0, 6) + '...' + addr.slice(-4);
            }
        });
    </script>
</body>
</html>`;
}
