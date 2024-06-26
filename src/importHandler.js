import { handleApiCalls } from "./apiHandler.js";
import { calculateWeightedAverages } from "./numberHandler.js";

export async function prepFcImportBody(groups, buStartDayOfWeek, description) {
  console.log("[OFG] Preparing Forecast Import Body and encoding to gzip");

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

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const planningGroup = group.planningGroup;
    const forecastData = group.forecastData;

    if (!forecastData) {
      console.warn(`[OFG] [${planningGroup.name}] No forecast data found`);
      continue;
    }

    console.debug(`[OFG] [${planningGroup.name}] Processing forecast data`);

    // Reorder arrays to align to BU start day of week
    console.debug(
      `[OFG] [${planningGroup.name}] Reordering forecast data to ${buStartDayOfWeek} week start`
    );
    const nContacts = forecastData.nContacts;
    const tHandle = forecastData.tHandle;
    const nHandled = forecastData.nHandled;
    const aHandleTime = calculateWeightedAverages(tHandle, nHandled);

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

    const nContactsReordered = [];
    const aHandleTimeReordered = [];

    for (let i = 0; i < nContacts.length; i++) {
      const index = (buStartDayIndex + i) % 7;
      nContactsReordered.push(nContacts[index]);
      aHandleTimeReordered.push(aHandleTime[index]);
    }

    // Replicate the new 0 index at the end of the arrays
    console.debug(
      `[OFG] [${planningGroup.name}] Adding required 8th day to reordered forecast data`
    );
    nContactsReordered.push(nContactsReordered[0]);
    aHandleTimeReordered.push(aHandleTimeReordered[0]);

    // Flatten the arrays
    console.debug(
      `[OFG] [${planningGroup.name}] Flattening reordered forecast data`
    );
    const offeredPerInterval = nContactsReordered.flat();
    const averageHandleTimeSecondsPerInterval = aHandleTimeReordered.flat();

    // Round data per interval to 2 decimal places
    console.debug(
      `[OFG] [${planningGroup.name}] Rounding forecast data to 2 decimal places`
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
      `[OFG] [${planningGroup.name}] Creating Planning Group object for import body`
    );
    let pgObj = {
      "planningGroupId": planningGroup.id,
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
