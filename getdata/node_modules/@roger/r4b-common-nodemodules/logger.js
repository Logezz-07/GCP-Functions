function logConsole(sessionId, tag, message) {
    console.log(JSON.stringify({
        event: "consoleLog",
        severity: "INFO",
        sessionId,
        tag,
        details: JSON.stringify({ message })
    }));
}

function logWebhookDetails(sessionId, tag) {
    console.log(JSON.stringify({
        event: "WebhookDetails",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify({ message: "Webhook Invoked" })
    }));
}

function logWebhookRequest(sessionId, tag, payload) {
    console.log(JSON.stringify({
        event: "WebhookRequest",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify(payload)
    }));
}

function logApiRequest({ sessionId, tag, attempt, url, method, headers, data = null }) {
    console.log(JSON.stringify({
        event: "ApiRequest",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify({ attempt, url, method, headers, data })
    }));
}

function logApiResponse({ sessionId, tag, attempt, status, executionTimeMs, response }) {
    console.log(JSON.stringify({
        event: "ApiResponse",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify({ attempt, status, executionTimeMs, response })
    }));
}

function logWebhookResponse(sessionId, tag, response) {
    console.log(JSON.stringify({
        event: "WebhookResponse",
        severity: "DEBUG",
        sessionId,
        tag,
        details: JSON.stringify({ response })
    }));
}

function logErrorResponse({ sessionId, tag, attempt, err }) {
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

module.exports = {
    logConsole,
    logWebhookDetails,
    logWebhookRequest,
    logApiRequest,
    logApiResponse,
    logWebhookResponse,
    logErrorResponse
};
