import { handleApiCalls, toastUser } from "./apiHandler.js";

export async function startSession() {
  console.log("[OFG] Starting session");

  // Declare global variables
  const indexPage = "./not-authorized.html";
  const isTesting = window.isTesting;

  // Functions start here
  /* don't need this anymore
  function getParameterByName(name) {
    name = name.replace(/[\\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\#&]" + name + "=([^&#]*)"),
      results = regex.exec(location.hash);
    return results === null
      ? ""
      : decodeURIComponent(results[1].replace(/\+/g, " "));
  }
  */

  // check if account being used to log in with is internal genesys
  function internalUserCheck(emailAddress) {
    const domain = emailAddress.split("@")[1];
    if (domain.toLowerCase() === "genesys.com") {
      console.log("[OFG] Authorised user");
    } else {
      console.log("[OFG] Unauthorised user!");
      alert("Sorry, you are not authorised to use this page :(");
      window.location.replace(indexPage);
    }
  }

  // get user details
  async function getUser() {
    console.log("[OFG] Getting user details");
    // Get user welcome div in page
    let userWelcome = document.getElementById("user-welcome");

    if (isTesting) {
      console.log("[OFG] Testing mode enabled. Skipping user details");
      userWelcome.innerHTML = `Welcome, Test User!`;

      return;
    }

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

        toastUser();

        /* Dont worry about user images... that's a bit unneccessary 
        const userImage = udata.images[0].imageUri;

        // Set user welcome message

        // Add user image to welcome message
        const userImageElement = document.createElement("img");
        userImageElement.src = userImage;
        userImageElement.alt = "User Image";
        userImageElement.style =
          "width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;";
        userWelcome.appendChild(userImageElement);
        */

        userWelcome.innerHTML = `Welcome, ${userName}!`;

        // Append
      } else {
        console.error(`[OFG] Error getting user details. `, udata);
        window.location.replace(indexPage);
      }
    } catch (error) {
      console.error(`[OFG] Error getting user`, error);
      window.location.replace(indexPage);
    }
    userWelcome.removeAttribute("hidden");
  }

  // open notification channel
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

  // Functions end here

  // main code starts here

  /*
  if (window.location.hash) {
    // Set the token in session storage
    console.log("[OFG] Retrieving access token");
    const token = getParameterByName("access_token");
    sessionStorage.setItem("oauth_token", token);

    // make sure user is authorised before continuing
    await getUser();
    await openNotificationsChannel();
  }
  */

  // make sure user is authorised before continuing
  await getUser();
  await openNotificationsChannel();
  console.log("[OFG] Session started");
}
