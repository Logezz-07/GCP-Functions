import * as functions from "@google-cloud/functions-framework";
import {
  apiClient, logger, getIvaConfigs, parseJson, fallbackApiData
} from "@roger/r4b-common-nodemodules";


functions.http("helloHttp", async (req, res) => {

  const params = req.body.sessionInfo?.parameters || {};
  let tag = req.body.fulfillmentInfo?.tag || "Unknown-Tag";
  let sessionId = params.sessionId || "Unknown-Session";
  logger.logWebhookDetails(sessionId, tag);

  if (tag === "getCallStartParams") {
    let Status = 500;
    let ResponsePayload = {};
    let sessionParams = {};
    let ivaConfig = {};
    try {
      const dnis = params.dnis || "NA";
      const ani = params.ani || "NA";
      const env = params.mwInstance || "qa4";
      logger.logWebhookRequest(sessionId, tag, { dnis, ani, env });

      // Load IVA Config
      const ivaResultConfig = await getIvaConfigs({ sessionId, tag });
      ivaConfig = ivaResultConfig.ResponsePayload;
      const tokenConfig = {
        timeOutMs: ivaConfig.timeOutMs,
        apiAttempts: ivaConfig.apiAttempts,
        tokenUrl: ivaConfig.getToken[env],
        scope: ivaConfig.scope[env],
        tokenRefreshTimeMin: ivaConfig.tokenRefreshTimeMin
      }

      const apiUrl = ivaConfig[tag][env].replace("${dnis}", dnis).replace("${ani}", ani);

      const time = new Date().toISOString()
      const headers = {
        cdr: sessionId,
        transactionId: `${sessionId}-${ani}`,
        transactionDateTime: time,
      };
      const apiResult = await apiClient.getRequest({ sessionId, tag, url: apiUrl, headers, tokenConfig });
      Status = apiResult.Status;
      ResponsePayload = apiResult.ResponsePayload;
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
          involuntaryRedirectInd: parseJson(d.involuntaryRedirectInd),
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
            ...fallbackApiData,
            ...ivaConfig
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
      let apiUrl = params[tag][env]
      const headers = {
        cdr: sessionId,
        transactionId: `${sessionId}-${ani}`,
        transactionDateTime: new Date().toISOString()
      };
      const tokenConfig = {
        timeOutMs: params.timeOutMs,
        apiAttempts: params.apiAttempts,
        tokenUrl: params.getToken[env],
        scope: params.scope[env],
        tokenRefreshTimeMin: params.tokenRefreshTimeMin
      }
      const requestBody = {
        "identifiers": {
          idType,
          idNumber,
          "filters": {
            searchHomeContact,
            searchMobileContact,
            searchBusinessContact,
            searchBrand
          }
        }
      };
      const apiResult = await apiClient.postRequest({
        sessionId,
        tag,
        url: apiUrl,
        headers,
        data: requestBody,
        tokenConfig
      });
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

      let apiUrl = params[tag][env]
      const headers = {
        cdr: sessionId,
        transactionId: `${sessionId}-${params.ani || "NA"}`,
        transactionDateTime: new Date().toISOString(),
      };

      const tokenConfig = {
        timeOutMs: params.timeOutMs,
        apiAttempts: params.apiAttempts,
        tokenUrl: params.getToken[env],
        scope: params.scope[env],
        tokenRefreshTimeMin: params.tokenRefreshTimeMin
      }

      // Build POST Body
      const requestBody = {
        broadcastId: broadcastId,
        dnis: dnis,
        language: language,
        applicationId: applicationId,
        brand: brand,
        sessionIds: accountNumber === "" ? sessionIds : [],
        sessionIdInContext: accountNumber === "" ? "" : sessionIds[0]
      };

      const apiResult = await apiClient.postRequest({
        sessionId,
        tag,
        url: apiUrl,
        headers,
        data: requestBody,
        tokenConfig
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

  else if (tag === "getAniIdentificationBySessionId") {
    let Status = 500;
    let ResponsePayload = {};
    let sessionParams = {};
    let requestBody = {};

    try {
      const env = params.mwInstance || "qa4";
      const ani = params.ani || "NA";
      const sessionList = params.accountSessionList || [];

      logger.logWebhookRequest(sessionId, tag, { env, sessionList });

      let apiUrl = params[tag.substring(0, 20)][env]
      const headers = {
        cdr: sessionId,
        transactionId: `${sessionId}-${ani}`,
        transactionDateTime: new Date().toISOString()
      };
      const tokenConfig = {
        timeOutMs: params.timeOutMs,
        apiAttempts: params.apiAttempts,
        tokenUrl: params.getToken[env],
        scope: params.scope[env],
        tokenRefreshTimeMin: params.tokenRefreshTimeMin
      }
      // request Body
      if (sessionList.length === 1) {
        requestBody = { "sessionIdInContext": sessionList[0] }
      } else {
        requestBody = { "sessionIds": sessionList }
      }
      const apiResult = await apiClient.postRequest({
        sessionId,
        tag,
        url: apiUrl,
        headers,
        data: requestBody,
        tokenConfig
      });
      Status = apiResult.Status;
      ResponsePayload = apiResult.ResponsePayload;
      const billingAccounts = parseJson(ResponsePayload.numberOfBillingAccounts) === "NA" ? 0 : parseJson(ResponsePayload.numberOfBillingAccounts);
      if (Status === 200 && billingAccounts !== 0 && billingAccounts <= 4) {
        const accounts = ResponsePayload.billingAccountInContext ? [ResponsePayload.billingAccountInContext] : [];
        let disambigMenuPrompt = "";
        let disambigMenuPromptNm1 = "";
        let disambigMenuPromptNm2 = "";
        let disambigMenuPromptNi1 = "";
        let disambigMenuPromptNi2 = "";

        // Sort business first
        accounts.sort((a, b) =>
          Number(b.businessInd === true) - Number(a.businessInd === true)
        );

        const accountNumberList = accounts.map(a => parseJson(a.accountNumber));
        const accountSessionList = accounts.map(a => parseJson(a.sessionId));
        const productLabelsMixList = accounts.map(a => parseJson(a.subscriptionSummary?.productLabelsMix));
        const businessIndList = accounts.map(a => parseJson(a.businessInd));
        const maestroAccountIndList = accounts.map(a => parseJson(a.maestroAccountInd));
        const collectionSuspendedIndList = accounts.map(a => parseJson(a.collectionSuspendedInd));
        const accountClassificationList = accounts.map(a => parseJson(a.accountClassification));
        const lobList = accounts.map(a => parseJson(a.lob));
        const accountStatusList = accounts.map(a => parseJson(a.accountStatus));

        const menuAccountOption = ["say One ", "say Two ", "say Three ", "say Four "];
        const nmNiAccountOption = ["say or press One", " say or press Two", "say or press Three", "say or pressFour,"]

        if (accounts.length === 1) {

          const last4 = accountNumberList[0]?.slice(-4);
          const products = productLabelsMixList[0] || "";
          const category = businessIndList[0] ? "Business" : "Personal";

          disambigMenuPrompt = `Are you calling about the ${category} account ending in ${last4} with ${products}?`;
          disambigMenuPromptNm1 = `I'm sorry, i didn't get that. Are you calling about the ${category} account ending in ${last4} with ${products}? You can say yes or no`;
          disambigMenuPromptNm2 = `If you are calling about the ${category} account ending in ${last4} with ${products}, say yes or press 1, or say no or press 2.`;
          disambigMenuPromptNi1 = `I'm sorry, I couldn't hear that. Are you calling about the ${category} account ending in ${last4} with ${products}? You can say yes or no`;
          disambigMenuPromptNi2 = `If you are calling about the ${category} account ending in ${last4} with ${products}, say yes or press 1, or say no or press 2.`;
        } else {

          accounts.forEach((acc, index) => {
            const last4 = accountNumberList[index]?.slice(-4);
            const products = productLabelsMixList[index] || "";
            const category = businessIndList[index] ? "Business" : "Personal";

            const optionPrompt = menuAccountOption[index];
            const dtmfOption = nmNiAccountOption[index];

            disambigMenuPrompt += `For the ${category} account ending in ${last4} with ${products}, ${optionPrompt},`;
            disambigMenuPromptNm2 += `For the ${category} account ending in ${last4} with ${products}, ${dtmfOption},`;
            disambigMenuPromptNi2 += `For the ${category} account ending in ${last4} with ${products}, ${dtmfOption},`
          });
          disambigMenuPromptNm1 = `I'm sorry, i didn't get that. ${disambigMenuPrompt}, or say,a different account.`
          disambigMenuPromptNm2 = `I'm sorry, i still didn't get that. ${disambigMenuPromptNm2}, or say, a different account. or press ${billingAccounts + 1}.`
          disambigMenuPromptNi1 = `I'm sorry, i didn't get that. ${disambigMenuPrompt}, or say,a different account.`
          disambigMenuPromptNi2 = `I'm sorry, i still couldn't hear that. ${disambigMenuPromptNi2}, or say, a different account. or press ${billingAccounts + 1}.`

        }

        sessionParams = {
          numberOfBillingAccounts: billingAccounts,
          lastFourAccountNumberList: accountNumberList.map(a => a !== "NA" ? a.slice(-4) : "NA"),
          accountNumberList,
          accountSessionList,
          maestroAccountIndList,
          accountClassificationList,
          collectionSuspendedIndList,
          lobList,
          accountStatusList,
          disambigMenuPrompt,
          disambigMenuPromptNi1,
          disambigMenuPromptNi2,
          disambigMenuPromptNm1,
          disambigMenuPromptNm2,
          returnCode: "0"
        };
      } else if (billingAccounts === 0) {
        sessionParams = {
          returnCode: "0",
          numberOfBillingAccounts: billingAccounts
        };
      }
      else {
        sessionParams = {
          returnCode: "1"
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

  else if (tag === "getBillingProfile") {
    let Status = 500;
    let ResponsePayload = {};
    let sessionParams = {};

    try {
      const env = params.mwInstance || "qa4";
      const accountNumber = params.accountNumber || "NA";
      const maestroInd = params.maestroInd || false;
      const lob = params.lob || "NA";
      const accountBrand = params.brand || "ROGERS";
      const sessionIdInContext = params.sessionIdInContext || "NA";

      logger.logWebhookRequest(sessionId, tag, {
        env, accountNumber, maestroInd, lob, accountBrand
      });

      // URL 
      let apiUrl = params[tag][env]
        .replace("${accountNumber}", accountNumber)
        .replace("${maestroInd}", maestroInd)
        .replace("${lob}", lob)
        .replace("${accountBrand}", accountBrand)
        .replace("${sessionId}", sessionIdInContext);

      const headers = {
        cdr: sessionId,
        transactionId: `${sessionId}-${params.ani || "NA"}`,
        transactionDateTime: new Date().toISOString(),
      };

      const tokenConfig = {
        timeOutMs: params.timeOutMs,
        apiAttempts: params.apiAttempts,
        tokenUrl: params.getToken[env],
        scope: params.scope[env],
        tokenRefreshTimeMin: params.tokenRefreshTimeMin
      }

      const apiResult = await apiClient.getRequest({
        sessionId,
        tag,
        url: apiUrl,
        headers,
        tokenConfig
      });

      Status = apiResult.Status;
      ResponsePayload = apiResult.ResponsePayload;

      if (Status === 200) {
        const b = ResponsePayload.billingProfile;

        sessionParams = {
          billingAccountNumber: parseJson(b?.billingAccountNumber),
          actualBalance: parseJson(b?.balanceDetails?.actualBalance),
          returnCode: "0",
        };

      } else {
        sessionParams = {
          returnCode: "1"
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
            returnCode: "1"
          }
        }
      };

      logger.logWebhookResponse(sessionId, tag, webhookResponse);
      res.setHeader("Content-Type", "application/json");
      res.status(200).send(webhookResponse);
    }
  }

  else if (tag === "getPredictiveTreatment") {
    let Status = 500;
    let ResponsePayload = {};
    let sessionParams = {};

    try {
      const env = params.mwInstance || "qa4";
      const language = params.flowLanguage || "NA";
      const brand = params.brand || "ROGERS";
      const applicationId = params.applicationId || "NA";
      const accountNumber = params.accountNumber || "";
      const sessionIds = params.accountSessionList || [];

      logger.logWebhookRequest(sessionId, tag, {
        env, language, brand, applicationId, sessionIds
      });

      const apiUrl = params[tag][env];

      const headers = {
        cdr: sessionId,
        transactionId: `${sessionId}-${params.ani || "NA"}`,
        transactionDateTime: new Date().toISOString(),
      };

      const tokenConfig = {
        timeOutMs: params.timeOutMs,
        apiAttempts: params.apiAttempts,
        tokenUrl: params.getToken[env],
        scope: params.scope[env],
        tokenRefreshTimeMin: params.tokenRefreshTimeMin
      }

      // Build POST Payload
      const requestBody = {
        language: language,
        brand: brand,
        applicationId: applicationId,
        sessionIds: accountNumber === "" ? sessionIds : [],
        sessionIdInContext: accountNumber === "" ? "" : sessionIds[0]
      };

      const apiResult = await apiClient.postRequest({
        sessionId,
        tag,
        url: apiUrl,
        headers,
        data: requestBody,
        tokenConfig
      });

      Status = apiResult.Status;
      ResponsePayload = apiResult.ResponsePayload;

      if (Status === 200 && ResponsePayload.enabled === true) {
        const p = ResponsePayload.predictiveRule;
        sessionParams = {
          enabled: parseJson(ResponsePayload.enabled),
          predictiveMessageAvailable: parseJson(p?.predictiveMessageAvailable),
          questionOrMessage: parseJson(p?.questionOrMessage),
          voiceScriptContent: parseJson(p?.predictiveScript?.voiceScriptContent),
          intent: parseJson(p?.intent),
          action: parseJson(p?.action),
          systemOverride: parseJson(p?.routingParams?.systemOverride),
          returnCode: "0"
        }
      } else {
        sessionParams = {
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