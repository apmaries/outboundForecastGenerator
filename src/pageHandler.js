import { handleApiCalls, globalPageOpts } from "./apiHandler.js";
import { sharedState } from "./main.js";
import { PlanningGroup } from "./classHandler.js";

// Global variables
const testMode = window.ofg.isTesting;
let businessUnits = [];
const businessUnitListbox = document.getElementById("business-unit-listbox");
const planningGroupsDropdown = document.getElementById(
  "planning-group-dropdown"
);
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
export async function switchPages(hidePageId, showPageId) {
  const hidePage = document.getElementById(hidePageId);
  const showPage = document.getElementById(showPageId);

  if (hidePage) {
    hidePage.classList.add("inactive-page");
    hidePage.classList.remove("active-page");
  }

  if (showPage) {
    showPage.classList.remove("inactive-page");
    showPage.classList.add("active-page");
  }
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
  if (testMode) {
    // Testing mode - Get Business Unit data from mock PlatformClient
    businessUnitData =
      await window.ofg.PlatformClient.MockWfmApi.getBusinessUnitData();
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

  // Get the current date and time in the user's time zone
  const nowLocal = new Date();

  // Calculate the next start date in the user's time zone
  const daysUntilStart =
    (dayNameToNumber[businessUnitStartDayOfWeek] - nowLocal.getDay() + 7) % 7;
  const nextStartLocal = new Date(nowLocal);
  nextStartLocal.setDate(nowLocal.getDate() + daysUntilStart);

  // Convert the next start date to the business unit's time zone
  const nextStartTz = new Date(
    nextStartLocal.toLocaleString("en-US", { timeZone: businessUnitTimeZone })
  );

  // Set the value of the week-start element
  weekStart.value = nextStartTz.toISOString().slice(0, 10);

  // Re-enable the week start element
  weekStart.disabled = false;

  // Assign Business Unit values to sharedState
  Object.assign(sharedState.userInputs.businessUnit, businessUnitData);

  return businessUnitData;
}

// Function to load page one
export async function loadPageOne() {
  if (testMode) {
    // Testing mode - Get Business Units from mock PlatformClient
    businessUnits =
      await window.ofg.PlatformClient.MockWfmApi.getBusinessUnits();
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

  // Hide inbound-forecast-div
  document.getElementById("inbound-forecast-div").style.display = "none";

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
      if (testMode) {
        // Testing mode - Get Planning Groups from mock PlatformClient
        planningGroups =
          await window.ofg.PlatformClient.MockWfmApi.getPlanningGroups();
      } else {
        // Production mode
        planningGroups = await handleApiCalls(
          "WorkforceManagementApi.getWorkforcemanagementBusinessunitPlanninggroups",
          selectedBuId
        );
      }
    } catch (error) {
      console.error("[OFG] Error loading planning groups", error);
    }

    if (!planningGroups || planningGroups.length === 0) {
      // Special handling when 0 planning groups are loaded
      console.log("[OFG] No planning groups found");
      return;
    } else {
      console.log(`[OFG] ${planningGroups.length} Planning Groups loaded`);
    }

    // Loop through planning groups to build array of planning group objects
    for (let i = 0; i < planningGroups.length; i++) {
      const group = planningGroups[i];

      // Get planning group data
      const groupId = group.id;
      const groupName = group.name;
      const groupRpQueue = group.routePaths[0].queue;
      const groupQueueId = groupRpQueue.id;

      // Create a new planning group object
      let pgObj = {
        "groupId": groupId,
        "groupName": groupName,
        "groupQueueId": groupQueueId,
      };

      // Add planning group object to array
      planningGroupsArray.push(pgObj);
    }

    // Return the array of planning group objects
    console.debug("[OFG] Planning Groups: ", planningGroupsArray);
    return planningGroupsArray;
  }

  // Function to get outbound campaigns
  async function getCampaigns() {
    let campaigns;
    let campaignsArray = [];
    console.log(`[OFG] Get Campaigns initiated`);

    if (testMode) {
      // Testing mode - Get Campaigns from mock PlatformClient
      campaigns =
        await window.ofg.PlatformClient.MockOutboundApi.getOutboundCampaigns();
    } else {
      // Production mode
      try {
        campaigns = await handleApiCalls(
          "OutboundApi.getOutboundCampaigns",
          globalPageOpts
        );
      } catch (error) {
        console.error("[OFG] Error loading campaigns", error);
      }
    }

    if (!campaigns || campaigns.length === 0) {
      // Special handling when 0 planning groups are loaded
      console.log("[OFG] No Campaigns found");
      return;
    } else {
      console.log(`[OFG] ${campaigns.length} Campaigns loaded`);
    }

    // Loop through campaigns to build array of campaign objects
    for (let i = 0; i < campaigns.length; i++) {
      try {
        const campaign = campaigns[i];

        // Get campaign data
        const campaignId = campaign.id;
        const campaignName = campaign.name;
        const campaignQueueId = campaign.queue.id;
        const campaignQueueName = campaign.queue.name;

        // Create a new campaign object
        let campaignObj = {
          "campaignId": campaignId,
          "campaignName": campaignName,
          "campaignQueueId": campaignQueueId,
          "campaignQueueName": campaignQueueName,
        };

        // Add campaign object to array
        campaignsArray.push(campaignObj);
      } catch (error) {
        console.warn(`[OFG] Error processing campaign ${i + 1}`, error);
      }
    }

    // Return the array of campaign objects
    console.debug("[OFG] Campaigns: ", campaignsArray);
    return campaignsArray;
  }

  // Function to match queues and campaigns
  async function queueCampaignMatcher(planningGroups, campaigns) {
    console.log(`[OFG] Matching queues & campaigns`);

    // Function to create a table cell
    function createCell(textContent, dataId, dataValue) {
      const cell = document.createElement("td");
      cell.textContent = textContent;
      if (dataId) {
        cell.dataset[dataId] = dataValue;
      }
      return cell;
    }

    // Function to create a number input
    function createNumberInput(groupId, groupName, matchingCampaign) {
      const guxFormFieldNumber = document.createElement(
        "gux-form-field-number"
      );
      guxFormFieldNumber.setAttribute("label-position", "screenreader");

      const input = document.createElement("input");
      input.slot = "input";
      input.type = "number";
      input.id = "nContacts_" + groupId;
      input.min = "0";
      input.max = "100000";
      input.value = "0";
      input.step = "500";

      const label = document.createElement("label");
      label.slot = "label";
      label.textContent = groupName + " number of contacts";

      if (!matchingCampaign) {
        input.disabled = true;
      }

      guxFormFieldNumber.appendChild(input);
      guxFormFieldNumber.appendChild(label);

      return guxFormFieldNumber;
    }

    // Define variables
    let sharedStatePlanningGroups = sharedState.userInputs.planningGroups;
    window.ofg.isInboundForecastMode = false;

    // Define document elements
    const loadingSpinner = document.getElementById("planning-groups-loading");
    const planningGroupsDiv = document.getElementById(
      "planning-groups-container"
    );
    const tableBody = document.querySelector("#planning-groups-table tbody");

    // Clear out any existing rows
    tableBody.innerHTML = "";

    for (const [i, group] of planningGroups.entries()) {
      const groupQueueId = group.groupQueueId;
      const groupId = group.groupId;
      const groupName = group.groupName;

      const matchingCampaign = campaigns.find(
        (campaign) => campaign.campaignQueueId === groupQueueId
      );

      // Initialize variables
      let campaignId = null;
      let campaignName = null;
      let queueId = null;
      let queueName = null;

      // If a matching campaign is found, set the variables
      if (matchingCampaign) {
        campaignId = matchingCampaign.campaignId;
        campaignName = matchingCampaign.campaignName;
        queueId = matchingCampaign.campaignQueueId;
        queueName = matchingCampaign.campaignQueueName;
      }

      // Add planning group to sharedStatePlanningGroups
      const planningGroup = new PlanningGroup(
        groupId,
        groupName,
        campaignId,
        campaignName,
        queueId,
        queueName
      );
      sharedStatePlanningGroups.push(planningGroup);

      // Log to console
      console.debug(
        `[OFG] [${groupName}] pgId: ${groupId}, cpId: ${campaignId}, queueId: ${queueId}`
      );

      // Add planning group to table
      const row = document.createElement("tr");
      row.appendChild(createCell(groupName, "pgId", groupId));

      if (matchingCampaign) {
        row.appendChild(
          createCell(
            matchingCampaign.campaignName,
            "campaignId",
            matchingCampaign.campaignId
          )
        );
      } else {
        row.appendChild(createCell("", "matchedCampaign", "false"));
        row.style.fontStyle = "italic";
        row.style.color = "grey";
        document.getElementById("inbound-forecast-div").style.display = "block";
        window.ofg.isInboundForecastMode = true;
      }

      // Add number input to table
      const nContactsCell = document.createElement("td");
      nContactsCell.appendChild(
        createNumberInput(groupId, groupName, matchingCampaign)
      );
      row.appendChild(nContactsCell);

      tableBody.appendChild(row);
    }

    // Hide loading spinner and show planning groups
    loadingSpinner.style.display = "none";
    planningGroupsDiv.style.display = "block";

    // Add event listener to "generate-inbound-fc" checkbox
    if (window.ofg.isInboundForecastMode) {
      const inboundForecastToggle = document.getElementById(
        "generate-inbound-fc"
      );

      inboundForecastToggle.addEventListener("click", function () {
        const retainInboundToggle =
          document.getElementById("retain-inbound-fc");
        if (inboundForecastToggle.checked) {
          retainInboundToggle.disabled = false;
        } else {
          retainInboundToggle.disabled = true;
          retainInboundToggle.checked = false;
        }
      });
    }

    console.log(
      "[OFG] Campaigns matched to Planning Groups: ",
      sharedStatePlanningGroups
    );
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
  console.log("[OFG] Loading page 3 initiated");

  // Initialize the modifiedForecast
  sharedState.modifiedForecast = JSON.parse(
    JSON.stringify(sharedState.completedForecast)
  );

  // Remove existing planning group gux-option elements from page three
  while (planningGroupsListbox.firstChild) {
    planningGroupsListbox.removeChild(planningGroupsListbox.firstChild);
  }

  // Get the planning groups from sharedState
  const planningGroupsSummary = sharedState.modifiedForecast.map((pg) => {
    return {
      id: pg.planningGroup.id,
      name: pg.planningGroup.name,
    };
  });

  // Populate Planning Groups dropdown
  populateDropdown(planningGroupsListbox, planningGroupsSummary);

  // Remove any dropdown options not in forecast data
  await validatePlanningGroupDropdown();

  // Hide loading spinner and show page three
  await hideLoadingSpinner(
    "forecast-outputs-container",
    "generate-loading-div"
  );
}

// Function to load page four
export async function loadPageFour() {
  console.log("[OFG] Loading page 4 initiated");

  // Hide page 3 and show page 4
  await switchPages("page-three", "page-four");
}

// Function to validate planning group dropdown entries
async function validatePlanningGroupDropdown() {
  console.log("[OFG] Validating Planning Group dropdown entries");

  // Get list of planning groups in listbox
  const planningGroups = planningGroupsListbox.querySelectorAll("gux-option");

  // Convert planningGroups to an array and iterate over it
  Array.from(planningGroups).forEach((option) => {
    const optionId = option.value;

    // Find the planning group in sharedState.completedForecast
    const completedFcPg = sharedState.completedForecast.find(
      (pgForecast) => pgForecast.planningGroup.id === optionId
    );
    const pgName = completedFcPg.planningGroup.name;

    if (completedFcPg.metadata.forecastStatus.isForecast === false) {
      const reason = completedFcPg.metadata.forecastStatus.reason;
      console.warn(
        `[OFG] [${pgName}] Disabling dropdown option with reason: `,
        reason
      );

      // Set the option to disabled
      option.setAttribute("disabled", "true");

      // Update the option text
      let optionText = option.textContent;
      option.textContent = `${optionText} - ${reason}`;
    } else {
      option.removeAttribute("disabled");
    }
  });
  planningGroupsDropdown.removeAttribute("disabled");
}
