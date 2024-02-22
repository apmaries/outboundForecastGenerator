// Declare global variables
const indexPage =
  "https://apmaries.github.io/outboundForecastGenerator/index.html";

// Functions start here
function getParameterByName(name) {
  name = name.replace(/[\\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\#&]" + name + "=([^&#]*)"),
    results = regex.exec(location.hash);
  return results === null
    ? ""
    : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// check if account being used to log in with is internal genesys
function internalUserCheck(emailAddress) {
  const domain = emailAddress.split("@")[1];
  if (domain.toLowerCase() === "genesys.com") {
    console.log("OFG: Authorised user");
  } else {
    console.log("OFG: Unauthorised user!");
    alert("Sorry, you are not authorised to use this page :(");
    window.location.replace(indexPage);
  }
}

// get user details
async function getUser() {
  const uapi = new platformClient.UsersApi();
  // get current user details
  uapi
    .getUsersMe()
    .then((data) => {
      console.log("OFG: User details returned", data);
      const userName = data.name;
      const userId = data.id;
      const userEmail = data.email;
      internalUserCheck(userEmail);
      sessionStorage.setItem("userName", userName);
      sessionStorage.setItem("userId", userId);
    })
    .catch((err) => {
      console.log("There was a failure calling getUsersMe");
      console.error(err);
    });

  /*try {
    let udata = await makeApiCallWithRetry(`/api/v2/users/me`, "GET");
    if (udata) {
      console.log("OFG: User details returned", udata);
      const userName = udata.name;
      const userId = udata.id;
      const userEmail = udata.email;
      internalUserCheck(userEmail);
      sessionStorage.setItem("userName", userName);
      sessionStorage.setItem("userId", userId);
    } else {
      console.error(`OFG: Error getting user details. `, udata);
      window.location.replace(indexPage);
    }
  } catch (error) {
    console.error(`OFG: Error getting user`, error);
    window.location.replace(indexPage);
  } */
}

// get remaining org deets and open notifications channel
async function getOrgLevelStuff() {
  // make sure user is authorised before returning more sensitive data
  await getUser();

  // Wrap each fetch operation in an async function

  // Fetch the OAuth client details
  let clientPromise = (async () => {
    const clientId = sessionStorage.getItem("clientId");
    let client = await makeApiCallWithRetry(
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

  // Fetch the divisions
  let divisionsPromise = (async () => {
    let divisions = await makeApiCallWithRetry(
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

  // Open the notifications channel
  let channelPromise = (async () => {
    let channel = await makeApiCallWithRetry(
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

  // Run all fetch operations concurrently
  await Promise.all([clientPromise, divisionsPromise, channelPromise]);
}

// Define the timeout function
function timeout() {
  const notificationsId = sessionStorage.getItem("notificationsId");

  try {
    // delete notifications channel subscriptions
    x = makeApiCallWithRetry(
      `/notifications/channels/${notificationsId}/subscriptions`,
      "DELETE"
    );

    // delete the token
    x = makeApiCallWithRetry(`/tokens/me`, "DELETE");
  } catch (error) {
    console.error(`OFG: Error disconnecting: ${error}`);
  }

  // Clear the session storage and redirect to the login page
  sessionStorage.clear;
  window.location.replace(indexPage);
  console.log("OFG: Timeout due to inactivity.");
}

// Function to reset the activity timer
function resetActivityTimer() {
  clearTimeout(activityTimeout);
  activityTimeout = setTimeout(timeout, 15 * 60 * 1000); // 15 minutes in milliseconds
}
// Functions end here

// main code starts here
let activityTimeout;

if (window.location.hash) {
  // Set the token in session storage
  console.log("OFG: Retrieving access token");
  const token = getParameterByName("access_token");
  sessionStorage.setItem("token", token);

  // Get the user details and open the notifications channel
  getOrgLevelStuff();

  // Start the initial activity timer
  resetActivityTimer();

  // Add event listeners to detect user activity
  document.addEventListener("mousemove", resetActivityTimer);
  document.addEventListener("keydown", resetActivityTimer);
}
