async function runGenerator(
  testMode,
  businessUnitName,
  businessUnitId,
  selectedBuTimeZone,
  weekStart,
  historicalWeeks,
  planningGroupContactsArray
) {
  // Your existing scheduling logic goes here
  console.log("OFG: Selected BU Name:", businessUnitName);
  console.log("OFG: Selected BU TimeZone:", selectedBuTimeZone);
  console.log("OFG: Week Start:", weekStart);
  console.log("OFG: Historical Weeks:", historicalWeeks);
  console.log(
    "OFG: Number of Planning Groups:",
    planningGroupContactsArray.length
  );

  // Function to build query body
  async function queryBuilder() {
    let queriesArray = [];
    console.log(`OFG: Query Builder initiated`);
    console.log(planningGroupContactsArray);
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

  if (testMode) {
    var queryResults =
      // load test data
      fetch("./test/testData.json")
        .then((response) => response.json())
        .then((testData) => {
          var queryResults = testData;
          console.log("OFG: Test data loaded");
        })
        .catch((error) => {
          console.error(error);
        });
  } else {
    // Execute queryBuilder after queueCampaignMatcher complete
    var queriesArray = await queryBuilder();

    // Execute historical data queries
    var queryResults = await executeQueries(queriesArray);
  }

  // Continue with the rest of the logic
}
