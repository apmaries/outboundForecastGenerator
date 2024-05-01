import { handleApiCalls } from "./apiHandler.js";
import { downloadJson } from "./pageHandler.js";

export async function prepFcImportBody(campaignsData) {
  console.log("[OFG] Preparing Forecast Import Body and encoding to gzip");

  // function to gzip encode the body
  function gzipEncode(body) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(body));
    return pako.gzip(data);
  }

  // build the body for the forecast import
  const fcDescription = "Outbound Forecast";

  let planningGroupsArray = [];

  for (let i = 0; i < campaignsData.length; i++) {
    const campaign = campaignsData[i];
    const campaigPgId = campaign.pgId;
    const offeredPerInterval = campaign.fcData.contactsIntraday.flat();
    const averageHandleTimeSecondsPerInterval =
      campaign.fcData.ahtIntraday.flat();

    // function to round the values to 2 decimal places
    function roundToTwo(num) {
      return +(Math.round(num + "e+2") + "e-2");
    }

    // round the average handle time to 2 decimal places
    for (let i = 0; i < averageHandleTimeSecondsPerInterval.length; i++) {
      averageHandleTimeSecondsPerInterval[i] = roundToTwo(
        averageHandleTimeSecondsPerInterval[i]
      );
    }

    // round the offered per interval to 2 decimal places
    for (let i = 0; i < offeredPerInterval.length; i++) {
      offeredPerInterval[i] = roundToTwo(offeredPerInterval[i]);
    }

    let pgObj = {
      "planningGroupId": campaigPgId,
      "offeredPerInterval": offeredPerInterval,
      "averageHandleTimeSecondsPerInterval":
        averageHandleTimeSecondsPerInterval,
    };
    planningGroupsArray.push(pgObj);
  }

  let fcImportBody = {
    "description": fcDescription,
    "weekCount": 1,
    "planningGroups": planningGroupsArray,
  };

  downloadJson(fcImportBody, "fcImportBody");

  let fcImportGzip = gzipEncode(fcImportBody);
  let contentLengthBytes = fcImportGzip.length;

  console.log(`[OFG] Body encoded to gzip with length: ${contentLengthBytes}`);

  return [fcImportGzip, contentLengthBytes];
}

export async function generateUrl(
  businessUnitId,
  weekDateId,
  contentLengthBytes
) {
  console.log("[OFG] Generating URL for import");
  console.debug("[OFG] Content Length Bytes: " + contentLengthBytes);

  const importUrl = await handleApiCalls(
    "WorkforceManagementApi.postWorkforcemanagementBusinessunitWeekShorttermforecastsImportUploadurl",
    businessUnitId, // Pass selected Business Unit ID
    weekDateId, // Pass selected Week Date ID
    {
      "contentLengthBytes": contentLengthBytes,
    }
  );
  console.debug("[OFG] Import URL: ", importUrl);

  return importUrl;
}

export async function importFc(
  businessUnitId,
  weekDateId,
  gzip,
  uploadAttributes
) {
  console.log("[OFG] Uploading forecast");

  const uploadKey = uploadAttributes.uploadKey;
  const uploadUrl = uploadAttributes.url;
  const uploadHeaders = uploadAttributes.headers;

  //temp logging
  console.debug("[OFG] Upload Key: ", uploadKey);
  console.debug("[OFG] Upload URL: ", uploadUrl);
  console.debug("[OFG] Upload Headers: " + JSON.stringify(uploadHeaders));
  console.debug(JSON.stringify(uploadHeaders));
  console.debug(uploadHeaders);
  // this all looks fine but the upload is being blocked on CORS :(

  // upload gzip to upload url with uploadHeaders
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: uploadHeaders,
    body: gzip,
  });

  // Add debugging for response
  console.log(
    "[OFG] Upload Response: ",
    uploadResponse.status,
    uploadResponse.statusText
  );

  // check if upload was successful
  if (uploadResponse.ok) {
    console.log("[OFG] Forecast uploaded successfully");

    // complete the import
    const importAttributes = {
      "uploadKey": uploadKey,
    };

    const importResponse = await handleApiCalls(
      "WorkforceManagementApi.postWorkforcemanagementBusinessunitWeekShorttermforecastsImport",
      businessUnitId, // Pass selected Business Unit ID
      weekDateId, // Pass selected Week Date ID
      {
        "uploadKey": uploadKey,
      }
    );

    console.log("[OFG] Forecast import complete");
    return importResponse;
  } else {
    console.error("[OFG] Forecast upload failed");
    return null;
  }
}
