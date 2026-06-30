const baseConfig = require("./app.json");
const devConfig = require("./app.dev.json");

module.exports = () => {
  if (process.env.EXPO_PUBLIC_USE_DEV_CONFIG === "true") {
    return devConfig;
  }
  return baseConfig;
};
