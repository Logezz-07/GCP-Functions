import * as logger from "./logger.js";
import * as apiClient from "./apiclient.js";
import { getIvaConfigs } from "./ivaConfig.js";
import { preloadNluConfig, getNluConfigByKey } from "./nluConfig.js";
import * as functions from "@google-cloud/functions-framework";

function parseJson(value) {
    if (value === undefined || value === null || value === "") return "NA";
    return value;
}


export { logger, apiClient, getIvaConfigs, getNluConfigByKey, preloadNluConfig, functions, parseJson }