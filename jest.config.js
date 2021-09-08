module.exports = {
    "collectCoverage": true,
    "collectCoverageFrom": ["**/*.ts"],
    "coveragePathIgnorePatterns": [
        "node_modules",
        "tests"
    ],

    "coverageDirectory": "<rootDir>/coverage/",
    "coverageThreshold": {
        "global": {
            "branches": 75,
            "functions": 75,
            "lines": 75,
            "statements": 75
        }
    },
    "verbose": false
}