import { globalErrorHandler, handleError } from "./errorHandler.js";
import {
  downloadJson,
  hideLoadingSpinner,
  updateLoadingMessage,
  loadPageOne,
  loadPageThree,
  loadPageFour,
} from "./pageHandler.js";
import {
  queryBuilder,
  intervalBuilder,
  executeQueries,
} from "./queryHandler.js";
import {
  prepFcMetrics,
  generateAverages,
  applyContacts,
} from "./numberHandler.js";
import {
  generateInboundForecast,
  deleteInboundForecast,
} from "./inboundHandler.js";
import {
  prepFcImportBody,
  generateUrl,
  invokeGCF, // invokeGCF calls a Google Cloud Function to make PUT request
  importFc, // importFc makes a PUT request to the upload URL - need CORS fixed before being able to switch to this
} from "./importHandler.js";
import { NotificationHandler } from "../src/notificationHandler.js";
import { toastUser } from "./apiHandler.js";

// Set global variables
window.onerror = globalErrorHandler;
window.ofg.isInboundForecastMode = false; // Default to false - will be updated to true if inbound planning groups are found

// Define and export shared state object
export let sharedState = {
  generatedForecast: null,
  modifiedForecast: null,
  userInputs: {
    businessUnit: {
      name: null,
      id: null,
      settings: null,
    },
    forecastParameters: {
      weekStart: null,
      historicalWeeks: null,
      description: null,
    },
    forecastOptions: {
      ignoreZeroes: null,
      resolveContactsAhtMode: null,
      generateInbound: null,
      retainInbound: null,
    },
    planningGroups: [],
  },
};

// Function to reset sharedState without reassigning it
export function resetSharedState() {
  // Resetting primitive values and arrays directly
  sharedState.generatedForecast = null;
  sharedState.modifiedForecast = null;

  // Resetting nested objects
  const resetObject = (obj) => {
    Object.keys(obj).forEach((key) => {
      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        resetObject(obj[key]); // Recurse for nested objects
      } else if (Array.isArray(obj[key])) {
        obj[key] = []; // Reset arrays
      } else {
        obj[key] = null; // Reset primitive values
      }
    });
  };

  // Apply reset logic to nested objects within sharedState
  resetObject(sharedState.userInputs);
}

/* FUNCTIONS START */
// Generate outbound forecast data
export async function generateForecast() {
  console.info("[OFG] Forecast generation initiated");

  console.log("[OFG] User selections:", sharedState.userInputs);

  // Create each planning group in the sharedState.generatedForecast object
  sharedState.generatedForecast = sharedState.userInputs.planningGroups.map(
    (pg) => {
      let obj = {
        planningGroup: { ...pg.planningGroup },
        campaign: { ...pg.campaign },
        queue: { ...pg.queue },
        metadata: { numContacts: pg.numContacts },
      };
      return obj;
      // historicalWeeks and forecastData will be added later by queryHandler
    }
  );

  // Declare variables
  let queryResults = [];

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

  // Returns the year and week number in the format "YYYY-WW".
  function getYearWeek(date) {
    var week = getWeek(date);
    var year = getWeekYear(date);
    // Pad the week number with a leading zero if necessary
    var weekString = String(week).padStart(2, "0");
    return `${year}-${weekString}`;
  }

  // Process query results
  async function processQueryResults(results) {
    console.log(`[OFG] Processing ${results.length} groups in query results`);
    const generatedForecast = sharedState.generatedForecast;

    // Loop through results and crunch numbers
    for (let i = 0; i < results.length; i++) {
      var resultsGrouping = results[i];
      console.debug(`[OFG] Processing query group ${i + 1}`);
      var group = resultsGrouping.group;
      var data = resultsGrouping.data;
      var campaignId = group.outboundCampaignId;

      // Find matching planning group in sharedState.generatedForecast
      var planningGroupIndex = generatedForecast.findIndex(
        (pg) => pg.campaign.id === campaignId
      );

      // Create a baseWeekArray that contains 7 arrays of 96 zeros
      var baseWeekArray = Array.from({ length: 7 }, () =>
        Array.from({ length: 96 }, () => 0)
      );

      // Create a new week object
      let weekObj = {
        weekNumber: "",
        intradayValues: {
          nAttempted: JSON.parse(JSON.stringify(baseWeekArray)),
          nConnected: JSON.parse(JSON.stringify(baseWeekArray)),
          tHandle: JSON.parse(JSON.stringify(baseWeekArray)),
          nHandled: JSON.parse(JSON.stringify(baseWeekArray)),
        },
      };

      // For each interval in the data, get the week number and add to the campaign object
      console.debug(
        `[OFG] Extracting data from campaign id ${campaignId} query results`
      );
      for (let j = 0; j < data.length; j++) {
        var interval = data[j].interval;
        var metrics = data[j].metrics;

        const [startString, _] = interval.split("/");
        const startDate = new Date(startString);
        const weekNumber = getYearWeek(startDate);

        // Get weekday index from startDate
        const dayIndex = startDate.getDay();

        // Get interval index from startDate
        const hours = startDate.getHours();
        const minutes = startDate.getMinutes();
        const totalMinutes = hours * 60 + minutes;
        const intervalDuration = 15;
        const intervalIndex = Math.floor(totalMinutes / intervalDuration);

        // Skip processing if generatedForecast does not contain planningGroupIndex
        if (planningGroupIndex === -1) {
          console.warn(
            `[OFG] Campaign id ${campaignId} not found in Planning Groups. Skipping...`
          );
          continue;
        }

        // Skip processing if weekNumber is not found (e.g. no contacts have been forecast for PG)
        const historicalWeeks =
          generatedForecast[planningGroupIndex].historicalWeeks;
        if (!historicalWeeks) {
          continue;
        }

        // Add weekNumber to campaign object if it does not yet exist
        var weekExists = historicalWeeks.some(
          (week) => week.weekNumber === weekNumber
        );
        if (!weekExists) {
          weekObj.weekNumber = weekNumber;
          historicalWeeks.push(weekObj);
        }

        // loop through metrics and add to intradayValues
        for (let k = 0; k < metrics.length; k++) {
          var metric = metrics[k];
          var metricName = metric.metric;

          // nOuotboundAttempted
          if (metricName === "nOutboundAttempted") {
            var attempted = metric.stats.count;

            // add nOutboundAttempted stat to intradayValues
            weekObj.intradayValues.nAttempted[dayIndex][intervalIndex] +=
              attempted;
          }

          // nOutboundConnected
          if (metricName === "nOutboundConnected") {
            var connected = metric.stats.count;

            // add nOutboundConnected stat to intradayValues
            weekObj.intradayValues.nConnected[dayIndex][intervalIndex] +=
              connected;
          }

          // tHandle
          if (metricName === "tHandle") {
            var tHandle = metric.stats.sum / 1000; // convert to seconds
            var nHandled = metric.stats.count;

            // add tHandle stats to intradayValues
            weekObj.intradayValues.tHandle[dayIndex][intervalIndex] += tHandle;
            weekObj.intradayValues.nHandled[dayIndex][intervalIndex] +=
              nHandled;
          }
        }
      }
    }

    validateHistoricalData();

    console.log(
      "[OFG] Query results processed",
      JSON.parse(JSON.stringify(generatedForecast))
    );
  }

  // Validate and update PG's if no historical data is found
  function validateHistoricalData() {
    const generatedForecast = sharedState.generatedForecast;

    for (let i = 0; i < generatedForecast.length; i++) {
      const group = generatedForecast[i];
      const pgName = group.planningGroup.name;
      const forecastMode = group.metadata.forecastMode;

      // Skip inbound planning groups
      if (forecastMode === "inbound") {
        continue;
      }

      // Update metadata.forecastStatus if no historical data is found
      const historicalWeeks = group.historicalWeeks;
      if (!historicalWeeks || historicalWeeks.length === 0) {
        console.warn(`[OFG] [${pgName}] No historical data found!`);
        group.metadata.forecastStatus = {
          isForecast: false,
          reason: "No historical data",
        };
      }
    }
  }

  // Run forecast prep function on group
  async function runFunctionOnGroup(group, func, funcName, ...args) {
    const pgName = group.planningGroup.name;
    console.log(`[OFG] [${pgName}] Running ${funcName}`);
    try {
      group = await func(group, ...args);
      // downloadJson(group, `${funcName}_${group.campaignId}`);
    } catch (error) {
      console.error(`[OFG] Error occurred while running ${funcName}:`, error);
    }
    return group;
  }

  async function prepareForecast() {
    let functionsToRun = [
      { func: prepFcMetrics, name: "prepFcMetrics" },
      {
        func: generateAverages,
        name: "generateAverages",
        args: [sharedState.userInputs.forecastOptions.ignoreZeroes],
      },
      {
        func: applyContacts,
        name: "applyContacts",
      },
      /* Removing this for now
      {
        func: resolveContactsAht,
        name: "resolveContactsAht",
        args: [resolveContactsAhtMode],
      },*/
    ];

    //
    const generatedForecast = sharedState.generatedForecast;
    let fcPrepPromises = generatedForecast
      .filter((group) => group.metadata.forecastStatus.isForecast === true)
      .map(async (group) => {
        const pgName = group.planningGroup.name;
        console.log(`[OFG] [${pgName}] Preparing outbound forecast`);

        for (let { func, name, args = [] } of functionsToRun) {
          group = await runFunctionOnGroup(group, func, name, ...args);
        }

        return group;
      });

    return Promise.all(fcPrepPromises).then(async (completedPgForecast) => {
      console.log(
        "[OFG] Outbound Planning Groups have been processed.",
        JSON.parse(JSON.stringify(completedPgForecast))
      );
      return completedPgForecast;
    });
  }

  // Functions end here

  // Main generate forecast code starts here

  // Execute queryBuilder after queueCampaignMatcher complete
  updateLoadingMessage("generate-loading-message", "Building queries");
  var queryBody = await queryBuilder();

  updateLoadingMessage(
    "generate-loading-message",
    "Generating query intervals"
  );
  var intervals = await intervalBuilder();

  // Execute historical data queries
  updateLoadingMessage("generate-loading-message", "Executing queries");
  queryResults = await executeQueries(queryBody, intervals);
  if (queryResults.length === 0) {
    console.error("[OFG] Query results are empty");

    // Hide loading spinner div
    hideLoadingSpinner("import-results-container", "import-loading-div");
    await loadPageFour();

    // TODO: This is repeated code from importForecast function - refactor to a function
    // Insert div to id="results-container" with error message
    const resultsContainer = document.getElementById(
      "import-results-container"
    );
    let message = document.createElement("div");
    message.className = "alert-danger";
    message.innerHTML = "Data query failed!";
    resultsContainer.appendChild(message);

    const errorReason = document.createElement("div");

    errorReason.innerHTML = "No historical data returned from queries!";
    resultsContainer.appendChild(errorReason);

    // Create a button to restart the process
    const restartButton = document.createElement("gux-button");
    restartButton.id = "restart-button";
    restartButton.setAttribute("accent", "secondary");
    restartButton.className = "align-left";
    restartButton.textContent = "Restart";

    // Add event listener to restart button
    restartButton.addEventListener("click", (event) => {
      console.log("[OFG] Restarting...");
      loadPageOne();
    });

    // Create a new div
    const buttonsContainer = document.createElement("div");

    // Set the id, class, and style attributes
    buttonsContainer.id = "page-three-buttons";
    buttonsContainer.className = "row";
    buttonsContainer.style.paddingTop = "20px";

    // Append buttons to the results container
    buttonsContainer.appendChild(restartButton);
    //buttonsContainer.appendChild(openForecastButton);

    // Append the buttonsContainer
    resultsContainer.appendChild(buttonsContainer);

    return;
  }

  // Process query results
  updateLoadingMessage("generate-loading-message", "Processing query results");
  await processQueryResults(queryResults);

  // Prepare forecast
  updateLoadingMessage("generate-loading-message", "Preparing forecast");
  await prepareForecast();

  // Generate inbound forecast if required
  if (sharedState.userInputs.forecastOptions.generateInbound) {
    updateLoadingMessage(
      "generate-loading-message",
      "Generating inbound forecast"
    );

    // Update inbound planning groups in generatedForecast with metadata.forecastStatus.isForecast = true
    sharedState.generatedForecast.forEach((pg) => {
      const forecastMode = pg.metadata.forecastMode;
      if (forecastMode === "inbound") {
        pg.metadata.forecastStatus = { isForecast: true };
        delete pg.metadata.forecastStatus.reason;
      }
    });

    await generateInboundForecast();
    if (!sharedState.userInputs.forecastOptions.retainInbound) {
      deleteInboundForecast();
    }

    console.log(
      "[OFG] Inbound Planning Groups have been processed.",
      JSON.parse(JSON.stringify(sharedState.generatedForecast))
    );
  }
  loadPageThree();
}

// Import forecast to GC
export async function importForecast() {
  console.info("[OFG] Forecast import initiated");

  const buId = sharedState.userInputs.businessUnit.id;
  const weekStart = sharedState.userInputs.forecastParameters.weekStart;
  const startDayOfWeek =
    sharedState.userInputs.businessUnit.settings.startDayOfWeek;
  const description = sharedState.userInputs.forecastParameters.description;

  console.debug(
    "[OFG] Shared state at importForecast start",
    JSON.parse(JSON.stringify(sharedState))
  );
  loadPageFour();

  // Prepare forecast
  updateLoadingMessage("import-loading-message", "Preparing forecast");
  let [fcImportBody, importGzip, contentLength] = await prepFcImportBody(
    sharedState.modifiedForecast,
    startDayOfWeek,
    description
  );

  // Log the forecast import body
  console.log("[OFG] Forecast import body:", fcImportBody);

  // Declare variables
  let importOperationId = null;

  let topics = ["shorttermforecasts.import"];

  let importNotifications = new NotificationHandler(
    topics,
    buId,
    runImport,
    handleImportNotification
  );
  importNotifications.connect();
  importNotifications.subscribeToNotifications();

  // Main import function
  async function runImport() {
    // Generate URL for upload
    updateLoadingMessage("import-loading-message", "Generating URL for upload");
    let uploadAttributes = await generateUrl(buId, weekStart, contentLength);

    // Upload forecast
    updateLoadingMessage("import-loading-message", "Uploading forecast");
    /* GCF function being used until CORS blocking removed */
    // importFc(buId, globalWeekStart, importGzip, uploadAttributes);
    const uploadResponse = await invokeGCF(uploadAttributes, fcImportBody);

    // Check if upload was successful
    if (uploadResponse === 200) {
      const uploadKey = uploadAttributes.uploadKey;
      console.log(
        "[OFG] Forecast uploaded successfully! Calling import method."
      );

      // Import forecast
      updateLoadingMessage("import-loading-message", "Importing forecast");
      const importResponse = await importFc(buId, weekStart, uploadKey);

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

  // Handle notification messages
  async function handleImportNotification(notification) {
    console.debug("[OFG] Message from server: ", notification);
    if (
      notification.eventBody &&
      notification.eventBody.operationId === importOperationId
    ) {
      const status = notification.eventBody.status;
      console.log(`[OFG] Forecast import status updated <${status}>`);

      // Hide loading spinner div
      hideLoadingSpinner("import-results-container", "import-loading-div");

      const resultsContainer = document.getElementById(
        "import-results-container"
      );

      // Create a button to restart the process
      const restartButton = document.createElement("gux-button");
      restartButton.id = "restart-button";
      restartButton.setAttribute("accent", "secondary");
      restartButton.className = "align-left";
      restartButton.textContent = "Restart";

      // TODO: Find a way to allow user to navigate main GC browser window to new forecast

      // Add event listener to restart button
      restartButton.addEventListener("click", (event) => {
        loadPageOne();
      });

      let message;
      if (status === "Complete") {
        console.log("[OFG] Forecast import completed successfully!");
        toastUser("Forecast imported successfully!");

        const forecastId = notification.eventBody.result.id;

        // TODO: Find a way to allow user to navigate main GC browser window to new forecast

        // Insert div to id="results-container" with success message
        message = document.createElement("div");
        message.className = "alert-success";
        message.innerHTML = "Forecast imported successfully!";
        resultsContainer.appendChild(message);
      } else if (status === "Error" || status === "Canceled") {
        console.error("[OFG] Forecast import failed.", notification);
        toastUser("Forecast import failed!");
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
      //buttonsContainer.appendChild(openForecastButton);

      // Append the buttonsContainer
      resultsContainer.appendChild(buttonsContainer);
    } else {
      console.log("[OFG] Message from server: ", notification);
    }
  }
}
/* FUNCTIONS END */
