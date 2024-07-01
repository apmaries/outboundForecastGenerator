import { loadPageFour } from "./pageHandler.js";

// Define global variables
var testMode = window.ofg.isTesting;

// Define the notification uri & channel id
let notificationsUri = sessionStorage.getItem("notifications_uri");
let notificationsId = sessionStorage.getItem("notifications_id");

export class NotificationHandler {
  constructor(topics, buId, onSubscribed, onMessage) {
    this.uri = notificationsUri;
    this.id = notificationsId;

    let resultsContainer = document.getElementById("import-results-container");
    let message = document.createElement("div");

    if ((!this.uri || !this.id) && !testMode) {
      alert("An error occurred. Please refresh the page and try again.");
      loadPageFour();

      // Insert div to id="import-results-container" with error message
      message.className = "alert-danger";
      message.innerHTML =
        "Something went wrong :(<br>Please refresh the page and try again.";
      resultsContainer.appendChild(message);

      const reason = document.createElement("div");

      reason.innerHTML = "Missing required session storage items";
      resultsContainer.appendChild(reason);

      throw new Error("Missing required session storage items");
    }

    this.topics = topics;
    this.buId = buId;
    this.onSubscribed = onSubscribed;
    this.onMessage = onMessage;
    this.ws = null;
  }

  connect() {
    if (this.uri) {
      this.ws = new WebSocket(this.uri);

      // Connection opened
      this.ws.addEventListener("open", this.onOpen.bind(this));

      // Listen for messages
      this.ws.addEventListener("message", this.handleMessage.bind(this));

      // Connection closed
      this.ws.addEventListener("close", this.onClose.bind(this));

      // Connection error
      this.ws.addEventListener("error", this.onError.bind(this));
    }
  }

  onOpen(event) {
    console.log("[OFG] WebSocket connection opened");
    // Add your code here
  }

  subscribeToNotifications() {
    console.info("[OFG] Subscribing to forecast notifications");

    if (testMode) {
      console.log("[OFG] Skipping subscription in test mode");
      return;
    } else {
      let apiInstance = new window.ofg.PlatformClient.NotificationsApi();

      let body = this.topics.map((topic) => ({
        "id": `v2.workforcemanagement.businessunits.${this.buId}.${topic}`,
      }));

      let opts = {
        "ignoreErrors": false, // Boolean | Optionally prevent throwing of errors for failed permissions checks.
      };

      // Add a list of subscriptions to the existing list of subscriptions
      body.forEach((topicObj) => {
        let topic = topicObj.id.split(".").pop();
        apiInstance
          .postNotificationsChannelSubscriptions(this.id, [topicObj], opts)
          .then((data) => {
            console.debug(
              `[OFG] Subscribed to ${topic} notifications in BU ${this.buId}: `,
              data
            );
            if (this.onSubscribed) {
              this.onSubscribed();
            }
          })
          .catch((err) => {
            console.error(
              `[OFG] Error subscribing to ${topic} notifications in BU ${this.buId}: `,
              err
            );
          });
      });
    }
  }

  handleMessage(event) {
    const notification = JSON.parse(event.data);
    const topicName = notification.topicName;

    if (topicName !== "channel.metadata") {
      console.log(`[OFG] Received notification for topic ${topicName}`);
      this.onMessage(notification);
    }
  }

  onClose(event) {
    console.log("[OFG] WebSocket connection closed");
    // Add any other code here
  }

  onError(event) {
    console.log("[OFG] WebSocket error: ", event);
    // Add any other code here
  }
}
