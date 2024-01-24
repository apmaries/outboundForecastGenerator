const token = sessionStorage.getItem("token");
const environment = sessionStorage.getItem("environment");
const prefix = `https://api.${environment}`;

// make api calls
async function fetchDataWithRetry(
  endpoint,
  method,
  postData = null,
  maxRetries = 3
) {
  terminal(`Making ${method} request to ${prefix}${endpoint}`, "DEBUG");
  let retryCount = 0;
  const headers = {
    "Authorization": "bearer " + token,
    "Content-Type": "application/json",
  };

  while (retryCount < maxRetries) {
    try {
      const requestOptions = {
        method: method,
        headers: headers,
      };

      if (method === "POST" && postData) {
        requestOptions.body = JSON.stringify(postData);
      }

      const response = await fetch(prefix + endpoint, requestOptions);
      if (response.ok) {
        const data = await response.json();

        // return entities, results or object only
        if ("entities" in data) {
          // add logic to get next page
          terminal(`${method} data entities returned`, "DEBUG");
          return data.entities;
        } else if ("results" in data) {
          terminal(`${method} data results returned`, "DEBUG");
          return data.results;
        } else {
          terminal(`${method} data object returned`, "DEBUG");
          return data;
        }
      } else {
        // error response handling
        const responseBody = await response.json();
        const message = responseBody.message;

        if (response.status === 429) {
          // handle rate limit
          retryCount++;
          // add logic to retrieve seconds to wait
          let hasRetrySeconds = message.match(/\[(.*?)\]/);
          if (hasRetrySeconds) {
            let retrySeconds = hasRetrySeconds[1];
            terminal(
              `Rate limit breached! Retrying in ${retrySeconds} seconds`,
              "WARNING"
            );
            await new Promise((resolve) =>
              setTimeout(resolve, retrySeconds * 1000)
            );
            terminal(`Retrying request`, "INFO");
            continue;
          }
        } else if (response.status === 401) {
          // invalid login or no token - redirect back to login
          sessionStorage.clear();
          alert(
            `Request failed: Invalid login credentials. Please log in again.`
          );
          window.location.href = "../index.html";
        } else {
          // some other error response
          terminal(
            `Request failed with status ${response.status}: ${message}`,
            "ERROR"
          );
          return message;
        }
      }
    } catch (error) {
      // handle the error
      return;
    }
  }
  terminal(`Maximum retry count exceeded!`, "ERROR");
}
