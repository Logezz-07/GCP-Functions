const functions = require("@google-cloud/functions-framework");
const apiRequest = require('@roger/r4b-common-nodemodules').apiClient;
const logger = require('@roger/r4b-common-nodemodules').logger;

functions.http("helloHttp", async (req, res) => {
    const sessionId = req.body.sessionInfo?.session?.split("/sessions/").pop() || "unknown-session";
    const tag = req.body.fulfillmentInfo?.tag || "PostDataTransfer";
    logger.logWebhookDetails(sessionId, tag);
    const sessionParamsFromCX = req.body.sessionInfo?.parameters || {};
    let Status = 1;
    let ResponsePayload = {};
    ihwyas
    try {
        
        const secretHeader = {
            token: req.headers["token"],
            expiryTime: req.headers["expirytime"],
            clientId: req.headers["clientid"],
            clientSecret: req.headers["clientsecret"]
        };

        if (!secretHeader.token || !secretHeader.expiryTime || !secretHeader.clientId || !secretHeader.clientSecret) {
            throw new Error("Missing required secret headers");
        }
        const transferId = sessionParamsFromCX?.CONN_ID || "1234567890abcdef";
        const callingSystem = req.query?.callingSystem || "engage";

        const apiUrl = `https://dev1-cct.rogers.com/dev01-cctdtapi/data-transfer/1.0.0/datatransfer/${transferId}?callingSystem=${callingSystem}`;

        // headers
        const headers = {
            "Content-Type": "application/json",
            cdr: "112432245667775757",
            clientSystem: "IVR",
            brand: "FIDO",
            transactionId: "454545323",
            transactionDateTime: new Date().toISOString(),
            ivrSubscriptionKey: "f9422c1450c747aaaca69253a489f3c6"
        };

        // Prepare body payload
        const payload = [
            { keyName: "svcReferenceId", transformType: "any", value: sessionParamsFromCX?.svcReferenceId || transferId },
            { keyName: "AGENT_ALERT", transformType: "any", value: sessionParamsFromCX?.AGENT_ALERT || "Default Alert" },
            { keyName: "SemaphoneCR", transformType: "any", value: sessionParamsFromCX?.SemaphoneCR || "DefaultCR" },
            { keyName: "ANI", transformType: "phoneNumber", value: sessionParamsFromCX?.ANI || "0000000000" },
            { keyName: "LNG", transformType: "any", value: sessionParamsFromCX?.LNG || "en" },
            { keyName: "CONN_ID", transformType: "any", value: transferId },
            { keyName: "conversationId", transformType: "any", value: sessionParamsFromCX?.conversationId || transferId },
            { keyName: "lastChkPt", transformType: "any", value: sessionParamsFromCX?.lastChkPt || "" }
        ];

        logger.logWebhookRequest(sessionId, tag, payload);

        // Call API via apiClient (handles token internally)
        const apiResult = await apiRequest.postRequest({ sessionId, tag, url: apiUrl, headers, data: payload, secretHeader });
        Status = apiResult.Status;
        ResponsePayload = apiResult.ResponsePayload;

       
        let sessionParams = {};
        if (Status === 200 && apiResult.ReturnCode === "0") {
            sessionParams = { returnCode: "0", message: ResponsePayload?.message };
        } else {
            sessionParams = { returnCode: apiResult.ReturnCode || "1", response: ResponsePayload };
        }

        const webhookResponse = { sessionInfo: { parameters: sessionParams } };
        logger.logWebhookResponse(sessionId, tag, webhookResponse);

        res.setHeader("Content-Type", "application/json");
        res.status(200).send(webhookResponse);

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
});
