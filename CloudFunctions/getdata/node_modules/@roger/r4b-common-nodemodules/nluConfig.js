import { Storage } from "@google-cloud/storage";
import * as logger from "./logger.js";
import csv from "csvtojson";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const NLU_CONFIG_PATH = process.env.GCS_NLU_CONFIG_PATH;
const NLU_CONFIG_KEY = process.env.GCS_NLU_CONFIG_KEY;

const dirname = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_NLU_PATH = path.resolve(dirname, "./fallbackConfigs/r4b-nlu-config.csv");

let cachedNluConfig = null;
let nluConfigEtag = null;

async function preloadNluConfig({ sessionId, tag }) {
  try {
    const file = storage.bucket(BUCKET_NAME).file(NLU_CONFIG_PATH);

    const metaStart = Date.now();
    const [metadata] = await file.getMetadata();
    const metaTime = Date.now() - metaStart;
    logger.logConsole(sessionId, tag, `NLU metadata fetched in ${metaTime} ms (etag=${metadata.etag})`);

    if (cachedNluConfig && nluConfigEtag === metadata.etag) {
      logger.logConsole(sessionId, tag, "NLU config served from cache");
      return;
    }

    const downloadStart = Date.now();
    const [contents] = await file.download();
    const downloadTime = Date.now() - downloadStart;

    logger.logConsole(sessionId, tag, `NLU file downloaded in ${downloadTime} ms`);

    const jsonArray = await csv().fromString(contents.toString());
    cachedNluConfig = jsonArray;
    nluConfigEtag = metadata.etag;

    logger.logConsole(sessionId, tag, `NLU cache updated (${jsonArray.length} rows)`);

  } catch (err) {
    logger.logErrorResponse({ sessionId, tag, attemptCount: 1, err });
    logger.logConsole(sessionId, tag, "Using fallback NLU config");

    try {
      const fallbackCSV = await readFile(FALLBACK_NLU_PATH, "utf-8");
      cachedNluConfig = await csv().fromString(fallbackCSV);
      nluConfigEtag = "fallback-local";

      logger.logConsole(
        sessionId,
        tag,
        `Fallback NLU CSV loaded (${cachedNluConfig.length} rows)`
      );
    } catch (fallbackErr) {
      logger.logErrorResponse({ sessionId, tag, attemptCount: 2, err: fallbackErr });
      logger.logConsole(sessionId, tag, "Fallback NLU config also failed");
      cachedNluConfig = []; // safe empty array
    }
  }
}

async function getNluConfigByKey({ sessionId, tag, key }) {
  if (!cachedNluConfig) {
    logger.logConsole(sessionId, tag, "NLU cache empty, preloading...");
    await preloadNluConfig({ sessionId, tag });
  }

  const filtered = cachedNluConfig.filter(row => row[NLU_CONFIG_KEY] === key);

  if (filtered.length === 0) {
    return {
      Status: 404,
      ReturnCode: "1",
      ResponsePayload: { message: "Config key not found" }
    };
  }

  return {
    Status: 200,
    ReturnCode: "0",
    ResponsePayload: filtered[0]
  };
}

export { getNluConfigByKey, preloadNluConfig };
