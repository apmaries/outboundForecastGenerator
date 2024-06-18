import { handleApiCalls } from "./apiHandler.js";
import { sharedState } from "./main.js";

const testMode = window.ofg.isTesting;

/*
async function getUtcOffset(timezone) {
  // Create a date object in the specified timezone
  const date = new Date(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format()
  );

  // Get the offset in minutes and convert it to hours
  const offset = date.getTimezoneOffset() / 60;

  return offset;
}
*/

// Function to build query body
export async function queryBuilder() {
  // Get variables from sharedState
  const forecastPlanningGroups = sharedState.completedForecast;
  const timeZone = sharedState.userInputs.businessUnit.settings.timeZone;

  // Log to console
  console.log(`[OFG] Query body builder initiated`);
  console.debug("[OFG] Planning Groups: ", forecastPlanningGroups);

  // Define predicates array
  let clausePredicates = [];

  // Create predicate for each cpId in forecastPlanningGroups
  forecastPlanningGroups.forEach((pg) => {
    const pgName = pg.planningGroup.name;
    const cpId = pg.campaign.id;
    const numContacts = pg.metadata.numContacts;

    if (cpId && numContacts && Number(numContacts) > 0) {
      clausePredicates.push({
        dimension: "outboundCampaignId",
        value: cpId,
      });
      pg.metadata.forecastStatus = { isForecast: true };
      pg.metadata.forecastMode = "outbound";
    } else {
      if (!cpId) {
        console.warn(
          `[OFG] [${pgName}] Skipping query on inbound planning group`,
          pg
        );
        pg.metadata.forecastMode = "inbound";
        pg.metadata.forecastStatus = {
          isForecast: false,
          reason: "Inbound planning groups not forecasted",
        };
      } else if (!numContacts || Number(numContacts) <= 0) {
        console.warn(
          `[OFG] [${pgName}] Skipping query with 0 forecast contacts`,
          pg
        );
        pg.metadata.forecastMode = "outbound";
        pg.metadata.forecastStatus = {
          isForecast: false,
          reason: "Zero forecast outbound contacts",
        };
      } else {
        console.warn(`[OFG] [${pgName}] Skipping query with invalid data`, pg);
        pg.metadata.forecastStatus = {
          isForecast: false,
          reason: "Invalid data",
        };
      }
    }

    if (pg.metadata.forecastStatus.isForecast) {
      pg.historicalWeeks = [];
      pg.forecastData = {};
    }
  });

  // Define query body
  const queryBody = {
    "filter": {
      "type": "and",
      "clauses": [
        {
          "type": "or",
          "predicates": clausePredicates,
        },
      ],
      "predicates": [{ "dimension": "mediaType", "value": "voice" }],
    },
    "metrics": ["nOutboundAttempted", "nOutboundConnected", "tHandle"],
    "groupBy": ["outboundCampaignId"],
    "granularity": "PT15M",
    "interval": "",
    "timeZone": timeZone,
  };

  // Return query body
  console.debug("[OFG] Query body: ", queryBody);
  return queryBody;
}

export async function intervalBuilder() {
  // Get variables from sharedState
  const historicalWeeks =
    sharedState.userInputs.forecastParameters.historicalWeeks;
  const buTimeZone = sharedState.userInputs.businessUnit.settings.timeZone;
  const buStartDayOfWeek =
    sharedState.userInputs.businessUnit.settings.startDayOfWeek;

  // Log to console
  console.log(`[OFG] Query interval builder initiated`);

  // Define arrays
  let intervals = [];
  const startOfWeekDays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Get the index of the start day of the week
  const startIndex = startOfWeekDays.indexOf(buStartDayOfWeek);

  // Get the current date in the specified time zone
  const now = luxon.DateTime.now().setZone(buTimeZone);

  // Find the most recent start of the week date
  let startOfWeek = now
    .minus({ days: (now.weekday - startIndex + 7) % 7 })
    .startOf("day");

  // If today is the start of the week or within the current week, adjust to the previous week
  if (startOfWeek >= now.startOf("day")) {
    startOfWeek = startOfWeek.minus({ weeks: 1 });
  }

  // Loop for historicalWeeks times to calculate each interval
  for (let i = 0; i < historicalWeeks; i++) {
    // Calculate the end of the week date
    const endOfWeek = startOfWeek.plus({ days: 6 }).endOf("day");

    // Push the interval as ISO string to the intervals array
    intervals.push(`${startOfWeek.toISO()}/${endOfWeek.toISO()}`);

    // Move to the previous week
    startOfWeek = startOfWeek.minus({ weeks: 1 });
  }

  // Return intervals array
  console.debug("[OFG] Intervals: ", intervals);
  return intervals;
}

// Function to execute queries
export async function executeQueries(body, intervals) {
  console.log(`[OFG] Executing queries`);
  let results = [];

  if (testMode) {
    console.log(
      "[OFG] Test mode enabled. Static data will be used for forecast generation"
    );

    try {
      results =
        await window.ofg.PlatformClient.MockAnalyticsApi.getOutboundConversationsAggregates();
    } catch (error) {
      console.error("[OFG] Test data retrieval failed: ", error);
      throw error;
    }

    // Get variables from sharedState
    const forcastPlanningGroups = sharedState.completedForecast;

    // Return only the data for the campaigns in the forcastPlanningGroups where pg.isForecast is true
    results = results.filter((result) => {
      return forcastPlanningGroups.some((pg) => {
        return (
          pg.campaign.id === result.group.outboundCampaignId &&
          pg.metadata.forecastStatus.isForecast
        );
      });
    });

    return results;
  } else {
    console.log("[OFG] Query execution initiated");

    // Loop through intervals and execute queries
    for (let i = 0; i < intervals.length; i++) {
      console.debug(`[OFG] Executing query for interval ${i + 1}`);
      body.interval = intervals[i];

      try {
        const queryResult = await window.ofg.PlatformClient.AnalyticsApi.query(
          body
        );
        const queryResults = queryResult.results;
        results.push(queryResults);
      } catch (error) {
        console.error("[OFG] Query execution failed: ", error);
        throw error;
      }
    }
  }

  return results;
}
