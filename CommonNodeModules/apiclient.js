import axios from "axios";
import * as logger from "./logger.js";

// load from terraform secret env
const CLIENT_ID = process.env.clientId;
const CLIENT_SECRET = process.env.clientSecret;

//storing it in memory for reuse
let TOKEN = null;
let TOKEN_EXPIRY_TIME = null;

async function makeRequest({ sessionId, tag, attempt, url, method, headers = {}, data = null, params = null, timeoutMs }) {
    let responsePayload = null;
    let status = null;
    let returnCode = "1";

    for (let attemptCount = 1; attemptCount <= Number(attempt); attemptCount++) {
        logger.logApiRequest({ sessionId, tag, attemptCount, url, method, headers, params, data });
        const startTime = Date.now();

        try {
            const response = await axios({ url, method, headers, data, params, timeout: Number(timeoutMs) });
            const executionTimeMs = Date.now() - startTime;

            logger.logApiResponse({ sessionId, tag, attemptCount, status: response.status, executionTimeMs, response: response.data });

            status = response.status;
            responsePayload = response.data;
            returnCode = response.data?.returnCode || "0";

            if (status === 200 || returnCode === "0") break; // success
        } catch (err) {

            logger.logErrorResponse({ sessionId, tag, attemptCount, err });
            returnCode = err.response?.data?.returnCode || "1";
            status = err.response?.status || null;
            responsePayload = err.response?.data || { message: err.message };
        }
    }

    return { Status: status, ReturnCode: returnCode, ResponsePayload: responsePayload };
}

async function getValidToken({ sessionId, tag, ivaConfig }) {

    const tokenUrl = ivaConfig.tokenUrl;
    const scope = ivaConfig.scope;
    const refreshTime = Number(ivaConfig.tokenRefreshTimeMin);
    const timeoutMs = Number(ivaConfig.timeOutMs);
    const attempt = Number(ivaConfig.apiAttempts);
    const now = Date.now();
    let generateNew = false;

    if (!TOKEN || !TOKEN_EXPIRY_TIME) {
        logger.logConsole(sessionId, tag, `No existing token found. Generating new one...`);
        generateNew = true;
    } else {
        const expiryTimestamp = Date.parse(TOKEN_EXPIRY_TIME);
        if (isNaN(expiryTimestamp)) {
            logger.logConsole(sessionId, tag, `Invalid expiryTime "${TOKEN_EXPIRY_TIME}". Generating new token...`);
            generateNew = true;
        } else {
            const timeLeftMin = (expiryTimestamp - now) / 60000;
            if (timeLeftMin > Number(refreshTime) || timeLeftMin < 0) {
                logger.logConsole(sessionId, tag, `Time left ${timeLeftMin.toFixed(1)} min > ${refreshTime}. Generating new token...`);
                generateNew = true;
            } else {
                logger.logConsole(sessionId, tag, `Using existing token. Time left: ${timeLeftMin.toFixed(1)} min`);
                return TOKEN;
            }
        }
    }

    if (generateNew) {
        const formData = new URLSearchParams();
        formData.append("client_id", CLIENT_ID);
        formData.append("scope", scope);
        formData.append("client_secret", CLIENT_SECRET);
        formData.append("grant_type", "client_credentials");

        const headers = { "Content-Type": "application/x-www-form-urlencoded" };
        const tokenResult = await makeRequest({
            sessionId,
            tag: `${tag}-token`,
            attempt,
            url: tokenUrl,
            method: "POST",
            headers,
            data: formData.toString(),
            timeoutMs
        });

        if (!tokenResult.ResponsePayload?.access_token) {
            throw new Error("Failed to fetch token from token API");
        }

        TOKEN = tokenResult.ResponsePayload.access_token;
        TOKEN_EXPIRY_TIME = new Date(Date.now() + 55 * 60 * 1000).toISOString();

        logger.logConsole(sessionId, tag, `New token generated. Valid until ${TOKEN_EXPIRY_TIME}`);
        return TOKEN;
    }
}


export async function getRequest({ sessionId, tag, url, headers = {}, params = null, ivaConfig }) {
    const token = await getValidToken({ sessionId, tag, ivaConfig });
    const reqHeaders = { ...headers, Authorization: `Bearer ${token}` };
    return makeRequest({ sessionId, tag, attempt: ivaConfig.apiAttempts, url, method: "GET", headers: reqHeaders, params, timeoutMs: ivaConfig.timeOutMs });
}

export async function postRequest({ sessionId, tag, url, headers = {}, data = null, ivaConfig }) {
    const token = await getValidToken({ sessionId, tag, ivaConfig });
    const reqHeaders = { ...headers, Authorization: `Bearer ${token}` };
    return makeRequest({ sessionId, tag, attempt: ivaConfig.apiAttempts, url, method: "POST", headers: reqHeaders, data, timeoutMs: ivaConfig.timeOutMs });
}

