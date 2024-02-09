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

  // Declare historicalData variable with a default value
  var historicalDataByCampaign = [];

  // Returns the ISO week of the date.
  function getWeek(date) {
    var dateCopy = new Date(date.getTime());
    dateCopy.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    dateCopy.setDate(dateCopy.getDate() + 3 - ((dateCopy.getDay() + 6) % 7));
    // January 4 is always in week 1.
    var week1 = new Date(dateCopy.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return (
      1 +
      Math.round(
        ((dateCopy.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    );
  }

  // Returns the four-digit year corresponding to the ISO week of the date.
  function getWeekYear(date) {
    var dateCopy = new Date(date.getTime());
    dateCopy.setDate(dateCopy.getDate() + 3 - ((dateCopy.getDay() + 6) % 7));
    return dateCopy.getFullYear();
  }

  function getYearWeek(date) {
    var week = getWeek(date);
    var year = getWeekYear(date);
    // Pad the week number with a leading zero if necessary
    var weekString = String(week).padStart(2, "0");
    return `${year}-${weekString}`;
  }

  function processQueryResults(results) {
    // loop through results and crunch numbers
    for (let i = 0; i < results.length; i++) {
      var resultsGrouping = results[i];
      console.log(`OFG: Processing query group ${i + 1}`);
      var group = resultsGrouping.group;
      var data = resultsGrouping.data;
      var campaignId = group.outboundCampaignId;

      // check if campaign exists in historicalDataByCampaign
      var campaignExists = historicalDataByCampaign.some(
        (campaign) => campaign.campaignId === campaignId
      );

      // if campaign does not exist, create a new campaign object
      if (!campaignExists) {
        let campaignObj = {
          campaignId: campaignId,
          historicalWeeks: [],
        };
        historicalDataByCampaign.push(campaignObj);
      }

      // for each interval in the data, get the week number and add to the campaign object
      for (let j = 0; j < data.length; j++) {
        var interval = data[j].interval;
        var metrics = data[j].metrics;

        const [startString, _] = interval.split("/");
        const startDate = new Date(startString);
        //const localDateTimeString = startDate.toLocaleString();
        const weekNumber = getYearWeek(startDate);

        var campaignIndex = historicalDataByCampaign.findIndex(
          (campaign) => campaign.campaignId === campaignId
        );

        // add weekNumber to campaign object if it does not yet exist
        var weekExists = historicalDataByCampaign[
          campaignIndex
        ].historicalWeeks.some((week) => week.weekNumber === weekNumber);
        if (!weekExists) {
          let weekObj = {
            weekNumber: weekNumber,
            dailySummary: {},
            intradayValues: [],
          };
          historicalDataByCampaign[campaignIndex].historicalWeeks.push(weekObj);
        }
      }
    }
    console.warn(historicalDataByCampaign);
  }
}
