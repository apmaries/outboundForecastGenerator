import { makeApiCall } from "./apiHandler.js";

// Function to build query body
export async function queryBuilder() {
  let queriesArray = [];
  console.log(`[OFG] Query Builder initiated`);
  console.debug(
    "[OFG] planningGroupContactsArray: ",
    planningGroupContactsArray
  );
  console.debug("[OFG] historicalWeeks: ", historicalWeeks);
  return queriesArray;
}

// Function to execute queries
export async function executeQueries() {
  console.log(`[OFG] Executing queries`);

  // Needs to be completed - using test data for now
  // load test data
  return fetch("./test/testData.json")
    .then((response) => response.json())
    .then((testData) => {
      // replace planning group id's in test data with actual planning group id's from sco org
      for (let i = 0; i < testData.length; i++) {
        let campaign1 = "c1a07179-b2f2-4251-a1fa-9fd9b3219174";
        let campaign2 = "ce713659-c13a-486e-b978-28b77436bf67";
        let amCampaign1 = "dc853e3b-0c45-42c1-9e34-b52567f5a3c7";
        let amCampaign2 = "1896f07f-7a5c-4132-9f31-2ad69dd4435f";

        if (testData[i].group.outboundCampaignId === campaign1) {
          testData[i].group.outboundCampaignId = amCampaign1;
        } else if (testData[i].group.outboundCampaignId === campaign2) {
          testData[i].group.outboundCampaignId = amCampaign2;
        }
      }
      console.log("[OFG] Test data loaded");
      return testData;
    })
    .catch((error) => {
      console.error(error);
    });
}
