// Module to handle generating the forecast for the inbound data
import { handleApiCalls, globalPageOpts } from "./apiHandler.js";
import { NotificationHandler } from "../src/notificationHandler.js";
import { sharedState } from "./main.js";

// Declare global variables
let generateOperationId;
const testMode = window.ofg.isTesting;

async function transformInboundForecastData(inboundFcData) {
  const weekStart = sharedState.weekStart;

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

export async function generateInboundForecast() {
  console.log("[OFG] Initiating inbound forecast generation");

  const buId = sharedState.businessUnitId;
  const weekStart = sharedState.weekStart;
  const description = sharedState.fcDescription;

  // Declare variables
  let resolveInboundForecast;
  const topics = ["shorttermforecasts.generate"];
  let inboundForecastData;

  // Return test data if in test mode
  if (testMode) {
    console.log(
      "[OFG] Testing mode enabled. Skipping notifications setup and getting test data"
    );
    inboundForecastData =
      await window.ofg.PlatformClient.MockWfmApi.getInboundForecastData();
    console.log(
      "[OFG] Forecast data loaded from test data",
      inboundForecastData
    );
    await transformInboundForecastData(inboundForecastData.result);
    sharedState.inboundForecastId = "abc-123";
    return;
  }

  // Subscribe to generate notifications
  const generateNotifications = new NotificationHandler(
    topics,
    buId,
    generateAbmForecast,
    handleInboundForecastNotification
  );

  // Function to retrieve the inbound forecast data
  async function getInboundForecastData(forecastId) {
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

    console.log(
      "[OFG] Inbound forecast data retrieved. Trimming to 7 days only"
    );
    // Trim results to 7 days only (8th day will be re-added later after modifications)
    forecastData.result.planningGroups.forEach((pg) => {
      console.debug(`[OFG] Trimming data for Planning Group ${pg.id}`);
      pg.offeredPerInterval = pg.offeredPerInterval.slice(0, 672);
      pg.averageHandleTimeSecondsPerInterval =
        pg.averageHandleTimeSecondsPerInterval.slice(0, 672);
    });

    return forecastData.result;
  }

  // Generate the forecast
  function generateAbmForecast() {
    return new Promise(async (resolve, reject) => {
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

      // Generate the forecast
      let generateResponse;
      try {
        generateResponse = await handleApiCalls(
          "WorkforceManagementApi.postWorkforcemanagementBusinessunitWeekShorttermforecastsGenerate",
          buId,
          weekStart,
          body,
          opts
        );
      } catch (error) {
        console.error("[OFG] Inbound forecast generation failed: ", error);
        reject(error);
      }

      console.log(
        `[OFG] Inbound forecast generate status = ${generateResponse.status}`
      );

      // Forecast created successfully
      if (generateResponse.status === "Complete") {
        console.log("[OFG] Inbound forecast generated synchronously");
        // Get the forecast id
        const forecastId = generateResponse.result.id;
        sharedState.inboundForecastId = forecastId;
        inboundForecastData = await getInboundForecastData(forecastId);
        resolveInboundForecast(inboundForecastData);
      }
      // Forecast creation in progress
      else if (generateResponse.status === "Processing") {
        console.log(
          "[OFG] Inbound forecast generation in progress. Waiting for completion"
        );

        // Set the operation ID
        generateOperationId = generateResponse.operationId;
      }
      // Forecast creation failed
      else {
        console.error(
          "[OFG] Inbound forecast generation failed: ",
          generateResponse
        );
        reject(generateResponse);
      }
    });
  }

  // Get the forecast data
  async function handleInboundForecastNotification(notification) {
    console.debug("[OFG] Message from server: ", notification);
    if (
      notification.eventBody &&
      notification.eventBody.operationId === generateOperationId
    ) {
      const status = notification.eventBody.status;
      console.log(`[OFG] Generate inbound forecast status updated <${status}>`);

      // Check if status = "Complete"
      if (status === "Complete") {
        console.log("[OFG] Inbound forecast generation complete");
        const forecastId = notification.eventBody.result.id;
        sharedState.inboundForecastId = forecastId;

        console.debug("[OFG] Inbound forecast ID: ", forecastId);
        inboundForecastData = await getInboundForecastData(forecastId);
        resolveInboundForecast(inboundForecastData);
        console.log(
          "[OFG] Inbound forecast generation complete",
          inboundForecastData
        );
        return inboundForecastData;
      }
      // Status is Cancelled or Error
      else {
        console.error(
          "[OFG] Inbound forecast generation failed: ",
          notification.eventBody
        );
      }
    }
  }

  // Connect and subscribe to notifications, then generate the forecast
  generateNotifications.connect();
  generateNotifications.subscribeToNotifications();

  // Generate the forecast and wait for it to complete
  await new Promise((resolve, reject) => {
    resolveInboundForecast = resolve;
    generateAbmForecast();
  });

  await transformInboundForecastData(inboundForecastData);
}

export function deleteInboundForecast() {
  console.log("[OFG] Deleting inbound forecast");
  console.log("[OFG] Inbound forecast ID: ", sharedState.inboundForecastId);
}
