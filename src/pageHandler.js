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
  let businessUnitData;
  if (window.isTesting) {
    // Testing mode - Get Business Unit data from ./test/source/bu.json
    try {
      const response = await fetch(
        "/outboundForecastGenerator/test/source/bu.json"
      );
      businessUnitData = await response.json();
      console.log(
        "[OFG] Business Unit data loaded from test data",
        businessUnitData
      );
    } catch (error) {
      console.error("[OFG] Error loading test data", error);
    }
  } else {
    // Production mode
    const selectedBuId = businessUnitListbox.value;
    businessUnitData = await handleApiCalls(
      "WorkforceManagementApi.getWorkforcemanagementBusinessunit",
      selectedBuId, // Pass selected Business Unit ID
      {
        "expand": ["settings.timeZone, settings.startDayOfWeek"], // [String] | Include to access additional data on the business unit
      }
    );
    console.log(`[OFG] Business Unit '${businessUnitData.name}' loaded`);
  }

  const dayNameToNumber = {
    "Sunday": 0,
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6,
  };

  const businessUnitStartDayOfWeek = businessUnitData.settings.startDayOfWeek;
  const businessUnitTimeZone = businessUnitData.settings.timeZone;

  // Populate Business Unit time zone to page
  document.getElementById("bu-timezone").value = businessUnitTimeZone;

  // Update the week-start element to next occurance of the start day of week e.g. "Monday"
  const weekStart = document.getElementById("week-start");
  const today = new Date();
  const daysUntilStart =
    (dayNameToNumber[businessUnitStartDayOfWeek] - today.getDay() + 7) % 7;
  const nextStart = new Date(today);
  nextStart.setDate(today.getDate() + daysUntilStart);
  weekStart.value = nextStart.toISOString().slice(0, 10);

  // Re-enable the week start element
  weekStart.disabled = false;

  return businessUnitData;
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
    try {
      businessUnits = await handleApiCalls(
        "WorkforceManagementApi.getWorkforcemanagementBusinessunits"
      );
      console.log(
        `[OFG] ${businessUnits.length} Business Units loaded`,
        businessUnits
      );
    } catch (error) {
      console.error("[OFG] Error loading business units", error);
    }
  }

  // Populate Business Unit dropdown
  await populateDropdown(businessUnitListbox, businessUnits);

  // Hide loading spinner and show main
  await hideLoadingSpinner("main-loading-section", "main");
}

export async function loadPageTwo() {
  const selectedBuId = businessUnitListbox.value;
  // Function to get planning groups from BU id
  async function getPlanningGroups() {
    console.log(`[OFG] Get Planning Groups initiated`);
    let planningGroups;
    let planningGroupsArray = [];

    if (window.isTesting) {
      // Testing mode - Get Planning Groups from ./test/source/planningGroups.json
      try {
        const response = await fetch(
          "/outboundForecastGenerator/test/source/planningGroups.json"
        );
        const data = await response.json();
        planningGroups = data.entities;
        console.log(
          "[OFG] Planning Groups loaded from test data",
          planningGroups
        );
      } catch (error) {
        console.error("[OFG] Error loading test data", error);
      }
    } else {
      // Production mode
      try {
        planningGroups = await handleApiCalls(
          "WorkforceManagementApi.getWorkforcemanagementBusinessunitPlanninggroups",
          selectedBuId
        );
        console.log(
          `[OFG] ${planningGroups.length} Business Units loaded`,
          planningGroups
        );
      } catch (error) {
        console.error("[OFG] Error loading business units", error);
      }
    }

    // loop through planning groups to build array of planning group objects
    for (let i = 0; i < planningGroups.length; i++) {
      const group = planningGroups[i];
      console.log(
        `[OFG] Processing planning group ${i + 1}: ${group.name} (${group.id})`
      );

      // get planning group data
      const groupId = group.id;
      const groupName = group.name;
      const groupRpQueue = group.routePaths[0].queue;
      const groupQueueId = groupRpQueue.id;

      // create a new planning group object
      let pgObj = {
        "pgId": groupId,
        "pgName": groupName,
        "pgQueueId": groupQueueId,
      };

      // add planning group object to array
      planningGroupsArray.push(pgObj);
      console.debug(`[OFG] PG[${i + 1}] = ` + JSON.stringify(pgObj));
    }

    return planningGroupsArray;
  }

  // Function to get outbound campaigns
  async function getCampaigns() {
    let campaigns;
    let campaignsArray = [];
    console.log(`[OFG] Get Campaigns initiated`);

    if (window.isTesting) {
      // Testing mode - Get Campaigns from ./test/source/campaigns.json
      try {
        const response = await fetch(
          "/outboundForecastGenerator/test/source/campaigns.json"
        );
        const data = await response.json();
        campaigns = data.entities;
        console.log(
          "[OFG] Planning Groups loaded from test data",
          planningGroups
        );
      } catch (error) {
        console.error("[OFG] Error loading test data", error);
      }
    } else {
      // Production mode
      try {
        campaigns = await handleApiCalls(
          "OutboundApi.getOutboundCampaigns",
          globalPageOpts
        );

        console.log(`[OFG] Found ${campaigns.length} campaigns`);
      } catch (error) {
        console.error("[OFG] Error loading campaigns", error);
      }
    }

    // loop through campaigns to build array of campaign objects
    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      console.log(
        `[OFG] Processing campaign ${i + 1}: ${campaign.name} (${campaign.id})`
      );

      // get campaign data
      const campaignId = campaign.id;
      const campaignName = campaign.name;
      const campaignQueueId = campaign.queue.id;
      const campaignQueueName = campaign.queue.name;

      // create a new campaign object
      let campaignObj = {
        "campaignId": campaignId,
        "campaignName": campaignName,
        "campaignQueueId": campaignQueueId,
        "campaignQueueName": campaignQueueName,
      };

      // add campaign object to array
      campaignsArray.push(campaignObj);
      console.debug(
        `[OFG] Campaign[${i + 1}] = ` + JSON.stringify(campaignObj)
      );
    }

    return campaignsArray;
  }

  // Function to get queue campaigns
  async function queueCampaignMatcher(planningGroups, campaigns) {
    // define document elements
    const loadingSpinner = document.getElementById("planning-groups-loading");
    const planningGroupsDiv = document.getElementById(
      "planning-groups-container"
    );
    const planningGroupsTable = document.querySelector(
      "#planning-groups-table"
    );
    const tableBody = document.querySelector("#planning-groups-table tbody");

    // Clear out any existing rows
    tableBody.innerHTML = "";

    console.log(`[OFG] Matching queues & campaigns`);

    for (let i = 0; i < planningGroups.length; i++) {
      // loop through planning groups to link to campaigns and populate table
      const group = planningGroups[i];
      const groupQueueId = group.pgQueueId;
      const groupId = group.pgId;
      const groupName = group.pgName;

      console.log(
        `[OFG] PG${
          i + 1
        }[${groupId}] Matching ${groupName} to campaigns with queue id ${groupQueueId}`
      );

      // find matching campaign
      const matchingCampaign = campaigns.find(
        (campaign) => campaign.campaignQueueId === groupQueueId
      );

      // create table row
      const row = document.createElement("tr");

      // populate pg name cell
      const pgNameCell = document.createElement("td");
      pgNameCell.textContent = groupName;
      pgNameCell.dataset.pgId = groupId; // Add the planning group id as a data attribute
      row.appendChild(pgNameCell);

      // populate campaign name cell
      const campaignNameCell = document.createElement("td");
      if (matchingCampaign) {
        // populate campaign name if matching campaign found
        console.log(
          `[OFG] PG${i + 1}[${groupId}] Matched ${groupName} to ${
            matchingCampaign.campaignName
          } (${matchingCampaign.campaignId})`
        );
        campaignNameCell.textContent = matchingCampaign.campaignName;
        campaignNameCell.dataset.campaignId = matchingCampaign.campaignId; // Add the campaign id as a data attribute
      } else {
        // populate empty cell if no matching campaign found
        console.warn(
          `[OFG] PG${
            1 + 1
          }[${groupId}] No matching campaign found for ${groupName}`
        );
        campaignNameCell.textContent = "";
      }
      row.appendChild(campaignNameCell);

      // populate nContacts cell
      const inputId = "nContacts_" + groupId;
      const nContactsCell = document.createElement("td");

      const guxFormFieldNumber = document.createElement(
        "gux-form-field-number"
      );
      guxFormFieldNumber.setAttribute("label-position", "screenreader");

      const input = document.createElement("input");
      input.slot = "input";
      input.type = "number";
      input.id = inputId;
      input.min = "0";
      input.max = "100000";
      input.value = "0";
      input.step = "500";

      const label = document.createElement("label");
      label.slot = "label";
      label.textContent = groupName + " number of contacts";

      if (!matchingCampaign) {
        // Disable input if no matching campaign found and add data attribute to indicate this
        input.disabled = true;
        campaignNameCell.dataset.matchedCampaign = "false";
        row.style.fontStyle = "italic";
        row.style.color = "grey";
        // TODO: Would like to move row to the bottom of the table if no matching campaign found - pending fix to sortable table
      } else {
        // Add data attribute to indicate that a matching campaign was found
        campaignNameCell.dataset.matchedCampaign = "true";
      }

      guxFormFieldNumber.appendChild(input);
      guxFormFieldNumber.appendChild(label);
      nContactsCell.appendChild(guxFormFieldNumber);

      row.appendChild(nContactsCell);

      tableBody.appendChild(row);
    }

    loadingSpinner.style.display = "none";
    planningGroupsDiv.style.display = "block";
  }

  // Use Promise.all to run getPlanningGroups and getCampaigns concurrently
  var [planningGroups, campaigns] = await Promise.all([
    getPlanningGroups(),
    getCampaigns(),
  ]);

  // Execute queueCampaignMatcher after getPlanningGroups and getCampaigns complete
  await queueCampaignMatcher(planningGroups, campaigns);
}
