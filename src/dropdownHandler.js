// Function to populate dropdowns with provided data

// Will make option.text to be item.name and option.value to be item.id
// All other attributes are added to option.dataset

export async function populateDropdown(dropdown, data, sortAttribute = "name") {
  console.log("OFG: populateDropdown");
  if (data.length === 0) {
    dropdown.innerHTML = '<gux-option value="">No data found</gux-option>';
    return;
  }

  if (typeof data[0] === "object") {
    // sort data by sortAttribute (not case sensitive)
    data.sort((a, b) =>
      a[sortAttribute].localeCompare(b[sortAttribute], undefined, {
        sensitivity: "base",
      })
    );
    dropdown.innerHTML = "";
    data.forEach((item) => {
      const option = document.createElement("gux-option");
      option.value = item.id;
      option.name = item.name;
      option.innerHTML = item.name;
      dropdown.appendChild(option);
    });
  } else if (typeof data[0] === "string") {
    // sort data
    data.sort();
    dropdown.innerHTML = "";
    data.forEach((item) => {
      const option = document.createElement("gux-option");
      option.value = item;
      option.innerHTML = item;
      dropdown.appendChild(option);
    });
  }
}

export async function populateMultiDropdown(
  dropdown,
  data,
  sortAttribute = "name"
) {
  if (data.length === 0) {
    dropdown.innerHTML =
      '<gux-option-multi value="">No data found</gux-option-multi>';
    return;
  }

  if (typeof data[0] === "object") {
    // sort data by sortAttribute (not case sensitive)
    data.sort((a, b) =>
      a[sortAttribute].localeCompare(b[sortAttribute], undefined, {
        sensitivity: "base",
      })
    );
    dropdown.innerHTML = "";
    data.forEach((item) => {
      const option = document.createElement("gux-option-multi");
      option.value = item.id;
      option.name = item.name;
      option.innerHTML = item.name;
      dropdown.appendChild(option);
    });
  } else if (typeof data[0] === "string") {
    // sort data
    data.sort();
    dropdown.innerHTML = "";
    data.forEach((item) => {
      const option = document.createElement("gux-option-multi");
      option.value = item;
      option.innerHTML = item;
      dropdown.appendChild(option);
    });
  }
}
