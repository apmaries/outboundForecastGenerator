# Outbound Forecast Generator

---

## Things to note

- Multiple campaigns can reference a single queue object - currently support a 1:1 mapping of queue to campaign
- Should use dedicated queues for outbound vs. inbound work - things will get tricky quickly if a single queue is being used as both an inbound forecast and outbound (WFM limitation more than anything)

## Known bugs

-- Week start on page one sometimes defaults to incorrect start day of week

## Items to do

- Dynamically get environment & client id (wfm-outbound.html)
- Allow navigation to generated forecast in main browser window, or open to new tab (main.js)
- Fix problem with week start populating on page one - should default to next instance of BU's start day of week (e.g. Monday)

## Navigation to fix

-- update loadPageX functions to handle only loading
-- add reset functions for each page
-- add the event listeners to each page's loading
-- remove event listeners when no longer needed
