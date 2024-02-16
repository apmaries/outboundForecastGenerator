var environment = sessionStorage.getItem("environment");
var clientId = sessionStorage.getItem("clientId");

function getParameterByName(name) {
  name = name.replace(/[\\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\#&]" + name + "=([^&#]*)"),
    results = regex.exec(location.hash);
  return results === null
    ? ""
    : decodeURIComponent(results[1].replace(/\+/g, " "));
}

if (window.location.hash) {
  console.log("OFG: Retrieving access token");

  const token = getParameterByName("access_token");
  sessionStorage.setItem("token", token);
}

// get user details
async function getUser() {
  let user = await fetchDataWithRetry(`/api/v2/users/me`, "GET");
  if (user) {
    var userName = user.name;
    var userId = user.id;
    console.log(`OFG: User ${userName} (${userId}) returned`);
    var userWelcomeDiv = document.getElementById("user-welcome");

    // Create a <p> element with the welcome message
    const welcomeParagraph = document.createElement("p");
    welcomeParagraph.textContent = `Welcome ${userName}`;

    // Append the <p> element to the parent node
    userWelcomeDiv.appendChild(welcomeParagraph);
    userWelcomeDiv.removeAttribute("hidden");
  } else {
    console.error(`OFG: Error getting user`);
  }
}

async function getOrgLevelStuff() {
  // make sure user is authorised before returning more sensitive data
  await getUser();

  // Wrap each fetch operation in an async function
  let clientPromise = (async () => {
    let client = await fetchDataWithRetry(
      `/api/v2/oauth/clients/${clientId}`,
      "GET"
    );
    if (client) {
      console.log("OFG: OAuth client details returned");
      const clientName = client.name;
      // TODO: Future consideration to validate client scope prior to execution
      const clientScope = client.scope;
      sessionStorage.setItem("clientName", clientName);
      sessionStorage.setItem("clientScope", clientScope);
    } else {
      console.error(`OFG: Error getting OAuth client`);
    }
  })();

  let divisionsPromise = (async () => {
    let divisions = await fetchDataWithRetry(
      `/api/v2/authorization/divisions?pageSize=1000&pageNumber=1`,
      "GET"
    );
    if (divisions) {
      console.log("OFG: Divisions data returned");
      // TODO: Future cosideration to make application division aware (e.g. what BU's are returned)
      sessionStorage.setItem("divisionsList", JSON.stringify(divisions));
    } else {
      console.error(`OFG: Error getting divisions`);
    }
  })();

  let channelPromise = (async () => {
    let channel = await fetchDataWithRetry(
      `/api/v2/notifications/channels`,
      "POST"
    );
    if (channel) {
      console.log("OFG: Notifications channel opened");
      const notificationsUri = channel.connectUri;
      const notificationsId = channel.id;
      sessionStorage.setItem("notificationsUri", notificationsUri);
      sessionStorage.setItem("notificationsId", notificationsId);
    } else {
      console.error(`OFG: Error creating notifications channel`);
    }
  })();

  // testing pagination on a get time zones call
  let timeZonesPromise = (async () => {
    let timeZones = await fetchDataWithRetry(`/api/v2/timezones`, "GET");
    if (timeZones) {
      console.log(`OFG: ${timeZones} Timezones data returned`);
    } else {
      console.error(`OFG: Error getting time zones`);
    }
  })();

  // Run all fetch operations concurrently
  await Promise.all([clientPromise, divisionsPromise, channelPromise]);
}

// auto timeout
let activityTimeout;

// Define the timeout function
function timeout() {
  // TODO: Understand if timeout needed
  const token = sessionStorage.getItem("token");
  const environment = sessionStorage.getItem("environment");
  const notificationsId = sessionStorage.getItem("notificationsId");

  let unsubscribe = fetchDataWithRetry(
    `/api/v2/notifications/channels`,
    "DELETE"
  );
  if (unsubscribe) {
    console.log("OFG: Notifications channel subscriptions removed");
    let deleteToken = fetchDataWithRetry(`/api/v2/tokens/me`, "DELETE");
    if (deleteToken) {
      console.log("OFG: Token deleted and session closed");
      sessionStorage.clear;
      alert("Session closed");
      window.location.replace("./index.html");
    } else {
      console.error(`OFG: Error deleting token`);
    }
  } else {
    console.error(`OFG: Error removing notification channel subscriptions`);
  }

  console.log("OFG: Timeout due to inactivity.");
  sessionStorage.clear;
}

// Function to reset the activity timer
function resetActivityTimer() {
  clearTimeout(activityTimeout);
  activityTimeout = setTimeout(timeout, 10 * 60 * 1000); // 10 minutes in milliseconds
}

// Add event listeners to detect user activity
//document.addEventListener("mousemove", resetActivityTimer);
//document.addEventListener("keydown", resetActivityTimer);

// Start the initial activity timer
//resetActivityTimer();
