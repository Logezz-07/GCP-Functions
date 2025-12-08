import * as functions from "@google-cloud/functions-framework";
import {
  apiClient, logger, getIvaConfigs, preloadNluConfig,
  getNluConfigByKey, parseJson, fallbackApiData
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
      if (apiSettle.status === "fulfilled") {
        const apiResult = apiSettle.value;
        Status = apiResult.Status;
        ResponsePayload = apiResult.ResponsePayload;
      } else {
        logger.logConsole(sessionId, tag, "API request failed ");
      }
      if (Status === 200) {
        const d = ResponsePayload || {};

        sessionParams = {
          brand: parseJson(d.brand),
          dnisLanguage: parseJson(d.dnisLanguage),
          aniLookup: parseJson(d.aniLookup),
          validAni: parseJson(d.aniDetails?.validANI),
          searchHomeContact: parseJson(d.icmSearchIndicators?.searchHomeContact),
          searchMobileContact: parseJson(d.icmSearchIndicators?.searchMobileContact),
          searchBusinessContact: parseJson(d.icmSearchIndicators?.searchBusinessContact),
          npaLanguage: parseJson(d.aniDetails?.npaLanguage),
          greetingScriptEn: parseJson(d.greetingScript?.scriptContent?.en),
          greetingScriptFr: parseJson(d.greetingScript?.scriptContent?.fr),
          disclaimerScriptEn: parseJson(d.disclaimerScript?.scriptContent?.en),
          disclaimerScriptFr: parseJson(d.disclaimerScript?.scriptContent?.fr),
          offerLanguageMenu: parseJson(d.offerLanguageMenu),
          applicationId: parseJson(d.applicationId),
          aniConfirm: parseJson(d.aniConfirm),
          identifyAccount: parseJson(d.identifyAccount),
          idType: parseJson(d.idType),
          involuntaryRedirect: parseJson(d.involuntaryRedirectInd),
          voluntaryRedirect: parseJson(d.voluntaryRedirect),
          returnCode: "0"
        };
      }
      else {
        sessionParams = {
          returnCode: "1",
          ...fallbackApiData
        };
      }
      // Spread IVA config values + session params
      const finalParams = {
        ...ivaConfig,
        ...sessionParams
      };
      const webhookResponse = {
        sessionInfo: {
          parameters: finalParams
        }
      };
      logger.logWebhookResponse(sessionId, tag, webhookResponse);
      res.status(200).json(webhookResponse);
    } catch (err) {
      logger.logErrorResponse({ sessionId, tag, attempt: 1, err });
      const webhookResponse = {
        sessionInfo: {
          parameters: {
            returnCode: "1",
            ...fallbackApiData
          }
        }
      };
      logger.logWebhookResponse(sessionId, tag, webhookResponse);
      res.setHeader("Content-Type", "application/json");
      res.status(200).send(webhookResponse);
    }
  }

  else if (tag === "getAniIdentification") {
    let Status = 500;
    let ResponsePayload = {};
    let sessionParams = {};

    try {
      const env = params.mwInstance || "qa4";
      const ani = params.ani || "NA";
      const accountNumber = params.accountNumber || "NA"
      const idType = params.callerIdType || "NA";
      const idNumber = params.callerIdType === "phone" ? ani : accountNumber;
      const searchHomeContact = params.searchHomeContact || false;
      const searchMobileContact = params.searchMobileContact || false;
      const searchBusinessContact = params.searchBusinessContact || false;
      const searchBrand = params.brand || "NA";

      logger.logWebhookRequest(sessionId, tag, {
        ani, env, accountNumber, idType, idNumber, searchHomeContact, searchMobileContact, searchBusinessContact, searchBrand
      });
      const headers = {
        cdr: sessionId,
        transactionId: `${sessionId}-${ani}`,
        transactionDateTime: new Date().toISOString()
      };
      const ivaConfig = {
        timeOutMs: params.timeOutMs,
        apiAttempts: params.apiAttempts,
        tokenUrl: params.tokenUrl,
        scope: params.scope,
        tokenRefreshTimeMin: params.tokenRefreshTimeMin
      }
      let apiUrl = params[`${tag}-${env}`]
        .replace("${idType}", idType)
        .replace("${idNumber}", idNumber)
        .replace("${searchHomeContact}", searchHomeContact)
        .replace("${searchMobileContact}", searchMobileContact)
        .replace("${searchBusinessContact}", searchBusinessContact)
        .replace("${searchBrand}", searchBrand);
      const apiResult = await apiClient.getRequest({ sessionId, tag, url: apiUrl, headers, ivaConfig });
      Status = apiResult.Status;
      ResponsePayload = apiResult.ResponsePayload;

      if (Status === 200) {
        const accounts = ResponsePayload.billingAccounts || [];
        const accountNumberList = accounts.map(a => parseJson(a.accountNumber));
        const accountSessionList = accounts.map(a => parseJson(a.sessionId));

        sessionParams = {
          dirtyAni: parseJson(ResponsePayload.dirtyANI),
          numberOfBillingAccounts: parseJson(ResponsePayload.numberOfBillingAccounts) === "NA" ? 0 : parseJson(ResponsePayload.numberOfBillingAccounts),
          uniqueBillingLanguage: parseJson(ResponsePayload.uniqueBillingLanguage),
          billingLanguage: parseJson(accounts[0]?.billingLanguage),
          accountNumberList,
          accountSessionList,
          returnCode: "0"
        };
      } else {
        sessionParams = {
          returnCode: "1",
        };
      }

      const webhookResponse = {
        sessionInfo: {
          parameters: sessionParams
        }
      };

      logger.logWebhookResponse(sessionId, tag, webhookResponse);
      res.status(200).json(webhookResponse);

    } catch (err) {
      logger.logErrorResponse({ sessionId, tag, attempt: 1, err });

      const webhookResponse = {
        sessionInfo: {
          parameters: {
            returnCode: "1",
          }
        }
      };

      logger.logWebhookResponse(sessionId, tag, webhookResponse);
      res.setHeader("Content-Type", "application/json");
      res.status(200).send(webhookResponse);
    }
  }

  else if (tag === "getBroadcastMessage") {
    let Status = 500;
    let ResponsePayload = {};
    let sessionParams = {};

    try {
      const env = params.mwInstance || "qa4";
      const broadcastId = params.broadcastId || "NA";
      const dnis = params.dnis || "NA";
      const language = params.flowLanguage || "NA";
      const brand = params.brand || "NA";
      const applicationId = params.applicationId || "NA";
      const accountNumber = params.accountNumber || "";
      const sessionIds = params.accountSessionList || [];


      logger.logWebhookRequest(sessionId, tag, { env, broadcastId, dnis, language, brand, applicationId, sessionIds, sessionIdInContext: accountNumber });

      const apiUrl = params[`${tag}-${env}`];
      const headers = {
        cdr: sessionId,
        transactionId: `${sessionId}-${params.ani || "NA"}`,
        transactionDateTime: new Date().toISOString(),
      };

      // IVA config 
      const ivaConfig = {
        timeOutMs: params.timeOutMs,
        apiAttempts: params.apiAttempts,
        tokenUrl: params.tokenUrl,
        scope: params.scope,
        tokenRefreshTimeMin: params.tokenRefreshTimeMin
      };

      // Build POST Body
      const requestBody = {
        broadcastId: broadcastId,
        dnis: dnis,
        language: language,
        applicationId: applicationId,
        brand: brand,
        sessionIds: sessionIds,
        sessionIdInContext: accountNumber
      };

      const apiResult = await apiClient.postRequest({
        sessionId,
        tag,
        url: apiUrl,
        headers,
        data: requestBody,
        ivaConfig
      });

      Status = apiResult.Status;
      ResponsePayload = apiResult.ResponsePayload;

      if (Status === 200) {

        const b = ResponsePayload.broadcast;
        const type = b?.questionOrMessage;

        // Common fields
        sessionParams = {
          enabled: parseJson(ResponsePayload.enabled),
          questionOrMessage: parseJson(type),
          primaryMessage: parseJson(b?.broadcastScript?.voiceScriptContent),
          nextAction: parseJson(b?.nextAction),
          intent: parseJson(b?.intent),
          smsEnabled: parseJson(b?.smsEnabled),
          returnCode: "0",
        };
        // Question
        if (type === "question") {
          sessionParams.secondaryMessageRequired = parseJson(b?.secondaryMessageRequired);
          sessionParams.secondaryMessage = parseJson(b?.secondaryMessageScript?.voiceScriptContent);
        }

      } else {
        sessionParams = {
          enabled: "false",
          returnCode: "1"
        };
      }

      const webhookResponse = {
        sessionInfo: { parameters: sessionParams }
      };

      logger.logWebhookResponse(sessionId, tag, webhookResponse);
      res.status(200).json(webhookResponse);

    } catch (err) {
      logger.logErrorResponse({ sessionId, tag, attempt: 1, err });

      const webhookResponse = {
        sessionInfo: {
          parameters: {
            enabled: "false",
            returnCode: "1",
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