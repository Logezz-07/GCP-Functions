import { Storage } from "@google-cloud/storage";
import * as logger from "./logger.js";
import fallbackConfig from "./fallbackConfigs/config.json" with { type: "json" };


const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const CONFIG_PATH = process.env.GCS_CONFIG_PATH;


let cachedIvaConfig = null;
let ivaConfigEtag = null;

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


        if (cachedIvaConfig && ivaConfigEtag === metadata.etag) {
            logger.logConsole(sessionId, tag, `Config served from cache (etag=${metadata.etag})`);
            status = 200;
            returnCode = "0";
            responsePayload = cachedIvaConfig;
        } else {

            const downloadStart = Date.now();
            const [contents] = await file.download();
            const downloadTime = Date.now() - downloadStart;

            const config = JSON.parse(contents.toString());
            cachedIvaConfig = config;
            ivaConfigEtag = metadata.etag;

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
        logger.logErrorResponse({ sessionId, tag, attemptCount: 1, err });
        cachedIvaConfig = fallbackConfig;
        ivaConfigEtag = "fallback-local";
        logger.logConsole(sessionId, tag, "Using fallback IVA config");
        status = 500;
        returnCode = "1";
        responsePayload = fallbackConfig;
    }

    return { Status: status, ReturnCode: returnCode, ResponsePayload: responsePayload };
}

export { getIvaConfigs };