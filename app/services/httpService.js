const utils = require('./utils');
const logger = require('./logger');
const config = require('./coolerCacheConfig');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios').default;
const retry = require('async-retry')
let _neid = '';

exports.downloadAndSaveAssetsIfModifiedSince = async function (downloadUrl, assetFilename, directoryPathToSaveTo) {
    await retry(async bail => {
        await downloadIfModifiedSinceInternal(downloadUrl, assetFilename, directoryPathToSaveTo);
    }, {
        retries: 5,
        onRetry: (err) => logger.warn(`Will retry error [${err}]`)
    })
}

const downloadIfModifiedSinceInternal = async function(downloadUrl, assetFilename, directoryPathToSaveTo) {
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
        await new Promise(resolve => {
            const writeSteam = response.data.pipe(fs.createWriteStream(assetFullPath, { flags: 'w+' }));
            writeSteam.on('finish', resolve);
            writeSteam.on('error', function (err) {
                logger.info(`Error saving image ${assetFilename} under ${directoryPathToSaveTo}.`
                    + ` Details: ${err}`);
            });
        });

        const contentLength = response.headers['content-length'];
        const filesize = utils.getFilesizeInBytes(assetFullPath)
        if (!contentLength) {
            logger.warn(`No content length received for ${utils.toUnconfidentialUrl(downloadUrl)}. Cannot verify completeness.`);
        } else if (`${filesize}` !== contentLength) {
            throw new Error(`Content length [${contentLength}] and filesize [${filesize}] are different. Will retry download.`);
        } else {
            logger.info(`Successfully verified saved file under ${assetFullPath}.`);
            logger.info(`#Downloaded and saved ${filesize} bytes.`);
        }
        // TODO: if error - put in a "poison" list to retry later/whenever.
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
                throw error;
            }
        }
        else {
            if (error.message.startsWith('Content length')) {
                throw error;
            }
            if (error.code && error.code === 'ETIMEDOUT') {
                logger.warn(`Got a network issue while downloading ${downloadUrl}: ${error}.`);
                throw error;
                // TODO: Handle broken download
            }
            logger.error(`Error getting and saving file from URL ${downloadUrl}: ${error}`);
            fs.unlink(assetFullPath);
            
            throw error;
        }
    }
}

exports.getNEID = async function() {
    if (!_neid) {
        try {
            _neid = await getNeidFromLocationApi();
            
            utils.writeNeidFile(_neid);
        } catch (error) {
            _neid = utils.readNeidFileIfExists();
        }
        // For subsequent dockers initializations, write to file as a fallback for API calls issues
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
        logger.warn(`Returned data from NEID query had more than one results: [${response.data}]. Returning first`);
    }

    const neid = response.data.data.assets[0].screen;
    logger.info(`Got NEID for the device: ${neid}.`); //Whole response: [${JSON.stringify(response.data)}]. hostname: ${os.hostname()}`);

    return neid;
}