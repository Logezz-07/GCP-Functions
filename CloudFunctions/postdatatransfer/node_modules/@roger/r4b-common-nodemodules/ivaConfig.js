import { Storage } from "@google-cloud/storage";
import * as logger from "./logger.js";

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const CONFIG_PATH = process.env.GCS_CONFIG_PATH;


let cachedConfig = null;
let lastEtag = null;

async function getIvaConfigs({ sessionId, tag }) {
    let status = null;
    let returnCode = "1";
    let responsePayload = {};

    try {
        const file = storage.bucket(BUCKET_NAME).file(CONFIG_PATH);

        const metaStart = Date.now();
        const [metadata] = await file.getMetadata();
        const metaTime = Date.now() - metaStart;
        logger.logConsole(sessionId, tag, `Metadata fetched in ${metaTime} ms (etag=${metadata.etag})`);


        if (cachedConfig && lastEtag === metadata.etag) {
            logger.logConsole(sessionId, tag, `Config served from cache (etag=${metadata.etag})`);
            status = 200;
            returnCode = "0";
            responsePayload = cachedConfig;
        } else {

            const downloadStart = Date.now();
            const [contents] = await file.download();
            const downloadTime = Date.now() - downloadStart;

            const config = JSON.parse(contents.toString());
            cachedConfig = config;
            lastEtag = metadata.etag;

            logger.logConsole(
                sessionId,
                tag,
                `Config downloaded in ${downloadTime} ms (etag=${metadata.etag})`
            );
            status = 200;
            returnCode = "0";
            responsePayload = config;
        }
    } catch (err) {
        logger.logErrorResponse({ sessionId, tag, attempt: 1, err });
        status = 500;
        returnCode = "1";
        responsePayload = { message: err.message };
    }

    return { Status: status, ReturnCode: returnCode, ResponsePayload: responsePayload };
}

export { getIvaConfigs };