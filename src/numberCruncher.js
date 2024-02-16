function getTotalLength(arrayOfArrays) {
  let totalLength = 0;

  function calculateLength(array) {
    if (Array.isArray(array)) {
      array.forEach((subArray) => {
        calculateLength(subArray);
      });
    } else {
      totalLength++;
    }
  }

  calculateLength(arrayOfArrays);

  return totalLength;
}

async function prepFcMetrics(campaignData) {
  const campaignId = campaignData.campaignId;
  console.log(`OFG: [${campaignId}] Prepping Contact Rate & AHT metrics.`);
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
    // Check if the higher-level object contains both intradayValues and dailySummary
    if (
      !historicalWeeks[w] ||
      !historicalWeeks[w].intradayValues ||
      !historicalWeeks[w].dailySummary
    ) {
      console.error(
        `OFG: ${campaignId} Both intradayValues and dailySummary are required in the input object.`
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
  const campaignId = campaignData.campaignId;
  console.log(
    `OFG: [${campaignId}] Grouping CR and AHT values by day of week.`
  );
  // function to group CR and AHT values by index number
  campaignData.fcHistoricalPatternData = {};
  var crDaily = [];
  var ahtDaily = [];

  var historicalWeeks = campaignData.historicalWeeks;

  // loop through historical weeks and group by day of week
  for (let i = 0; i < historicalWeeks.length; i++) {
    let historicalWeek = historicalWeeks[i];

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
  const campaignId = campaignData.campaignId;
  console.log(`OFG: [${campaignId}] Averaging CR and AHT values`);
  campaignData.fcData = {};

  function normalizeToDistribution(array) {
    // Calculate the total sum of the array
    var totalSum = array.reduce((total, value) => total + value, 0);

    // Adjust the values to represent a distribution
    if (totalSum === 0) {
      return array.map(() => 0);
    } else {
      return array.map((value) => value / totalSum);
    }
  }

  // create average daily contact rate
  var contactRateDailyAverage =
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
  campaignData.fcData.contactRateDailyDistrib = normalizeToDistribution(
    contactRateDailyAverage
  );

  // create an average intraday contact rate by day of week
  var contactRateIntradayAverage =
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
  campaignData.fcData.contactRateIntradayDistrib =
    contactRateIntradayAverage.map(normalizeToDistribution);

  // create average daily AHT
  campaignData.fcData.ahtDaily =
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
  campaignData.fcData.ahtIntraday =
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

  // delete the now obsolete fcHistoricalPatternData property from the campaignData object
  delete campaignData.historicalWeeks;

  return campaignData;
}

async function applyContacts(campaignData, pgArray, testMode) {
  let campaignId = campaignData.campaignId;
  const planningGroupContactsArray = pgArray;
  const dailyCrDistrib = campaignData.fcData.contactRateDailyDistrib;
  const intradayCrDistrib = campaignData.fcData.contactRateIntradayDistrib;

  // function to distribute contacts over given contact rate distribution
  async function distributeContacts(contacts, distribution) {
    let distributedContacts = [];
    for (let i = 0; i < distribution.length; i++) {
      distributedContacts.push(contacts * distribution[i]);
    }
    return distributedContacts;
  }

  if (testMode) {
    // test mode - use a different campaign id from available testData
    if (campaignId === "ce713659-c13a-486e-b978-28b77436bf67") {
      campaignId = "5e7b4fd4-8377-436b-a7f6-0b72f498fbc1";
    } else if (campaignId === "c1a07179-b2f2-4251-a1fa-9fd9b3219174") {
      campaignId = "958c03c1-24a6-49ff-ba32-5824237deabe";
    } else {
      console.error(
        `OFG: Campaign ID ${campaignId} not found in planningGroupsArray`
      );
      return;
    }
  }

  // find campaign id from planningGroupContactsArray
  let campaignMatch = planningGroupContactsArray.find(
    (planningGroup) => planningGroup.cpId === campaignId
  );
  const campaignContacts = campaignMatch.numContacts;
  const campaignPgId = campaignMatch.pgId;

  try {
    if (campaignContacts === undefined) {
      throw new Error(
        `OFG: No contacts found for campaign ${campaignId}. Please check inputs.`
      );
    } else {
      console.log(
        `OFG: [${campaignId}] Applying ${campaignContacts} contacts to Contact Rate forecast.`
      );
      // distribute contacts over daily distribution
      let distributedContactsDaily = await distributeContacts(
        campaignContacts,
        dailyCrDistrib
      );

      // distribute contacts over intraday distribution
      let distributedContactsIntraday = [];
      for (let i = 0; i < intradayCrDistrib.length; i++) {
        let crDistribDay = intradayCrDistrib[i];
        let contactsToDistrib = distributedContactsDaily[i];

        let distributedContacts = await distributeContacts(
          contactsToDistrib,
          crDistribDay
        );
        distributedContactsIntraday.push(distributedContacts);
      }

      // add forecast contacts to campaignData object
      campaignData.fcData.contactsDaily = distributedContactsDaily;
      campaignData.fcData.contactsIntraday = distributedContactsIntraday;

      // add pgId to campaignData object
      campaignData.pgId = campaignPgId;
    }
  } catch (error) {
    console.error(`OFG: ${error}`);
    console.error(planningGroupContactsArray);
    return;
  }

  // apply contacts to contact rate forecast
  return campaignData;
}
