/** Jest config for functions/ — ts-jest, CommonJS (package has no "type": "module") */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    // Source files import with .js extensions (NodeNext); map back to .ts for jest
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
