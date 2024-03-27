import { handleApiCalls, globalPageOpts } from "./apiHandler.js";
import { populateDropdown } from "./dropdownHandler.js";

// Global variables
let businessUnits = [];
const businessUnitListbox = document.getElementById("business-unit-listbox");

// Function to hide loading spinner and show content
export async function hideLoadingSpinner(spinner, elem) {
  console.log("[OFG] hideLoadingSpinner");

  const spinnerElem = document.getElementById(spinner);
  const elemElem = document.getElementById(elem);

  spinnerElem.style.display = "none";
  elemElem.style.display = "block";
}

// Function to handle page transitions
export function switchPages(currentPageId, nextPageId) {
  const currentPage = document.getElementById(currentPageId);
  const nextPage = document.getElementById(nextPageId);

  currentPage.classList.remove("active-page");
  currentPage.classList.add("inactive-page");

  setTimeout(() => {
    nextPage.classList.add("active-page");
    nextPage.classList.remove("inactive-page");
  }, 100); // Delay for a smoother transition
}

// Function to load selected Business Unit data
export async function getBusinessUnit() {
  if (window.isTesting) {
    // Testing mode - Get Business Unit data from ./test/source/bu.json
    try {
      const response = await fetch(
        "/outboundForecastGenerator/test/source/bu.json"
      );
      const data = await response.json();
      console.log("[OFG] Business Unit data loaded from test data", data);
      return data;
    } catch (error) {
      console.error("[OFG] Error loading test data", error);
    }
  } else {
    // Production mode
    const selectedBuId = businessUnitListbox.value;
    console.log("[OFG] Selected Business Unit ID", selectedBuId);
    const businessUnitData = await handleApiCalls(
      "WorkforceManagementApi.getWorkforcemanagementBusinessunit",
      selectedBuId, // Pass selected Business Unit ID
      {
        "expand": ["settings.timeZone, settings.startDayOfWeek"], // [String] | Include to access additional data on the business unit
      }
    );
    console.log("[OFG] Business Unit data loaded", businessUnitData);
    return businessUnitData;
  }
}

export async function loadPageOne() {
  if (window.isTesting) {
    // Testing mode - Get Business Units from ./test/source/businessUnits.json
    try {
      const response = await fetch(
        "/outboundForecastGenerator/test/source/businessUnits.json"
      );
      const data = await response.json();
      businessUnits = data.entities;
      console.log(
        `[OFG] ${businessUnits.length} Business Units loaded from test data`,
        businessUnits
      );
    } catch (error) {
      console.error("[OFG] Error loading test data", error);
    }
  } else {
    // Production mode
    businessUnits = await handleApiCalls(
      "WorkforceManagementApi.getWorkforcemanagementBusinessunits"
    );
    console.log(
      `[OFG] ${businessUnits.length} Business Units loaded`,
      businessUnits
    );
  }

  // Populate Business Unit dropdown
  await populateDropdown(businessUnitListbox, businessUnits);

  // Hide loading spinner and show main
  await hideLoadingSpinner("main-loading-section", "main");
}
