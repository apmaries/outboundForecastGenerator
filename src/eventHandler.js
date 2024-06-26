import {
  switchPages,
  getRadioValue,
  getBusinessUnit,
  loadPageTwo,
  loadPageThree,
  loadPageFour,
} from "./pageHandler.js";
import {
  generateForecast,
  importForecast,
  getPlanningGroupDataForDay,
} from "./main.js";

let selectedBusinessUnit;

export function initializeEventListeners() {
  // Event listener for BU dropdown on page 1
  const businessUnitDropdown = document.getElementById(
    "business-unit-dropdown"
  );
  if (businessUnitDropdown) {
    businessUnitDropdown.addEventListener("change", async () => {
      const weekStartInput = document.getElementById("week-start");
      weekStartInput.disabled = true;
      const selectedBuId = businessUnitDropdown.value;
      console.log(`[OFG] Business Unit dropdown changed to ${selectedBuId}`);
      selectedBusinessUnit = await getBusinessUnit();
    });
  } else {
    console.error("[OFG] Business Unit dropdown not found");
  }

  // Event listener for next buttons
  const nextButtons = document.getElementsByName("next-button");
  nextButtons.forEach((nextButton) => {
    nextButton.addEventListener("click", function () {
      const currentPage = document.querySelector(".active-page");
      let nextPageId;
      switch (currentPage.id) {
        case "page-one":
          console.log("[OFG] Loading page two");
          nextPageId = "page-two";
          loadPageTwo();
          break;
        case "page-two":
          console.log("[OFG] Loading page three");
          nextPageId = "page-three";
          loadPageThree();
          break;
      }
      if (nextPageId) {
        switchPages(currentPage.id, nextPageId);
      }
    });
  });

  // Event listener for back buttons
  const backButtons = document.getElementsByName("back-button");
  backButtons.forEach((backButton) => {
    backButton.addEventListener("click", function () {
      const currentPage = document.querySelector(".active-page");
      let previousPageId;
      switch (currentPage.id) {
        case "page-two":
          console.log("[OFG] Loading page one");
          previousPageId = "page-one";
          break;
        case "page-three":
          console.log("[OFG] Loading page two");
          previousPageId = "page-two";
          break;
      }
      if (previousPageId) {
        switchPages(currentPage.id, previousPageId);
      }
    });
  });

  // Event listener for generate button
  const generateButton = document.getElementById("generate-button");
  if (generateButton) {
    generateButton.addEventListener("click", async () => {
      const test = window.isTesting;
      const buName = selectedBusinessUnit.name;
      const buId = selectedBusinessUnit.id;
      const buStartDayOfWeek = selectedBusinessUnit.settings.startDayOfWeek;
      const buTimeZone = selectedBusinessUnit.settings.timeZone;
      const weekStart = document.getElementById("week-start").value;
      const historicalWeeks = document.getElementById("historical-weeks").value;

      let planningGroupContactsArray = [];
      const tableBody = document.querySelector("#planning-groups-table tbody");
      const rows = tableBody.querySelectorAll("tr");
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll("td");
        const pgNameCell = row.querySelector("td:first-child");
        const pgName = pgNameCell.textContent;
        const pgId = pgNameCell.dataset.pgId;
        const cpNameCell = row.querySelector("td:nth-child(2)");

        let planningGroupContacts = {
          "pgName": pgName,
          "pgId": pgId,
        };

        if (cpNameCell.dataset.matchedCampaign === "true") {
          const cpName = cpNameCell.textContent;
          const cpId = cpNameCell.dataset.campaignId;
          const numContactsInput = document.getElementById(`nContacts_${pgId}`);
          const numContacts = numContactsInput.value;

          planningGroupContacts["cpName"] = cpName;
          planningGroupContacts["cpId"] = cpId;
          planningGroupContacts["numContacts"] = numContacts;
        }
        planningGroupContactsArray.push(planningGroupContacts);
      }

      const ignoreZeroes = document.getElementById("ignoreZeroes").checked;
      const inboundForecastModeRadio = document.getElementsByName(
        "inbound-forecast-radio"
      );
      const inboundForecastMode = getRadioValue(inboundForecastModeRadio);
      const forecastDescription =
        document.getElementById("fc-description").value;

      generateForecast(
        test,
        buName,
        buId,
        buStartDayOfWeek,
        buTimeZone,
        weekStart,
        historicalWeeks,
        planningGroupContactsArray,
        ignoreZeroes,
        inboundForecastMode,
        forecastDescription
      );

      // Enable the planningGroupDropdown
      planningGroupDropdown.disabled = false;
    });
  } else {
    console.error("[OFG] Generate button not found");
  }

  // Event listener for planning group dropdown
  const planningGroupDropdown = document.getElementById(
    "planning-group-dropdown"
  );
  const weekDayDropdown = document.getElementById("week-day-dropdown");

  if (planningGroupDropdown && weekDayDropdown) {
    planningGroupDropdown.addEventListener("change", async () => {
      const selectedPgId = planningGroupDropdown.value;
      console.log(`[OFG] Planning Group dropdown changed to ${selectedPgId}`);

      // Remove disabled attribute from "week-day-dropdown"
      weekDayDropdown.removeAttribute("disabled");

      // set weekDayDropdown placeholder
      weekDayDropdown.placeholder = "Select a week day";

      // Check if weekDayDropdown has a value
      if (weekDayDropdown.value) {
        // Get Planning Group forecast data for week day
        const pgDataWeekDay = await getPlanningGroupDataForDay(
          selectedPgId,
          weekDayDropdown.value
        );
      }
    });

    // Add event listener to "week-day-dropdown"
    weekDayDropdown.addEventListener("change", async () => {
      const selectedWeekDay = weekDayDropdown.value;
      console.log(`[OFG] Week Day dropdown changed to ${selectedWeekDay}`);

      // Check if planningGroupDropdown has a value
      if (planningGroupDropdown.value) {
        // Get Planning Group forecast data for week day
        const pgDataWeekDay = await getPlanningGroupDataForDay(
          planningGroupDropdown.value,
          selectedWeekDay
        );
      }
    });
  } else {
    console.error("[OFG] Dropdowns not found");
  }

  // Event listener for import button
  const importButton = document.getElementById("import-button");
  if (importButton) {
    importButton.addEventListener("click", async () => {
      await importForecast();
    });
  } else {
    console.error("[OFG] Import button not found");
  }
}
