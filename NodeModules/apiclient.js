import axios from "axios";
const logger = require("./logger");
const TOKEN_API_URL = process.env.TOKEN_URL;
const TOKEN_REFRESH_TIME = process.env.TOKEN_REFRESH_TIME;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SCOPE = process.env.SCOPE;

let TOKEN = null;
let TOKEN_EXPIRY_TIME = null;

async function makeRequest({ sessionId, tag, url, method, headers = {}, data = null, params = null }) {
    let responsePayload = null;
    let status = null;
    let returnCode = "1";

    for (let attempt = 1; attempt <= 2; attempt++) {
        logger.logApiRequest({ sessionId, tag, attempt, url, method, headers, params, data });
        const startTime = Date.now();

        try {

            const response = await axios({ url, method, headers, data, params, timeout: 15000 });
            const executionTimeMs = Date.now() - startTime;

            logger.logApiResponse({ sessionId, tag, attempt, status: response.status, executionTimeMs, response: response.data });

            status = response.status;
            responsePayload = response.data;
            returnCode = response.data?.returnCode || "0";

            if (status === 200 || returnCode === "0") break; // success
        } catch (err) {
            logger.logErrorResponse({ sessionId, tag, attempt, err });
            returnCode = err.response?.data?.returnCode || "1";
            status = err.response?.status || null;
            responsePayload = err.response?.data || { message: err.message };
        }
    }

    return { Status: status, ReturnCode: returnCode, ResponsePayload: responsePayload };
}

async function getValidToken({ sessionId, tag }) {
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

            if (timeLeftMin > Number(TOKEN_REFRESH_TIME) || timeLeftMin < 0) {
                logger.logConsole(sessionId, tag, `Time left ${timeLeftMin.toFixed(1)} min > ${TOKEN_REFRESH_TIME}. Generating new token...`);
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
        formData.append("scope", SCOPE);
        formData.append("client_secret", CLIENT_SECRET);
        formData.append("grant_type", "client_credentials");

        const headers = { "Content-Type": "application/x-www-form-urlencoded" };
        const tokenResult = await makeRequest({
            sessionId,
            tag: `${tag}-token`,
            url: TOKEN_API_URL,
            method: "POST",
            headers,
            data: formData.toString(),
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



// GET
async function getRequest({ sessionId, tag, url, headers = {}, params = null }) {
    const token = await getValidToken({ sessionId, tag });
    const reqHeaders = { ...headers, Authorization: `Bearer ${token}` };
    return makeRequest({ sessionId, tag, url, method: "GET", headers: reqHeaders, params });
}

// POST
async function postRequest({ sessionId, tag, url, headers = {}, data = null }) {
    const token = await getValidToken({ sessionId, tag });
    const reqHeaders = { ...headers, Authorization: `Bearer ${token}` };
    return makeRequest({ sessionId, tag, url, method: "POST", headers: reqHeaders, data });
}

module.exports = { getRequest, postRequest };
