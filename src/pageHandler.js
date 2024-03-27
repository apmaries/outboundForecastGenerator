// Function to hide loading spinner and show content
export async function hideLoadingSpinner() {
  console.log("OFG: hideLoadingSpinner");

  document.getElementById("loading-section").style.display = "none";

  // Use setTimeout to delay the execution of the rest of the code
  setTimeout(() => {
    const mainElements = document.getElementsByTagName("main");
    for (let i = 0; i < mainElements.length; i++) {
      mainElements[i].style.display = "block";
    }
  }, 0); // Delay of 0 milliseconds
}
