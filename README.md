# Outbound Forecast Generator

---

## Things to note

- Multiple campaigns can reference a single queue object - currently support a 1:1 mapping of queue to campaign
- Should use dedicated queues for outbound vs. inbound work - things will get tricky quickly if a single queue is being used as both an inbound forecast and outbound (WFM limitation more than anything)
