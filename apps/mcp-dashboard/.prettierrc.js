/** @type {import("prettier").Config} */
const config = {
  ...require("@repo/prettier-config/prettier-base"),
  // Dashboard-specific overrides
  printWidth: 100,
  plugins: ["prettier-plugin-tailwindcss"],
};

module.exports = config;