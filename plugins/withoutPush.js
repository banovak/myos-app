// expo-notifications adds the push (aps-environment) entitlement by default.
// This app only schedules local notifications and has no push server, so the
// entitlement is dropped: no Push Notifications capability needed on the
// bundle ID, nothing for App Review to ask about.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPush(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults["aps-environment"];
    return c;
  });
};
