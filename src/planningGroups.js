async function loadPageTwo(businessUnitId) {
  // Function to get planning groups from BU id
  async function getPlanningGroups() {
    let planningGroupsArray = [];
    console.log(`OFG: Get Planning Groups initiated`);

    // Get planning groups
    planningGroupsArray = await fetchDataWithRetry(
      `/api/v2/workforcemanagement/businessunits/${businessUnitId}/planninggroups`,
      "GET"
    );

    for (let i = 0; i < planningGroupsArray.length; i++) {
      console.log(
        `OFG: Found planning group ${i + 1}: ${planningGroupsArray[i].name}`
      );
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
