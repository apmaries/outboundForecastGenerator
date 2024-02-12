function prepFcMetrics(campaignData) {
  var historicalWeeks = campaignData.historicalWeeks;

  function l2Values(attempted, connected, time, handled) {
    var crValues = [];
    var crDistribution = [];
    var ahtValues = [];

    for (var i = 0; i < attempted.length; i++) {
      var nAttemptedValue = attempted[i];
      var nConnectedValue = connected[i];

      if (nAttemptedValue === 0) {
        crValues.push(0);
      } else {
        crValues.push(nConnectedValue / nAttemptedValue);
      }
    }

    for (let j = 0; j < time.length; j++) {
      var tTotalHandleTimeValue = time[j];
      var nHandledValue = handled[j];

      if (nHandledValue === 0) {
        ahtValues.push(0);
      } else {
        ahtValues.push(tTotalHandleTimeValue / nHandledValue);
      }
    }

    var contactRateSum = crValues.reduce(function (a, b) {
      return a + b;
    }, 0);

    for (var k = 0; k < crValues.length; k++) {
      crDistribution.push(crValues[k] / contactRateSum);
    }

    return [crValues, crDistribution, ahtValues];
  }

  function l1Arrays(body) {
    var attempted = body.nAttempted;
    var connected = body.nConnected;
    var time = body.tHandle;
    var handled = body.nHandled;

    for (var i = 0; i < attempted.length; i++) {
      var nAttemptedArray = attempted[i];
      var nConnectedArray = connected[i];
      var tHandleArray = time[i];
      var nHandledArray = handled[i];

      [body.contactRate, body.contactRateDistribution, body.averHandleTime] =
        l2Values(nAttemptedArray, nConnectedArray, tHandleArray, nHandledArray);
    }
    return body;
  }

  for (let w = 0; w < historicalWeeks.length; w++) {
    console.log(
      `OFG: Prepping Contact Rate & AHT values for campaign ${campaignData.campaignId} in week ${historicalWeeks[w].weekNumber}`
    );

    // Check if the higher-level object contains both intradayValues and dailySummary
    if (
      !historicalWeeks[w] ||
      !historicalWeeks[w].intradayValues ||
      !historicalWeeks[w].dailySummary
    ) {
      console.error(
        "OFG: Both intradayValues and dailySummary are required in the input object."
      );
      return;
    }

    let daily = historicalWeeks[w].dailySummary;
    let intraday = historicalWeeks[w].intradayValues;

    // Assign the returned values to the corresponding properties of the daily object
    [daily.contactRate, daily.contactRateDistribution, daily.averHandleTime] =
      l2Values(
        daily.nAttempted,
        daily.nConnected,
        daily.tHandle,
        daily.nHandled
      );

    intraday = l1Arrays(intraday);
  }
  return campaignData;
}
