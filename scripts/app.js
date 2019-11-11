const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const fs = require("fs");

async function getGitUser() {
  const name = exec("git config --global user.name", function(
    error,
    stdout,
    stderr
  ) {
    console.log(stdout);
    if (error !== null) {
      console.log("exec error: " + error);
    }
  });

  const email = await exec("git config --global user.email", function(
    error,
    stdout,
    stderr
  ) {
    console.log(stdout);
    if (error !== null) {
      console.log("exec error: " + error);
    }
  });
  return { name, email };
}

async function createGitPatch(firstCommit, lastCommit) {
  //biggest issue is how to call an asynch function within a callback
  //and how to do sequential await calls

  const createPatch = exec(
    "git diff " + firstCommit + "..." + lastCommit + " > myPatch.patch",
    function(error, stdout, stderr) {
      if (error !== null) {
        console.log(error);
      } else {
        return fs.readFile("myPatch.patch", "utf8", function(err, data) {
          console.log(data);
        });
        //   console.log(patchString);
        //   resolve(patchString)
      }
    }
  );
}


function createPayload(repoName, branchName, repoOwner, url, patch, buildSize){
    
    
    const payload = {  
        jobType: "githubPatch",
        source: "github",
        action: "push",
        repoName: "docs-bi-connector",
        branchName: "test2",
        isFork: true,
        private: false,
        isXlarge: false,
        repoOwner: "madelinezec",
        url: https://github.com/madelinezec/docs-bi-connector.git,
        newHead: "17330b506db3993d9ed1a916ada1f4a0f473b3ac"}

    // payload: {
    //     jobType: "githubPush",
    //     source: "github",
    //     action: "push",
    //     repoName: "docs-bi-connector",
    //     branchName: "test2",
    //     isFork: true,
    //     private: false,
    //     isXlarge: false,
    //     repoOwner: "madelinezec",
    //     url: https://github.com/madelinezec/docs-bi-connector.git,
    //     newHead: "17330b506db3993d9ed1a916ada1f4a0f473b3ac"
    //     },
}
async function getGitCommits() {
  //gets all local unpushed commits

  const patch = await exec("git cherry", function(error, stdout, stderr) {
    const cleanedup = stdout.replace(/\+ /g, "");
    let commits = cleanedup.split(/\r\n|\r|\n/);
    commits.length = commits.length - 1; //remove the last, dummy element that results from splitting on newline
    console.log(commits);
    //would we ideal to call this with await
    const patch = createGitPatch(commits[0], commits[commits.length - 1]);
    console.log(patch);
    console.log("paaaaaatch");
    if (error !== null) {
      console.log("exec error: " + error);
    }
  });
}

async function main() {
  try {
    const { name, email } = getGitUser();
    console.log(name, email);
  } catch (error) {
    console.error(error.toString());
  }

  try {
    console.log("get in here!!!");
    const commits = await getGitCommits();
  } catch (error) {
    console.error(error.toString());
  }
}

main();















// exports = function(payload, jobTitle, jobUserName, jobUserEmail){

//     console.log(JSON.stringify(context.user));

//     const db_name = context.values.get("db_name");
//     const coll_name = context.values.get("coll_name");

//     // get the queue collection
//     var queue = context.services.get("mongodb-atlas").db(db_name).collection(coll_name);

//     // create the new job document
//     const newJob = {
//       title: jobTitle,
//       user: jobUserName,
//       email: jobUserEmail,
//       status: "inQueue",
//       createdTime: new Date(),
//       startTime: null,
//       endTime: null,
//       priority: 1,
//       numFailures: 0,
//       failures: [],
//       result: null,
//       payload: payload,
//       logs: {},
//     };

//     // we are looking for jobs in the queue with the same payload that have not yet started (startTime == null)
//     const filterDoc = {payload: payload, startTime: null};
//     const updateDoc = {$setOnInsert: newJob};

//     // upsert the new job and return if the upsertedId if the job was added to the queue
//     return queue.updateOne(filterDoc, updateDoc, {upsert: true}).then(result => {
//       if (result.upsertedId) {
//         return result.upsertedId;
//       } else {
//         return "Already Existed";
//       }}, (error) => {
//         return error;
//       });
//   };
