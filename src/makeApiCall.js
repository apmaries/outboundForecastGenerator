var token = sessionStorage.getItem("token");
var environment = sessionStorage.getItem("environment");
var prefix = `https://api.${environment}`;

async function fetchDataWithRetry(
  endpoint,
  method,
  postData = null,
  maxRetries = 3
) {
  console.debug(`OFG: Making ${method} request to ${prefix}${endpoint}`);
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
          console.debug(`OFG: ${method} data entities returned`);
          let entities = data.entities;

          // fetch the next page and concatenate the entities if nextUri exists
          if ("nextUri" in data) {
            const nextPageEntities = await fetchDataWithRetry(
              data.nextUri,
              method,
              postData,
              maxRetries
            );
            entities = entities.concat(nextPageEntities);
          }

          return entities;
        } else if ("results" in data) {
          console.debug(`OFG: ${method} data results returned`);
          return data.results;
        } else {
          console.debug(`OFG: ${method} data object returned`);
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
            console.warn(
              `OFG: Rate limit breached! Retrying in ${retrySeconds} seconds`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, retrySeconds * 1000)
            );
            console.log(`OFG: Retrying request`);
            continue;
          }
        } else if (response.status === 400) {
          // handle malformed syntax
          console.error(
            `OFG: Request failed with status ${response.status}: ${message}`
          );
          console.error("OFG: Malformed POST body:", postData);
          return message;
        } else if (response.status === 401) {
          // invalid login or no token - redirect back to login
          sessionStorage.clear();
          alert(
            `Request failed: Invalid login credentials. Please log in again.`
          );
          window.location.href = "../index.html";
        } else {
          // some other error response
          console.error(
            `OFG: Request failed with status ${response.status}: ${message}`
          );
          return message;
        }
      }
    } catch (error) {
      // handle the error
      return;
    }
  }
  console.error(`OFG: Maximum retry count exceeded!`);
}
