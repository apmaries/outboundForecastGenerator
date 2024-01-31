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

  // Execute queryBuilder after queueCampaignMatcher complete
  var queriesArray = await queryBuilder(queueCampaignsResult);

  // Execute historical data queries
  var queryResults = await executeQueries(queriesArray);

  // Continue with the rest of the logic
}
