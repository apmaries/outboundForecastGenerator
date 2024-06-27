// Module to handle generating the forecast for the inbound data
import { handleApiCalls } from "./apiHandler.js";
import { NotificationHandler } from "../src/notificationHandler.js";
import { sharedState } from "./main.js";

// Declare global variables
let generateOperationId;
const testMode = window.ofg.isTesting;

async function transformInboundForecastData(inboundFcData) {
  const weekStart = sharedState.userInputs.forecastParameters.weekStart;

  // Add inbound forecast data to sharedState.completedForecast if pgId not already present
  console.log("[OFG] Merging inbound forecast data with completed forecast");

  // Process each planning group in inbound forecast data
  inboundFcData.planningGroups.forEach((pg) => {
    // Find the planning group in sharedState.completedForecast
    const completedFcPg = sharedState.completedForecast.find(
      (pgForecast) => pgForecast.planningGroup.id === pg.planningGroupId
    );
    const isInbound = completedFcPg.metadata.forecastMode === "inbound";

    if (isInbound) {
      // Transform inbound forecast data to same schema as outbound forecast data
      let nContactsArray = [];
      let tHandleArray = [];

      for (let i = 0; i < pg.offeredPerInterval.length; i += 96) {
        let chunkOffered = pg.offeredPerInterval.slice(i, i + 96);
        let chunkAht = pg.averageHandleTimeSecondsPerInterval.slice(i, i + 96);
        let chunkTht = chunkOffered.map((val, idx) => val * chunkAht[idx]);

        nContactsArray.push(chunkOffered);
        tHandleArray.push(chunkTht);
      }

      // Get the day of the week from weekStart
      let date = new Date(weekStart);
      let dayOfWeek = date.getDay();

      // Calculate the difference between the current day of the week and Sunday
      let rotateBy = (7 - dayOfWeek) % 7;

      // Rotate the arrays
      nContactsArray = [
        ...nContactsArray.slice(rotateBy),
        ...nContactsArray.slice(0, rotateBy),
      ];
      tHandleArray = [
        ...tHandleArray.slice(rotateBy),
        ...tHandleArray.slice(0, rotateBy),
      ];

      let forecastData = {
        nContacts: nContactsArray,
        tHandle: tHandleArray,
        nHandled: nContactsArray, // Replicating nContacts for now - inbound forecast doesn't have nHandled data and need something to divide by when making modifications
      };

      completedFcPg.forecastData = forecastData;
    }
  });
}

// Function to retrieve the inbound forecast data
async function getInboundForecastData(forecastId) {
  const buId = sharedState.userInputs.businessUnit.id;
  const weekStart = sharedState.userInputs.forecastParameters.weekStart;

  console.log("[OFG] Getting inbound forecast data");

  let forecastData;
  try {
    forecastData = await handleApiCalls(
      "WorkforceManagementApi.getWorkforcemanagementBusinessunitWeekShorttermforecastData",
      buId,
      weekStart,
      forecastId
    );
  } catch (error) {
    console.error("[OFG] Inbound forecast data retrieval failed: ", error);
    throw error;
  }

  console.log("[OFG] Inbound forecast data retrieved. Trimming to 7 days only");
  // Trim results to 7 days only (8th day will be re-added later after modifications)
  forecastData.result.planningGroups.forEach((pg) => {
    console.debug(
      `[OFG] Trimming data for Planning Group ${pg.planningGroupId}`
    );
    pg.offeredPerInterval = pg.offeredPerInterval.slice(0, 672);
    pg.averageHandleTimeSecondsPerInterval =
      pg.averageHandleTimeSecondsPerInterval.slice(0, 672);
  });

  return forecastData.result;
}

// Generate the forecast
async function generateAbmForecast(buId, weekStart, description) {
  console.log("[OFG] Generating ABM forecast");
  const abmFcDescription = description + " ([OFG] Inbound ABM)";

  let body = {
    "description": abmFcDescription,
    "weekCount": 1,
    "canUseForScheduling": true,
  };
  let opts = {
    "forceAsync": true,
  };

  try {
    let generateResponse = await handleApiCalls(
      "WorkforceManagementApi.postWorkforcemanagementBusinessunitWeekShorttermforecastsGenerate",
      buId,
      weekStart,
      body,
      opts
    );
    console.log(
      `[OFG] Inbound forecast generate status = ${generateResponse.status}`
    );

    if (generateResponse.status === "Complete") {
      console.log("[OFG] Inbound forecast generated synchronously");
      const forecastId = generateResponse.result.id;
      sharedState.inboundForecastId = forecastId;
      let inboundForecastData = await getInboundForecastData(forecastId);
      return inboundForecastData; // Assuming resolveInboundForecast logic is moved here
    } else if (generateResponse.status === "Processing") {
      console.log(
        "[OFG] Inbound forecast generation in progress. Waiting for completion"
      );
      // Logic for handling "Processing" status
    } else {
      console.error(
        "[OFG] Inbound forecast generation failed: ",
        generateResponse
      );
      throw generateResponse; // Rethrow or handle error appropriately
    }
  } catch (error) {
    console.error("[OFG] Inbound forecast generation failed: ", error);
    throw error; // Rethrow or handle error appropriately
  }
}

export async function generateInboundForecast() {
  console.log("[OFG] Initiating inbound forecast generation");

  const buId = sharedState.userInputs.businessUnit.id;
  const weekStart = sharedState.userInputs.forecastParameters.weekStart;
  const description = sharedState.userInputs.forecastParameters.description;

  // Return test data if in test mode
  if (testMode) {
    console.log(
      "[OFG] Testing mode enabled. Skipping notifications setup and getting test data"
    );
    const inboundForecastData =
      await window.ofg.PlatformClient.MockWfmApi.getInboundForecastData();
    console.log(
      "[OFG] Forecast data loaded from test data",
      inboundForecastData
    );
    await transformInboundForecastData(inboundForecastData.result);
    sharedState.inboundForecastId = "abc-123";
    return;
  }

  // Generate the forecast and immediately check its status
  const initialStatus = await generateAbmForecast(buId, weekStart, description);
  if (initialStatus === "Complete") {
    // Synchronous handling if the forecast is already complete
    const forecastId = initialStatus.result.id;
    sharedState.inboundForecastId = forecastId;
    const inboundForecastData = await getInboundForecastData(forecastId);
    await transformInboundForecastData(inboundForecastData);
    console.log(
      "[OFG] Inbound forecast generation complete",
      inboundForecastData
    );
    return inboundForecastData;
  } else if (initialStatus === "Processing") {
    // Asynchronous handling through notifications
    return handleAsyncForecastGeneration(buId);
  } else {
    console.error(
      "[OFG] Inbound forecast generation failed with initial status: ",
      initialStatus
    );
    throw new Error("Inbound forecast generation failed");
  }
}

async function handleAsyncForecastGeneration(buId) {
  const topics = ["shorttermforecasts.generate"];

  function onSubscriptionSuccess() {
    console.log(
      "[OFG] Successfully subscribed to forecast generate notifications"
    );
  }

  const generateNotifications = new NotificationHandler(
    topics,
    buId,
    onSubscriptionSuccess,
    handleInboundForecastNotification
  );

  generateNotifications.connect();
  generateNotifications.subscribeToNotifications();

  return new Promise((resolve, reject) => {
    const handleComplete = (event) => {
      window.removeEventListener("inboundForecastComplete", handleComplete);
      window.removeEventListener("inboundForecastError", handleError);
      resolve(event.detail);
    };

    const handleError = (event) => {
      window.removeEventListener("inboundForecastComplete", handleComplete);
      window.removeEventListener("inboundForecastError", handleError);
      reject(new Error("Inbound forecast generation failed"));
    };

    window.addEventListener("inboundForecastComplete", handleComplete);
    window.addEventListener("inboundForecastError", handleError);
  });
}

async function handleInboundForecastNotification(notification) {
  console.debug("[OFG] Message from server: ", notification);
  if (
    notification.eventBody &&
    notification.eventBody.operationId === generateOperationId
  ) {
    const status = notification.eventBody.status;
    console.log(`[OFG] Generate inbound forecast status updated <${status}>`);

    if (status === "Complete") {
      const forecastId = notification.eventBody.result.id;
      sharedState.inboundForecastId = forecastId;
      const inboundForecastData = await getInboundForecastData(forecastId);
      window.dispatchEvent(
        new CustomEvent("inboundForecastComplete", {
          detail: inboundForecastData,
        })
      );
    } else {
      window.dispatchEvent(new CustomEvent("inboundForecastError"));
    }
  }
}

export function deleteInboundForecast() {
  console.log("[OFG] Deleting inbound forecast");
  console.log("[OFG] Inbound forecast ID: ", sharedState.inboundForecastId);

  const buId = sharedState.userInputs.businessUnit.id;
  const weekStart = sharedState.userInputs.forecastParameters.weekStart;
  const forecastId = sharedState.inboundForecastId;

  // Return if forecast ID is not set
  if (!forecastId) {
    console.warn("[OFG] Inbound forecast ID not set. Skipping deletion");
    return;
  }

  if (testMode) {
    console.log("[OFG] Testing mode enabled. Skipping deletion");
    return;
  }

  // Delete the forecast
  let delResponse = handleApiCalls(
    "WorkforceManagementApi.deleteWorkforcemanagementBusinessunitWeekShorttermforecast",
    buId,
    weekStart,
    forecastId
  );

  // Reset the forecast ID
  sharedState.inboundForecastId = null;
  console.log("[OFG] Inbound forecast deleted", delResponse);
}
