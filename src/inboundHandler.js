// Module to handle generating the forecast for the inbound data
import { handleApiCalls, globalPageOpts } from "./apiHandler.js";
import { NotificationHandler } from "../src/notificationHandler.js";

let generateOperationId = null;

export function generateInboundForecast(method, buId) {
  const topics = ["v2.workforcemanagement.businessunits.generate"];

  // Subscribe to generate notifications
  const generateNotifications = new NotificationHandler(
    topics,
    buId,
    generateInboundForecast,
    handleInboundForecastNotification
  );

  // Check inbound forecast generation method
  // Generate the forecast
  async function generateInboundForecast() {}
  // Get the forecast data
  async function handleInboundForecastNotification() {}
  // Add inbound forecast data to mainPgForecastData
  // Return the forecast data
}
