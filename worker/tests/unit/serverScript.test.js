  /** ******************************************************************
   *                  Testing StagingUtils Class                       *
   ******************************************************************* */
  jest.mock('child_process');
  const serverScript = require('../../../scripts/build/stagingUtils');
  const child_process = require('child_process');

  describe('Test Class', () => {

    beforeEach(() => {
      jest.useFakeTimers();
    });

    const commitPatch =
    "diff --git a/README.rst b/README.rst    index 845a0ce..057c4bd 100644    --- a/README.rst    +++ b/README.rst    @@ -2,7 +2,7 @@      MongoDB Connector for Business Intelligence Documentation      =========================================================          -kjshdfksjdhThis repository contains documentation regarding components of the    +This repository contains documentation regarding components of the      the MongoDB Connector for BI (Business Intelligence). This documentation      builds on the work of the `MongoDB Manual <http://docs.mongodb.org/manual/>`_.          diff --git a/source/tutorial/install-bi-connector-windows.txt b/source/tutorial/install-bi-connector-windows.txt    index 562d172..65d13a2 100644    --- a/source/tutorial/install-bi-connector-windows.txt    +++ b/source/tutorial/install-bi-connector-windows.txt    @@ -5,7 +5,6 @@      ===============================      Install {+bi-short+} on Windows      ===============================    -Test      .. default-domain:: mongodb            .. contents:: On this page";

    const urlArg = 'git@github.com:madelinezec/docs-bi-connector';
    const repoNameArg = 'docs-bi-connector';
    const branchNameArg = 'test2';
    const lastCommit = '0989f60b8addddbbfe8c8ee415812b6783ae00e';

    const payload = {
      jobType: 'githubPush',
      source: 'github',
      action: 'push',
      repoName: repoNameArg,
      branchName: branchNameArg,
      upstream: 'upstream/master',
      localBranchName: branchNameArg,
      isFork: true,
      private: true,
      isXlarge: true,
      repoOwner: 'mongodb',
      url: urlArg,
      newHead: lastCommit,
      patch: commitPatch,
    };

    console.log('before tests');

    it('getRepoName', () => {
      const repoName = serverScript.getRepoName(
        'git@github.com:madelinezec/docs-bi-connector'
      );
      expect(repoName).toBe(repoNameArg);
    });


    it('getGitUser', async () => {
      serverScript.getGitUser = jest
        .fn()
        .mockReturnValue(Promise.resolve('mez2113@columbia.edu'));
    });

    it('getGitEmail', async () => {
      serverScript.getGitEmail = jest
        .fn()
        .mockReturnValue(Promise.resolve('mez2113@columbia.edu'));
    });

    it('getRepoInfo', async () => {
      serverScript.getRepoInfo = jest
        .fn()
        .mockReturnValue(
          Promise.resolve(urlArg),
        );
    });

    it('getBranchName', async () => {
      serverScript.getBranchName = jest
        .fn()
        .mockReturnValue(Promise.resolve(branchNameArg));
    });

    it('getGitCommits', async () => {
      serverScript.getGitCommits = jest
        .fn()
        .mockReturnValue(
          Promise.resolve([
            '+ 7c7ca2c4284719c278f66eb61301daaa133a51fb',
            '+ 60989f60b8addddbbfe8c8ee415812b6783ae00e',
          ]),
        );
    });

    it('getGitPatchFromLocal', async () => {
      serverScript.getGitPatchFromLocal = jest
        .fn()
        .mockReturnValue(
          Promise.resolve(
            'diff --git a/Makefile b/Makefile\
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
      -Test\
       .. default-domain:: mongodb\
       \
       .. contents:: On this page\
      ')
        );
    });

    it('getGitPatchFromCommits', async () => {
      serverScript.getGitPatchFromCommits = jest
        .fn()
        .mockReturnValue(
          Promise.resolve(commitPatch)
        );
    });

      //public repo -> should resolve true
    it('check upstream repo', () => {
      expect(serverScript.getUpstreamRepo()).resolves.toEqual('mongodb/docs-bi-connector.git');
    });

    it('createPayload', () => {
      console.log("yooo payload: ")
      console.log(payload)
      expect(
        serverScript.createPayload(
          repoNameArg,
          branchNameArg,
          'upstream/master',
          'mongodb',
          urlArg,
          commitPatch,
          lastCommit, 
          branchNameArg,
        )
      ).toEqual(payload);
    });

    it('deletePatchFile', async () => {
      serverScript.deletePatchFile = jest
        .fn()
        .mockReturnValue(Promise.resolve('successfully removed patch file'));
    });
  });
