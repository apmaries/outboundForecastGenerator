function crunchNumbers(body) {
  var group = body.group;
  const campaignId = group.campaignId;
  var data = body.data;

  for (let i = 0; i < data.length; i++) {
    var interval = data[i].interval;
    var metrics = data[i].metrics;

    // convert interval to local time
    const [startString, _] = intervalString.split("/");
    const startDate = new Date(startString);
    const localDateTimeString = startDate.toLocaleString();
    const utcDateTimeString = startDate.toISOString();

    // temp log
    console.log(
      startString + " = " + localDateTimeString + " = " + utcDateTimeString
    );

    // Day name en-AU locale
    const dayNameAU = startDate.toLocaleDateString("en-AU", {
      weekday: "long",
    });

    // temp log
    console.log(dayNameAU);
  }
}

function weeklyNumbersCruncher(data, timeZone) {
  console.log(`OFG: Weekly numbers being crunched`);
}

function dailyNumbersCruncher(data, timeZone) {
  console.log(`OFG: Daily numbers being crunched`);
}
