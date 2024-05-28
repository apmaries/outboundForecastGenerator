import { handleApiCalls, toastUser } from "./apiHandler.js";

// Declare global variables
const indexPage = "./not-authorized.html";
const isTesting = window.ofg.isTesting;

// Function to check if user is authorised
async function internalUserCheck(emailAddress) {
  const domain = emailAddress.split("@")[1];
  if (domain.toLowerCase() === "genesys.com") {
    console.log("[OFG] Authorised user");
  } else {
    console.log("[OFG] Unauthorised user!");
    alert("Sorry, you are not authorised to use this page :(");
    window.location.replace(indexPage);
  }
}

// Function to get user details and check if authorised
async function getUser() {
  console.log("[OFG] Getting user details");
  // Get user welcome div in page
  let userWelcome = document.getElementById("user-welcome");

  if (isTesting) {
    console.log("[OFG] Testing mode enabled. Skipping user details");
    userWelcome.innerHTML = `Welcome, Test User!`;
  } else {
    try {
      let udata = await handleApiCalls("UsersApi.getUsersMe");

      if (udata) {
        console.log("[OFG] User details returned", udata);
        const userName = udata.name;
        const userId = udata.id;
        const userEmail = udata.email;

        internalUserCheck(userEmail);

        sessionStorage.setItem("user_name", userName);
        sessionStorage.setItem("user_id", userId);

        // Toast not required if can't include custom buttons in toast to open generated forecast
        //toastUser();

        userWelcome.innerHTML = `Welcome, ${userName}!`;
      } else {
        console.error(`[OFG] Error getting user details. `, udata);
        window.location.replace(indexPage);
        throw new Error("Error getting user details");
      }
    } catch (error) {
      console.error(`[OFG] Error getting user`, error);
      window.location.replace(indexPage);
      throw error;
    }
  }
  userWelcome.removeAttribute("hidden");
}

// Function to open notification channel
async function openNotificationsChannel() {
  if (!isTesting) {
    console.log("[OFG] Opening notifications channel");
    let channel = await handleApiCalls(
      "NotificationsApi.postNotificationsChannels"
    );

    if (channel) {
      console.log("[OFG] Notifications channel opened");
      const notificationsUri = channel.connectUri;
      const notificationsId = channel.id;
      sessionStorage.setItem("notifications_uri", notificationsUri);
      sessionStorage.setItem("notifications_id", notificationsId);
    } else {
      console.error(`[OFG] Error creating notifications channel`);
    }
  }
}

export async function startSession() {
  console.log("[OFG] Starting session");

  try {
    // Get user details and open notifications channel
    await getUser();
    await openNotificationsChannel();
    console.log("[OFG] Session started");
  } catch (error) {
    console.error(`[OFG] Error starting session: `, error);
  }
}
