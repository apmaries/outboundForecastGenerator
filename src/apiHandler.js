// Set up the client
var platformClient = window.require("platformClient");
var client = platformClient.ApiClient.instance;
client.setReturnExtendedResponses(true);

/*
// Set client logging
client.config.logger.log_level = client.config.logger.logLevelEnum.level.LTrace;
client.config.logger.log_format =
  client.config.logger.logFormatEnum.formats.JSON;
client.config.logger.log_request_body = true;
client.config.logger.log_response_body = true;
client.config.logger.log_to_console = true;
client.config.logger.setLogger(); // To apply above changes
*/

// Get the environment & access token from session storage
var accessToken = sessionStorage.getItem("token");
var environment = sessionStorage.getItem("client_env");

// Set the client configuration
client.setEnvironment(environment);
client.setAccessToken(accessToken);
client.setPersistSettings(true, "wpt");
// TODO: Why does the client need to be set up again? Can't we use the one from index.html?

// Define the API instances in an object
const apiInstances = {}; // Is added to dynamically as calls are made

// Define global options
export const globalPageOpts = {
  "pageSize": 100, // Number | Page size
  "pageNumber": 1, // Number | Page number
};

// Handle errors in API calls
async function handleApiErrors(error, apiFunctionStr) {
  // temp logging
  console.warn("WPT: Error = ", error);

  if (error.body) {
    let errorStatus = error.body.status;
    let errorMessage = error.body.message;
    let errorCode = error.body.code;
    let errorHeaders = error.headers;
    let errorBody = {
      status: errorStatus,
      message: errorMessage,
      errorCode: errorCode,
      errorHeaders: errorHeaders,
    }; // used to log shortened objects in error handling

    // Define rertry variables
    let isRetryable = false; // default to not retryable
    let retryAfter; // default to undefined - exponential backoff will be handled in the catch block

    // Handle 429 rate limit exceeded
    if (errorStatus === 429) {
      isRetryable = true; // set to retryable
      retryAfter = errorHeaders["Retry-After"]; // override default retryAfter, value is seconds
      if (retryAfter) {
        console.warn(
          `WPT: Rate limit exceeded. Retrying after ${retryAfter} seconds.`,
          errorBody
        );
      } else {
        // if retryAfter is missing, log the error and throw it
        console.error(
          `WPT: Rate limit exceeded but Retry-After header is missing.`,
          errorBody
        );
        throw error;
      }
    }
    // Handle 400 malformed syntax
    else if (errorStatus === 400) {
      console.error(
        `WPT: Malformed syntax in request to ${apiFunctionStr}.`,
        errorBody
      );
      throw error;
    }
    // Handle any other retryable errors
    else if ([408, 500, 503, 504].includes(errorStatus)) {
      isRetryable = true; // set to retryable
      retryAfter = 3; // override default retryAfter to initial 3 second delay
      console.warn(
        `WPT: Retryable error occurred. Retrying request to ${apiFunctionStr}.`,
        errorBody
      );
    }
    // Handle any other errors
    else {
      console.error(
        `WPT: Error making API call to ${apiFunctionStr}. Status = ${errorStatus}`,
        errorBody
      );
      throw new Error(`Error making API call to ${apiFunctionStr}`);
    }
    return { isRetryable, retryAfter };
  }
}

// Handle API calls
export async function handleApiCalls(apiFunctionStr, ...args) {
  // Split the apiFunctionStr string and get the API instance and function
  const [apiInstanceName, functionName] = apiFunctionStr.split(".");

  // If platformClient[apiInstanceName] is not defined, throw an error
  if (!platformClient[apiInstanceName]) {
    // Check if the apiInstanceName is in PascalCase
    if (apiInstanceName[0] !== apiInstanceName[0].toUpperCase()) {
      throw new Error(
        `API instance ${apiInstanceName} not found. API instance name should be in PascalCase`
      );
    }
    throw new Error(`API instance ${apiInstanceName} not found`);
  }

  const apiInstance =
    apiInstances[apiInstanceName] || new platformClient[apiInstanceName]();
  apiInstances[apiInstanceName] = apiInstance;

  const apiFunction = apiInstance[functionName].bind(apiInstance);

  // Set retry count and max retries
  let retryCount = 0;
  let maxRetries = 3;

  // Initialize the combined entities or results
  let allEntities = [];
  let allResults = [];

  // Start the retry loop
  while (retryCount < maxRetries) {
    try {
      let requestBody = args.find((arg) => typeof arg === "object") || {}; // Find the first object in args
      // Default page number to 1 if pageNumber exists in requestBody
      let currentPage = requestBody.hasOwnProperty("pageNumber")
        ? 1
        : requestBody.pageNumber;

      // Find any strings in args
      let stringArgs = args.filter((arg) => typeof arg === "string");

      while (true) {
        // Create a new object with the updated pageNumber
        const updatedRequestBody = {
          ...requestBody,
          pageNumber: currentPage,
        };

        // Make the API call

        // Create an array of arguments
        let apiFunctionArgs = [...stringArgs];
        if (Object.keys(updatedRequestBody).length > 0) {
          apiFunctionArgs.push(updatedRequestBody);
        }
        console.debug(
          `WPT: Making API call to ${apiFunctionStr} with function args: `,

          apiFunctionArgs
        );
        const response = await apiFunction(...apiFunctionArgs);

        // If the response is blank and the API function is 'deleteTokensMe', return a success message
        if (!response && apiFunctionStr === "TokensApi.deleteTokensMe") {
          return { message: "Token deletion successful" };
        }
        const responseBody = response.body;

        console.debug(
          `WPT: ${apiInstanceName}.${functionName} response body: `,
          responseBody
        );

        // If the response has a body
        if (responseBody) {
          // If the response body is paginated, process the pages
          if (
            responseBody.pageNumber !== undefined &&
            responseBody.pageCount !== undefined
          ) {
            const pageCount = responseBody.pageCount;

            // Combine the entities or results
            if (responseBody.entities) {
              allEntities = allEntities.concat(responseBody.entities);
            } else if (responseBody.results) {
              allResults = allResults.concat(responseBody.results);
            }

            // If the current page is less than the pageCount, request the next page
            if (currentPage < responseBody.pageCount) {
              console.debug(
                `WPT: ${apiInstanceName}.${functionName} is paginated - processing page ${currentPage} of ${pageCount}...`
              );

              currentPage += 1; // Increment currentPage directly

              console.debug(
                `WPT: ${apiInstanceName}.${functionName} Requesting next page of results. requestBody = `,
                updatedRequestBody
              );
            }
            // If the current page is equal to the pageCount, break out of the loop
            else {
              console.debug(
                `WPT: ${apiInstanceName}.${functionName} - No more pages to process`
              );
              break;
            }
          } else {
            // Return the response body if it is not paginated
            console.debug(
              `WPT: ${apiInstanceName}.${functionName} is not paginated.`
            );
            // Return the entities if in responseBody
            if (responseBody.entities) {
              return responseBody.entities;
            } else if (responseBody.results) {
              return responseBody.results;
            } else {
              return responseBody;
            }
          }
        } else {
          // Return an empty object if the response body is blank
          console.warn(`WPT: Response body is blank for ${apiFunctionStr}!`);
          return {};
        }
      }

      // Return the entities or results
      if (allEntities.length > 0) {
        return allEntities;
      } else if (allResults.length > 0) {
        return allResults;
      }
    } catch (error) {
      console.error(`WPT: Error making API call to ${apiFunctionStr}!`);

      // Check error using handleApiErrors function
      const { isRetryable, retryAfter } = await handleApiErrors(
        error,
        apiFunctionStr
      );

      // Set the retry delay for retryable errors
      if (isRetryable) {
        if (error.status !== 429) {
          let backoffRetry = retryAfter * 1000 * 3 ** retryCount;
          console.warn(`WPT: Retrying after ${backoffRetry} seconds`);
          await new Promise((resolve) => setTimeout(resolve, backoffRetry));
        } else {
          console.warn(`WPT: Retrying after ${retryAfter} seconds`);
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000)
          );
        }

        // Increment the retry count
        retryCount++;
        continue;
      } else {
        // Break out of the loop if the error is not retryable
        throw error;
      }
    }
  }

  throw new Error(
    `WPT: Failed to make API call to ${apiFunctionStr} after ${maxRetries} retries`
  );
}
