import { downloadJson } from "./pageHandler.js";
import {
  prepFcMetrics,
  groupByIndexNumber,
  generateAverages,
  applyContacts,
} from "./numberHandler.js";
import { prepFcImportBody, generateUrl, importFc } from "./importHandler.js";

export async function runGenerator(
  testMode,
  businessUnitName,
  businessUnitId,
  businessUnitStartDayOfWeek,
  selectedBuTimeZone,
  weekStart,
  historicalWeeks,
  planningGroupContactsArray,
  ignoreZeroes,
  inboundForecastMode,
  forecastDescription
) {
  // Log user variables
  console.log("[OFG] Forecast generation initiated");
  if (testMode) {
    console.warn(`[OFG] Running with test mode: ${testMode}`);
  }
  console.log("[OFG] User selected BU Name:", businessUnitName);
  console.log("[OFG] User selected BU ID:", businessUnitId);
  console.log("[OFG] User selected BU Start Day:", businessUnitStartDayOfWeek);
  console.log("[OFG] User selected BU TimeZone:", selectedBuTimeZone);
  console.log("[OFG] User selected week Start:", weekStart);
  console.log("[OFG] User selected historical Weeks:", historicalWeeks);
  console.log(
    "[OFG] Number of Planning Groups:",
    planningGroupContactsArray.length.toString()
  );
  for (let i = 0; i < planningGroupContactsArray.length; i++) {
    console.log(`[OFG] ${JSON.stringify(planningGroupContactsArray[i])}`);
  }
  console.log("[OFG] User selected ignore Zeroes:", ignoreZeroes.toString());
  console.log(
    "[OFG] User selected inbound Forecast Mode:",
    inboundForecastMode
  );
  console.log("[OFG] User selected forecast Description:", forecastDescription);

  // Declare variables
  let queryResults = [];
  var historicalDataByCampaign = [];

  // Functions start here
  function subscribe(buId) {
    const id = buId;
    const channelId = sessionStorage.getItem("notificationsId");

    console.log(`[OFG] Subscribing to notifications for BU ${id}`);
    const forecastTopic = `v2.workforcemanagement.businessunits.${id}.shorttermforecasts.import`;

    const forecastTopicBody = {
      "channelId": channelId,
      "topic": forecastTopic,
    };

    // temp logging
    console.warn(JSON.stringify(forecastTopicBody));

    // Subscribe to the forecast topic
    const subscribeToForecast = makeApiCallWithRetry(
      `/api/v2/notifications/channels/${channelId}/subscriptions`,
      "POST",
      [forecastTopicBody]
    );

    // log response from subscribeToForecast
    subscribeToForecast.then(() => {
      console.log(`[OFG] Subscribed to forecast topic ${forecastTopic}`);
    });
  }

  // Function to build query body
  async function queryBuilder() {
    let queriesArray = [];
    console.log(`[OFG] Query Builder initiated`);
    console.log(planningGroupContactsArray);
    console.log(historicalWeeks);
    return queriesArray;
  }

  // Function to execute queries
  async function executeQueries() {
    let queryResults = [];
    console.log(`[OFG] Executing queries`);
    console.log(businessUnitId);
    return queryResults;
  }

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

  async function processQueryResults(results) {
    // loop through results and crunch numbers
    for (let i = 0; i < results.length; i++) {
      var resultsGrouping = results[i];
      console.log(`[OFG] Processing query group ${i + 1}`);
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
        console.log(
          `[OFG] New campaign found in results. Campaign ID = ${campaignId}`
        );
        historicalDataByCampaign.push(campaignObj);
      }

      // create a baseWeekArray that contains 7 arrays of 96 zeros
      var baseWeekArray = Array.from({ length: 7 }, () =>
        Array.from({ length: 96 }, () => 0)
      );

      // create a new week object
      // TODO: Refactor to use a class
      let weekObj = {
        weekNumber: "",
        dailySummary: {
          // TODO: Refactor these to use an objects rather than arrays only - get's difficult to understand what's what when using arrays only later on
          nAttempted: Array(7).fill(0),
          nConnected: Array(7).fill(0),
          tHandle: Array(7).fill(0),
          nHandled: Array(7).fill(0),
        },
        intradayValues: {
          nAttempted: JSON.parse(JSON.stringify(baseWeekArray)),
          nConnected: JSON.parse(JSON.stringify(baseWeekArray)),
          tHandle: JSON.parse(JSON.stringify(baseWeekArray)),
          nHandled: JSON.parse(JSON.stringify(baseWeekArray)),
        },
      };

      // for each interval in the data, get the week number and add to the campaign object
      console.log(`[OFG] [${campaignId}] Extracting data from query results`);
      for (let j = 0; j < data.length; j++) {
        var interval = data[j].interval;
        var metrics = data[j].metrics;

        const [startString, _] = interval.split("/");
        const startDate = new Date(startString);
        const weekNumber = getYearWeek(startDate);

        // get weekday index from startDate
        const dayIndex = startDate.getDay();

        // get interval index from startDate
        const hours = startDate.getHours();
        const minutes = startDate.getMinutes();
        const totalMinutes = hours * 60 + minutes;
        const intervalDuration = 15;
        const intervalIndex = Math.floor(totalMinutes / intervalDuration);

        var campaignIndex = historicalDataByCampaign.findIndex(
          (campaign) => campaign.campaignId === campaignId
        );

        // add weekNumber to campaign object if it does not yet exist
        var weekExists = historicalDataByCampaign[
          campaignIndex
        ].historicalWeeks.some((week) => week.weekNumber === weekNumber);
        if (!weekExists) {
          weekObj.weekNumber = weekNumber;
          historicalDataByCampaign[campaignIndex].historicalWeeks.push(weekObj);
        }

        // loop through metrics and add to dailySummary & intradayValues
        for (let k = 0; k < metrics.length; k++) {
          var metric = metrics[k];
          var metricName = metric.metric;

          // nOuotboundAttempted
          if (metricName === "nOutboundAttempted") {
            var attempted = metric.stats.count;

            // add nOutboundAttempted stat to dailySummary
            weekObj.dailySummary.nAttempted[dayIndex] += attempted;

            // add nOutboundAttempted stat to intradayValues
            weekObj.intradayValues.nAttempted[dayIndex][intervalIndex] +=
              attempted;
          }

          // nOutboundConnected
          if (metricName === "nOutboundConnected") {
            var connected = metric.stats.count;

            // add nOutboundConnected stat to dailySummary
            weekObj.dailySummary.nConnected[dayIndex] += connected;

            // add nOutboundConnected stat to intradayValues
            weekObj.intradayValues.nConnected[dayIndex][intervalIndex] +=
              connected;
          }

          // tHandle
          if (metricName === "tHandle") {
            var tHandle = metric.stats.sum / 1000; // convert to seconds
            var nHandled = metric.stats.count;

            // add tHandle stats to dailySummary
            weekObj.dailySummary.tHandle[dayIndex] += tHandle;
            weekObj.dailySummary.nHandled[dayIndex] += nHandled;

            // add tHandle stats to intradayValues
            weekObj.intradayValues.tHandle[dayIndex][intervalIndex] += tHandle;
            weekObj.intradayValues.nHandled[dayIndex][intervalIndex] +=
              nHandled;
          }
        }
      }
    }
  }

  async function runFunctionOnCampaign(campaign, func, funcName, ...args) {
    try {
      campaign = await func(campaign, ...args);
      downloadJson(campaign, `${funcName}_${campaign.campaignId}`);
    } catch (error) {
      console.error(`[OFG] Error occurred while running ${funcName}:`, error);
    }
    return campaign;
  }

  async function prepareForecast() {
    let functionsToRun = [
      { func: prepFcMetrics, name: "prepFcMetrics" },
      { func: groupByIndexNumber, name: "groupByIndexNumber" },
      {
        func: generateAverages,
        name: "generateAverages",
        args: [ignoreZeroes],
      },
      {
        func: applyContacts,
        name: "applyContacts",
        args: [planningGroupContactsArray, testMode],
      },
    ];

    let fcPrepPromises = historicalDataByCampaign.map(async (campaign) => {
      console.log(
        `[OFG] [${campaign.campaignId}] Preparing campaign for forecast`
      );

      for (let { func, name, args = [] } of functionsToRun) {
        campaign = await runFunctionOnCampaign(campaign, func, name, ...args);
      }

      return campaign;
    });

    Promise.all(fcPrepPromises).then(async (completedCampaigns) => {
      console.log("[OFG] All campaigns have been processed.");
      downloadJson(completedCampaigns, "completedCampaigns");

      let [importGzip, contentLength] = await prepFcImportBody(
        completedCampaigns,
        businessUnitStartDayOfWeek
      );
      let uploadAttributes = await generateUrl(
        businessUnitId,
        weekStart,
        contentLength
      );

      importFc(businessUnitId, weekStart, importGzip, uploadAttributes);
    });
  }

  // Functions end here

  // Main code starts here

  // Create a WebSocket connection
  const notificationsUri = sessionStorage.getItem("notificationsUri");
  if (notificationsUri) {
    const ws = new WebSocket(notificationsUri);

    // Connection opened
    ws.addEventListener("open", (event) => {
      console.log("WebSocket connection opened");
      subscribe(businessUnitId);
      // Send a subscribe message if your WebSocket server requires it
      // ws.send(JSON.stringify({ type: 'subscribe', channel: 'your-channel' }));
    });

    // Listen for messages
    ws.addEventListener("message", (event) => {
      const notification = event.data;
      const topicName = notification.topicName;
      if (topicName !== "channel.metadata") {
        console.log("[OFG] Message from server: ", event.data);
      }
      // If the data is JSON, you might want to parse it
      // const data = JSON.parse(event.data);
    });

    // Connection closed
    ws.addEventListener("close", (event) => {
      console.log("[OFG] WebSocket connection closed");
    });

    // Connection error
    ws.addEventListener("error", (event) => {
      console.log("[OFG] WebSocket error: ", event);
    });
  }

  if (testMode) {
    // load test data
    fetch("./test/testData.json")
      .then((response) => response.json())
      .then(async (testData) => {
        queryResults = testData;
        console.log("[OFG] Test data loaded");

        await processQueryResults(queryResults);

        // added download for testing purposes
        downloadJson(historicalDataByCampaign, "historicalDataByCampaign_base");

        prepareForecast(); // Call the function to continue execution
      })
      .catch((error) => {
        console.error(error);
      });
  } else {
    // TODO: Update for production
    console.warn(
      "[OFG] Running in live mode - this has not yet been completed!"
    );
    // Execute queryBuilder after queueCampaignMatcher complete
    var queriesArray = await queryBuilder();

    // Execute historical data queries
    queryResults = await executeQueries(queriesArray);
    await processQueryResults(queryResults);
    prepareForecast(); // Call the function to continue execution
  }
}
