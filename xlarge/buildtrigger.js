// Service that listens for modifications to the docs-worker-pool repo
// requires the secret to live in file name .sab

const http = require('http');
const crypto = require('crypto');
const util = require('util');

const filterBranch = 'stage';

const exec = util.promisify(require('child_process').exec);

let secret;

async function cat() {
  const { stdout, stderr } = await exec('cat .sab');
  if (stderr) {
    throw new Error(stderr);
  }
  secret = stdout.replace(/\r?\n|\r/g, '');
}

async function build() {
  const { stdout, stderr } = await exec('sudo ./build.sh');
  console.log(`ERROR: ${stderr}`);
  console.log(`${stdout}`);
}

// filter
async function filter(data) {
  const dataObj = JSON.parse(data);
  if (dataObj.ref.split('/')[2] === filterBranch) {
    return true;
  }
  return false;
 }

async function returnFailure(res) {
  // message was successful but the filter didn't match so?
  res.statusMessage = 'server does not compile for this branch';
  res.statusCode = 404;
  res.write('{ init: false }', function (err) {
    console.log('sent response');
    res.end();
  });
}

function createServer() {
  console.log('init...');
  http
    .createServer((req, res) => {
      const data = []
      console.log('rebuild request...');
      req.on('data', chunk => {
        // this is actually data in a weird state ignore
        if (res.finished === true) return;
        data.push(chunk);
        let sig =
          'sha1=' + crypto
            .createHmac('sha1', secret)
            .update(chunk.toString())
            .digest('hex');
        if (req.headers['x-hub-signature'] == sig) {
          // filter branch for this rebuilder
          filter(data).then(result => {
            if (!result) {
              returnFailure(res).then((resultNew) => {
                console.log(resultNew);
              });
            } else {
              // it matches the filter, do the build
              build().catch((err) => {
                console.log(err);
              });
              res.write('{ init: true }').then(() => {
                console.log('init build:');
                res.end();
              });
            }
          });
        } else {
          // does not have the password, reject
          console.log('update request rejected: unauthorized');
          res.statusMessage = 'Not authorized';
          res.statusCode = 401;
          res.write('{ init: false }').then((result) => {
            console.log(result);
            res.end();
          });
        }
      });
    })
    .listen(8080); // the server object listens on port 8080
}

cat().then(createServer).catch((error) => {
  console.log(error);
});

