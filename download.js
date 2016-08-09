var https = require("https");
var url = require("url");
var path = require("path");
var fs = require('fs');

(function(listPath, inputDir, outputDir) {
  let DEBUG = true;
  let POOL_SIZE = 100;
  let httpAgent = null;

  function download(link) {
    let urlObj = url.parse(link);

    let options = {
      "hostname": urlObj.hostname,
      "path": urlObj.pathname,
      "agent": httpAgent
    };

    let targetFilename = path.resolve(
        outputDir,
        path.basename(path.dirname(urlObj.pathname)) +
        "-" +
        path.basename(urlObj.pathname)
    );

    if(DEBUG) {
      console.log("download", link);
    }

    return new Promise( (fulfill, reject) => {
      https.get(options, (res) => {
        let data = [];    // storing chunks of data
        res.setEncoding('binary');
        res.on(
          'data', (chunk) => { data.push(new Buffer(chunk, 'binary')); }
        ).on(
          'end', () => {
            fulfill({
              "content": Buffer.concat(data),
              "name": targetFilename
            } );
          }
        ).on(
          'error', (err) => {
            reject(link + err);
          }
        );
      });
    });  // end of "new Promise"
  }

  function saveFile(file) {
    if(DEBUG) {
      console.log("saveFile", file.name);
    }

    return new Promise(
      (fulfill, reject) => {
        fs.writeFile(
          file.name,
          file.content,
          (err, data) => {
            if(err) reject(err);
            fulfill();
          }
        );
      }
    );
  }

  function createDest(dest) {
    return new Promise(
      (fulfill, reject) => {
        fs.mkdir(
          dest,
          (err, data) => {
            fulfill();
          }
        )
      }
    );
  }

  function main() {
    let list = (require(listPath)).reduce(
      (acc, fname) => {
        return acc.concat(...(
          require(path.resolve(inputDir, fname))
        ));
      },
      []
    );

    return createDest(outputDir)
    .then(
      () => {
        return Promise.all(list.map(download));
      }
    ).then(
      (data) => {
        return Promise.all(data.map(saveFile));
      }
    ).then(
      () => {
        return Promise.resolve(list.length);
      }
    )
  }

  function setupAgent() {
    return new https.Agent({
      "keepAlive": true,
      "maxSockets": POOL_SIZE
    });
  }

  httpAgent = setupAgent();

  return main().then(
    (count) => {
      console.log(count + " files downloaded");
      return Promise.resolve();
    }
  ).catch(
    (err) => {
      console.log(err);
    }
  )
})("./list.json", "./json", "./dest");
