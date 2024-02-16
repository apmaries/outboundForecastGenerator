async function prepFcImportBody(campaignsData) {
  console.log("OFG: Preparing Forecast Import Body and encoding to gzip");

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
  };

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

  return importUrl;
}

function importFc(fcImportBody) {
  const businessUnitId = fcImportBody.buId;
  const weekDateId = fcImportBody.weekDateId;

  console.log("OFG: importFc with body", fcImportBody);

  // Get import URL
  /*const importUrl = fetchDataWithRetry(
    `/api/v2/workforcemanagement/businessunits/${businessUnitId}/weeks/${weekDateId}/shorttermforecasts/import/uploadurl`,
    "POST",
    {
      "contentLengthBytes": 1123,
    }
  );*/
}
