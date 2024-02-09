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

    function getWeek(localDateTime) {
      const date = new Date(localDateTime);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 4 - (date.getDay() || 7));
      const yearStart = new Date(date.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
      return weekNumber;
    }

    // Day name en-AU locale
    const dayNameAU = startDate.toLocaleDateString("en-AU", {
      weekday: "long",
    });

    // Get interval index number
    const hours = startDate.getHours();
    const minutes = startDate.getMinutes();
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
