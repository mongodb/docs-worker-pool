module.exports = {
    "collectCoverage": true,
    "collectCoverageFrom": ["src/**/*.ts"],
    "coveragePathIgnorePatterns": [
        "node_modules",
        "tests",
        "errors"
    ],

    "coverageDirectory": "<rootDir>/coverage/",
    "coverageThreshold": {
        "global": {
            "branches": 90,
            "functions": 90,
            "lines": 90,
            "statements": 90
        }
    },
    "verbose": false,
    "globalSetup": './tests/mongo/setup.ts',
    "globalTeardown": './tests/mongo/teardown.ts',
    "testEnvironment": './tests/mongo/mongo-environment.ts'
}