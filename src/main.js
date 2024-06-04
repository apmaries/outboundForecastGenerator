import {
  downloadJson,
  hideLoadingSpinner,
  updateLoadingMessage,
  switchPages,
  loadPageOne,
  loadPageThree,
  loadPageFour,
} from "./pageHandler.js";
import { queryBuilder, executeQueries } from "./queryHandler.js";
import {
  prepFcMetrics,
  groupByIndexNumber,
  generateAverages,
  applyContacts,
  resolveContactsAht,
} from "./numberHandler.js";
import { generateInboundForecast } from "./inboundHandler.js";
import {
  prepFcImportBody,
  generateUrl,
  invokeGCF,
  importFc,
} from "./importHandler.js";
import { NotificationHandler } from "../src/notificationHandler.js";
// invokeGCF calls a Google Cloud Function to make PUT request
// importFc makes a PUT request to the upload URL - need CORS fixed before being able to switch to this

// Gloabl variables
let globalCompletedPgForecast;
let globalBusinessUnitId;
let globalWeekStart;
let globalForecastDescription;
let globalBusinessUnitStartDayOfWeek;

const testMode = window.ofg.isTesting;

// Generate outbound forecast data
export async function generateForecast(
  businessUnitName,
  businessUnitId,
  businessUnitStartDayOfWeek,
  selectedBuTimeZone,
  weekStart,
  historicalWeeks,
  forecastDescription,
  planningGroupContactsArray,
  ignoreZeroes,
  resolveContactsAhtMode,
  generateInbound,
  retainInbound
) {
  console.info("[OFG] Forecast generation initiated");
  switchPages("page-two", "page-three");

  // Log user variables
  let userSelections = {
    businessUnitName,
    businessUnitId,
    businessUnitStartDayOfWeek,
    selectedBuTimeZone,
    weekStart,
    historicalWeeks,
    forecastDescription,
    planningGroupCount: planningGroupContactsArray.length,
    planningGroupDetails: planningGroupContactsArray,
    ignoreZeroes,
    resolveContactsAhtMode,
    generateInbound,
    retainInbound,
  };
  console.log("[OFG] User selections:", userSelections);

  // Declare variables
  let queryResults = [];
  var historicalDataByCampaign = [];
  globalBusinessUnitId = businessUnitId;
  globalWeekStart = weekStart;
  globalForecastDescription = forecastDescription;
  globalBusinessUnitStartDayOfWeek = businessUnitStartDayOfWeek;

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

  async function runFunctionOnGroup(group, func, funcName, ...args) {
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
      {
        func: resolveContactsAht,
        name: "resolveContactsAht",
        args: [resolveContactsAhtMode],
      },
    ];

    let fcPrepPromises = historicalDataByCampaign.map(async (group) => {
      console.log(
        `[OFG] [${group.campaignId}] Preparing campaign for forecast`
      );

      for (let { func, name, args = [] } of functionsToRun) {
        group = await runFunctionOnGroup(group, func, name, ...args);
      }

      return group;
    });

    return Promise.all(fcPrepPromises).then(async (completedPgForecast) => {
      console.log("[OFG] All groups have been processed.", completedPgForecast);
      return completedPgForecast;
    });
  }

  // Functions end here

  // Main generate forecastcode starts here

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
  globalCompletedPgForecast = await prepareForecast();

  // Generate inbound forecast if required
  if (generateInbound) {
    updateLoadingMessage(
      "generate-loading-message",
      "Generating inbound forecast"
    );
    const inboundFcData = await generateInboundForecast(
      globalBusinessUnitId,
      globalWeekStart,
      globalForecastDescription,
      retainInbound
    );

    // Add inbound forecast data to globalCompletedPgForecast if pgId not already present
    console.log(
      "[OFG] Adding inbound forecast data to globalCompletedPgForecast"
    );
    inboundFcData.planningGroups.forEach((pg) => {
      if (
        !globalCompletedPgForecast.some(
          (pgForecast) => pgForecast.pgId === pg.planningGroupId
        )
      ) {
        // Transform inbound forecast data to same schema as outbound
        let contactsDaily = [];
        let contactsIntraday = [];
        let weightedAhtDaily = [];
        let ahtIntraday = [];

        for (let i = 0; i < pg.offeredPerInterval.length; i += 96) {
          let chunkOffered = pg.offeredPerInterval.slice(i, i + 96);
          let chunkAht = pg.averageHandleTimeSecondsPerInterval.slice(
            i,
            i + 96
          );
          let chunkTht = chunkOffered.map((val, idx) => val * chunkAht[idx]);
          let dayTht = chunkTht.reduce((a, b) => a + b, 0);
          let dayOffered = chunkOffered.reduce((a, b) => a + b, 0);
          let dayAht = dayTht / dayOffered;

          contactsIntraday.push(chunkOffered);
          contactsDaily.push(dayOffered);
          weightedAhtDaily.push(dayAht);
          ahtIntraday.push(chunkAht);
        }

        let transformedPg = {
          campaignId: null,
          pgId: pg.planningGroupId,
          fcData: {
            contactsDaily: contactsDaily,
            contactsIntraday: contactsIntraday,
            ahtDaily: weightedAhtDaily,
            ahtIntraday: ahtIntraday,
          },
        };

        globalCompletedPgForecast.push(transformedPg);
      }
    });

    console.log(
      "[OFG] Merged inbound and outbound forecast data",
      globalCompletedPgForecast
    );
  }
  loadPageThree();
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
    const pgId = option.value;
    const pgForecast = globalCompletedPgForecast.find((pg) => pg.pgId === pgId);
    const totalOffered = pgForecast
      ? pgForecast.fcData.contactsDaily.reduce((a, b) => a + b, 0)
      : 0;

    // If the option value is not in fcImportBody.planningGroups or totalOffered is 0, remove it
    if (
      !globalCompletedPgForecast.some((pg) => pg.pgId === option.value) ||
      totalOffered === 0
    ) {
      console.warn(
        `[OFG] Planning group ${option.value} not found in forecast data. Removing...`
      );

      // Set the option to disabled
      option.setAttribute("disabled", "true");

      // Update the option text
      let optionText = option.textContent;
      option.textContent = `${optionText} - No forecast data available for this planning group`;
    } else {
      option.removeAttribute("disabled");
    }
  });
}

// Function to get forecast data for visualisation
export async function viewAndModifyFc(selectedPgId, selectedWeekDay) {
  selectedWeekDay = Number(selectedWeekDay);
  let weeklyMode = selectedWeekDay === 99;

  let selectedPlanningGroup = globalCompletedPgForecast.find(
    (group) => group.pgId === selectedPgId
  );

  let offeredDaysForWeek = selectedPlanningGroup.fcData.contactsDaily;
  let ahtDaysForWeek = selectedPlanningGroup.fcData.ahtDaily;

  let offeredIntervalsForDay =
    selectedPlanningGroup.fcData.contactsIntraday[selectedWeekDay];
  let ahtIntervalsForDay =
    selectedPlanningGroup.fcData.ahtIntraday[selectedWeekDay];

  let offeredTotalForDay = parseFloat(offeredDaysForWeek[selectedWeekDay]);
  let ahtTotalForDay = parseFloat(ahtDaysForWeek[selectedWeekDay]);

  let ahtSumForWeek = 0;
  let offeredTotalForWeek = 0;
  for (let i = 0; i < offeredDaysForWeek.length; i++) {
    ahtSumForWeek += offeredDaysForWeek[i] * ahtDaysForWeek[i];
    offeredTotalForWeek += offeredDaysForWeek[i];
  }
  let ahtTotalForWeek = ahtSumForWeek / offeredTotalForWeek;

  let intervals;
  let xAxisLabels;

  if (weeklyMode) {
    console.log("[OFG] Weekly mode selected for planning group", selectedPgId);

    console.debug("[OFG] offeredTotalForWeek", offeredTotalForWeek);
    console.debug("[OFG] offeredDaysForWeek", offeredDaysForWeek);
    console.debug("[OFG] ahtTotalForWeek", ahtTotalForWeek);
    console.debug("[OFG] ahtDaysForWeek", ahtDaysForWeek);

    document.getElementById("forecast-offered").textContent =
      offeredTotalForWeek.toFixed(1);
    document.getElementById("forecast-aht").textContent =
      ahtTotalForWeek.toFixed(1);

    intervals = Array.from({ length: 7 }, (_, i) => i);

    xAxisLabels = Array.from({ length: 7 }, (_, i) => {
      let date = new Date(globalWeekStart);
      date.setDate(date.getDate() + i);

      let weekday = date.toLocaleDateString("en-GB", { weekday: "short" });

      return weekday;
    });
  } else {
    console.log("[OFG] Daily mode selected for planning group", selectedPgId);

    console.debug("[OFG] offeredTotalForDay", offeredTotalForDay);
    console.debug("[OFG] offeredIntervalsForDay", offeredIntervalsForDay);
    console.debug("[OFG] ahtTotalForDay", ahtTotalForDay);
    console.debug("[OFG] ahtIntervalsForDay", ahtIntervalsForDay);

    document.getElementById("forecast-offered").textContent =
      offeredTotalForDay.toFixed(1);
    document.getElementById("forecast-aht").textContent =
      ahtTotalForDay.toFixed(1);

    intervals = Array.from({ length: 96 }, (_, i) => {
      let hours = Math.floor(i / 4);
      let minutes = (i % 4) * 15;
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
    });

    xAxisLabels = intervals;
  }

  let vegaSpec = {
    "$schema": "https://vega.github.io/schema/vega/v5.json",
    "width": 400,
    "height": 360,
    "padding": 5,

    "data": [
      {
        "name": "table",
        "values": intervals.map((x, i) => {
          let y1 = weeklyMode
            ? offeredDaysForWeek[i]
            : offeredIntervalsForDay[i];
          let y2 = weeklyMode ? ahtDaysForWeek[i] : ahtIntervalsForDay[i];

          return { x, y1, y2 };
        }),
      },
    ],

    "scales": [
      {
        "name": "x",
        "type": "band",
        "range": "width",
        "domain": { "data": "table", "field": "x" },
        "padding": 0.1,
      },
      {
        "name": "y",
        "type": "linear",
        "range": "height",
        "nice": true,
        "zero": false,
        "domain": { "data": "table", "field": "y1" },
        "domainMin": 0,
      },
      {
        "name": "y2",
        "type": "linear",
        "range": "height",
        "nice": true,
        "zero": false,
        "domain": { "data": "table", "field": "y2" },
        "domainMin": 0,
      },
    ],

    "axes": [
      {
        "orient": "bottom",
        "scale": "x",
        "labelAngle": -90,
        "labelPadding": 10,
        "title": weeklyMode ? "Days" : "Time (hours)",
        "bandPosition": 0.5, // Center the labels between the ticks
        "labelAlign": "center", // Align labels to the center
        "values": weeklyMode
          ? xAxisLabels
          : Array.from(
              { length: 24 },
              (_, i) => `${i.toString().padStart(2, "0")}:00`
            ),
      },
      { "orient": "left", "scale": "y", "title": "Offered" },
      { "orient": "right", "scale": "y2", "title": "Average Handle Time" },
    ],

    "marks": [
      {
        "type": "rect",
        "from": { "data": "table" },
        "encode": {
          "enter": {
            "x": { "scale": "x", "field": "x" },
            "width": { "scale": "x", "band": 1 },
            "y": { "scale": "y", "field": "y1" },
            "y2": { "scale": "y", "value": 0 },
            "fill": { "value": "steelblue" },
          },
        },
      },
      {
        "type": "line",
        "from": { "data": "table" },
        "encode": {
          "enter": {
            "x": { "scale": "x", "field": "x", "band": 0.5 },
            "y": { "scale": "y2", "field": "y2" },
            "stroke": { "value": "orange" },
          },
        },
      },
      weeklyMode
        ? {
            "type": "symbol",
            "from": { "data": "table" },
            "encode": {
              "enter": {
                "x": { "scale": "x", "field": "x", "band": 0.5 },
                "y": { "scale": "y2", "field": "y2" },
                "fill": { "value": "orange" },
                "size": { "value": 50 },
              },
            },
          }
        : {
            "type": "symbol",
            "from": { "data": "table" },
            "encode": {
              "enter": {
                "x": { "scale": "x", "field": "x", "band": 0.5 },
                "y": { "scale": "y2", "field": "y2" },
                "fill": { "value": "orange" },
                "size": { "value": 0 },
              },
            },
          },
    ],
  };

  let view = new vega.View(vega.parse(vegaSpec), {
    renderer: "canvas",
    container: "#chart",
    hover: true,
  });

  view
    .change(
      "table",
      vega
        .changeset()
        .remove(() => true)
        .insert(
          intervals.map((x, i) => ({
            x: xAxisLabels[i],
            y1: weeklyMode ? offeredDaysForWeek[i] : offeredIntervalsForDay[i],
            y2: weeklyMode ? ahtDaysForWeek[i] : ahtIntervalsForDay[i],
          }))
        )
    )
    .run();

  // Original data for reset
  const originalOfferedIntervals = JSON.parse(
    JSON.stringify(weeklyMode ? offeredDaysForWeek : offeredIntervalsForDay)
  );
  const originalOfferedTotal = JSON.parse(
    JSON.stringify(weeklyMode ? offeredTotalForWeek : offeredTotalForDay)
  );
  const originalAhtIntervals = JSON.parse(
    JSON.stringify(weeklyMode ? ahtDaysForWeek : ahtIntervalsForDay)
  );
  const originalAhtTotal = JSON.parse(
    JSON.stringify(weeklyMode ? ahtTotalForWeek : ahtTotalForDay)
  );

  // Get the controls
  const smoothButton = document.getElementById("smooth-button");
  const normaliseButton = document.getElementById("normalise-button");
  const flattenButton = document.getElementById("flatten-button");
  const resetButton = document.getElementById("reset-button");

  // Function to update daily total in the document
  function updateDailyTotal(elementId, data, dataType) {
    let dailyTotal;

    if (dataType === "offered") {
      dailyTotal = data.reduce((a, b) => a + b, 0);
    } else if (dataType === "averageHandleTime") {
      let sumProduct = offeredIntervalsForDay.reduce(
        (sum, offered, i) => sum + offered * data[i],
        0
      );
      dailyTotal = sumProduct / offeredTotalForDay;
    }

    // Update the daily total in the document
    let element = document.getElementById(elementId);

    // Create a new span for the text content
    let span = document.createElement("span");
    span.textContent = dailyTotal.toFixed(1);

    // Add the bulge class to the span
    span.classList.add("bulge");

    // Clear the element's existing content and add the new span
    element.textContent = "";
    element.appendChild(span);

    // Remove the bulge class after the animation ends
    setTimeout(() => {
      span.classList.remove("bulge");
    }, 1000);

    return dailyTotal;
  }

  // Function to update the completed planning group forecast with modified data
  function updateCompletedPgForecast(dataType, intervals, day) {
    // Find the selected planning group
    let selectedPlanningGroup = globalCompletedPgForecast.find(
      (group) => group.pgId === selectedPgId
    );

    if (selectedPlanningGroup) {
      // TODO: Currently only updating the interval level data - do I need to update daily totals also?

      if (dataType === "offered") {
        // Update the intraday data for offered
        selectedPlanningGroup.fcData.contactsIntraday[selectedWeekDay] =
          intervals;
      } else if (dataType === "averageHandleTime") {
        // Update the intraday data for averageHandleTime
        selectedPlanningGroup.fcData.ahtIntraday[selectedWeekDay] = intervals;
      }
    }
  }

  // Smooth button event listener
  smoothButton.addEventListener("click", () => {
    // Get the selected data type
    let dataType = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Smoothing ${dataType} data for planning group ${selectedPgId}`
    );

    function smoothData(data) {
      // Identify the first and last non-zero indices
      let nonZeroIndices = data
        .map((value, index) => (value !== 0 ? index : -1))
        .filter((index) => index !== -1);
      let start_index = nonZeroIndices[0];
      let end_index = nonZeroIndices[nonZeroIndices.length - 1];

      // Extract the subrange
      let subrange = data.slice(start_index, end_index + 1);

      // Smooth the subrange
      let smoothedSubrange = subrange.map((num, i, arr) => {
        if (i === 0 || i === arr.length - 1) return num; // Skip the first and last element
        return Math.max(0, (arr[i - 1] + num + arr[i + 1]) / 3); // Ensure no values are less than zero
      });

      // Maintain the original sum
      let subrangeSum = subrange.reduce((a, b) => a + b, 0);
      let smoothedSum = smoothedSubrange.reduce((a, b) => a + b, 0);
      let diff = subrangeSum - smoothedSum;
      smoothedSubrange = smoothedSubrange.map((num) =>
        num !== 0
          ? num + diff / smoothedSubrange.filter((num) => num !== 0).length
          : num
      );

      // Replace the subrange in the original data
      let smoothedData = [...data];
      for (let i = start_index; i <= end_index; i++) {
        smoothedData[i] = smoothedSubrange[i - start_index];
      }

      return smoothedData;
    }

    // Smooth offered data and update daily total
    if (dataType === "offered" || dataType === "both") {
      // Smooth the offered data
      offeredIntervalsForDay = smoothData(offeredIntervalsForDay);

      // Update the daily total for offered
      offeredTotalForDay = updateDailyTotal(
        "forecast-offered",
        offeredIntervalsForDay,
        "offered"
      );

      // Update the completed planning group forecast with the modified data
      updateCompletedPgForecast(
        "offered",
        offeredIntervalsForDay,
        offeredTotalForDay
      );
      console.debug("[OFG] Smoothed offered data:", offeredIntervalsForDay);
    }

    // Smooth AHT data and update daily total
    if (dataType === "averageHandleTime" || dataType === "both") {
      // Smooth the AHT data
      ahtIntervalsForDay = smoothData(ahtIntervalsForDay);

      // Update the daily total for AHT
      ahtTotalForDay = updateDailyTotal(
        "forecast-aht",
        ahtIntervalsForDay,
        "averageHandleTime"
      );

      // Update the completed planning group forecast with the modified data
      updateCompletedPgForecast(
        "averageHandleTime",
        ahtIntervalsForDay,
        ahtTotalForDay
      );
      console.debug("[OFG] Smoothed AHT data:", ahtIntervalsForDay);
    }

    if (!dataType) {
      alert("Please select a metric to smooth");
    }

    // Update chart datasets
    view
      .change(
        "table",
        vega
          .changeset()
          .remove(() => true)
          .insert(
            intervals.map((x, i) => ({
              x,
              "y1": offeredIntervalsForDay[i],
              "y2": ahtIntervalsForDay[i],
            }))
          )
      )
      .run();
  });

  // Normalise button event listener
  normaliseButton.addEventListener("click", () => {
    let dataType = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Normalising outliers from ${dataType} data for planning group ${selectedPgId}`
    );

    function normaliseData(data) {
      // Identify the first and last non-zero indices
      let nonZeroIndices = data
        .map((value, index) => (value !== 0 ? index : -1))
        .filter((index) => index !== -1);
      let start_index = nonZeroIndices[0];
      let end_index = nonZeroIndices[nonZeroIndices.length - 1];

      // Extract the subrange
      let subrange = data.slice(start_index, end_index + 1);

      // Calculate thresholds for peaks and troughs based on percentiles
      let sortedSubrange = [...subrange].sort((a, b) => a - b);
      let lowerPercentile =
        sortedSubrange[Math.floor(sortedSubrange.length * 0.1)];
      let upperPercentile =
        sortedSubrange[Math.floor(sortedSubrange.length * 0.9)];

      // Trim peaks and uplift troughs
      let adjustedSubrange = subrange.map((num) => {
        if (num < lowerPercentile) return lowerPercentile;
        if (num > upperPercentile) return upperPercentile;
        return num;
      });

      // Maintain the original sum
      let originalSum = subrange.reduce((a, b) => a + b, 0);
      let adjustedSum = adjustedSubrange.reduce((a, b) => a + b, 0);
      let diff = originalSum - adjustedSum;
      let nonZeroCount = adjustedSubrange.filter((num) => num !== 0).length;
      adjustedSubrange = adjustedSubrange.map((num) =>
        num !== 0 ? num + diff / nonZeroCount : num
      );

      // Replace the subrange in the original data
      let adjustedData = [...data];
      for (let i = start_index; i <= end_index; i++) {
        adjustedData[i] = adjustedSubrange[i - start_index];
      }

      return adjustedData;
    }

    // Normalise offered data and update daily total
    if (dataType === "offered" || dataType === "both") {
      // Normalise the offered data
      offeredIntervalsForDay = normaliseData(offeredIntervalsForDay);

      // Update the daily total for offered
      offeredTotalForDay = updateDailyTotal(
        "forecast-offered",
        offeredIntervalsForDay,
        "offered"
      );

      // Update the completed planning group forecast with the modified data
      updateCompletedPgForecast(
        "offered",
        offeredIntervalsForDay,
        offeredTotalForDay
      );
      console.debug("[OFG] Normalised offered data:", offeredIntervalsForDay);
    }

    // Normalise AHT data and update daily total
    if (dataType === "averageHandleTime" || dataType === "both") {
      // Normalise the AHT data
      ahtIntervalsForDay = normaliseData(ahtIntervalsForDay);

      // Update the daily total for AHT
      ahtTotalForDay = updateDailyTotal(
        "forecast-aht",
        ahtIntervalsForDay,
        "averageHandleTime"
      );

      // Update the completed planning group forecast with the modified data
      updateCompletedPgForecast(
        "averageHandleTime",
        ahtIntervalsForDay,
        ahtTotalForDay
      );
      console.debug("[OFG] Normalised AHT data:", ahtIntervalsForDay);
    }

    if (!dataType) {
      alert("Please select a metric to normalise");
    }

    // Update chart datasets
    view
      .change(
        "table",
        vega
          .changeset()
          .remove(() => true)
          .insert(
            intervals.map((x, i) => ({
              x,
              "y1": offeredIntervalsForDay[i],
              "y2": ahtIntervalsForDay[i],
            }))
          )
      )
      .run();
  });

  // Flatten button event listener
  flattenButton.addEventListener("click", () => {
    let dataType = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Flattening ${dataType} data for planning group ${selectedPgId}`
    );

    function flattenData(data, total, dataType) {
      let nonZeroIndices = data
        .map((value, index) => (value !== 0 ? index : -1))
        .filter((index) => index !== -1);
      let start_index = nonZeroIndices[0];
      let end_index = nonZeroIndices[nonZeroIndices.length - 1];

      let subrange = data.slice(start_index, end_index + 1);
      let nonZeroValues = subrange.filter((value) => value !== 0);
      let average = nonZeroValues.length > 0 ? total / nonZeroValues.length : 0;

      let flattenedSubrange = subrange.map((value) => {
        if (dataType === "offered") {
          return value !== 0 ? average : 0;
        } else {
          return value !== 0 ? total : 0;
        }
      });

      let flattenedData = [...data];
      for (let i = start_index; i <= end_index; i++) {
        flattenedData[i] = flattenedSubrange[i - start_index];
      }

      return flattenedData;
    }

    if (dataType === "offered" || dataType === "both") {
      // Flatten offered data
      offeredIntervalsForDay = flattenData(
        offeredIntervalsForDay,
        offeredTotalForDay,
        "offered"
      );

      // Update the daily total forecast-offered
      offeredTotalForDay = updateDailyTotal(
        "forecast-offered",
        offeredIntervalsForDay,
        "offered"
      );

      // Update the completed planning group forecast with the modified data
      updateCompletedPgForecast(
        "offered",
        offeredIntervalsForDay,
        offeredTotalForDay
      );
      console.debug("[OFG] Flattened offered data:", offeredIntervalsForDay);
    }

    if (dataType === "averageHandleTime" || dataType === "both") {
      // Flatten AHT data
      ahtIntervalsForDay = flattenData(
        ahtIntervalsForDay,
        ahtTotalForDay,
        "averageHandleTime"
      );

      // Update the daily total forecast-aht
      ahtTotalForDay = updateDailyTotal(
        "forecast-aht",
        ahtIntervalsForDay,
        "averageHandleTime"
      );

      // Update the completed planning group forecast with the modified data
      updateCompletedPgForecast(
        "averageHandleTime",
        ahtIntervalsForDay,
        ahtTotalForDay
      );
      console.debug("[OFG] Flattened AHT data:", ahtIntervalsForDay);
    }

    if (!dataType) {
      alert("Please select a metric to flatten");
    }

    view
      .change(
        "table",
        vega
          .changeset()
          .remove(() => true)
          .insert(
            intervals.map((x, i) => ({
              x,
              "y1": offeredIntervalsForDay[i],
              "y2": ahtIntervalsForDay[i],
            }))
          )
      )
      .run();
  });

  // Reset button event listener
  resetButton.addEventListener("click", () => {
    let dataType = document.getElementById("metric-select").value;
    console.log(
      `[OFG] Resetting ${dataType} data for planning group ${selectedPgId}`
    );

    if (dataType === "offered" || dataType === "both") {
      // Reset offered data
      offeredIntervalsForDay = JSON.parse(
        JSON.stringify(originalOfferedIntervals)
      );
      offeredTotalForDay = JSON.parse(JSON.stringify(originalOfferedTotal));

      // Update the completed planning group forecast with the modified data
      updateCompletedPgForecast(
        "offered",
        offeredIntervalsForDay,
        offeredTotalForDay
      );

      // Update the daily total forecast-offered
      let element = document.getElementById("forecast-offered");
      element.textContent = offeredTotalForDay.toFixed(1);

      // Add the flash class to the element
      element.classList.add("flash");

      // Remove the flash class after the animation ends
      setTimeout(() => {
        element.classList.remove("flash");
      }, 1000);
    }
    if (dataType === "averageHandleTime" || dataType === "both") {
      // Reset AHT data
      ahtIntervalsForDay = JSON.parse(JSON.stringify(originalAhtIntervals));
      ahtTotalForDay = JSON.parse(JSON.stringify(originalAhtTotal));

      // Update the completed planning group forecast with the modified data
      updateCompletedPgForecast(
        "averageHandleTime",
        ahtIntervalsForDay,
        ahtTotalForDay
      );

      // Update the daily total forecast-aht
      let element = document.getElementById("forecast-aht");
      element.textContent = ahtTotalForDay.toFixed(1);

      // Add the flash class to the element
      element.classList.add("flash");

      // Remove the flash class after the animation ends
      setTimeout(() => {
        element.classList.remove("flash");
      }, 1000);
    }

    if (!dataType) {
      alert("Please select a metric to reset");
    }

    // Update chart datasets
    view
      .change(
        "table",
        vega
          .changeset()
          .remove(() => true)
          .insert(
            intervals.map((x, i) => ({
              x,
              "y1": offeredIntervalsForDay[i],
              "y2": ahtIntervalsForDay[i],
            }))
          )
      )
      .run();
  });

  // Unhide the totals table div
  const totalsTableDiv = document.getElementById("totals-table");
  totalsTableDiv.hidden = false;

  // Unhide the controls div
  const controlsDiv = document.getElementById("controls");
  controlsDiv.hidden = false;
}

// Import forecast to GC
export async function importForecast() {
  loadPageFour();

  // Prepare forecast
  updateLoadingMessage("import-loading-message", "Preparing forecast");
  let [fcImportBody, importGzip, contentLength] = await prepFcImportBody(
    globalCompletedPgForecast,
    globalBusinessUnitStartDayOfWeek,
    globalForecastDescription
  );

  // Log the forecast import body
  console.debug("[OFG] Forecast import body:", fcImportBody);

  // Declare variables
  let importOperationId = null;

  let topics = ["shorttermforecasts.import"];

  let importNotifications = new NotificationHandler(
    topics,
    globalBusinessUnitId,
    runImport,
    handleImportNotification
  );
  importNotifications.connect();
  importNotifications.subscribeToNotifications();

  // Main import function
  async function runImport() {
    // Generate URL for upload
    updateLoadingMessage("import-loading-message", "Generating URL for upload");
    let uploadAttributes = await generateUrl(
      globalBusinessUnitId,
      globalWeekStart,
      contentLength
    );

    // Upload forecast
    updateLoadingMessage("import-loading-message", "Uploading forecast");
    /* GCF function being used until CORS blocking removed */
    // importFc(globalBusinessUnitId, globalWeekStart, importGzip, uploadAttributes);
    const uploadResponse = await invokeGCF(uploadAttributes, fcImportBody);

    // Check if upload was successful
    if (uploadResponse === 200) {
      const uploadKey = uploadAttributes.uploadKey;
      console.log(
        "[OFG] Forecast uploaded successfully! Calling import method."
      );

      // Import forecast
      updateLoadingMessage("import-loading-message", "Importing forecast");
      const importResponse = await importFc(
        globalBusinessUnitId,
        globalWeekStart,
        uploadKey
      );

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

      // Create a button to open forecast
      /* 
      TODO: Find a way to allow user to navigate main GC browser window to new forecast
      const openForecastButton = document.createElement("gux-button");
      openForecastButton.id = "open-forecast-button";
      openForecastButton.setAttribute("accent", "primary");
      openForecastButton.setAttribute("disabled", "true");
      openForecastButton.className = "align-right";
      openForecastButton.textContent = "Open Forecast";
      */

      // Add event listener to restart button
      restartButton.addEventListener("click", (event) => {
        switchPages("page-four", "page-one");
        loadPageOne();
      });

      let message;
      if (status === "Complete") {
        console.log("[OFG] Forecast import completed successfully!");

        const forecastId = notification.eventBody.result.id;

        // Add event listener to open forecast button
        /*
        TODO: Find a way to allow user to navigate main GC browser window to new forecast
        openForecastButton.addEventListener("click", (event) => {
          window.top.location.href = `/directory/#/admin/wfm/forecasts/${globalBusinessUnitId}/update/${globalWeekStart}${forecastId}`;
        });
        */

        // Enable open forecast button
        //openForecastButton.removeAttribute("disabled");

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
      //buttonsContainer.appendChild(openForecastButton);

      // Append the buttonsContainer
      resultsContainer.appendChild(buttonsContainer);
    } else {
      console.log("[OFG] Message from server: ", notification);
    }
  }
}
