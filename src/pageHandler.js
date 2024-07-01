import { handleApiCalls, globalPageOpts } from "./apiHandler.js";
import { sharedState, generateForecast, importForecast } from "./main.js";
import { initializeModificationHandler } from "./modificationHandler.js";
import { PlanningGroup } from "./classHandler.js";
import { handleError } from "./errorHandler.js";

// Global variables
const testMode = window.ofg.isTesting;
let businessUnits = [];

const businessUnitListbox = document.getElementById("business-unit-listbox");
const planningGroupsListbox = document.getElementById("planning-group-listbox");

const daysOfWeek = [
  { id: "99", name: "All" },
  { id: "1", name: "Monday" },
  { id: "2", name: "Tuesday" },
  { id: "3", name: "Wednesday" },
  { id: "4", name: "Thursday" },
  { id: "5", name: "Friday" },
  { id: "6", name: "Saturday" },
  { id: "0", name: "Sunday" },
];

/* PAGE HELPER FUNCTIONS START */
// function to get value of a radio buttons
export function getRadioValue(ele) {
  for (let i = 0; i < ele.length; i++) {
    if (ele[i].checked) {
      return ele[i].value;
    }
  }
}

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
function populateDropdown(
  listbox,
  data,
  sortAttribute = "name",
  applySort = true
) {
  // Remove existing listbox items
  while (listbox.firstChild) {
    listbox.removeChild(listbox.firstChild);
  }

  return new Promise((resolve, reject) => {
    try {
      if (data.length === 0) {
        listbox.innerHTML = '<gux-option value="">No data found</gux-option>';
        resolve();
        return;
      }

      // Check if sorting should be applied
      if (applySort) {
        if (typeof data[0] === "object" && sortAttribute) {
          // sort data by sortAttribute (not case sensitive)
          data.sort((a, b) =>
            a[sortAttribute].localeCompare(b[sortAttribute], undefined, {
              sensitivity: "base",
            })
          );
        } else if (typeof data[0] === "string") {
          // sort data
          data.sort();
        }
      }

      listbox.innerHTML = "";
      data.forEach((item) => {
        const option = document.createElement("gux-option");
        option.value = item.id || item;
        option.dataset.name = item.name || item;
        option.dataset.id = item.id || item;
        option.innerHTML = item.name || item;
        listbox.appendChild(option);
      });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

// Function to handle page transitions
async function switchPages(hidePageId, showPageId) {
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

// Function to validate planning group dropdown entries
async function validatePlanningGroupDropdown() {
  console.log("[OFG] Validating Planning Group dropdown entries");
  const planningGroupsDropdown = document.getElementById(
    "planning-group-dropdown"
  );

  // Get list of planning groups in listbox
  const planningGroups = planningGroupsListbox.querySelectorAll("gux-option");

  // Convert planningGroups to an array and iterate over it
  Array.from(planningGroups).forEach((option) => {
    const optionId = option.value;

    // Find the planning group in sharedState.generatedForecast
    const completedFcPg = sharedState.generatedForecast.find(
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

// Function to get the number of contacts for each planning group
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

// Function to get forecast parameters
function getForecastParameters() {
  return {
    weekStart: document.getElementById("week-start").value,
    historicalWeeks: document.getElementById("historical-weeks").value,
    description: document.getElementById("fc-description").value,
  };
}

// Function to get options
function getOptions() {
  return {
    ignoreZeroes: document.getElementById("ignore-zeroes").checked,
    //resolveContactsAhtMode: document.getElementById("resolve-contacts-aht").checked,
    generateInbound: document.getElementById("generate-inbound-fc").checked,
    retainInbound: document.getElementById("retain-inbound-fc").checked,
  };
}
/* PAGE HELPER FUNCTIONS END */

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

/* PAGE LOAD FUNCTIONS START */
// Function to load page one
export async function loadPageOne() {
  console.log("[OFG] Loading page one");
  console.debug("[OFG] sharedState", JSON.parse(JSON.stringify(sharedState)));

  // Function to load selected Business Unit data
  async function getBusinessUnit(selectedBuId) {
    let businessUnitData;
    if (testMode) {
      // Testing mode - Get Business Unit data from mock PlatformClient
      businessUnitData =
        await window.ofg.PlatformClient.MockWfmApi.getBusinessUnitData();
      console.log(
        "[OFG] Business Unit data loaded from test data",
        JSON.parse(JSON.stringify(businessUnitData))
      );
    } else {
      // Production mode
      try {
        businessUnitData = await handleApiCalls(
          "WorkforceManagementApi.getWorkforcemanagementBusinessunit",
          selectedBuId, // Pass selected Business Unit ID
          {
            "expand": ["settings.timeZone, settings.startDayOfWeek"], // [String] | Include to access additional data on the business unit
          }
        );
        console.log(`[OFG] Business Unit '${businessUnitData.name}' loaded`);
      } catch (error) {
        handleError(error, "getBusinessUnit");
        throw error;
      }
    }

    // Convert the daysOfWeek array to a dayNameToNumber map
    const dayNameToNumber = daysOfWeek.reduce((acc, day) => {
      // Exclude the "All" option
      if (day.name !== "All") {
        acc[day.name] = parseInt(day.id);
      }
      return acc;
    }, {});

    const businessUnitStartDayOfWeek = businessUnitData.settings.startDayOfWeek;
    const businessUnitTimeZone = businessUnitData.settings.timeZone;

    // Populate Business Unit time zone to page
    document.getElementById("bu-timezone").value = businessUnitTimeZone;

    // Update the week-start element to next occurance of the start day of week e.g. "Monday"
    // TODO: Still some cases where incorrect week start is calculated
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
      handleError(error, "getBusinessUnits");
      throw error;
    }
  }

  // Populate Business Unit dropdown
  await populateDropdown(businessUnitListbox, businessUnits, "name", true);

  // Hide loading spinner and show main
  await hideLoadingSpinner("main", "main-loading-section");

  // Initialize event listeners
  if (!window.ofg.pageOneEventListenersAdded) {
    // Add event listener to Business Unit dropdown
    businessUnitListbox.addEventListener("change", async () => {
      const selectedBuId = businessUnitListbox.value;
      console.log(`[OFG] Business Unit dropdown changed to ${selectedBuId}`);
      await getBusinessUnit(selectedBuId);
    });

    // Add event listener to next button
    const nextButton = document.getElementById("p1-next-button");
    nextButton.addEventListener("click", async () => {
      await loadPageTwo();
      await switchPages("page-one", "page-two");
    });

    // Set the flag to true to indicate that event listeners have been added
    window.ofg.pageOneEventListenersAdded = true;
  }
}

// Function to load page two
export async function loadPageTwo() {
  console.log("[OFG] Loading page two");
  console.debug("[OFG] sharedState", JSON.parse(JSON.stringify(sharedState)));

  // Clean up previous selections
  document.querySelector("#planning-groups-table tbody").innerHTML = "";
  sharedState.userInputs.planningGroups = [];

  // Define variables
  const selectedBu = sharedState.userInputs.businessUnit;
  const selectedBuId = selectedBu.id;
  const sharedStatePlanningGroups = sharedState.userInputs.planningGroups;

  // Define document elements
  const loadingSpinner = document.getElementById("planning-groups-loading");
  const planningGroupsDiv = document.getElementById(
    "planning-groups-container"
  );
  const tableBody = document.querySelector("#planning-groups-table tbody");

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
      handleError(error, "getPlanningGroups");
      throw error;
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
        handleError(error, "getCampaigns");
        throw error;
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

    // Array to hold groups
    const matchedGroups = [];
    const unmatchedGroups = [];

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

    // Function to create Planning Group objects
    function createPlanningGroup(
      groupId,
      groupName,
      campaignId = null,
      campaignName = null,
      queueId = null,
      queueName = null
    ) {
      const planningGroup = new PlanningGroup(
        groupId,
        groupName,
        campaignId,
        campaignName,
        queueId,
        queueName
      );
      // Add planning group to sharedStatePlanningGroups
      sharedStatePlanningGroups.push(planningGroup);

      // Log to console
      console.debug(
        `[OFG] [${groupName}] pgId: ${groupId}, cpId: ${campaignId}, queueId: ${queueId}`
      );

      // Return the planning group
      return planningGroup;
    }

    // Function to match planning groups with campaigns
    function matchPlanningGroupsWithCampaigns(group) {
      const groupQueueId = group.groupQueueId;
      const groupId = group.groupId;
      const groupName = group.groupName;

      const matchingCampaign = campaigns.find(
        (campaign) => campaign.campaignQueueId === groupQueueId
      );

      // If a matching campaign is found, set the variables
      if (matchingCampaign) {
        const planningGroup = createPlanningGroup(
          groupId,
          groupName,
          matchingCampaign.campaignId,
          matchingCampaign.campaignName,
          matchingCampaign.campaignQueueId,
          matchingCampaign.campaignQueueName
        );
        matchedGroups.push(planningGroup);
      } else {
        const planningGroup = createPlanningGroup(groupId, groupName);
        unmatchedGroups.push(planningGroup);
      }
    }

    // Function to append rows to the table body
    function appendRowsToTable(groups, isMatched) {
      groups.forEach((group) => {
        const row = document.createElement("tr");

        // Planning Group column: Display planningGroup.name and optionally campaign.name
        const planningGroupCell = createCell(
          group.planningGroup.name,
          "pgId",
          group.planningGroup.id
        );
        if (isMatched) {
          const campaignNameSpan = document.createElement("span");
          campaignNameSpan.textContent = ` [${group.campaign.name}]`;
          campaignNameSpan.className = "italic-gray";
          planningGroupCell.appendChild(document.createElement("br"));
          planningGroupCell.appendChild(campaignNameSpan);
        } else {
          planningGroupCell.classList.add("grey-italic");
        }
        row.appendChild(planningGroupCell);

        // # Contacts column: Use createNumberInput function, disable if not matched
        const contactsCell = document.createElement("td");
        const numberInput = createNumberInput(
          group.groupId,
          group.groupName,
          isMatched
        );
        contactsCell.appendChild(numberInput);
        row.appendChild(contactsCell);

        // Append the row to the table body
        tableBody.appendChild(row);
      });
    }

    // Loop through planning groups to match with campaigns
    for (const [i, group] of planningGroups.entries()) {
      // Match planning groups with campaigns
      matchPlanningGroupsWithCampaigns(group);
    }

    // Enable inbound forecast mode if any campaigns are not matched
    if (unmatchedGroups.length > 0) {
      document.getElementById("inbound-forecast-div").style.display = "block";
      window.ofg.isInboundForecastMode = true;
    }

    // Sort the rows alphabetically by groupName
    const sortAlphabetically = (a, b) =>
      a.planningGroup.name.localeCompare(b.planningGroup.name);
    matchedGroups.sort(sortAlphabetically);
    unmatchedGroups.sort(sortAlphabetically);

    // Call appendRowsToTable for matched and unmatched groups
    appendRowsToTable(matchedGroups, true);
    appendRowsToTable(unmatchedGroups, false);

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

  if (!window.ofg.pageTwoEventListenersAdded) {
    // Add event listener to back button
    const backButton = document.getElementById("p2-back-button");
    backButton.addEventListener("click", async () => {
      // Hide planning groups and show loading spinner
      planningGroupsDiv.style.display = "none";
      loadingSpinner.style.display = "block";

      await loadPageOne("true");
      await switchPages("page-two", "page-one");
    });

    // Event listener for generate button
    const generateButton = document.getElementById("generate-button");
    if (generateButton) {
      generateButton.addEventListener("click", async () => {
        const totalContacts = await getPlanningGroupContacts();

        if (totalContacts === 0) {
          alert(
            "Please enter the number of contacts for at least one campaign"
          );
          return;
        }

        // Assign sharedState.userInputs properties
        Object.assign(
          sharedState.userInputs.forecastParameters,
          getForecastParameters()
        );
        Object.assign(sharedState.userInputs.forecastOptions, getOptions());

        await switchPages("page-two", "page-three");
        initializeModificationHandler();
        generateForecast();
      });
    } else {
      console.error("[OFG] Generate button not found");
    }

    // Set the flag to true to indicate that event listeners have been added
    window.ofg.pageTwoEventListenersAdded = true;
  }
}

// Function to load page three
export async function loadPageThree() {
  console.log("[OFG] Loading page three");
  console.debug("[OFG] sharedState", JSON.parse(JSON.stringify(sharedState)));
  const weekDayListbox = document.getElementById("week-day-listbox");

  // Initialize the modifiedForecast
  sharedState.modifiedForecast = JSON.parse(
    JSON.stringify(sharedState.generatedForecast)
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

  // Populate page three listboxes
  populateDropdown(planningGroupsListbox, planningGroupsSummary, "name", true);
  populateDropdown(weekDayListbox, daysOfWeek, "name", false);

  // Remove any dropdown options not in forecast data
  await validatePlanningGroupDropdown();

  // Hide loading spinner and show page three
  await hideLoadingSpinner(
    "forecast-outputs-container",
    "generate-loading-div"
  );

  if (!window.ofg.pageThreeEventListenersAdded) {
    // Event listener for back button
    const backButton = document.getElementById("p3-back-button");
    backButton.addEventListener("click", async () => {
      // Reset forecast
      sharedState.generatedForecast = null;
      sharedState.modifiedForecast = null;

      loadPageTwo();
      await switchPages("page-three", "page-two");
    });

    // Event listener for import button
    const importButton = document.getElementById("import-button");
    if (importButton) {
      importButton.addEventListener("click", async () => {
        await importForecast();
      });
    } else {
      console.error("[OFG] Import button not found");
    }

    // Set the flag to true to indicate that event listeners have been added
    window.ofg.pageThreeEventListenersAdded = true;
  }
}

// Function to load page four
export async function loadPageFour() {
  console.log("[OFG] Loading page 4 initiated");

  // Hide page 3 and show page 4
  await switchPages("page-three", "page-four");
}
/* PAGE LOAD FUNCTIONS END */

export function populateMessage(className, innerHTML, reason) {
  // Hide loading spinner div
  hideLoadingSpinner("import-results-container", "import-loading-div");

  const resultsContainer = document.getElementById("import-results-container");

  let message = document.createElement("div");
  message.className = className;
  message.innerHTML = innerHTML;
  resultsContainer.appendChild(message);

  if (reason) {
    const errorReason = document.createElement("div");
    errorReason.innerHTML = reason;
    resultsContainer.appendChild(errorReason);
  }

  // TODO: Find a way to allow user to navigate main GC browser window to new forecast

  // Create a button to restart the process
  const restartButton = document.createElement("gux-button");
  restartButton.id = "restart-button";
  restartButton.setAttribute("accent", "secondary");
  restartButton.className = "align-left";
  restartButton.textContent = "Restart";

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

  if (!window.ofg.pageFourEventListenersAdded) {
    // Add event listener to restart button
    restartButton.addEventListener("click", (event) => {
      loadPageOne();
      switchPages("page-four", "page-one");
    });
    window.ofg.pageFourEventListenersAdded = true;
  }
}
