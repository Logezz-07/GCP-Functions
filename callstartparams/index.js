const functions = require("@google-cloud/functions-framework");
const apiRequest = require('@roger/r4b-common-nodemodules').apiClient;
const logger = require('@roger/r4b-common-nodemodules').logger;
const axios = require("axios");
functions.http("helloHttp", async (req, res) => {
  const sessionId = req.body.sessionInfo?.session.split("/sessions/").pop() || "unknown-session";
  const tag = req.body.fulfillmentInfo?.tag || "Unknown-Tag";
  logger.logWebhookDetails(sessionId, tag);
  const sessionParamsFromCX = req.body.sessionInfo?.parameters || {};
  let sessionParams = {};
  let Status = 1;
  let ResponsePayload = {}
  iiwjierji
  try {
    console.log("webhook invocation started");
    if (tag === "callStartApi") {
      const dnis = sessionParamsFromCX?.Dnis || "NA";
      logger.logWebhookRequest(sessionId, tag, { Dnis: dnis });
      const apiUrl = `https://dev1-cct.rogers.com/dev01-config/ivr-config-ms/ivr/${dnis}/call-start/params`;
      const headers = {
        cdr: "112432245667775757",
        clientSystem: "IVR",
        brand: "FIDO",
        transactionId: "454545323",
        transactionDateTime: "2024-11-07T10:23:00",
        ivrSubscriptionKey: "f9422c1450c747aaaca69253a489f3c6",
      };

      const apiResult = await apiRequest.getRequest({ sessionId, tag, url: apiUrl, headers });
      Status = apiResult.Status;
      ResponsePayload = apiResult.ResponsePayload;

      if (Status === 200 && apiResult.ReturnCode === "0") {
        const dnisParams = ResponsePayload.dnisParams || {};
        const aniParams = ResponsePayload.aniParams || {};
        sessionParams = {
          SearchBusinessContact: dnisParams.icmSearch?.searchBusinessContact || "NA",
          HomeContact: dnisParams.icmSearch?.searchHomeContact || "NA",
          MobileContact: dnisParams.icmSearch?.searchMobileContact || "NA",
          aniConfirm: dnisParams.aniConfirm || "NA",
          aniLookup: dnisParams?.aniLookup || "NA",
          dnisLang: dnisParams.language?.offerLanguageMenu || "NA",
          identifyAccount: dnisParams.identifyAccount || "NA",
          npaLanguage: aniParams.npaLanguage || "NA",
          offerlanguageMenu: dnisParams.language?.offerLanguageMenu || "NA",
          predctiveEnd: dnisParams.predictiveInd || "NA",
          validAni: aniParams.validANI || "NA",
          returnCode: "0",
        };
      } else {
        sessionParams = {
          returnCode: apiResult.ReturnCode || "1",
          response: ResponsePayload,
        };
      }
    }

    // ---------------------- AniIdentification ---------------------- //
    else if (tag === "AniIdentification") {
      const ani = sessionParamsFromCX?.Ani || "NA";
      logger.logWebhookRequest(sessionId, tag, { Ani: ani });

      const apiUrl = "https://dev1-cct.rogers.com/dev01-identification/ivr-identification-ms/idc/data";
      const headers = {
        cdr: "112432245667775757",
        clientSystem: "IVR",
        brand: "FIDO",
        transactionId: "4545453232",
        transactionDateTime: "2024-11-07T10:23:00",
        ivrSubscriptionKey: "f9422c1450c747aaaca69253a489f3c6",
      };

      const params = {
        brand: "FIDO",
        searchHomeContact: "Y",
        searchMobileContact: "Y",
        searchBusinessContact: "Y",
        phoneNumber: ani,
        predictiveInd: "Y",
      };

      const apiResult = await apiRequest.getRequest({ sessionId, tag, url: apiUrl, headers, params });
      Status = apiResult.Status;
      ResponsePayload = apiResult.ResponsePayload;
      if (Status === 200 && ResponsePayload.identifiedCustomer) {
        const accountList = [];
        ResponsePayload.idcData?.primaryContacts?.forEach((contact) => {
          contact.customers?.forEach((customer) => {
            customer.accounts?.forEach((account) => {
              if (account.accountNumber) {
                accountList.push(account.accountNumber.slice(-4));
              }
            });
          });
        });
        sessionParams = {
          returnCode: "0",
          identifiedCustomer: ResponsePayload.identifiedCustomer,
          AccountList: accountList,
        };

      } else {
        sessionParams = {
          returnCode: "1",
          response: ResponsePayload,
        };
      }
    }

    // ---------------------- Webhook Response ---------------------- //
    const webhookResponse = { sessionInfo: { parameters: { ...sessionParams } } };
    logger.logWebhookResponse(sessionId, tag, webhookResponse);
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(webhookResponse);
  } catch (err) {
    logger.logErrorResponse({ sessionId, tag, attempt: 1, err });

    const returnCode = "1";
    const errorDetails =
      err.code === "ECONNABORTED"
        ? "Request timed out after 15 seconds"
        : err.message || String(err);

    const webhookResponse = {
      sessionInfo: { parameters: { returnCode, errorDetails } },
    };

    logger.logWebhookResponse(sessionId, tag, webhookResponse);
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(webhookResponse);
  }
});