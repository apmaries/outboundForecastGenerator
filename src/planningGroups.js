async function loadPageTwo(businessUnitId) {
  // Function to get planning groups from BU id
  async function getPlanningGroups() {
    let planningGroupsArray = [];
    console.log(`OFG: Get Planning Groups initiated`);

    const tableBody = document.querySelector("#planning-groups-table tbody");
    // Clear out any existing rows
    tableBody.innerHTML = "";

    // Get planning groups
    planningGroupsArray = await fetchDataWithRetry(
      `/api/v2/workforcemanagement/businessunits/${businessUnitId}/planninggroups`,
      "GET"
    );

    for (let i = 0; i < planningGroupsArray.length; i++) {
      const group = planningGroupsArray[i];
      console.log(`OFG: Found planning group ${i + 1}: ${group.name}`);
      const row = document.createElement("tr");
      const pgNameCell = document.createElement("td");
      pgNameCell.textContent = group.name;
      row.appendChild(pgNameCell);

      const campaignNameCell = document.createElement("td");
      campaignNameCell.textContent = "Campaign Name";
      row.appendChild(campaignNameCell);

      const nContactsCell = document.createElement("td");
      nContactsCell.textContent = "1000";
      row.appendChild(nContactsCell);

      tableBody.appendChild(row);
    }

    return planningGroupsArray;
  }

  // Function to get outbound campaigns
  async function getCampaigns() {
    let campaignsArray = [];
    console.log(`OFG: Get Campaigns initiated`);
    console.log(businessUnitId);
    return campaignsArray;
  }

  // Function to get queue campaigns
  async function queueCampaignMatcher() {
    let queueCampaignsArray = [];
    console.log(`OFG: Queue Campaigns initiated`);
    console.log(businessUnitId);
    return queueCampaignsArray;
  }

  // Use Promise.all to run getPlanningGroups and getCampaigns concurrently
  var [planningGroups, campaigns] = await Promise.all([
    getPlanningGroups(),
    getCampaigns(),
  ]);

  // Execute queueCampaignMatcher after getPlanningGroups and getCampaigns complete
  var queueCampaignsResult = await queueCampaignMatcher();
}
