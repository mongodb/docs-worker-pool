'use strict';

const child_process = jest.genMockFromModule('child_process');

// A custom version of `exec` 
function exec(commands) {
  console.log(commands)
  return 'git@github.com:mongodb/docs-bi-connector.git\n';
}

child_process.exec = exec;

module.exports = child_process;
