// Module to handle generating the forecast for the inbound data
import { handleApiCalls, globalPageOpts } from "./apiHandler.js";
import { NotificationHandler } from "../src/notificationHandler.js";

let generateOperationId = null;

export async function generateInboundForecast(
  buId,
  weekStart,
  description,
  retainInboundFc
) {
  console.log("[OFG] Generating inbound forecast");

  const topics = ["v2.workforcemanagement.businessunits.generate"];

  let inboundForecast;

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
    const abmFcDescription = description + " (Inbound ABM)";

    // Generate the forecast
    generateResponse = await handleApiCalls(
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
    // Return the forecast data}
  }
}
