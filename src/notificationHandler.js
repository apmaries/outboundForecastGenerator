// notificationHandler.js

// TODO: Add testing mode bypass
var testMode = window.ofg.isTesting;

// Define the notification uri & channel id
let notificationsUri = sessionStorage.getItem("notifications_uri");
let notificationsId = sessionStorage.getItem("notifications_id");

/*
// Subscribe to notifications
export async function subscribeToNotifications(buId, channelId) {
  console.info("[OFG] Subscribing to forecast notifications");
  let apiInstance = new PlatformClient.NotificationsApi();

  let body = [
    {
      "id": `v2.workforcemanagement.businessunits.${buId}.shorttermforecasts.generate`,
    },
    {
      "id": `v2.workforcemanagement.businessunits.${buId}.shorttermforecasts.import`,
    },
  ]; // Object | Body
  let opts = {
    "ignoreErrors": false, // Boolean | Optionally prevent throwing of errors for failed permissions checks.
  };

  // Add a list of subscriptions to the existing list of subscriptions
  apiInstance
    .postNotificationsChannelSubscriptions(channelId, body, opts)
    .then((data) => {
      console.debug(
        `[OFG] Subscribed to forecast notifications in BU ${buId}: `,
        data
      );
    })
    .catch((err) => {
      console.error("[OFG] Error subscribing to forecast notifications: ", err);
    });
}
*/

export class NotificationHandler {
  constructor(topics, buId, onSubscribed, onMessage) {
    this.uri = notificationsUri;
    this.id = notificationsId;

    if ((!this.uri || !this.id) && !testMode) {
      throw new Error("Missing required session storage items");
    }

    this.topics = topics;
    this.buId = buId;
    this.onSubscribed = onSubscribed;
    this.onMessage = onMessage;
    this.ws = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.uri) {
        this.ws = new WebSocket(this.uri);

        // Connection opened
        this.ws.addEventListener("open", (event) => {
          console.log("[OFG] WebSocket connection opened");
          resolve();
        });

        // Listen for messages
        this.ws.addEventListener("message", this.handleMessage.bind(this));

        // Connection closed
        this.ws.addEventListener("close", this.onClose.bind(this));

        // Connection error
        this.ws.addEventListener("error", (event) => {
          console.log("[OFG] WebSocket error: ", event);
          reject(event);
        });
      } else {
        reject(new Error("URI is not defined"));
      }
    });
  }

  onOpen(event) {
    console.log("[OFG] WebSocket connection opened");
    // Add your code here
  }

  subscribeToNotifications() {
    console.info("[OFG] Subscribing to forecast notifications");
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
    // Add your code here
  }

  onError(event) {
    console.log("[OFG] WebSocket error: ", event);
    // Add your code here
  }
}
