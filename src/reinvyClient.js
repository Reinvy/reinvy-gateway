const config = require("../config");
const { ReinvyClient } = require("@reinvy/sdk");

const reinvy = new ReinvyClient({
  baseUrl: config.REINVY_CORE_URL,
  serviceKey: config.REINVY_SERVICE_KEY,
});

module.exports = reinvy;
