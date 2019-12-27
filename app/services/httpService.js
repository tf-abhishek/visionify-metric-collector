const utils = require('./utils');
const logger = require('./logger');
const path = require('path');
const fs = require('fs');
const axios = require('axios').default;

exports.downloadAndSaveAssetsIfModifiedSince = async function(downloadUrl, assetFilename, directoryPathToSaveTo) {
    const assetFullPath = path.join(directoryPathToSaveTo, assetFilename);
    const fileLastModifiedTime = utils.getFileLastModifiedTime(assetFullPath);
    const getHeaders = {
        'If-Modified-Since': fileLastModifiedTime
    };
    try {
        // Download the file:
        const response = await axios.get(downloadUrl, {
            headers: getHeaders,
            responseType: 'stream'
        });
        logger.info(`Downloaded an asset from: [${downloadUrl}], will save it to: [${directoryPathToSaveTo}]`);
        // Save the file:
        const writeSteam = response.data.pipe(fs.createWriteStream(assetFullPath, { flags: 'w+' }));
        writeSteam.on('error', function (err) {
            logger.info(`Error saving image ${assetFilename} under ${directoryPathToSaveTo}.`
                + ` Details: ${err}`);
        });
    }
    catch (error) {
        if (error && error.response) { // HTTP error
            if (error.response.status === 304) {
                // Not an error:
                logger.info(`File at ${downloadUrl} was not modified since last time, skipping.`);
            }
            else if (error.response.status === 404) {
                logger.error(`File not found (404): ${downloadUrl}`);
            }
            else if (error.response.status === 403) {
                logger.error(`Authentication failed (403) for ${downloadUrl}: [${error.response.statusText}]`);
            }
            else {
                logger.error(`HTTP ${error.response.status} error when trying to 
                get ${downloadUrl}: [${error.response.statusText}]`);
            }
        }
        else {
            logger.error(`Error getting and saving file from URL ${downloadUrl}: ${err}`);
        }
    }
}