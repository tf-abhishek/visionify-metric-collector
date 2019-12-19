const utils = require('./utils');
const path = require('path');
const fs = require('fs');
const axios = require('axios').default;

exports.downloadAndSaveAssetsIfModifiedSince = async function(downloadUrl, assetFilename, directoryPathToSaveTo) {
    const fileLastModifiedTime = utils.getFileLastModifiedTime(path.join(directoryPathToSaveTo, assetFilename));
    const getHeaders = {
        'If-Modified-Since': fileLastModifiedTime
    };
    try {
        // Download the file:
        const response = await axios.get(downloadUrl, {
            headers: getHeaders,
            responseType: 'stream'
        });
        console.log(`Downloaded an asset from: [${downloadUrl}], will save it to: [${directoryPathToSaveTo}]`);
        // Save the file:
        const writeSteam = response.data.pipe(fs.createWriteStream(path.join(directoryPathToSaveTo, assetFilename)));
        writeSteam.on('error', function (err) {
            console.log(`Error saving image ${assetFilename} under ${directoryPathToSaveTo}.`
                + ` Details: ${err}`);
        });
    }
    catch (error) {
        if (error && error.response) { // HTTP error
            if (error.response.status === 304) {
                // Not an error:
                console.log(`File at ${downloadUrl} was not modified since last time, skipping.`);
            }
            else if (error.response.status === 404) {
                console.error(`File not found (404): ${downloadUrl}`);
            }
            else if (error.response.status === 403) {
                console.error(`Authentication failed (403) for ${downloadUrl}: [${error.response.statusText}]`);
            }
            else {
                console.error(`HTTP error when trying to get ${downloadUrl}: [${error.response.statusText}]`);
            }
        }
        else {
            console.error(`Error getting and saving file from URL ${downloadUrl}: ${err}`);
        }
    }
}