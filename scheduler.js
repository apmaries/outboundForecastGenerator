async function runHelper(
  businessUnitId,
  selectedBuTimeZone,
  weekStart,
  numContacts,
  historicalWeeks
) {
  // Function to subscribe to notifications channel
  async function subscribeToNotificationsChannel(businessUnitId) {
    console.log(
      `Subscribing to notifications channel for BU ID: ${businessUnitId}`
    );
    // Your logic to subscribe to the notifications channel goes here
    // Return a promise that resolves when the subscription is complete
    return new Promise((resolve) => {
      // Simulating asynchronous operation, replace this with actual logic
      setTimeout(() => {
        console.log(
          `Notifications channel subscribed for BU ID: ${businessUnitId}`
        );
        resolve();
      }, 2000); // Simulating a 2-second delay
    });
  }

  // Call the function to subscribe to notifications channel
  await subscribeToNotificationsChannel(businessUnitId);

  // Your existing scheduling logic goes here
  console.log("Selected BU ID:", businessUnitId);
  console.log("Selected BU TimeZone:", selectedBuTimeZone);
  console.log("Week Start:", weekStart);
  console.log("Number of Contacts:", numContacts);
  console.log("Historical Weeks:", historicalWeeks);

  // Function to get planning groups from BU id
  async function getPlanningGroups() {
    const planningGroupsArray = [];
    console.log(`Get Planning Groups initiated`);
    console.log(businessUnitId);
    return planningGroupsArray;
  }

  // Function to get outbound campaigns
  async function getCampaigns() {
    const campaignsArray = [];
    console.log(`Get Campaigns initiated`);
    console.log(businessUnitId);
    return campaignsArray;
  }

  // Function to get queue campaigns
  async function queueCampaignMatcher() {
    const queueCampaignsArray = [];
    console.log(`Queue Campaigns initiated`);
    console.log(businessUnitId);
    return queueCampaignsArray;
  }

  // Function to build query body
  async function queryBuilder(queueCampaigns) {
    const queriesArray = [];
    console.log(`Query Builder initiated`);
    console.log(businessUnitId);
    console.log(historicalWeeks);
    return queriesArray;
  }

  // Use Promise.all to run getPlanningGroups and getCampaigns concurrently
  var [planningGroups, campaigns] = await Promise.all([
    getPlanningGroups(),
    getCampaigns(),
  ]);

  // Execute queueCampaignMatcher after getPlanningGroups and getCampaigns complete
  var queueCampaignsResult = await queueCampaignMatcher();

  // Execute queryBuilder after queueCampaignMatcher complete
  var queriesArray = await queryBuilder(queueCampaignsResult);

  // Continue with the rest of your logic using planningGroups, campaigns, and queriesArray
}
