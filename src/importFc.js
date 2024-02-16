async function prepFcImportBody(campaignsData) {
  console.log("OFG: prepFcBody");
  let fcImportBody = {
    "campaigns": [],
  };
  return fcImportBody;
}

function importFc(fcImportBody) {
  const businessUnitId = fcImportBody.buId;
  const weekDateId = fcImportBody.weekDateId;

  console.log("OFG: importFc with body", fcImportBody);

  const importUrl = fetchDataWithRetry(
    `/api/v2/workforcemanagement/businessunits/${businessUnitId}/weeks/${weekDateId}/shorttermforecasts/import/uploadurl`,
    "POST",
    {
      "contentLengthBytes": 1123,
    }
  );
}
