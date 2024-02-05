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

    // initate object to store planning group data
    let pgObj = { "pgId": "", "pgName": "", "pgQueueId": "" };

    // loop through planning groups to build array of planning group objects
    for (let i = 0; i < planningGroups.length; i++) {
      const group = planningGroups[i];
      console.log(`OFG: Found planning group ${i + 1}: ${group.name}`);

      // get planning group data
      const groupId = group.id;
      const groupName = group.name;
      const groupRpQueue = group.routePaths[0].queue;
      const groupQueueId = groupRpQueue.id;

      // populate planning group object
      pgObj.pgId = groupId;
      pgObj.pgName = groupName;
      pgObj.pgQueueId = groupQueueId;

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

    // initiate object to store campaign data
    let campaignObj = {
      "campaignId": "",
      "campaignName": "",
      "campaignQueueId": "",
      "campaignQueueName": "",
    };

    // loop through campaigns to build array of campaign objects
    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      console.log(`OFG: Found campaign ${i + 1}: ${campaign.name}`);

      // get campaign data
      const campaignId = campaign.id;
      const campaignName = campaign.name;
      const campaignQueueId = campaign.queue.id;
      const campaignQueueName = campaign.queue.name;

      // populate campaign object
      campaignObj.campaignId = campaignId;
      campaignObj.campaignName = campaignName;
      campaignObj.campaignQueueId = campaignQueueId;
      campaignObj.campaignQueueName = campaignQueueName;

      // add campaign object to array
      campaignsArray.push(campaignObj);
      console.debug(`OFG: Campaign[${i + 1}] = ` + JSON.stringify(campaignObj));
    }

    // temporary logging
    console.log(`OFG: Campaigns: ${campaignsArray}`);

    return campaignsArray;
  }

  // Function to get queue campaigns
  async function queueCampaignMatcher(planningGroups, campaigns) {
    // define table body
    const tableBody = document.querySelector("#planning-groups-table tbody");

    // Clear out any existing rows
    tableBody.innerHTML = "";

    console.log(`OFG: Matching queues & campaigns`);

    for (let i = 0; i < planningGroups.length; i++) {
      // loop through planning groups to link to campaigns and populate table
      const group = planningGroups[i];
      const groupQueueId = group.pgQueueId;

      console.log(`OFG: Processing planning group ${i + 1}: ${group.pgName}`);

      // temporary logging
      console.log(`OFG: Campaigns: ${campaigns}`);

      // find matching campaign
      const matchingCampaign = campaigns.find(
        (campaign) => campaign.campaignQueueId === groupQueueId
      );
      console.log(`OFG: Matching campaign: ${matchingCampaign}`);

      // create table row
      const row = document.createElement("tr");

      // populate pg name cell
      const pgNameCell = document.createElement("td");
      pgNameCell.textContent = group.pgName;
      pgNameCell.dataset.pgId = group.pgId; // Add the planning group id as a data attribute
      row.appendChild(pgNameCell);

      // populate campaign name cell
      const campaignNameCell = document.createElement("td");
      if (matchingCampaign) {
        // populate campaign name if matching campaign found
        console.log(`OFG: Matching campaign found: ${matchingCampaign.name}`);
        campaignNameCell.textContent = matchingCampaign.name;
      } else {
        // populate empty cell if no matching campaign found
        console.log(`OFG: No matching campaign found`);
        campaignNameCell.textContent = "";
      }
      row.appendChild(campaignNameCell);

      // populate nContacts cell
      const nContactsCell = document.createElement("td");
      nContactsCell.textContent = "1000";
      row.appendChild(nContactsCell);

      tableBody.appendChild(row);
    }
  }

  // Use Promise.all to run getPlanningGroups and getCampaigns concurrently
  var [planningGroups, campaigns] = await Promise.all([
    getPlanningGroups(),
    getCampaigns(),
  ]);

  // Execute queueCampaignMatcher after getPlanningGroups and getCampaigns complete
  await queueCampaignMatcher(planningGroups, campaigns);
}
