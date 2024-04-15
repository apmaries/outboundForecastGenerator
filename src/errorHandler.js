// Define a global error handler function
function globalErrorHandler(message, source, lineno, colno, error) {
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

  console.error(`OFG: An uncaught error occurred: ${message}`, body);
}
