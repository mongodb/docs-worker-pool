module.exports = {
    "collectCoverage": true,
    "collectCoverageFrom": ["src/**/*.ts"],
    "coveragePathIgnorePatterns": [
        "node_modules",
        "tests",
        "errors"
    ],
    "modulePathIgnorePatterns": ["<rootDir>/infrastructure/"],
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
}