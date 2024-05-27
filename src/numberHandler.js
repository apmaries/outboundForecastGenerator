export async function prepFcMetrics(campaignData) {
  // Extract campaignId from the campaignData
  const campaignId = campaignData.campaignId;
  console.log(`[OFG] [${campaignId}] Prepping Contact Rate & AHT metrics.`);

  // Extract historicalWeeks from the campaignData
  var historicalWeeks = campaignData.historicalWeeks;

  // Function to calculate contact rate, contact rate distribution and average handle time
  function l2Values(attempted, connected, time, handled) {
    // Initialize arrays to store calculated values
    var crValues = [];
    var crDistribution = [];
    var ahtValues = []; // old aht method that leads to average of averages
    var thtValues = []; // NEW: new aht method that uses total handle time

    // Calculate contact rate for each pair of attempted and connected values
    for (var i = 0; i < attempted.length; i++) {
      var nAttemptedValue = attempted[i];
      var nConnectedValue = connected[i];

      if (nAttemptedValue === 0) {
        crValues.push(0);
      } else {
        crValues.push(nConnectedValue / nAttemptedValue);
      }
    }

    // Calculate the sum of contact rates
    var contactRateSum = crValues.reduce(function (a, b) {
      return a + b;
    }, 0);

    // Calculate contact rate distribution based on the sum of contact rates
    for (var k = 0; k < crValues.length; k++) {
      if (contactRateSum == 0) {
        crDistribution.push(0);
      } else {
        var crDistribValue = crValues[k] / contactRateSum;
        crDistribution.push(crDistribValue);
      }
    }

    // Calculate average handle time for each pair of time and handled values
    for (let j = 0; j < time.length; j++) {
      var tTotalHandleTimeValue = time[j];
      var nHandledValue = handled[j];

      if (nHandledValue === 0) {
        ahtValues.push(0);

        // NEW: Add total handle time to the array
        thtValues.push(0);
      } else {
        ahtValues.push(tTotalHandleTimeValue / nHandledValue);

        // NEW: Add total handle time to the array
        thtValues.push(tTotalHandleTimeValue);
      }
    }

    // Return arrays of calculated values
    return [crValues, crDistribution, ahtValues, thtValues, handled];
  }

  // Function to create arrays of contact rate, contact rate distribution and average handle time
  function l1Arrays(body) {
    // Extract data from the body
    var attempted = body.nAttempted;
    var connected = body.nConnected;
    var time = body.tHandle;
    var handled = body.nHandled;

    // Initialize arrays to store calculated values
    var contactRateArray = [];
    var contactRateDistributionArray = [];
    var averHandleTimeArray = [];

    // NEW: Initialize array to store total handle time
    var totalHandleTimeArray = [];

    // Calculate contact rate, contact rate distribution and average handle time for each set of data
    for (var i = 0; i < attempted.length; i++) {
      var nAttemptedArray = attempted[i];
      var nConnectedArray = connected[i];
      var tHandleArray = time[i];
      var nHandledArray = handled[i];

      var contactRate;
      var contactRateDistribution;
      var averHandleTime;

      // NEW: Initialize variable for total handle time
      var totalHandleTime;

      [contactRate, contactRateDistribution, averHandleTime, totalHandleTime] =
        l2Values(nAttemptedArray, nConnectedArray, tHandleArray, nHandledArray);

      // Store calculated values in the arrays
      contactRateArray.push(contactRate);
      contactRateDistributionArray.push(contactRateDistribution);
      averHandleTimeArray.push(averHandleTime);

      // NEW: Add total handle time to the array
      totalHandleTimeArray.push(totalHandleTime);
    }

    // Add calculated values to the body
    body.contactRate = contactRateArray;
    body.contactRateDistribution = contactRateDistributionArray;
    body.averHandleTime = averHandleTimeArray;

    // NEW: Add total handle time to the body
    body.totalHandleTime = totalHandleTimeArray;

    // Add nHandled values to the body
    body.nHandled = handled;

    // Return the body
    return body;
  }

  // Process each week in the historicalWeeks
  for (let w = 0; w < historicalWeeks.length; w++) {
    // Check if the week contains both intradayValues and dailySummary
    if (
      !historicalWeeks[w] ||
      !historicalWeeks[w].intradayValues ||
      !historicalWeeks[w].dailySummary
    ) {
      console.error(
        `[OFG] ${campaignId} Both intradayValues and dailySummary are required in the input object.`
      );
      return;
    }

    let daily = historicalWeeks[w].dailySummary;
    let intraday = historicalWeeks[w].intradayValues;

    // Calculate contact rate, contact rate distribution and average handle time for daily data
    const dailyPromise = new Promise((resolve) => {
      [
        daily.contactRate,
        daily.contactRateDistribution,
        daily.averHandleTime,
        daily.totalHandleTime,
        daily.nHandled,
      ] = l2Values(
        daily.nAttempted,
        daily.nConnected,
        daily.tHandle,
        daily.nHandled
      );

      resolve();
    });

    // Calculate contact rate, contact rate distribution and handle times for intraday data
    const intradayPromise = new Promise((resolve) => {
      intraday = l1Arrays(intraday);
      resolve();
    });

    // Wait for both calculations to complete
    await Promise.all([dailyPromise, intradayPromise]);
  }

  // Return the processed campaignData
  return campaignData;
}

// Function to group Contact Rate (CR) and Average Handle Time (AHT) values by index number (day of week).
export async function groupByIndexNumber(campaignData) {
  // Extract the campaignId from the campaignData object
  const campaignId = campaignData.campaignId;

  // Log the start of the grouping process
  console.log(
    `[OFG] [${campaignId}] Grouping CR and AHT values by day of week.`
  );

  // Initialize an empty object to hold the grouped data
  campaignData.fcHistoricalPatternData = {};

  // Initialize arrays to hold daily CR and AHT values
  var crDaily = [];
  var ahtDaily = []; // old aht method that leads to average of averages
  var thtDaily = []; // NEW: new aht method that uses total handle time
  var nHandledDaily = []; // NEW: number of handled contacts

  // Extract the historical weeks data from the campaignData object
  var historicalWeeks = campaignData.historicalWeeks;

  // Loop through each historical week
  for (let i = 0; i < historicalWeeks.length; i++) {
    let historicalWeek = historicalWeeks[i];

    // Extract the contact rate distribution for the daily summary of the historical week
    var dowContactRateDistrib =
      historicalWeek.dailySummary.contactRateDistribution;
    // Add the contact rate distribution to the daily CR array
    crDaily.push(dowContactRateDistrib);

    // Extract the average handle time for the daily summary of the historical week
    var dowAverHandleTime = historicalWeek.dailySummary.averHandleTime;
    // Add the average handle time to the daily AHT array
    ahtDaily.push(dowAverHandleTime);

    // NEW: Extract the total handle time for the daily summary of the historical week
    var dowTotalHandleTime = historicalWeek.dailySummary.totalHandleTime;
    // NEW: Add the total handle time to the daily THT array
    thtDaily.push(dowTotalHandleTime);

    // NEW: Extract the number of handled contacts for the daily summary of the historical week
    var dowNHandled = historicalWeek.dailySummary.nHandled;
    // NEW: Add the number of handled contacts to the daily nHandled array
    nHandledDaily.push(dowNHandled);

    // Create the contact rate intraday array by mapping the contact rate distribution for each historical week
    campaignData.fcHistoricalPatternData.contactRateIntraday =
      campaignData.historicalWeeks[0].intradayValues.contactRateDistribution.map(
        (_, i) =>
          campaignData.historicalWeeks.map(
            (week) => week.intradayValues.contactRateDistribution[i]
          )
      );

    // Create the average handle time intraday array by mapping the average handle time for each historical week
    campaignData.fcHistoricalPatternData.averHandleTimeIntraday =
      campaignData.historicalWeeks[0].intradayValues.averHandleTime.map(
        (_, i) =>
          campaignData.historicalWeeks.map(
            (week) => week.intradayValues.averHandleTime[i]
          )
      );

    // NEW: Create the total handle time intraday array by mapping the total handle time for each historical week
    campaignData.fcHistoricalPatternData.totalHandleTimeIntraday =
      campaignData.historicalWeeks[0].intradayValues.totalHandleTime.map(
        (_, i) =>
          campaignData.historicalWeeks.map(
            (week) => week.intradayValues.totalHandleTime[i]
          )
      );

    // NEW: Create the number of handled contacts intraday array by mapping the number of handled contacts for each historical week
    campaignData.fcHistoricalPatternData.nHandledIntraday =
      campaignData.historicalWeeks[0].intradayValues.nHandled.map((_, i) =>
        campaignData.historicalWeeks.map(
          (week) => week.intradayValues.nHandled[i]
        )
      );

    // Assign the daily contact rate and average handle time arrays to the fcHistoricalPatternData object
    campaignData.fcHistoricalPatternData.contactRateDaily = crDaily;
    campaignData.fcHistoricalPatternData.averHandleTimeDaily = ahtDaily;

    // NEW: Assign the daily total handle time array to the fcHistoricalPatternData object
    campaignData.fcHistoricalPatternData.totalHandleTimeDaily = thtDaily;

    // NEW: Assign the daily number of handled contacts array to the fcHistoricalPatternData object
    campaignData.fcHistoricalPatternData.nHandledDaily = nHandledDaily;
  }

  // Delete the now obsolete historicalWeeks property from the campaignData object
  delete campaignData.historicalWeeks;

  // Return the modified campaignData object
  return campaignData;
}

// Function to generate averages for Contact Rate (CR) and Average Handle Time (AHT) values.
export async function generateAverages(campaignData, ignoreZeroes = true) {
  // Extract the campaignId from the campaignData object
  const campaignId = campaignData.campaignId;

  // Log the start of the averaging process
  console.log(`[OFG] [${campaignId}] Averaging historical CR and AHT values`);

  // Initialize an empty object to hold the forecast data
  campaignData.fcData = {};

  // This function normalizes an array to a distribution
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

  /* CONTACT RATE START */
  // Create average daily contact rate
  var contactRateDailyAverage =
    campaignData.fcHistoricalPatternData.contactRateDaily[0].map((_, i) => {
      // Extract the corresponding values from each array in the contactRateDaily array
      let values = campaignData.fcHistoricalPatternData.contactRateDaily.map(
        (array) => array[i]
      );

      // If ignoreZeroes is true, filter out any zero values
      if (ignoreZeroes) {
        values = values.filter((value) => value !== 0);
      }

      // Calculate the sum of the values
      let sum = values.reduce((total, value) => total + value, 0);

      // If the sum is zero, return zero; otherwise, return the average
      if (sum == 0) {
        return 0;
      } else {
        return sum / values.length;
      }
    });

  // Normalize the daily contact rate average to a distribution and store it in the fcData object
  campaignData.fcData.contactRateDailyDistrib = normalizeToDistribution(
    contactRateDailyAverage
  );

  // Create an average intraday contact rate by day of week
  var contactRateIntradayAverage =
    campaignData.fcHistoricalPatternData.contactRateIntraday.map(
      (dayOfWeek) => {
        return dayOfWeek[0].map((_, i) => {
          // Extract the corresponding values from each array in the dayOfWeek array
          let values = dayOfWeek.map((week) => week[i]);

          // If ignoreZeroes is true, filter out any zero values
          if (ignoreZeroes) {
            values = values.filter((value) => value !== 0);
          }

          // Calculate the sum of the values
          let sum = values.reduce((total, value) => total + value, 0);

          // If the sum is zero, return zero; otherwise, return the average
          if (sum == 0) {
            return 0;
          } else {
            return sum / values.length;
          }
        });
      }
    );

  // Normalize the intraday contact rate average to a distribution and store it in the fcData object
  campaignData.fcData.contactRateIntradayDistrib =
    contactRateIntradayAverage.map(normalizeToDistribution);

  /* CONTACT RATE END */

  /* OLD AVERAGE HANDLE TIME START */
  // Create average daily AHT
  campaignData.fcData.OLD_ahtDaily =
    campaignData.fcHistoricalPatternData.averHandleTimeDaily[0].map((_, i) => {
      // Extract the corresponding values from each array in the averHandleTimeDaily array
      let values = campaignData.fcHistoricalPatternData.averHandleTimeDaily.map(
        (array) => array[i]
      );

      // If ignoreZeroes is true, filter out any zero values
      if (ignoreZeroes) {
        values = values.filter((value) => value !== 0);
      }

      // Calculate the sum of the values
      let sum = values.reduce((total, value) => total + value, 0);

      // If the sum is zero, return zero; otherwise, return the average
      if (sum == 0) {
        return 0;
      } else {
        return sum / values.length;
      }
    });

  // Create an average intraday AHT by day of week
  campaignData.fcData.OLD_ahtIntraday =
    campaignData.fcHistoricalPatternData.averHandleTimeIntraday.map(
      (dayOfWeek) => {
        return dayOfWeek[0].map((_, i) => {
          // Extract the corresponding values from each array in the dayOfWeek array
          let values = dayOfWeek.map((week) => week[i]);

          // If ignoreZeroes is true, filter out any zero values
          if (ignoreZeroes) {
            values = values.filter((value) => value !== 0);
          }

          // Calculate the sum of the values
          let sum = values.reduce((total, value) => total + value, 0);

          // If the sum is zero, return zero; otherwise, return the average
          if (sum == 0) {
            return 0;
          } else {
            return sum / values.length;
          }
        });
      }
    );

  /* OLD AVERAGE HANDLE TIME END */

  /* NEW DAILY AVERAGE HANDLE TIME START */
  // Create average daily AHT
  let totalHandleTimeWeekly = Array(7).fill(0);
  let nHandledWeekly = Array(7).fill(0);

  // Sum the total handle time and the number of handled contacts for each day across all weeks
  campaignData.fcHistoricalPatternData.totalHandleTimeDaily.forEach(
    (week, i) => {
      week.forEach((totalTime, j) => {
        totalHandleTimeWeekly[j] += totalTime;
        nHandledWeekly[j] +=
          campaignData.fcHistoricalPatternData.nHandledDaily[i][j];
      });
    }
  );

  // Calculate the average handle time for each day
  campaignData.fcData.ahtDaily = totalHandleTimeWeekly.map((totalTime, i) => {
    if (nHandledWeekly[i] === 0) {
      return 0;
    } else {
      return totalTime / nHandledWeekly[i];
    }
  });

  /* NEW INTRADAY AVERAGE AHT START */
  // Create average intraday AHT
  let totalHandleTimeIntraday = Array(7)
    .fill()
    .map(() => Array(96).fill(0));
  let nHandledIntraday = Array(7)
    .fill()
    .map(() => Array(96).fill(0));

  // Sum the total handle time and the number of handled contacts for each 15-minute interval across all weeks
  campaignData.fcHistoricalPatternData.totalHandleTimeIntraday.forEach(
    (week, i) => {
      week.forEach((day, j) => {
        day.forEach((totalTime, k) => {
          totalHandleTimeIntraday[j][k] += totalTime;
          nHandledIntraday[j][k] +=
            campaignData.fcHistoricalPatternData.nHandledIntraday[i][j][k];
        });
      });
    }
  );

  // Calculate the average handle time for each 15-minute interval
  campaignData.fcData.ahtIntraday = totalHandleTimeIntraday.map((day, i) => {
    return day.map((totalTime, j) => {
      if (nHandledIntraday[i][j] === 0) {
        return 0;
      } else {
        return totalTime / nHandledIntraday[i][j];
      }
    });
  });
  /* NEW AVERAGE HANDLE TIME END */

  // Delete the now obsolete fcHistoricalPatternData property from the campaignData object
  // delete campaignData.historicalWeeks;

  // Return the modified campaignData object
  return campaignData;
}

// Function to apply user defined number of contacts to a campaign's Contact Rate (CR) forecast.
export async function applyContacts(campaignData, pgArray, testMode) {
  // Extract the campaignId from the campaignData object
  let campaignId = campaignData.campaignId;

  // Store the planning group array
  const planningGroupContactsArray = pgArray;

  // Extract the daily and intraday contact rate distributions from the campaignData object
  const dailyCrDistrib = campaignData.fcData.contactRateDailyDistrib;
  const intradayCrDistrib = campaignData.fcData.contactRateIntradayDistrib;

  // This function distributes a given number of contacts over a given distribution
  async function distributeContacts(contacts, distribution) {
    let distributedContacts = [];
    for (let i = 0; i < distribution.length; i++) {
      distributedContacts.push(contacts * distribution[i]);
    }
    return distributedContacts;
  }

  // If testMode is true, use a different campaignId from available testData
  if (testMode) {
    if (campaignId === "ce713659-c13a-486e-b978-28b77436bf67") {
      campaignId = "5e7b4fd4-8377-436b-a7f6-0b72f498fbc1";
    } else if (campaignId === "c1a07179-b2f2-4251-a1fa-9fd9b3219174") {
      campaignId = "958c03c1-24a6-49ff-ba32-5824237deabe";
    } else {
      console.error(
        `[OFG] Campaign ID ${campaignId} not found in planningGroupsArray`
      );
      return;
    }
  }

  // Find the campaignId in the planningGroupContactsArray
  let campaignMatch = planningGroupContactsArray.find(
    (planningGroup) => planningGroup.cpId === campaignId
  );
  const campaignContacts = campaignMatch.numContacts;
  const campaignPgId = campaignMatch.pgId;

  try {
    // If no contacts were found for the campaign, throw an error
    if (campaignContacts === undefined) {
      throw new Error(
        `[OFG] No contacts found for campaign ${campaignId}. Please check inputs.`
      );
    } else {
      console.log(
        `[OFG] [${campaignId}] Applying ${campaignContacts} contacts to Contact Rate forecast.`
      );

      // Distribute the contacts over the daily distribution
      let distributedContactsDaily = await distributeContacts(
        campaignContacts,
        dailyCrDistrib
      );

      // Distribute the contacts over the intraday distribution
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

      // Add the distributed contacts to the campaignData object
      campaignData.fcData.contactsDaily = distributedContactsDaily;
      campaignData.fcData.contactsIntraday = distributedContactsIntraday;

      // Add the planning group ID to the campaignData object
      campaignData.pgId = campaignPgId;
    }
  } catch (error) {
    console.error(`[OFG] ${error}`);
    console.error(planningGroupContactsArray);
    return;
  }

  // Return the modified campaignData object
  return campaignData;
}

export async function resolveContactsAht(campaignData) {
  let fixZeroAhtChecked = document.getElementById("resolveContactsAht").checked;
  if (fixZeroAhtChecked) {
    // Ensure every interval in contactsIntraday has a respective value in ahtIntraday if user elects
    campaignData.fcData.contactsIntraday.forEach((day, i) => {
      day.forEach((interval, j) => {
        if (interval !== 0) {
          console.log(
            `[OFG] [${campaignPgId}] Interval d${i} i${j} has ${interval} contacts and ${campaignData.fcData.ahtIntraday[i][j]} AHT.`
          );
        }

        if (
          interval !== 0 &&
          (campaignData.fcData.ahtIntraday[i][j] === 0 ||
            campaignData.fcData.ahtIntraday[i][j] === undefined)
        ) {
          console.warn(
            `[OFG] [${campaignPgId}] Interval ${i} ${j} has contacts but no AHT value. Populating daily AHT value.`
          );
          campaignData.fcData.ahtIntraday[i][j] =
            campaignData.fcData.ahtDaily[i];
        }
      });
    });

    // Set any interval with 0 contacts to 0 AHT
    campaignData.fcData.contactsIntraday.forEach((day, i) => {
      day.forEach((interval, j) => {
        if (interval === 0) {
          campaignData.fcData.ahtIntraday[i][j] = 0;
        }
      });
    });
  }
}
