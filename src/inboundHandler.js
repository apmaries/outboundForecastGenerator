// Module to handle generating the forecast for the inbound data
import { handleApiCalls, globalPageOpts } from "./apiHandler.js";
import { NotificationHandler } from "../src/notificationHandler.js";

// Declare global variables
let generateOperationId = null;
const testMode = window.ofg.isTesting;

export async function generateInboundForecast(
  buId,
  weekStart,
  description,
  retainInboundFc
) {
  console.log("[OFG] Initiating inbound forecast generation");

  // Declare variables
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
    return inboundForecastData;
  }

  // Main code starts here

  // Functions start here

  // Functions end here

  // Subscribe to generate notifications
  const generateNotifications = new NotificationHandler(
    topics,
    buId,
    generateAbmForecast,
    handleInboundForecastNotification
  );
  generateNotifications.connect();
  generateNotifications.subscribeToNotifications();

  // Generate the forecast
  async function generateAbmForecast() {
    console.log("[OFG] Generating ABM forecast");
    const abmFcDescription = description + " (Inbound ABM)";

    // Generate the forecast
    let generateResponse = await handleApiCalls(
      "WorkforceManagementApi.postWorkforcemanagementBusinessunitWeekShorttermforecastsGenerate",
      buId,
      weekStart,
      {
        "description": abmFcDescription,
        "weekCount": 1,
        "canUseForScheduling": true,
      }
    );

    console.log(
      `[OFG] Inbound forecast generate status = ${generateResponse.status}`
    );

    // Forecast created successfully
    if (generateResponse.status === "Complete") {
      // Get the forecast id
      const forecastId = generateResponse.result.id;
      inboundForecastData = getInboundForecastData(forecastId);
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
    }
  }

  // Function to retrieve the inbound forecast data
  async function getInboundForecastData(forecastId) {
    console.log("[OFG] Getting inbound forecast data");

    let forecastData = await handleApiCalls(
      "WorkforceManagementApi.getWorkforcemanagementBusinessunitWeekShorttermforecastData",
      buId,
      weekStart,
      forecastId
    );

    console.log("[OFG] Inbound forecast data retrieved: ", forecastData);

    return forecastData;
  }

  // Delete the forecast
  async function deleteInboundForecast() {
    console.log("[OFG] Deleting inbound forecast");

    let deleteResponse = await handleApiCalls(
      "WorkforceManagementApi.deleteWorkforcemanagementBusinessunitWeekShorttermforecasts",
      buId,
      weekStart
    );

    console.log("[OFG] Inbound forecast deleted: ", deleteResponse);
  }

  // Get the forecast data
  async function handleInboundForecastNotification(notification) {
    // Add inbound forecast data to mainPgForecastData
    // Return the forecast data
  }

  // Return the inbound forecast data
  return inboundForecastData;
}
