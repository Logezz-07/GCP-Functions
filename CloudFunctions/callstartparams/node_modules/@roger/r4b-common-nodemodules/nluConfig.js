import { Storage } from "@google-cloud/storage";
import * as logger from "./logger.js";
const csv = require("csvtojson");

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const NLU_CONFIG_PATH = process.env.GCS_NLU_CONFIG_PATH;
const NLU_CONFIG_KEY = process.env.GCS_NLU_CONFIG_KEY;

let cachedNluConfig = null;
let nluConfigEtag = null;

async function preloadNluConfig({ sessionId, tag }) {
  try {
    const file = storage.bucket(BUCKET_NAME).file(NLU_CONFIG_PATH);

    const [metadata] = await file.getMetadata();
    if (cachedNluConfig && nluConfigEtag === metadata.etag) {
      logger.logConsole(sessionId, tag, "NLU config already cached");
      return;
    }
    const [contents] = await file.download();
    const csvText = contents.toString();
    const jsonArray = await csv().fromString(csvText);

    cachedNluConfig = jsonArray;
    nluConfigEtag = metadata.etag;

    logger.logConsole(
      sessionId,
      tag,
      `NLU config updated in cache (${jsonArray.length} rows)`
    );

  } catch (err) {
      logger.logErrorResponse({ sessionId, tag, attemptCount: 1, err });
  }
}


async function getNluConfigByKey({ sessionId, tag, key }) {

  if (!cachedNluConfig) {
    logger.logConsole(sessionId, tag, "NLU cache empty, preloading...");
    await preloadNluConfig({ sessionId, tag });
  }

  const filtered = cachedNluConfig?.filter(row => row[NLU_CONFIG_KEY] == key) || [];

  if (filtered.length === 0) {
    logger.logConsole(sessionId, tag, `NLU key "${key}" not found`);
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