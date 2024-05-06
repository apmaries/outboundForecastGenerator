import { handleApiCalls } from "./apiHandler.js";
import { downloadJson, downloadGzip } from "./pageHandler.js";

export async function prepFcImportBody(
  campaignsData,
  buStartDayOfWeek,
  description
) {
  console.log("[OFG] Preparing Forecast Import Body and encoding to gzip");

  // function to gzip encode the body
  function gzipEncode(body) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(body));
    return pako.gzip(data);
  }

  // build the body for the forecast import
  let planningGroupsArray = [];

  for (let i = 0; i < campaignsData.length; i++) {
    const campaign = campaignsData[i];
    const campaigPgId = campaign.pgId;

    // Reorder arrays to align to BU start day of week
    const contactsIntraday = campaign.fcData.contactsIntraday;
    const ahtIntraday = campaign.fcData.ahtIntraday;

    const dayOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const buStartDayIndex = dayOfWeek.indexOf(buStartDayOfWeek);

    const contactsIntradayReordered = [];
    const ahtIntradayReordered = [];

    for (let i = 0; i < contactsIntraday.length; i++) {
      const index = (buStartDayIndex + i) % 7;
      contactsIntradayReordered.push(contactsIntraday[index]);
      ahtIntradayReordered.push(ahtIntraday[index]);
    }

    const offeredPerInterval = contactsIntradayReordered.flat();
    const averageHandleTimeSecondsPerInterval = ahtIntradayReordered.flat();

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
    "description": description,
    "weekCount": 1,
    "planningGroups": planningGroupsArray,
  };

  // downloadJson(fcImportBody, "fcImportBody");

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
  console.debug("[OFG] gzip: ", gzip);
  console.debug(JSON.stringify(uploadHeaders));
  console.debug(uploadHeaders);
  // this all looks fine but the upload is being blocked on CORS :(

  // download the gzip file
  downloadGzip(gzip);

  /*
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
  */
}

export async function invokeGCF(uploadAttributes, campaignsData) {
  console.log("[OFG] Invoking GCF");
  // Get client id from session storage
  const clientId = sessionStorage.getItem("oauth_client");

  // Define the URL for the GCF
  const url =
    "https://us-central1-outboundforecastgenerator.cloudfunctions.net/makePUT"; // GCF URL
  const apiKey = clientId; // Using users OAuth client id as API key

  // temp logging
  console.debug("[OFG] API Key: ", apiKey);

  const uploadUrl = uploadAttributes.url;
  const uploadHeaders = uploadAttributes.headers;

  const data = {
    url: uploadUrl,
    header: uploadHeaders,
    data: campaignsData,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": apiKey,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    console.error(`[OFG]: HTTP error! status: ${response.status}`);
    return null;
  }

  const result = await response.text();
  console.log(`[OFG] GCF result: `, result);
  return result;
}
