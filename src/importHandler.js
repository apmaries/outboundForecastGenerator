import { handleApiCalls } from "./apiHandler.js";

export async function prepFcImportBody(
  forecastData,
  buStartDayOfWeek,
  description
) {
  console.log("[OFG] Preparing Forecast Import Body and encoding to gzip");
  console.log(
    "[OFG] Preparing forecast data: ",
    JSON.parse(JSON.stringify(forecastData))
  );

  // Function to gzip encode the body
  function gzipEncode(body) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(body));
    return pako.gzip(data);
  }

  // Function to round the values to 2 decimal places
  function roundToTwo(num) {
    return +(Math.round(num + "e+2") + "e-2");
  }

  // Build the body for the forecast import
  let planningGroupsArray = [];

  for (let i = 0; i < forecastData.length; i++) {
    const campaign = forecastData[i];
    const campaigPgId = campaign.pgId;
    console.log(`[OFG] Processing forecast for Planning Group: ${campaigPgId}`);

    // Reorder arrays to align to BU start day of week
    console.debug(
      `[OFG] ${campaigPgId}: Reordering forecast data to ${buStartDayOfWeek} week start`
    );
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

    // Replicate the new 0 index at the end of the arrays
    console.debug(
      `[OFG] ${campaigPgId}: Adding required 8th day to reordered forecast data`
    );
    contactsIntradayReordered.push(contactsIntradayReordered[0]);
    ahtIntradayReordered.push(ahtIntradayReordered[0]);

    // Flatten the arrays
    console.debug(`[OFG] ${campaigPgId}: Flattening reordered forecast data`);
    const offeredPerInterval = contactsIntradayReordered.flat();
    const averageHandleTimeSecondsPerInterval = ahtIntradayReordered.flat();

    // Round data per interval to 2 decimal places
    console.debug(
      `[OFG] ${campaigPgId}: Rounding forecast data to 2 decimal places`
    );
    // offered
    for (let i = 0; i < offeredPerInterval.length; i++) {
      offeredPerInterval[i] = roundToTwo(offeredPerInterval[i]);
    }
    // aht
    for (let i = 0; i < averageHandleTimeSecondsPerInterval.length; i++) {
      averageHandleTimeSecondsPerInterval[i] = roundToTwo(
        averageHandleTimeSecondsPerInterval[i]
      );
    }

    // Create the object for the planning group
    console.debug(
      `[OFG] ${campaigPgId}: Creating Planning Group object for import body`
    );
    let pgObj = {
      "planningGroupId": campaigPgId,
      "offeredPerInterval": offeredPerInterval,
      "averageHandleTimeSecondsPerInterval":
        averageHandleTimeSecondsPerInterval,
    };
    planningGroupsArray.push(pgObj);
  }

  // Create the forecast import body
  console.debug("[OFG] Creating Forecast Import Body");
  let fcImportBody = {
    "description": description,
    "weekCount": 1,
    "planningGroups": planningGroupsArray,
  };

  // downloadJson(fcImportBody, "fcImportBody");

  let fcImportGzip = gzipEncode(fcImportBody);
  let contentLengthBytes = fcImportGzip.length;

  console.log(`[OFG] Body encoded to gzip with length: ${contentLengthBytes}`);

  return [fcImportBody, fcImportGzip, contentLengthBytes];
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

  return importUrl;
}

export async function invokeGCF(uploadAttributes, forecastData) {
  console.log("[OFG] Invoking GCF");
  // Get client id from session storage
  const clientId = sessionStorage.getItem("oauth_client");

  // Define the URL for the GCF
  const url =
    "https://us-central1-outboundforecastgenerator.cloudfunctions.net/makePUT"; // GCF URL
  const apiKey = clientId; // Using users OAuth client id as API key

  const uploadUrl = uploadAttributes.url;
  const uploadHeaders = uploadAttributes.headers;

  const data = {
    url: uploadUrl,
    header: uploadHeaders,
    data: forecastData,
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

  console.log(`[OFG] GCF response status: `, response.status);
  return response.status;
}

export async function importFc(businessUnitId, weekDateId, uploadKey) {
  console.log("[OFG] Importing forecast");

  const importResponse = await handleApiCalls(
    "WorkforceManagementApi.postWorkforcemanagementBusinessunitWeekShorttermforecastsImport",
    businessUnitId, // Pass selected Business Unit ID
    weekDateId, // Pass selected Week Date ID
    {
      "uploadKey": uploadKey,
    }
  );

  console.log("[OFG] Import response: ", importResponse);
  console.log("[OFG] Forecast import complete");
  return importResponse;
}
