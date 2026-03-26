module.exports = {
  displayName: "meeting-bot",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/apps/meeting-bot",
  // Run tests serially to prevent database deadlocks
  maxWorkers: 1,
};
