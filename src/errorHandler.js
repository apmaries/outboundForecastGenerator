// Define a global error handler function
export function globalErrorHandler(message, source, lineno, colno, error) {
  let body = {
    source,
    lineno,
    colno,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
  };

  console.error(`[OFG] An uncaught error occurred: ${message}`, body);
}

// Define a standard error handling function
export function handleError(error, context) {
  console.error(`[OFG] Error in ${context}: `, error);
  // Additional error handling logic can be added here
}
