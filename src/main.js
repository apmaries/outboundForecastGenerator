import {
  downloadJson,
  hideLoadingSpinner,
  updateLoadingMessage,
  switchPages,
  loadPageOne,
  loadPageThree,
} from "./pageHandler.js";
import { subscribeToNotifications } from "./apiHandler.js";
import { queryBuilder, executeQueries } from "./queryHandler.js";
import {
  prepFcMetrics,
  groupByIndexNumber,
  generateAverages,
  applyContacts,
} from "./numberHandler.js";
import {
  prepFcImportBody,
  generateUrl,
  invokeGCF,
  importFc,
} from "./importHandler.js";
// invokeGCF calls a Google Cloud Function to make PUT request
// importFc makes a PUT request to the upload URL - need CORS fixed before being able to switch to this

// Gloabl variables
let completedPgForecast;

// Generate forecast data
export async function generateForecast(
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
  console.info("[OFG] Forecast generation initiated");

  // Log user variables
  let userSelections = {
    testMode,
    businessUnitName,
    businessUnitId,
    businessUnitStartDayOfWeek,
    selectedBuTimeZone,
    weekStart,
    historicalWeeks,
    planningGroupCount: planningGroupContactsArray.length,
    planningGroupDetails: planningGroupContactsArray,
    ignoreZeroes,
    inboundForecastMode,
    forecastDescription,
  };
  console.log("[OFG] User selections:", userSelections);

  // Declare variables
  let queryResults = [];
  var historicalDataByCampaign = [];

  // Functions start here

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
    console.log(`[OFG] Processing ${results.length} groups in query results`);
    // loop through results and crunch numbers
    for (let i = 0; i < results.length; i++) {
      var resultsGrouping = results[i];
      console.debug(`[OFG] Processing query group ${i + 1}`);
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
      console.debug(`[OFG] [${campaignId}] Extracting data from query results`);
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
      // downloadJson(campaign, `${funcName}_${campaign.campaignId}`);
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

    return Promise.all(fcPrepPromises).then(async (completedPgForecast) => {
      console.log(
        "[OFG] All campaigns have been processed.",
        completedPgForecast
      );
      return completedPgForecast;
    });
  }

  // Functions end here

  // Main code starts here

  if (testMode) {
    console.warn(
      "[OFG] Running in test mode - static data will be used for forecast generation"
    );
    // load test data
    try {
      const response = await fetch("./test/testData.json");
      const testData = await response.json();

      // Execute historical data queries
      updateLoadingMessage("generate-loading-message", "Retrieving test data");
      queryResults = testData;
      console.log("[OFG] Test historical campaign data loaded");
    } catch (error) {
      console.error(error);
    }
  } else {
    // TODO: Update for production
    console.warn(
      "[OFG] Running in live mode - this has not yet been completed!"
    );
    // Execute queryBuilder after queueCampaignMatcher complete
    updateLoadingMessage("generate-loading-message", "Building queries");
    var queriesArray = await queryBuilder(
      planningGroupContactsArray,
      historicalWeeks
    );

    // Execute historical data queries
    updateLoadingMessage("generate-loading-message", "Executing queries");
    queryResults = await executeQueries(queriesArray);
  }
  // Process query results
  updateLoadingMessage("generate-loading-message", "Processing query results");
  await processQueryResults(queryResults);

  // Prepare forecast
  updateLoadingMessage("generate-loading-message", "Preparing forecast");
  completedPgForecast = await prepareForecast();

  // Load page three
  loadPageThree();
}

// Import forecast to GC
export async function importForecast() {
  // Prepare forecast
  updateLoadingMessage("import-loading-message", "Preparing forecast");
  let [fcImportBody, importGzip, contentLength] = await prepFcImportBody();

  // temp logging
  console.log("[OFG] Forecast import body:", fcImportBody);

  // Declare variables
  let importOperationId = null;
  let generateOperationId = null;

  // Create a WebSocket connection
  let notificationsUri;
  let notificationsId;

  try {
    notificationsUri = sessionStorage.getItem("notifications_uri");
    notificationsId = sessionStorage.getItem("notifications_id");
  } catch (error) {
    console.error("[OFG] Error getting notifications URI and ID: ", error);
  }

  if (notificationsUri) {
    const ws = new WebSocket(notificationsUri);

    // Connection opened
    ws.addEventListener("open", (event) => {
      console.log("[OFG] WebSocket connection opened");

      // Create an async function inside the event listener to pause execution until the subscribe function is complete
      (async () => {
        await subscribeToNotifications(businessUnitId, notificationsId);
      })();

      // Call main function
      main();
    });

    // Listen for messages
    ws.addEventListener("message", (event) => {
      const notification = JSON.parse(event.data);
      const topicName = notification.topicName;

      if (topicName !== "channel.metadata") {
        // Check if eventBody and operationId are in notification
        if (
          notification.eventBody &&
          notification.eventBody.operationId === importOperationId
        ) {
          const status = notification.eventBody.status;
          console.log(`[OFG] Forecast import status updated <${status}>`);

          // Hide loading spinner div
          hideLoadingSpinner("results-container", "results-loading");

          const resultsContainer = document.getElementById("results-container");

          // Create a button to restart the process
          const restartButton = document.createElement("gux-button");
          restartButton.id = "restart-button";
          restartButton.setAttribute("accent", "secondary");
          restartButton.className = "align-left";
          restartButton.textContent = "Restart";

          // Create a button to open forecast
          const openForecastButton = document.createElement("gux-button");
          openForecastButton.id = "open-forecast-button";
          openForecastButton.setAttribute("accent", "primary");
          openForecastButton.setAttribute("disabled", "true");
          openForecastButton.className = "align-right";
          openForecastButton.textContent = "Open Forecast";

          // Add event listener to restart button
          restartButton.addEventListener("click", (event) => {
            switchPages("page-three", "page-one");
            loadPageOne();
          });

          let message;
          if (status === "Complete") {
            console.log("[OFG] Forecast import completed successfully!");

            const forecastId = notification.eventBody.result.id;

            // Add event listener to open forecast button
            openForecastButton.addEventListener("click", (event) => {
              window.top.location.href = `/directory/#/admin/wfm/forecasts/${businessUnitId}/update/${weekStart}${forecastId}`;
            });

            // Enable open forecast button
            openForecastButton.removeAttribute("disabled");

            // Insert div to id="results-container" with success message
            message = document.createElement("div");
            message.className = "alert-success";
            message.innerHTML = "Forecast imported successfully!";
            resultsContainer.appendChild(message);
          } else if (status === "Error" || status === "Canceled") {
            console.error("[OFG] Forecast import failed.", notification);
            const userMessage = notification.metadata.errorInfo.userMessage;

            // Insert div to id="results-container" with error message

            message = document.createElement("div");
            message.className = "alert-danger";
            message.innerHTML = "Forecast import failed!";
            resultsContainer.appendChild(message);

            const errorReason = document.createElement("div");

            errorReason.innerHTML = userMessage;
            resultsContainer.appendChild(errorReason);
          }
          // Create a new div
          const buttonsContainer = document.createElement("div");

          // Set the id, class, and style attributes
          buttonsContainer.id = "page-three-buttons";
          buttonsContainer.className = "row";
          buttonsContainer.style.paddingTop = "20px";

          // Append buttons to the results container
          buttonsContainer.appendChild(restartButton);
          buttonsContainer.appendChild(openForecastButton);

          // Append the buttonsContainer
          resultsContainer.appendChild(buttonsContainer);
        } else {
          console.log("[OFG] Message from server: ", notification);
        }
      }
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

  // Generate URL for upload
  updateLoadingMessage("import-loading-message", "Generating URL for upload");
  let uploadAttributes = await generateUrl(
    businessUnitId,
    weekStart,
    contentLength
  );

  // Upload forecast
  updateLoadingMessage("import-loading-message", "Uploading forecast");
  /* GCF function being used until CORS blocking removed */
  // importFc(businessUnitId, weekStart, importGzip, uploadAttributes);
  const uploadResponse = await invokeGCF(uploadAttributes, fcImportBody);

  // Check if upload was successful
  if (uploadResponse === 200) {
    const uploadKey = uploadAttributes.uploadKey;
    console.log("[OFG] Forecast uploaded successfully! Calling import method.");

    // Import forecast
    updateLoadingMessage("import-loading-message", "Importing forecast");
    const importResponse = await importFc(businessUnitId, weekStart, uploadKey);

    // Check if operation id is in response
    if (importResponse) {
      importOperationId = importResponse.operationId;
      console.log(
        `[OFG] Forecast import initiated. Operation ID: ${importOperationId}`
      );

      // Assign operationId to global importOperationId variable
      importOperationId = importResponse.operationId;
    } else {
      console.error("[OFG] Forecast import failed.");
    }
  }
}

// Function to validate planning group dropdown entries
export function validatePlanningGroupDropdown() {
  const planningGroupDropdown = document.getElementById(
    "planning-group-listbox"
  );

  // Get list of planning groups in listbox
  const planningGroups = planningGroupDropdown.querySelectorAll("gux-option");

  // Convert planningGroups to an array and iterate over it
  Array.from(planningGroups).forEach((option) => {
    // If the option value is not in fcImportBody.planningGroups, remove it
    if (!completedPgForecast.some((pg) => pg.pgId === option.value)) {
      console.warn(
        `[OFG] Planning group ${option.value} not found in forecast data. Removing...`
      );
      option.remove();
    }
  });
}

// Function to get forecast data for visualisation
export async function getPlanningGroupDataForDay(
  selectedPgId,
  selectedWeekDay
) {
  // ... existing code ...

  // Convert selectedWeekDay to a number
  selectedWeekDay = Number(selectedWeekDay);

  // Find the selected planning group
  let selectedPlanningGroup = completedPgForecast.find(
    (group) => group.pgId === selectedPgId
  );

  // Get the data for the selected day
  let offeredPerIntervalForDay =
    selectedPlanningGroup.fcData.contactsIntraday[selectedWeekDay];
  let averageHandleTimeSecondsPerIntervalForDay =
    selectedPlanningGroup.fcData.ahtIntraday[selectedWeekDay];

  // Get the daily total for the selected day
  let dailyTotalOffered =
    selectedPlanningGroup.fcData.contactsDaily[selectedWeekDay];
  let dailyTotalAHT = selectedPlanningGroup.fcData.ahtDaily[selectedWeekDay];

  // temp logging
  console.log("[OFG] dailyTotalOffered", dailyTotalOffered);
  console.log("[OFG] offeredPerIntervalForDay", offeredPerIntervalForDay);
  console.log("[OFG] dailyTotalAHT", dailyTotalAHT);
  console.log(
    "[OFG] averageHandleTimeSecondsPerIntervalForDay",
    averageHandleTimeSecondsPerIntervalForDay
  );

  // Convert data arrays into an array of objects
  let data = offeredPerIntervalForDay.map((offered, index) => ({
    interval: index,
    offered: offered,
    averageHandleTime: averageHandleTimeSecondsPerIntervalForDay[index],
  }));

  const visualizationSpecLineAllPoints = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "data": { "values": data },
    "transform": [
      {
        "calculate": "datum.interval / 4",
        "as": "hour",
      },
    ],
    "width": 360,
    "height": 360,
    "layer": [
      {
        "mark": {
          "type": "bar",
          "color": "rgb(31, 119, 180)",
        },
        "encoding": {
          "x": {
            "field": "hour",
            "type": "quantitative",
            "axis": {
              "tickMinStep": 1, // 1 hour intervals
              "title": "Time (hours)", // x-axis title
            },
            "scale": { "domain": [0, 24] }, // x-axis range from 0 to 24
          },
          "y": {
            "field": "offered",
            "type": "quantitative",
            "axis": {
              "title": "Offered", // y-axis title
            },
          },
          "tooltip": { "field": "offered", "type": "quantitative" },
        },
      },
      {
        "mark": {
          "type": "line",
          "interpolate": "monotone",
          "color": "rgb(255, 127, 14)",
        },
        "encoding": {
          "x": {
            "field": "hour",
            "type": "quantitative",
            "axis": {
              "tickMinStep": 1, // 1 hour intervals
              "title": "Time (hours)", // x-axis title
            },
            "scale": { "domain": [0, 24] }, // x-axis range from 0 to 24
          },
          "y": {
            "field": "averageHandleTime",
            "type": "quantitative",
            "axis": {
              "title": "Average Handle Time", // y-axis title
            },
          },
          "tooltip": { "field": "averageHandleTime", "type": "quantitative" },
        },
      },
    ],
    "resolve": {
      "scale": {
        "y": "independent",
      },
    },
  };

  const chart11 = document.querySelector("#chart");

  chart11.visualizationSpec = visualizationSpecLineAllPoints;

  // Original data for reset
  const originalData = JSON.parse(JSON.stringify(data));

  // Get the controls
  const smoothButton = document.getElementById("smooth-button");
  const flattenButton = document.getElementById("flatten-button");
  const resetButton = document.getElementById("reset-button");

  // Smooth button event listener
  smoothButton.addEventListener("click", () => {
    const metric = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Smoothing ${metric} data for planning group ${selectedPgId}`
    );

    console.log(data);
    data = data.map((d, i, arr) => {
      if (i === 0 || i === arr.length - 1) return d; // Skip the first and last element
      return {
        ...d,
        offered: (arr[i - 1].offered + d.offered + arr[i + 1].offered) / 3,
        averageHandleTime:
          (arr[i - 1].averageHandleTime +
            d.averageHandleTime +
            arr[i + 1].averageHandleTime) /
          3,
      };
    });
    chart11.visualizationSpec.data.values = data;
  });

  // Flatten button event listener
  flattenButton.addEventListener("click", () => {
    const metric = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Flattening ${metric} data for planning group ${selectedPgId}`
    );

    const nonZeroOffered = data.filter((d) => d.offered !== 0);
    const nonZeroAHT = data.filter((d) => d.averageHandleTime !== 0);
    const avgOffered =
      nonZeroOffered.reduce((sum, d) => sum + d.offered, 0) /
      nonZeroOffered.length;
    const avgAHT =
      nonZeroAHT.reduce((sum, d) => sum + d.averageHandleTime, 0) /
      nonZeroAHT.length;
    data = data.map((d) => ({
      ...d,
      offered: d.offered === 0 ? 0 : avgOffered,
      averageHandleTime: d.averageHandleTime === 0 ? 0 : avgAHT,
    }));
    chart11.visualizationSpec.data.values = data;
  });

  // Reset button event listener
  resetButton.addEventListener("click", () => {
    metric = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Resetting ${metric} data for planning group ${selectedPgId}`
    );

    data = JSON.parse(JSON.stringify(originalData));
    chart11.visualizationSpec.data.values = data;
  });

  // Unhide the controls div
  const controlsDiv = document.getElementById("controls");
  controlsDiv.hidden = false;
}

// Function to get forecast data for visualisation
export async function getPlanningGroupDataForDayFubar(
  selectedPgId,
  selectedWeekDay
) {
  console.log("[OFG] Getting planning group data for visualisation");

  // Function to create a chart
  function createChart(data) {
    // Filter out invalid values
    data = data.filter((d) => {
      return (
        d.offered !== null &&
        d.offered !== undefined &&
        isFinite(d.offered) &&
        d.averageHandleTime !== null &&
        d.averageHandleTime !== undefined &&
        isFinite(d.averageHandleTime)
      );
    });

    // Create a new spec with the updated data
    const newSpec = {
      ...visualizationSpecLineAllPoints,
      data: { values: data },
    };

    // Remove the old chart
    const chartElement = document.querySelector("#chart");
    while (chartElement.firstChild) {
      chartElement.removeChild(chartElement.firstChild);
    }

    // Create a new chart
    vegaEmbed("#chart", newSpec);
  }

  // Convert selectedWeekDay to a number
  selectedWeekDay = Number(selectedWeekDay);

  // Find the selected planning group
  let selectedPlanningGroup = completedPgForecast.find(
    (group) => group.pgId === selectedPgId
  );

  // Get the data for the selected day
  let offeredPerIntervalForDay =
    selectedPlanningGroup.fcData.contactsIntraday[selectedWeekDay];
  let averageHandleTimeSecondsPerIntervalForDay =
    selectedPlanningGroup.fcData.ahtIntraday[selectedWeekDay];

  // Get the daily total for the selected day
  let dailyTotalOffered =
    selectedPlanningGroup.fcData.contactsDaily[selectedWeekDay];
  let dailyTotalAHT = selectedPlanningGroup.fcData.ahtDaily[selectedWeekDay];

  // temp logging
  console.log("[OFG] dailyTotalOffered", dailyTotalOffered);
  console.log("[OFG] offeredPerIntervalForDay", offeredPerIntervalForDay);
  console.log("[OFG] dailyTotalAHT", dailyTotalAHT);
  console.log(
    "[OFG] averageHandleTimeSecondsPerIntervalForDay",
    averageHandleTimeSecondsPerIntervalForDay
  );

  // Convert data arrays into an array of objects
  let data = offeredPerIntervalForDay.map((offered, index) => ({
    interval: index,
    offered: offered,
    averageHandleTime: averageHandleTimeSecondsPerIntervalForDay[index],
  }));

  const chart11 = document.querySelector("#chart");

  chart11.visualizationSpec = visualizationSpecLineAllPoints;

  // Create the chart
  createChart(data);

  // Original data for reset
  const originalData = JSON.parse(JSON.stringify(data));

  // Get the controls
  const smoothButton = document.getElementById("smooth-button");
  const flattenButton = document.getElementById("flatten-button");
  const resetButton = document.getElementById("reset-button");

  // Smooth button event listener
  smoothButton.addEventListener("click", () => {
    const metric = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Smoothing ${metric} data for planning group ${selectedPgId}`
    );

    console.log(data);
    let newData = data.map((d, i, arr) => {
      if (i === 0 || i === arr.length - 1) return d; // Skip the first and last element
      return {
        ...d,
        offered: (arr[i - 1].offered + d.offered + arr[i + 1].offered) / 3,
        averageHandleTime:
          (arr[i - 1].averageHandleTime +
            d.averageHandleTime +
            arr[i + 1].averageHandleTime) /
          3,
      };
    });
    console.log(newData);

    // Update the chart data and re-render
    chart11.visualizationSpec.data.values = newData;
    createChart(chart11.visualizationSpec.data.values);
  });

  // Flatten button event listener
  flattenButton.addEventListener("click", () => {
    const metric = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Flattening ${metric} data for planning group ${selectedPgId}`
    );

    const nonZeroOffered = data.filter((d) => d.offered !== 0);
    const nonZeroAHT = data.filter((d) => d.averageHandleTime !== 0);
    const avgOffered =
      nonZeroOffered.reduce((sum, d) => sum + d.offered, 0) /
      nonZeroOffered.length;
    const avgAHT =
      nonZeroAHT.reduce((sum, d) => sum + d.averageHandleTime, 0) /
      nonZeroAHT.length;
    data = data.map((d) => ({
      ...d,
      offered: d.offered === 0 ? 0 : avgOffered,
      averageHandleTime: d.averageHandleTime === 0 ? 0 : avgAHT,
    }));
    chart11.visualizationSpec.data.values = data;
  });

  // Reset button event listener
  resetButton.addEventListener("click", () => {
    metric = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Resetting ${metric} data for planning group ${selectedPgId}`
    );

    data = JSON.parse(JSON.stringify(originalData));
    chart11.visualizationSpec.data.values = data;
  });

  // Unhide the controls div
  const controlsDiv = document.getElementById("controls");
  controlsDiv.hidden = false;
}
