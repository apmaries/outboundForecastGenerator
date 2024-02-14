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
    // TODO - Refactor these arrays into something more readable
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
        // TODO: This leads to forecasting an average of averages. This is not a good practice.
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
  campaignData.fcHistoricalPatternData = {};
  var crDaily = [];
  var ahtDaily = [];

  var historicalWeeks = campaignData.historicalWeeks;

  // loop through historical weeks and group by day of week
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

    campaignData.fcHistoricalPatternData.contactRateIntraday =
      campaignData.historicalWeeks[0].intradayValues.contactRateDistribution.map(
        (_, i) =>
          campaignData.historicalWeeks.map(
            (week) => week.intradayValues.contactRateDistribution[i]
          )
      );

    campaignData.fcHistoricalPatternData.averHandleTimeIntraday =
      campaignData.historicalWeeks[0].intradayValues.averHandleTime.map(
        (_, i) =>
          campaignData.historicalWeeks.map(
            (week) => week.intradayValues.averHandleTime[i]
          )
      );

    campaignData.fcHistoricalPatternData.contactRateDaily = crDaily;
    campaignData.fcHistoricalPatternData.averHandleTimeDaily = ahtDaily;
  }

  // delete the now obsolete historicalWeeks property from the campaignData object
  delete campaignData.historicalWeeks;

  return campaignData;
}

async function generateAverages(campaignData, ignoreZeroes = true) {
  console.log("OFG: Generating forecast");
  console.log(`OFG: Ignore zeroes in averages = ${ignoreZeroes}`);
  campaignData.fcData = {};

  // create average daily contact rate
  campaignData.fcData.contactRateDailyAverage =
    campaignData.fcHistoricalPatternData.contactRateDaily[0].map((_, i) => {
      let values = campaignData.fcHistoricalPatternData.contactRateDaily.map(
        (array) => array[i]
      );
      if (ignoreZeroes) {
        values = values.filter((value) => value !== 0);
      }
      let sum = values.reduce((total, value) => total + value, 0);
      if (sum == 0) {
        return 0;
      } else {
        return sum / values.length;
      }
    });

  // create an average intraday contact rate by day of week
  campaignData.fcData.contactRateIntradayAverage =
    campaignData.fcHistoricalPatternData.contactRateIntraday.map(
      (dayOfWeek) => {
        return dayOfWeek[0].map((_, i) => {
          let values = dayOfWeek.map((week) => week[i]);
          if (ignoreZeroes) {
            values = values.filter((value) => value !== 0);
          }
          let sum = values.reduce((total, value) => total + value, 0);
          if (sum == 0) {
            return 0;
          } else {
            return sum / values.length;
          }
        });
      }
    );

  // create average daily AHT
  campaignData.fcData.ahtDailyAverage =
    campaignData.fcHistoricalPatternData.averHandleTimeDaily[0].map((_, i) => {
      let values = campaignData.fcHistoricalPatternData.averHandleTimeDaily.map(
        (array) => array[i]
      );
      if (ignoreZeroes) {
        values = values.filter((value) => value !== 0);
      }
      let sum = values.reduce((total, value) => total + value, 0);

      if (sum == 0) {
        return 0;
      } else {
        return sum / values.length;
      }
    });

  // create an average intraday aht by day of week
  campaignData.fcData.ahtIntradayAverage =
    campaignData.fcHistoricalPatternData.averHandleTimeIntraday.map(
      (dayOfWeek) => {
        return dayOfWeek[0].map((_, i) => {
          let values = dayOfWeek.map((week) => week[i]);
          if (ignoreZeroes) {
            values = values.filter((value) => value !== 0);
          }
          let sum = values.reduce((total, value) => total + value, 0);
          if (sum == 0) {
            return 0;
          } else {
            return sum / values.length;
          }
        });
      }
    );

  return campaignData;
}
