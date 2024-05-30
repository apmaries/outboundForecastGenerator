// Module to handle generating the forecast for the inbound data
import { handleApiCalls, globalPageOpts } from "./apiHandler.js";
import { NotificationHandler } from "../src/notificationHandler.js";

let generateOperationId = null;

export async function generateInboundForecast(
  method,
  buId,
  weekStart,
  historicalWeeks,
  description
) {
  const topics = ["v2.workforcemanagement.businessunits.generate"];

  let inboundForecast;

  // Subscribe to generate notifications
  const generateNotifications = new NotificationHandler(
    topics,
    buId,
    generateInboundForecast,
    handleInboundForecastNotification
  );

  // Generate the forecast
  async function generateInboundForecast() {
    // Check inbound forecast generation method
    if (method === "whi") {
      // Generate Weighted Historical Index forecast
    } else if (method === "abm") {
      // Generate Automatic Best Method Selection forecast
    }
  }

  // Get the forecast data
  async function handleInboundForecastNotification() {
    // Add inbound forecast data to mainPgForecastData
    // Return the forecast data}
  }
}
