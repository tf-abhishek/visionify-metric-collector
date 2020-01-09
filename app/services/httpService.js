const utils = require('./utils');
const logger = require('./logger');
const config = require('./coolerCacheConfig');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios').default;
let _neid = '';

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

        // TODO: if error - put in a "poison" list to retry later/whenever.
        // TODO: When finished, compare filesize to the content-length header to verify image is complete
    }
    catch (error) {
        if (error && error.response) { // HTTP error
            if (error.response.status === 304) {
                // Not an error:
                //logger.info(`File at ${downloadUrl} was not modified since last time, skipping.`);
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

exports.getNEID = async function() {
    if (!_neid) {
        _neid = await getNeidFromLocationApi();
        // For subsequent dockers initializations, write to file as a fallback for API calls issues
        utils.writeNeidFile(_neid);
    }

    return _neid;
}

async function getNeidFromLocationApi(){
    let response;
    try {
        let neidUrl = `${config.NeidQueryAddress}${os.hostname()}`;
        logger.info(`Getting NEID for device from: ${neidUrl}`);
        response = await axios.get(neidUrl);
    } catch (error) {
        logger.warn(`Error getting NEID for device ${os.hostname()}: [${error}]. Will try to read from file, if exists`);

        return utils.readNeidFileIfExists();
    }

    if (!response.data || !response.data.data || !response.data.data.assets){
        throw new Error(`Error getting NEID for device ${os.hostname()}, returned response is in incorrect
        format or does not contain expected data: [${response.data}]`);
    }

    if (utils.isEmptyArray(response.data.data.assets)) {
        throw new Error(`Got empty results for NEID for device ${os.hostname()}`);
    }

    if (response.data.data.assets.length > 1) {
        logger.warning(`Returned data from NEID query had more than one results: [${response.data}]. Returning first`);
    }

    const neid = 'WBA-15196-000-C001'; //'WBA-13827-000-C016'//response.data.data.assets[0].neid;
    logger.info(`Got NEID for the device: ${neid}.`); //Whole response: [${JSON.stringify(response.data)}]. hostname: ${os.hostname()}`);

    return neid;
}