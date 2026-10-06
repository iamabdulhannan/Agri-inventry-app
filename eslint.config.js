// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // forms reset their fields when a sheet opens; that sync is intended
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);
