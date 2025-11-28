import * as functions from "@google-cloud/functions-framework";
import {
  apiClient, logger, getIvaConfigs, preloadNluConfig,
  getNluConfigByKey, parseJson
} from "@roger/r4b-common-nodemodules";



functions.http("helloHttp", async (req, res) => {


  const params = req.body.sessionInfo?.parameters || {};
  const tag = req.body.fulfillmentInfo?.tag || "Unknown-Tag";
  const sessionId = params.sessionId || "unknown-session";

  logger.logWebhookDetails(sessionId, tag);
  if (tag === "getCallStartParams") {
    let Status = 500;
    let ResponsePayload = {};
    let sessionParams = {};
    try {
      const dnis = params.dnis || "NA";
      const ani = params.ani || "NA";
      const env = params.mwInstance || "qa4";
      logger.logWebhookRequest(sessionId, tag, { dnis, ani, env });

      // Load IVA Config
      const ivaResultConfig = await getIvaConfigs({ sessionId, tag });
      const ivaConfig = ivaResultConfig.ResponsePayload;

      const apiUrl = ivaConfig[tag + `-${env}`].replace("${dnis}", dnis).replace("${ani}", ani);
      const time = new Date().toISOString()
      const headers = {
        cdr: sessionId,
        transactionId: `${sessionId}-${ani}`,
        transactionDateTime: time,
      };

      // Parallel Tasks — API Call + NLU Preload
      const [apiSettle, nluSettle] = await Promise.allSettled([
        apiClient.getRequest({
          sessionId, tag, url: apiUrl, headers, ivaConfig
        }),
        preloadNluConfig({ sessionId, tag })
      ]);
      if (nluSettle.status === "rejected") {
        logger.logConsole(sessionId, tag, "NLU preload failed (continuing)");
      }
      if (apiSettle.status === "fulfilled") {
        const apiResult = apiSettle.value;
        Status = apiResult.Status;
        ResponsePayload = apiResult.ResponsePayload;
      } else {
        logger.logConsole(sessionId, tag, "API request failed ");
      }
      if (Status === 200) {
        const d = ResponsePayload.dnisParams || {};
        const a = ResponsePayload.aniParams || {};

        sessionParams = {
          brand: parseJson(d.brand),
          dnisLanguage: parseJson(d.language?.dnisLanguage),
          aniLookup: parseJson(d.aniLookup),
          validANI: parseJson(a.validANI),
          searchHomeContact: parseJson(d.icmSearch?.searchHomeContact),
          searchMobileContact: parseJson(d.icmSearch?.searchMobileContact),
          searchBusinessContact: parseJson(d.icmSearch?.searchBusinessContact),
          npaLanguage: parseJson(a.npaLanguage),
          greetingScriptEn: parseJson(d.greetingScript?.scriptContent?.en),
          greetingScriptFr: parseJson(d.greetingScript?.scriptContent?.fr),
          disclaimerScriptEn: parseJson(d.disclaimerScript?.scriptContent?.en),
          disclaimerScriptFr: parseJson(d.disclaimerScript?.scriptContent?.fr),
          offerLanguageMenu: parseJson(d.language?.offerLanguageMenu),
          applicationId: parseJson(d.applicationId),
          aniConfirm: parseJson(d.aniConfirm),
          identifyAccount: parseJson(d.identifyAccount),
          involuntaryRedirect: parseJson(d.involuntaryRedirect),
          voluntaryRedirect: parseJson(d.voluntaryRedirect),
          returnCode: "0"
        };
      } else {
        sessionParams = {
          returnCode: "1",
          brand: "NA",
          dnisLanguage: "NA",
          aniLookup: "NA",
          validANI: "NA",
          searchHomeContact: "NA",
          searchMobileContact: "NA",
          searchBusinessContact: "NA",
          npaLanguage: "NA",
          greetingScriptEn: "NA",
          greetingScriptFr: "NA",
          disclaimerScriptEn: "NA",
          disclaimerScriptFr: "NA",
          offerLanguageMenu: "NA",
          applicationId: "NA",
          aniConfirm: "NA",
          identifyAccount: "NA",
          involuntaryRedirect: "NA",
          voluntaryRedirect: "NA",
        };
      }
      // Spread IVA config values + session params
      const finalParams = {
        ...ivaConfig,
        ...sessionParams
      };
      const webhookResponse = {
        sessionInfo: { parameters: finalParams }
      };
      logger.logWebhookResponse(sessionId, tag, webhookResponse);
      res.status(200).json(webhookResponse);
    } catch (err) {
      logger.logErrorResponse({ sessionId, tag, attempt: 1, err });
      const webhookResponse = {
        sessionInfo: {
          parameters: {
            returnCode: "1",
            errorDetails: err.message || String(err)
          }
        }
      };
      logger.logWebhookResponse(sessionId, tag, webhookResponse);
      res.setHeader("Content-Type", "application/json");
      res.status(200).send(webhookResponse);
    }
  }
  else {
    logger.logConsole(sessionId, tag, "Invalid tag for this function");
    const webhookResponse = {
      sessionInfo: {
        parameters: {
          returnCode: "1",
          errorDetails: "Invalid tag for this function"
        }
      }
    };
    logger.logWebhookResponse(sessionId, tag, webhookResponse);
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(webhookResponse);
  }
});