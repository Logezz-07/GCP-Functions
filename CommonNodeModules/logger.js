export function logConsole(sessionId, tag, message) {
    console.log(JSON.stringify({
        event: "consoleLog",
        severity: "INFO",
        sessionId,
        tag,
        details: JSON.stringify({ message })
    }));
}

export function logWebhookDetails(sessionId, tag) {
    console.log(JSON.stringify({
        event: "WebhookDetails",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify({ message: "Webhook Invoked" })
    }));
}

export function logWebhookRequest(sessionId, tag, payload) {
    console.log(JSON.stringify({
        event: "WebhookRequest",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify(payload)
    }));
}

export function logApiRequest({ sessionId, tag, attempt, url, method, headers, params, data = null }) {
    const maskedHeaders = maskSensitiveData(headers);
    const maskedData = maskSensitiveData(data);
    const maskedParams = maskSensitiveData(params);
    console.log(JSON.stringify({
        event: "ApiRequest",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify({ attempt, url, method, maskedHeaders, maskedParams, maskedData })
    }));
}

export function logApiResponse({ sessionId, tag, attempt, status, executionTimeMs, response }) {
    console.log(JSON.stringify({
        event: "ApiResponse",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify({ attempt, status, executionTimeMs, response })
    }));
}

export function logWebhookResponse(sessionId, tag, response) {
    console.log(JSON.stringify({
        event: "WebhookResponse",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify({ response })
    }));
}

export function logErrorResponse({ sessionId, tag, attempt, err }) {
    const isTimeout = err?.code === "ECONNABORTED";
    const errorDetails = isTimeout ? "Request timed out after 15 seconds" : (err?.message || String(err));
    const statusCode = err?.response?.status || null;

    console.error(JSON.stringify({
        event: "ErrorResponse",
        severity: "ERROR",
        sessionId,
        tag,
        details: JSON.stringify({ attempt, statusCode, errorDetails, stack: err?.stack || null })
    }));
}

function maskSensitiveData(data) {
    if (!data) return data;
    let str = JSON.stringify(data);
    // Mask JSON Header fields
    str = str.replace(/client_id" *: *"[^"]+"/gi, 'client_id":"*********"');
    str = str.replace(/client_secret" *: *"[^"]+"/gi, 'client_secret":"*********"');
    str = str.replace(/Authorization" *: *"[^"]+"/gi, 'Authorization":"Bearer *********"');

    // Mask URL-encoded patterns
    str = str.replace(/client_id=[^&\s]+/gi, 'client_id=*********');
    str = str.replace(/client_secret=[^&\s]+/gi, 'client_secret=*********');
    return JSON.parse(str);
}
