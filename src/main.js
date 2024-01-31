async function runHelper(
  businessUnitName,
  businessUnitId,
  selectedBuTimeZone,
  weekStart,
  numContacts,
  historicalWeeks
) {
  // Your existing scheduling logic goes here
  console.log("OFG: Selected BU Name:", businessUnitName);
  console.log("OFG: Selected BU TimeZone:", selectedBuTimeZone);
  console.log("OFG: Week Start:", weekStart);
  console.log("OFG: Number of Contacts:", numContacts);
  console.log("OFG: Historical Weeks:", historicalWeeks);

  // Function to get planning groups from BU id
  async function getPlanningGroups() {
    let planningGroupsArray = [];
    console.log(`OFG: Get Planning Groups initiated`);

    // Get planning groups
    planningGroupsArray = await fetchDataWithRetry(
      `/api/v2/workforcemanagement/businessunits/${businessUnitId}/planninggroups`,
      "GET"
    );
    console.log(JSON.stringify(planningGroupsArray));
    return planningGroupsArray;
  }

  // Function to get outbound campaigns
  async function getCampaigns() {
    let campaignsArray = [];
    console.log(`OFG: Get Campaigns initiated`);
    console.log(businessUnitId);
    return campaignsArray;
  }

  // Function to get queue campaigns
  async function queueCampaignMatcher() {
    let queueCampaignsArray = [];
    console.log(`OFG: Queue Campaigns initiated`);
    console.log(businessUnitId);
    return queueCampaignsArray;
  }

  // Function to build query body
  async function queryBuilder(queueCampaigns) {
    let queriesArray = [];
    console.log(`OFG: Query Builder initiated`);
    console.log(businessUnitId);
    console.log(historicalWeeks);
    return queriesArray;
  }

  // Function to execute queries
  async function executeQueries() {
    let queryResults = [];
    console.log(`OFG: Executing queries`);
    console.log(businessUnitId);
    return queryResults;
  }

  // Use Promise.all to run getPlanningGroups and getCampaigns concurrently
  var [planningGroups, campaigns] = await Promise.all([
    getPlanningGroups(),
    getCampaigns(),
  ]);

  // Execute queueCampaignMatcher after getPlanningGroups and getCampaigns complete
  var queueCampaignsResult = await queueCampaignMatcher();

  // Execute queryBuilder after queueCampaignMatcher complete
  var queriesArray = await queryBuilder(queueCampaignsResult);

  // Execute historical data queries
  var queryResults = await executeQueries(queriesArray);

  // Continue with the rest of the logic
}
