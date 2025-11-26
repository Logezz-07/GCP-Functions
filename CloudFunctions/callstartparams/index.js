import * as functions from "@google-cloud/functions-framework";
import {
  apiClient, logger, getIvaConfigs, preloadNluConfig,
  getNluConfigByKey
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
      const Dnis = params.Dnis || "NA";
      const Ani = params.Ani || "NA";
      logger.logWebhookRequest(sessionId, tag, { Dnis, Ani });

      // Load IVA Config
      const ivaResultConfig = await getIvaConfigs({ sessionId, tag });
      const ivaConfig = ivaResultConfig.ResponsePayload;

      const apiUrl = ivaConfig[tag].replace("${Dnis}", Dnis).replace("${Ani}", Ani);
      const time = new Date().toISOString()
      const headers = {
        cdr: sessionId,
        clientSystem: ivaConfig.CLIENT_SYSTEM,
        brand: ivaConfig.BRAND,
        transactionId: `${sessionId}-${time}`,
        transactionDateTime: time,
        ivrSubscriptionKey: ivaConfig.IVR_SUBSCRIPTION_KEY
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
        //parse and set session params
        sessionParams = {
          SearchBusinessContact: d.icmSearch?.searchBusinessContact || "NA",
          HomeContact: d.icmSearch?.searchHomeContact || "NA",
          MobileContact: d.icmSearch?.searchMobileContact || "NA",
          aniConfirm: d.aniConfirm || "NA",
          aniLookup: d?.aniLookup || "NA",
          dnisLang: d.language?.offerLanguageMenu || "NA",
          identifyAccount: d.identifyAccount || "NA",
          npaLanguage: a.npaLanguage || "NA",
          offerlanguageMenu: d.language?.offerLanguageMenu || "NA",
          predctiveEnd: d.predictiveInd || "NA",
          validAni: a.validANI || "NA",
          returnCode: "0"
        };
      } else {
        sessionParams = {
          returnCode: "1",
          response: ResponsePayload
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