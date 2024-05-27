import { handleApiCalls, globalPageOpts } from "./apiHandler.js";
import { validatePlanningGroupDropdown } from "./main.js";

// Global variables
let businessUnits = [];
const businessUnitListbox = document.getElementById("business-unit-listbox");
let planningGroupsSummary = []; // Array to store planning group name & id for later use in page three visualisations
const planningGroupsListbox = document.getElementById("planning-group-listbox");

// Function to hide loading spinner and show content
export async function hideLoadingSpinner(elem, spinner) {
  const spinnerElem = document.getElementById(spinner);
  const elemElem = document.getElementById(elem);

  spinnerElem.style.display = "none";
  elemElem.style.display = "block";
}

// Function to replace the text in loading message
export async function updateLoadingMessage(elem, message) {
  const loadingMessage = document.getElementById(elem);
  loadingMessage.innerHTML = message;
}

// Function to populate dropdowns with provided data
function populateDropdown(listbox, data, sortAttribute = "name") {
  return new Promise((resolve, reject) => {
    try {
      if (data.length === 0) {
        listbox.innerHTML = '<gux-option value="">No data found</gux-option>';
        resolve();
        return;
      }

      if (typeof data[0] === "object") {
        // sort data by sortAttribute (not case sensitive)
        data.sort((a, b) =>
          a[sortAttribute].localeCompare(b[sortAttribute], undefined, {
            sensitivity: "base",
          })
        );
        listbox.innerHTML = "";
        data.forEach((item) => {
          const option = document.createElement("gux-option");
          option.value = item.id;
          option.dataset.name = item.name;
          option.innerHTML = item.name;
          listbox.appendChild(option);
        });
      } else if (typeof data[0] === "string") {
        // sort data
        data.sort();
        listbox.innerHTML = "";
        data.forEach((item) => {
          const option = document.createElement("gux-option");
          option.value = item;
          option.innerHTML = item;
          listbox.appendChild(option);
        });
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
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

// function to get value of a radio buttons
export function getRadioValue(ele) {
  for (let i = 0; i < ele.length; i++) {
    if (ele[i].checked) {
      return ele[i].value;
    }
  }
}

// Function to download JSON data
export function downloadJson(body, jsonName) {
  var jsonData = JSON.stringify(body);
  var blob = new Blob([jsonData], {
    type: "application/json",
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.download = `${jsonName}.json`;
  a.href = url;
  a.textContent = `Download ${jsonName}.json`;

  // Create a div for each download link
  var div = document.createElement("div");
  div.appendChild(a);

  var container = document.getElementById("test-mode");
  container.appendChild(div);
}

// Function to download gzip data
export function downloadGzip(gzip) {
  console.log("[OFG] Downloading gzip file");
  var blob = new Blob([gzip], {
    type: "application/gzip",
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.download = "forecast-import.json.gz";
  a.href = url;
  a.textContent = "Download forecast-import.json.gz";

  // Create a div for each download link
  var div = document.createElement("div");

  div.appendChild(a);

  var container = document.getElementById("test-mode");
  container.appendChild(div);
  container.style.display = "block";
}

// Function to load selected Business Unit data
export async function getBusinessUnit() {
  let businessUnitData;
  if (window.isTesting) {
    // Testing mode - Get Business Unit data from mock PlatformClient
    businessUnitData = await PlatformClient.MockWfmApi.getBusinessUnitData();
    console.log(
      "[OFG] Business Unit data loaded from test data",
      businessUnitData
    );
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

// Function to load page one
export async function loadPageOne() {
  if (window.isTesting) {
    // Testing mode - Get Business Units from mock PlatformClient
    businessUnits = await PlatformClient.MockWfmApi.getBusinessUnits();
    console.log("[OFG] Business Units loaded from test data", businessUnits);
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

  // Remove existing planning group gux-option elements from page three
  planningGroupsListbox.innerHTML = "";

  // Hide inbound-forecast-mode div
  document.getElementById("inbound-forecast-mode").style.display = "none";

  // Populate Business Unit dropdown
  await populateDropdown(businessUnitListbox, businessUnits);

  // Hide loading spinner and show main
  await hideLoadingSpinner("main", "main-loading-section");
}

// Function to load page two
export async function loadPageTwo() {
  // Variables
  const selectedBuId = businessUnitListbox.value;

  // Remove existing planning group gux-option elements from page three
  while (planningGroupsListbox.firstChild) {
    planningGroupsListbox.removeChild(planningGroupsListbox.firstChild);
  }

  // Function to get planning groups from BU id
  async function getPlanningGroups() {
    console.log(`[OFG] Get Planning Groups initiated`);
    let planningGroups;
    let planningGroupsArray = [];

    try {
      if (window.isTesting) {
        // Testing mode - Get Planning Groups from mock PlatformClient
        planningGroups = await PlatformClient.MockWfmApi.getPlanningGroups();
        console.log(
          "[OFG] Planning Groups loaded from test data",
          planningGroups
        );
      } else {
        // Production mode
        planningGroups = await handleApiCalls(
          "WorkforceManagementApi.getWorkforcemanagementBusinessunitPlanninggroups",
          selectedBuId
        );
        console.log(
          `[OFG] ${planningGroups.length} Planning Groups loaded`,
          planningGroups
        );
      }
    } catch (error) {
      console.error("[OFG] Error loading planning groups", error);
    }

    if (!planningGroups || planningGroups.length === 0) {
      // Special handling when 0 planning groups are loaded
      console.log("[OFG] No planning groups found");
      return;
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

      // add planning group name & id to planningGroupsSummary array
      planningGroupsSummary.push({
        "name": groupName,
        "id": groupId,
      });
    }

    return planningGroupsArray;
  }

  // Function to get outbound campaigns
  async function getCampaigns() {
    let campaigns;
    let campaignsArray = [];
    console.log(`[OFG] Get Campaigns initiated`);

    if (window.isTesting) {
      // Testing mode - Get Campaigns from mock PlatformClient
      campaigns = await PlatformClient.MockOutboundApi.getOutboundCampaigns();
      console.log("[OFG] Campaigns loaded from test data", campaigns);
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
      try {
        const campaign = campaigns[i];
        console.log(
          `[OFG] Processing campaign ${i + 1}: ${campaign.name} (${
            campaign.id
          })`
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
      } catch (error) {
        console.warn(`[OFG] Error processing campaign ${i + 1}`, error);
      }
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

    // Flag to track if inbound forecast mode div has been unhidden
    let isUnhidden = false;

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

        // Unhide inbound-forecast-mode div if it hasn't been unhidden yet
        if (!isUnhidden) {
          document.getElementById("inbound-forecast-mode").style.display =
            "block";
          isUnhidden = true;
        }
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

        // Unhide inbound-forecast-mode div
        document.getElementById("inbound-forecast-mode").style.display =
          "block";
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

// Function to load page three
export async function loadPageThree() {
  // Hide page 2 and show page 3
  console.log("[OFG] Loading page 3 initiated");

  // Remove existing planning group gux-option elements from page three
  while (planningGroupsListbox.firstChild) {
    planningGroupsListbox.removeChild(planningGroupsListbox.firstChild);
  }

  // Populate Planning Groups dropdown
  populateDropdown(planningGroupsListbox, planningGroupsSummary);

  // Remove any dropdown options not in forecast data
  validatePlanningGroupDropdown();

  // Hide loading spinner and show page three
  await hideLoadingSpinner(
    "forecast-outputs-container",
    "generate-loading-div"
  );

  switchPages("page-two", "page-three");
}

// Function to load page four
export async function loadPageFour() {
  // Hide page 3 and show page 4
  switchPages("page-three", "page-four");
}
