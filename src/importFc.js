async function prepFcImportBody(campaignsData) {
  console.log("OFG: Preparing Forecast Import Body and encoding to gzip");

  // TODO: need to do this smarter so that it's not needed in main and importFc
  function downloadJson(body, jsonName) {
    var jsonData = JSON.stringify(body);
    var blob = new Blob([jsonData], {
      type: "application/json",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.download = `${jsonName}.json`;
    a.href = url;
    a.textContent = `Download ${jsonName}.json`;

    // Create a div for each download link
    var div = document.createElement("div");
    div.appendChild(a);

    var container = document.getElementById("test-mode");
    container.appendChild(div);
  }

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
    "canUseForScheduling": true,
  };

  downloadJson(fcImportBody, "fcImportBody");

  let fcImportGzip = gzipEncode(fcImportBody);
  let contentLengthBytes = fcImportGzip.length;

  console.log(`OFG: Body encoded to gzip with length: ${contentLengthBytes}`);

  return [fcImportGzip, contentLengthBytes];
}

async function generateUrl(businessUnitId, weekDateId, contentLengthBytes) {
  console.log("OFG: Generating URL for import");
  console.debug("OFG: Content Length Bytes: " + contentLengthBytes);

  const importUrl = await fetchDataWithRetry(
    `/api/v2/workforcemanagement/businessunits/${businessUnitId}/weeks/${weekDateId}/shorttermforecasts/import/uploadurl`,
    "POST",
    {
      "contentLengthBytes": contentLengthBytes,
    }
  );
  console.debug("OFG: Import URL: ", importUrl);

  return importUrl;
}

async function importFc(businessUnitId, weekDateId, gzip, uploadAttributes) {
  console.log("OFG: Uploading forecast");

  const uploadKey = uploadAttributes.uploadKey;
  const uploadUrl = uploadAttributes.url;
  const uploadHeaders = uploadAttributes.headers;
  const contentLength = new TextEncoder().encode(gzip).length;

  //temp logging
  console.debug("OFG: Upload Key: ", uploadKey);
  console.debug("OFG: Upload URL: ", uploadUrl);
  console.debug("OFG: Upload Headers: ", uploadHeaders);

  // upload gzip to upload url with uploadHeaders
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { ...uploadHeaders, "Content-Length": contentLength },
    body: gzip,
  });

  // Add debugging for response
  console.log(
    "OFG: Upload Response: ",
    uploadResponse.status,
    uploadResponse.statusText
  );

  // check if upload was successful
  if (uploadResponse.ok) {
    console.log("OFG: Forecast uploaded successfully");

    // complete the import
    const importAttributes = {
      "uploadKey": uploadKey,
    };

    const importResponse = await fetchDataWithRetry(
      `/api/v2/workforcemanagement/businessunits/${businessUnitId}/weeks/${weekDateId}/shorttermforecasts/import`,
      "POST",
      importAttributes
    );

    console.log("OFG: Forecast import complete");
    return importResponse;
  } else {
    console.error("OFG: Forecast upload failed");
    return null;
  }
}
