import {
  switchPages,
  getBusinessUnit,
  loadPageOne,
  loadPageTwo,
} from "./pageHandler.js";
import { generateForecast, importForecast } from "./main.js";
import {
  getSelectedPgForecastData,
  populateGraphAndTable,
} from "./modificationHandler.js";
import { sharedState } from "./main.js";

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

      // Update week-start-label with start day of week
      const buStartDayOfWeek = selectedBusinessUnit.settings.startDayOfWeek;
      const label = (document.getElementById(
        "week-start-label"
      ).textContent = `Week start (${buStartDayOfWeek})`);
    });
  } else {
    console.error("[OFG] Business Unit dropdown not found");
  }

  // Event listener for p1 next button
  const nextButton = document.getElementById("p1-next-button");
  nextButton.addEventListener("click", function () {
    console.log("[OFG] Loading page two");

    const buStartDayOfWeek = selectedBusinessUnit.settings.startDayOfWeek;
    const weekStartInput = document.getElementById("week-start");
    const weekStart = weekStartInput.value;
    // Check weekStart (e.g. "2024-06-02") aligns to buStartDayOfWeek (e.g. "Monday")
    const weekStartDay = new Date(weekStart).toLocaleDateString("en-US", {
      weekday: "long",
    });
    if (weekStartDay !== buStartDayOfWeek) {
      alert(
        `Please select a week start date that aligns with the Business Unit's start day of week (${buStartDayOfWeek})`
      );

      // Highlight week start with adding a colour to label
      document.getElementById("week-start-label").style.color = "red";

      return;
    } else {
      // Remove colour from label
      document.getElementById("week-start-label").style.color = "black";
    }

    loadPageTwo();
    switchPages("page-one", "page-two");
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
          loadPageOne();
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
      const totalContacts = await getPlanningGroupContacts();

      if (totalContacts === 0) {
        alert("Please enter the number of contacts for at least one campaign");
        return;
      }

      // Assign sharedState.userInputs properties
      Object.assign(
        sharedState.userInputs.forecastParameters,
        getForecastParameters()
      );
      Object.assign(sharedState.userInputs.forecastOptions, getOptions());

      generateForecast();
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
      // Remove disabled attribute from "week-day-dropdown"
      weekDayDropdown.removeAttribute("disabled");

      // set weekDayDropdown placeholder
      weekDayDropdown.placeholder = "Select a week day";

      // Check if weekDayDropdown has a value
      if (weekDayDropdown.value) {
        // Get Planning Group forecast data for week day
        const pgData = await getSelectedPgForecastData();
        populateGraphAndTable(pgData);
      }
    });

    // Add event listener to "week-day-dropdown"
    weekDayDropdown.addEventListener("change", async () => {
      // Check if planningGroupDropdown has a value
      if (planningGroupDropdown.value) {
        // Get Planning Group forecast data for week day
        const pgData = await getSelectedPgForecastData();
        populateGraphAndTable(pgData);
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

async function getPlanningGroupContacts() {
  // Define shared state planning groups
  let planningGroups = sharedState.userInputs.planningGroups;

  // Get and validate user planning group values
  const tableBody = document.querySelector("#planning-groups-table tbody");
  const rows = tableBody.querySelectorAll("tr");

  let totalContacts = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const pgNameCell = row.querySelector("td:first-child");
    const pgName = pgNameCell.textContent;
    const pgId = pgNameCell.dataset.pgId;

    // Find the planning group in the sharedState.planningGroups array
    let pgData = planningGroups.find(
      (pgData) => pgData.planningGroup.id === pgId
    );

    // Get the number of contacts
    const numContactsInput = row.querySelector("input");
    const numContacts = numContactsInput.value;

    // Validate the number of contacts
    if (numContacts === "" || isNaN(numContacts)) {
      alert(`Please enter a valid number of contacts for ${pgName}`);
      return;
    }

    // Add numContacts to totalContacts
    totalContacts += parseInt(numContacts);

    // Add numContacts to matched planning group
    pgData.numContacts = numContacts;
  }

  return totalContacts;
}

function getForecastParameters() {
  return {
    weekStart: document.getElementById("week-start").value,
    historicalWeeks: document.getElementById("historical-weeks").value,
    description: document.getElementById("fc-description").value,
  };
}

function getOptions() {
  return {
    ignoreZeroes: document.getElementById("ignore-zeroes").checked,
    resolveContactsAhtMode: document.getElementById("resolve-contacts-aht")
      .checked,
    generateInbound: document.getElementById("generate-inbound-fc").checked,
    retainInbound: document.getElementById("retain-inbound-fc").checked,
  };
}
