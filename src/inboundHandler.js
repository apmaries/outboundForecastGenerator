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

  const topics = ["v2.workforcemanagement.businessunits.generate"];

  let inboundForecast;

  if (testMode) {
    console.log("[OFG] Testing mode enabled. Skipping notifications");
    generateAbmForecast();
  }

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

    console.log("[OFG] Inbound forecast generated: ", generateResponse);

    // Set the operation ID
    generateOperationId = generateResponse.operationId;
  }

  // Get the forecast data
  async function handleInboundForecastNotification() {
    // Add inbound forecast data to mainPgForecastData
    // Return the forecast data
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
}
