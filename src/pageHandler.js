// Function to hide loading spinner and show content
export async function hideLoadingSpinner() {
  console.log("OFG: hideLoadingSpinner");

  document.getElementById("loading-section").style.display = "none";

  const mainElements = document.getElementsByTagName("main");
  for (let i = 0; i < mainElements.length; i++) {
    mainElements[i].style.display = "block";
  }
}
