// Function to hide loading spinner and show content
export async function hideLoadingSpinner(spinner, elem) {
  console.log("OFG: hideLoadingSpinner");

  const spinnerElem = document.getElementById(spinner);
  const elemElem = document.getElementById(elem);

  spinnerElem.style.display = "none";
  elemElem.style.display = "block";
}

// Function to handle page transitions
export function switchPages(currentPageId, nextPageId) {
  const currentPage = document.getElementById(currentPageId);
  const nextPage = document.getElementById(nextPageId);

  currentPage.classList.remove("active-page");
  currentPage.classList.add("inactive-page");

  setTimeout(() => {
    nextPage.classList.add("active-page");
    nextPage.classList.remove("inactive-page");
  }, 100); // Delay for a smoother transition
}
