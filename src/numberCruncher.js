function getTotalLength(arrayOfArrays) {
  let totalLength = 0;

  arrayOfArrays.forEach((subArray) => {
    if (Array.isArray(subArray)) {
      totalLength += subArray.length;
    }
  });
  return totalLength;
}

async function prepFcMetrics(campaignData) {
  var historicalWeeks = campaignData.historicalWeeks;

  function l2Values(attempted, connected, time, handled) {
    var crValues = [];
    var crDistribution = [];
    var ahtValues = [];

    for (var i = 0; i < attempted.length; i++) {
      // create contact rate
      var nAttemptedValue = attempted[i];
      var nConnectedValue = connected[i];

      let value;
      if (nAttemptedValue === 0) {
        crValues.push(0);
      } else {
        crValues.push(nConnectedValue / nAttemptedValue);
      }
    }

    for (let j = 0; j < time.length; j++) {
      // create aht
      var tTotalHandleTimeValue = time[j];
      var nHandledValue = handled[j];

      if (nHandledValue === 0) {
        ahtValues.push(0);
      } else {
        ahtValues.push(tTotalHandleTimeValue / nHandledValue);
      }
    }

    // calculate contact rate sum
    var contactRateSum = crValues.reduce(function (a, b) {
      return a + b;
    }, 0);

    // create contact rate distribution based on sum
    for (var k = 0; k < crValues.length; k++) {
      if (contactRateSum == 0) {
        crDistribution.push(0);
      } else {
        var crDistribValue = crValues[k] / contactRateSum;
        crDistribution.push(crDistribValue);
      }
    }

    return [crValues, crDistribution, ahtValues];
  }

  function l1Arrays(body) {
    var attempted = body.nAttempted;
    var connected = body.nConnected;
    var time = body.tHandle;
    var handled = body.nHandled;

    var contactRateArray = [];
    var contactRateDistributionArray = [];
    var averHandleTimeArray = [];

    for (var i = 0; i < attempted.length; i++) {
      var nAttemptedArray = attempted[i];
      var nConnectedArray = connected[i];
      var tHandleArray = time[i];
      var nHandledArray = handled[i];

      var contactRate;
      var contactRateDistribution;
      var averHandleTime;

      [contactRate, contactRateDistribution, averHandleTime] = l2Values(
        nAttemptedArray,
        nConnectedArray,
        tHandleArray,
        nHandledArray
      );

      contactRateArray.push(contactRate);
      contactRateDistributionArray.push(contactRateDistribution);
      averHandleTimeArray.push(averHandleTime);
    }

    body.contactRate = contactRateArray;
    body.contactRateDistribution = contactRateDistributionArray;
    body.averHandleTime = averHandleTimeArray;

    return body;
  }

  for (let w = 0; w < historicalWeeks.length; w++) {
    console.log(
      `OFG: Prepping Contact Rate and AHT for campaign ${campaignData.campaignId} in week ${historicalWeeks[w].weekNumber}`
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
    const dailyPromise = new Promise((resolve) => {
      [daily.contactRate, daily.contactRateDistribution, daily.averHandleTime] =
        l2Values(
          daily.nAttempted,
          daily.nConnected,
          daily.tHandle,
          daily.nHandled
        );
      resolve();
    });

    const intradayPromise = new Promise((resolve) => {
      intraday = l1Arrays(intraday);
      resolve();
    });

    await Promise.all([dailyPromise, intradayPromise]);
  }

  return campaignData;
}

async function groupByIndexNumber(campaignData) {
  // function to group CR and AHT values by index number
  campaignData.fcData = {};
  var crDaily = [];
  var crIntraday = [];
  var ahtDaily = [];
  var ahtIntraday = [];

  var historicalWeeks = campaignData.historicalWeeks;

  for (let i = 0; i < historicalWeeks.length; i++) {
    let historicalWeek = historicalWeeks[i];

    console.log(
      `OFG: Grouping data by day of week for campaign ${campaignData.campaignId} in week ${historicalWeek.weekNumber}`
    );
    var dowContactRateDistrib =
      historicalWeek.dailySummary.contactRateDistribution;
    crDaily.push(dowContactRateDistrib);

    var dowAverHandleTime = historicalWeek.dailySummary.averHandleTime;
    ahtDaily.push(dowAverHandleTime);

    campaignData.fcData.contactRateIntraDayHistoricalPattern =
      campaignData.historicalWeeks[0].intradayValues.contactRateDistribution.map(
        (_, i) =>
          campaignData.historicalWeeks.map(
            (week) => week.intradayValues.contactRateDistribution[i]
          )
      );

    campaignData.fcData.averHandleTimeIntradayHistoricalPattern =
      campaignData.historicalWeeks[0].intradayValues.averHandleTime.map(
        (_, i) =>
          campaignData.historicalWeeks.map(
            (week) => week.intradayValues.averHandleTime[i]
          )
      );

    // old method - did not work
    /*var intradayContactRateDistrib =
      historicalWeek.intradayValues.contactRateDistribution;
    for (let j = 0; j < intradayContactRateDistrib.length; j++) {
      crIntraday.push(intradayContactRateDistrib[j]);
    }

    var intradayAhtValues = historicalWeek.intradayValues.averHandleTime;
    for (let k = 0; k < intradayAhtValues.length; k++) {
      ahtIntraday.push(intradayAhtValues[k]);
    }*/
  }

  // obsolete
  /*campaignData.fcData.contactRateDailyHistoricalPattern = crDaily;
  campaignData.fcData.averHandleTimeDailyHistoricalPattern = ahtDaily;

  campaignData.fcData.contactRateIntraDayHistoricalPattern = crIntraday;
  campaignData.fcData.averHandleTimeIntradayHistoricalPattern = ahtIntraday;*/

  return campaignData;
}
