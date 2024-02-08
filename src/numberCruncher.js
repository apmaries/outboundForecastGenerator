function crunchNumbers(body) {
  var group = body.group;
  const campaignId = group.campaignId;
  var data = body.data;

  for (let i = 0; i < data.length; i++) {
    var interval = data[i].interval;
    var metrics = data[i].metrics;

    // convert interval to local time
    const [startString, _] = interval.split("/");
    const startDate = new Date(startString);
    const localDateTimeString = startDate.toLocaleString();

    // Day name en-AU locale
    const dayNameAU = startDate.toLocaleDateString("en-AU", {
      weekday: "long",
    });

    // Get interval index number
    const totalMinutes = hours * 60 + minutes;
    const intervalDuration = 15;
    const indexNumber = Math.floor(totalMinutes / intervalDuration);

    // Prep data

    // Extract interval level metrics
    const attemptedMetrics = metrics.find(
      (metric) => metric.metric === "nOutboundAttempted"
    );
    const connectedMetrics = metrics.find(
      (metric) => metric.metric === "nOutboundConnected"
    );

    // Error checking: Ensure both metrics exist and count is not zero
    if (
      attemptedMetrics &&
      connectedMetrics &&
      attemptedMetrics.stats.count !== 0
    ) {
      const contactRate =
        connectedMetrics.stats.count / attemptedMetrics.stats.count;
      console.log(`OFG: ${localDateTimeString} Contact Rate: ${contactRate}`);
    } else {
      console.log("Error: Metrics not available or divide by zero error.");
      console.log(metrics);
    }
  }
}
