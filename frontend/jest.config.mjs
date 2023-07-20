import nextJest from "next/jest.js"

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
})

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
  rootDir: ".",
  moduleNameMapper: {
    "src/hooks/useWindowSize": "<rootDir>/src/hooks/useWindowSize",
    "src/asyncs/login": "<rootDir>/src/asyncs/login",
    "src/verificationProvider": "<rootDir>/src/verificationProvider",
    "pages/apps/search": "<rootDir>/pages/apps/search",
    "src/components/Spinner": "<rootDir>/src/components/Spinner",
    "src/meilisearch": "<rootDir>/src/meilisearch",
    "src/components/application/ApplicationCard":
      "<rootDir>/src/components/application/ApplicationCard",
    "src/types/Category": "<rootDir>/src/types/Category",
    "src/components/Button": "<rootDir>/src/components/Button",
    "src/context/user-info": "<rootDir>/src/context/user-info",
  },
  // Add more setup options before each test is run
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  testEnvironment: "jest-environment-jsdom",
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
