module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['node_modules', 'modules', 'tests', 'errors', 'app', 'app_test'],
  modulePathIgnorePatterns: ['<rootDir>/infrastructure/', '<rootDir>/modules', '<rootDir>/cdk-infra'],
  coverageDirectory: '<rootDir>/coverage/',
  verbose: false,
  // coverageThreshold: {
  //   global: {
  //     branches: 90,
  //     functions: 90,
  //     lines: 90,
  //     statements: 90,
  //   },
  // }, TODO: re-enable as testing coverage improves
};
