/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "next/core-web-vitals",
    "plugin:prettier/recommended"
  ],
  plugins: ["@typescript-eslint", "prettier"],
  rules: {
    "prettier/prettier": "warn", // Format issues show as warnings
    "no-unused-vars": "warn",
    "@typescript-eslint/no-unused-vars": ["warn"],
    "no-console": "off", // Allow console logs in dashboard
  },
  ignorePatterns: [
    "node_modules",
    ".next",
    "dist",
    "coverage",
    "out"
  ]
};
