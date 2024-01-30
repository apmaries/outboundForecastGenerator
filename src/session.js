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

  async function getTheRest() {
    // make sure user is authorised before returning more sensitive data
    await getUser();

    //get oauth client details
    let client = await fetchDataWithRetry(
      `/api/v2/oauth/clients/${clientId}`,
      "GET"
    );
    if (client) {
      console.log("OFG: OAuth client details returned");
      const clientName = client.name;
      const clientScope = client.scope;
      sessionStorage.setItem("clientName", clientName);
      sessionStorage.setItem("clientScope", clientScope);
    } else {
      console.error(`OFG: Error getting OAuth client`);
    }

    //get divisions list
    let divisions = await fetchDataWithRetry(
      `/api/v2/authorization/divisions?pageSize=1000&pageNumber=1`,
      "GET"
    );
    if (divisions) {
      console.log("OFG: Divisions data returned");
      sessionStorage.setItem(
        "divisionsList",
        JSON.stringify(divisions.entities)
      );
    } else {
      console.error(`OFG: Error getting divisions`);
    }

    //create notification channel
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
  }
  getTheRest();
}

// auto timeout
let activityTimeout;

// Define the timeout function
function timeout() {
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
}

// Function to reset the activity timer
function resetActivityTimer() {
  clearTimeout(activityTimeout);
  activityTimeout = setTimeout(timeout, 10 * 60 * 1000); // 10 minutes in milliseconds
}

// Add event listeners to detect user activity
document.addEventListener("mousemove", resetActivityTimer);
document.addEventListener("keydown", resetActivityTimer);

// Start the initial activity timer
resetActivityTimer();
