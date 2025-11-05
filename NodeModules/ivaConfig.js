import { Storage } from "@google-cloud/storage";
import * as logger from "./logger.js";

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const CONFIG_PATH = process.env.GCS_CONFIG_PATH;

async function getIvaConfigs({ sessionId, tag }) {
    let status = null;
    let returnCode = "1";
    let responsePayload = {};

    try {
        logger.logConsole(sessionId, tag, `Fetching IVA Config from GCS: ${BUCKET_NAME}/${CONFIG_PATH}`);
        const startTime = Date.now();

        const [contents] = await storage.bucket(BUCKET_NAME).file(CONFIG_PATH).download();
        const config = JSON.parse(contents.toString());

        const executionTimeMs = Date.now() - startTime;
        logger.logConsole(sessionId, tag, `Config fetched successfully in ${executionTimeMs} ms`);
        // Set success response
        status = 200;
        returnCode = "0";
        responsePayload = config;

    } catch (err) {
        logger.logErrorResponse({ sessionId, tag, attempt: 1, err });
        // Set error response
        status = 500;
        returnCode = "1";
        responsePayload = { message: err.message };
    }

    return { Status: status, ReturnCode: returnCode, ResponsePayload: responsePayload };
}

export { getIvaConfigs };
