// Class to store Planning Group data
export class PlanningGroup {
  constructor(
    planningGroupId,
    planningGroupName,
    campaignId,
    campaignName,
    queueId,
    queueName
  ) {
    this.planningGroup = {
      id: planningGroupId,
      name: planningGroupName,
    };
    this.campaign = {
      id: campaignId,
      name: campaignName,
    };
    this.queue = { id: queueId, name: queueName };
  }
}

// More classes as needed in future
