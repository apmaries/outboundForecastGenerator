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
  console.log(
    "OFG: main.js runGenerator() initiated. Listing user variables..."
  );
  if (testMode) {
    console.warn(`OFG: Running with test mode: ${testMode}`);
  }
  console.log("OFG: Selected BU Name:", businessUnitName);
  console.log("OFG: Selected BU TimeZone:", selectedBuTimeZone);
  console.log("OFG: Week Start:", weekStart);
  console.log("OFG: Historical Weeks:", historicalWeeks);
  console.log(
    "OFG: Number of Planning Groups:",
    planningGroupContactsArray.length
  );
  for (let i = 0; i < planningGroupContactsArray.length; i++) {
    console.log(`OFG: ${JSON.stringify(planningGroupContactsArray[i])}`);
  }

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

  // Declare queryResults variable with a default value
  let queryResults = [];

  if (testMode) {
    // load test data
    fetch("./test/testData.json")
      .then((response) => response.json())
      .then((testData) => {
        queryResults = testData;
        console.log("OFG: Test data loaded");
        processQueryResults(queryResults);
      })
      .catch((error) => {
        console.error(error);
      });
  } else {
    // TODO: Update for production
    console.warn(
      "OFG: Running in live mode - this has not yet been completed!"
    );
    // Execute queryBuilder after queueCampaignMatcher complete
    var queriesArray = await queryBuilder();

    // Execute historical data queries
    queryResults = await executeQueries(queriesArray);
    processQueryResults(queryResults);
  }

  function processQueryResults(results) {
    // loop through results and crunch numbers
    for (let i = 0; i < results.length; i++) {
      console.log(`OFG: Processing query result ${i + 1}`);
      console.log(`OFG: ${JSON.stringify(results[i])}`);
      weeklyNumbersCruncher(results[i], selectedBuTimeZone);
    }
  }
}
