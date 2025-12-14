import * as logger from "./logger.js";
import * as apiClient from "./apiclient.js";
import { getIvaConfigs } from "./ivaConfig.js";
import fallbackApiData from "./fallbackConfigs/apiDefaultFields.json" with { type: "json" };

function parseJson(value) {
    if (value === undefined || value === null || value === "") return "NA";
    return value;
}


export { logger, apiClient, getIvaConfigs, parseJson, fallbackApiData }