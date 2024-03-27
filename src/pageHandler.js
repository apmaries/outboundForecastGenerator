// Function to hide loading spinner and show content
export async function hideLoadingSpinner(spinner, elem) {
  console.log("OFG: hideLoadingSpinner");

  const spinnerElem = document.getElementById(spinner);
  const elemElem = document.getElementById(elem);

  console.log("OFG: spinnerElem", spinnerElem);
  console.log("OFG: elemElem", elemElem);

  spinnerElem.style.display = "none";
  elemElem.style.display = "block";
}
