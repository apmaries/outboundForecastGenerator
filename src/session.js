const environment = sessionStorage.getItem("environment");
const clientId = sessionStorage.getItem("clientId");

// check if account being used to log in with is internal genesys
function internalUserCheck(emailAddress) {
  const domain = emailAddress.split("@")[1];
  if (domain.toLowerCase() === "genesys.com") {
    console.log("WPT: Authorised user");
  } else {
    console.log("WPT: Unauthorised user!");
    alert("Unauthorised user!");
    window.location.replace("https://storage.googleapis.com/wem_pt/index.html");
  }
}

function getParameterByName(name) {
  name = name.replace(/[\\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\#&]" + name + "=([^&#]*)"),
    results = regex.exec(location.hash);
  return results === null
    ? ""
    : decodeURIComponent(results[1].replace(/\+/g, " "));
}

if (window.location.hash) {
  console.log("WPT: Retrieving access token");

  const token = getParameterByName("access_token");
  sessionStorage.setItem("token", token);

  // get user details
  async function getUser() {
    $.ajax({
      url: `https://api.${environment}/api/v2/users/me`,
      type: "GET",
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "bearer " + token);
      },
      success: function (udata) {
        console.log("WPT: User details returned");
        console.log(udata);
        const userName = udata.name;
        const userId = udata.id;
        const userEmail = udata.email;
        internalUserCheck(userEmail);
        sessionStorage.setItem("userName", userName);
        sessionStorage.setItem("userId", userId);
      },
    });
  }

  async function getTheRest() {
    // make sure user is authorised before returning more sensitive data
    await getUser();
    // get org details
    $.ajax({
      url: `https://api.${environment}/api/v2/organizations/me`,
      type: "GET",
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "bearer " + token);
      },
      success: function (odata) {
        console.log("WPT: org details returned");
        console.log(odata);
        const orgName = odata.name;
        sessionStorage.setItem("orgName", orgName);
        console.log("WPT: Updating subheader");
        const authText = document.getElementById("authenticatedSubHeader");
        authText.innerHTML = `Authenticated in: ${orgName}`;
      },
    });

    //get oauth client details
    $.ajax({
      url: `https://api.${environment}/api/v2/oauth/clients/${clientId}`,
      type: "GET",
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "bearer " + token);
      },
      success: function (cdata) {
        console.log("WPT: oatuh client details returned");
        console.log(cdata);
        const clientName = cdata.name;
        const clientScope = cdata.scope;
        sessionStorage.setItem("clientName", clientName);
        sessionStorage.setItem("clientScope", clientScope);
      },
    });

    //get divisions list
    $.ajax({
      url: `https://api.${environment}/api/v2/authorization/divisions?pageSize=1000&pageNumber=1`,
      type: "GET",
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "bearer " + token);
      },
      success: function (ddata) {
        console.log("WPT: Divisions data returned");
        console.log(ddata);

        sessionStorage.setItem("divisionsList", JSON.stringify(ddata.entities));
      },
    });

    //create notification channel
    $.ajax({
      url: `https://api.${environment}/api/v2/notifications/channels`,
      type: "POST",
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "bearer " + token);
        xhr.setRequestHeader("Content-Type", "application/json");
      },
      success: function (cdata) {
        console.log("WPT: notifications channel opened");
        console.log(cdata);
        const notificationsUri = cdata.connectUri;
        const notificationsId = cdata.id;
        sessionStorage.setItem("notificationsUri", notificationsUri);
        sessionStorage.setItem("notificationsId", notificationsId);
      },
    });
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
  $.ajax({
    url: `https://api.${environment}/api/v2/notifications/channels/${notificationsId}/subscriptions`,
    type: "DELETE",
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", "bearer " + token);
    },
    success: function (cdata) {
      console.log("WPT: notifications channel subscriptions removed");

      x = $.ajax({
        url: `https://api.${environment}/api/v2/tokens/me`,
        type: "DELETE",
        beforeSend: function (xhr) {
          xhr.setRequestHeader("Authorization", "bearer " + token);
        },
      }).always(function (jqXHR, textStatus) {
        if (jqXHR.status === 200) {
          console.log("WPT: Session closed");
          sessionStorage.clear;
          alert("Session closed");
          window.location.replace(
            "https://storage.googleapis.com/wem_pt/index.html"
          );
        } else {
          alert("Error: " + textStatus);
          window.location.replace(
            "https://storage.googleapis.com/wem_pt/index.html"
          );
        }
      });
    },
  });
  console.log("WPT: Timeout due to inactivity.");
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
