
/** ******************************************************************
 *                  Sample Class for Testing                       *
 ******************************************************************* */
console.log("AT TOP!Å")
const serverScript = require('../../../scripts/app');

describe('Test Class', () => {
    // const OLD_ENV = process.env;
    // console.log("hi")
    

    beforeAll(() => {
        process.env.DB_NAME = "MOCK"
        process.env.COL_NAME = "MOCK"
        process.env.USERNAME = "MOCK"
        process.env.SECRET = "MOCK"
    });
  afterAll(() => {

  });

  beforeEach(() => {
  });

  afterEach(() => {
   
  });
  console.log("before tests")
//   it('validateConfiguration', () => {
//     serverScript.validateConfiguration().resolves.toBeTruthy()
//   });
it('getRepoName', () => {
    const repoName = serverScript.getRepoName("git@github.com:madelinezec/docs-bi-connector");
    execpt(repoName.toBe('docs-bi-connector')); 
  });

  it('getGitUser', async () => {
      serverScript.getGitUser = jest.fn().mockReturnValue(Promise.resolve('mez2113@columbia.edu'));
  });

  it('getGitEmail', async () => {
      serverScript.getGitEmail = jest.fn().mockReturnValue(Promise.resolve('mez2113@columbia.edu'))
  });

  it('getRepoInfo', async () => {
    serverScript.getRepoInfo = jest.fn().mockReturnValue(Promise.resolve('git@github.com:madelinezec/docs-bi-connector'));
  });

  it('getBranchName', async () => {
    serverScript.getBranchName = jest.fn().mockReturnValue(Promise.resolve('test2'));
  });

  it('getGitCommits', async () => {
      serverScript.getGitCommits = jest.fn().mockReturnValue(Promise.resolve(['+ 7c7ca2c4284719c278f66eb61301daaa133a51fb', '+ 60989f60b8addddbbfe8c8ee415812b6783ae00e']))
  });

  it('getGitPatchFromLocal', async () => {
    serverScript.getGitPatchFromLocal = jest.fn().mockReturnValue(Promise.resolve(  "diff --git a/Makefile b/Makefile\
    index 411cc21..fd24145 100644\
    --- a/Makefile\
    +++ b/Makefile\
    @@ -52,7 +52,7 @@ stagel:\
         git clone https://github.com/madelinezec/test-submodules.git scripts\
         cd scripts && npm install dotenv && npm install mongodb\
         source ~/.config/.snootyenv && node scripts/app.js $(filter-out $@,$(MAKECMDGOALS))\
    -	rm -rf scripts\
    +	#rm -rf scripts\
    \
     commit:\
         @:\
    diff --git a/README.rst b/README.rst\
    index 845a0ce..057c4bd 100644\
    --- a/README.rst\
    +++ b/README.rst\
    @@ -2,7 +2,7 @@\
     MongoDB Connector for Business Intelligence Documentation\
     =========================================================\
     \
    -kjshdfksjdhThis repository contains documentation regarding components of the\
    +This repository contains documentation regarding components of the\
     the MongoDB Connector for BI (Business Intelligence). This documentation\
     builds on the work of the `MongoDB Manual <http://docs.mongodb.org/manual/>`_.\
     \
    diff --git a/source/tutorial/install-bi-connector-windows.txt b/source/tutorial/install-bi-connector-windows.txt\
    index 562d172..65d13a2 100644\
    --- a/source/tutorial/install-bi-connector-windows.txt\
    +++ b/source/tutorial/install-bi-connector-windows.txt\
    @@ -5,7 +5,6 @@\
     ===============================\
     Install {+bi-short+} on Windows\
     ===============================\
    -sdfsdf!!!\
     .. default-domain:: mongodb\
     \
     .. contents:: On this page\
    "))
  });

  it('getGitPatchFromCommits', async () => {
    serverScript.getGitPatchFromCommits = jest.fn().mockReturnValue(Promise.resolve("diff --git a/README.rst b/README.rst\
    index 845a0ce..057c4bd 100644\
    --- a/README.rst\
    +++ b/README.rst\
    @@ -2,7 +2,7 @@\
     MongoDB Connector for Business Intelligence Documentation\
     =========================================================\
     \
    -kjshdfksjdhThis repository contains documentation regarding components of the\
    +This repository contains documentation regarding components of the\
     the MongoDB Connector for BI (Business Intelligence). This documentation\
     builds on the work of the `MongoDB Manual <http://docs.mongodb.org/manual/>`_.\
     \
    diff --git a/source/tutorial/install-bi-connector-windows.txt b/source/tutorial/install-bi-connector-windows.txt\
    index 562d172..65d13a2 100644\
    --- a/source/tutorial/install-bi-connector-windows.txt\
    +++ b/source/tutorial/install-bi-connector-windows.txt\
    @@ -5,7 +5,6 @@\
     ===============================\
     Install {+bi-short+} on Windows\
     ===============================\
    -sdfsdf!!!\
     .. default-domain:: mongodb\
     \
     .. contents:: On this page"))
  });

  it('deletePatchFile', async () => {
    serverScript.deletePatchFile = jest.fn().mockReturnValue(Promise.resolve('successfully removed patch file'));
  });




  
});
