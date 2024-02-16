async function loadPageTwo(businessUnitId) {
  // Function to get planning groups from BU id
  async function getPlanningGroups() {
    let planningGroupsArray = [];
    console.log(`OFG: Get Planning Groups initiated`);

    // Get planning groups
    planningGroups = await fetchDataWithRetry(
      `/api/v2/workforcemanagement/businessunits/${businessUnitId}/planninggroups`,
      "GET"
    );
    console.log(`OFG: Found ${planningGroups.length} planning groups`);

    // loop through planning groups to build array of planning group objects
    for (let i = 0; i < planningGroups.length; i++) {
      const group = planningGroups[i];
      console.log(
        `OFG: Processing planning group ${i + 1}: ${group.name} (${group.id})`
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
      console.debug(`OFG: PG[${i + 1}] = ` + JSON.stringify(pgObj));
    }

    return planningGroupsArray;
  }

  // Function to get outbound campaigns
  async function getCampaigns() {
    let campaignsArray = [];
    console.log(`OFG: Get Campaigns initiated`);
    campaigns = await fetchDataWithRetry(`/api/v2/outbound/campaigns`, "GET");

    console.log(`OFG: Found ${campaigns.length} campaigns`);

    // loop through campaigns to build array of campaign objects
    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      console.log(
        `OFG: Processing campaign ${i + 1}: ${campaign.name} (${campaign.id})`
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
      console.debug(`OFG: Campaign[${i + 1}] = ` + JSON.stringify(campaignObj));
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

    console.log(`OFG: Matching queues & campaigns`);

    for (let i = 0; i < planningGroups.length; i++) {
      // loop through planning groups to link to campaigns and populate table
      const group = planningGroups[i];
      const groupQueueId = group.pgQueueId;
      const groupId = group.pgId;
      const groupName = group.pgName;

      console.log(
        `OFG: PG${
          n + 1
        }[${pgId}] Matching ${groupName} to campaigns with queue id ${groupQueueId}`
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

      // TODO: need to make updates to disable input if no matching campaign found
      // populate campaign name cell
      const campaignNameCell = document.createElement("td");
      if (matchingCampaign) {
        // populate campaign name if matching campaign found
        console.log(
          `OFG: PG${n + 1}[${pgId}] Matched ${groupName} to ${
            matchingCampaign.campaignName
          } (${matchingCampaign.campaignId})`
        );
        campaignNameCell.textContent = matchingCampaign.campaignName;
        campaignNameCell.dataset.campaignId = matchingCampaign.campaignId; // Add the campaign id as a data attribute
      } else {
        // populate empty cell if no matching campaign found
        console.warn(
          `OFG: PG${n + 1}[${pgId}] No matching campaign found for ${groupName}`
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
