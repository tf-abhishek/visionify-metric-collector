const utils = require('./utils');
const logger = require('./logger');
const config = require('./coolerCacheConfig');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios').default;
const retry = require('async-retry')
const fileSizeSuffix = 'size';
let _neid = '';

const { metrics } = require('../helpers/helpers');

const actionCounter = metrics().counter({
    name: 'action__counter',
    help: 'counter metric',
    labelNames: ['action_type'],
});

exports.downloadAndSaveAsset = async function (downloadUrl, assetFilename, directoryPathToSaveTo, onlyIfModifiedSince = true) {
    let downloaded = false;
    await retry(async bail => {
        actionCounter.inc({
            action_type: 'asset_requests'
        });
        downloaded = await downloadAssetInternal(downloadUrl, assetFilename, directoryPathToSaveTo, onlyIfModifiedSince) || downloaded;
    }, {
        minTimeout: 10000,
        retries: 10,
        onRetry: (err) => {
            logger.warn(`Will retry error [${err}]`)
            actionCounter.inc({
                action_type: 'asset_requests_retry'
            });
        }
    });

    return downloaded;
}

const downloadAssetInternal = async function(downloadUrl, assetFilename, directoryPathToSaveTo, onlyIfModifiedSince) {
    const assetFullPath = path.join(directoryPathToSaveTo, assetFilename);
    const assetFileSizeFullPath = path.join(directoryPathToSaveTo, `${assetFilename}.${fileSizeSuffix}`);
    const fileLastModifiedTime = utils.getFileLastModifiedTime(assetFullPath);
    const getHeaders = !onlyIfModifiedSince ? { } : {
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
        await new Promise((resolve, reject) => {
            const writeSteam = response.data.pipe(fs.createWriteStream(assetFullPath, { flags: 'w+' }));
            writeSteam.on('finish', resolve);
            writeSteam.on('error', function (err) {
                logger.info(`Error saving image ${assetFilename} under ${directoryPathToSaveTo}.`
                    + ` Details: ${err}`);

                reject(err);
            });
        });

        const contentLength = response.headers['content-length'];
        const filesize = utils.getFilesizeInBytes(assetFullPath);
        if (!contentLength) {
            logger.warn(`No content length received for ${utils.toUnconfidentialUrl(downloadUrl)}. Cannot verify completeness.`);
        } else if (`${filesize}` !== contentLength) {
            throw new Error(`Content length [${contentLength}] and filesize [${filesize}] are different. Will retry download.`);
        } else {
            logger.info(`Successfully verified saved file under ${assetFullPath}.`);
            logger.info(`#Downloaded and saved ${filesize} bytes.`);
        }

        if (contentLength) {
            logger.info(`Create .size file ${assetFileSizeFullPath}. Size: ${contentLength} bytes.`);
            fs.writeFileSync(assetFileSizeFullPath, contentLength);
        }

        return true;
        // TODO: if error - put in a "poison" list to retry later/whenever.
    }
    catch (error) {
        actionCounter.inc({
            action_type: 'asset_requests_failed'
        });
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
            fs.unlink(assetFullPath, err => {
                if (err) {
                    logger.warn(`Could not unlink erratic file from download-url [${downloadUrl}]. Details: [${err}]`);
                }
            });
            
            throw error;
        }

        return false;
    }
}

exports.getNEID = async function(updateNEID = false) {
    if (!_neid || updateNEID) {
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
        actionCounter.inc({
            action_type: 'location_manager_requests'
        });
    } catch (error) {
        logger.warn(`Error getting NEID for device ${os.hostname()}: [${error}]. Will try to read from file, if exists`);
        actionCounter.inc({
            action_type: 'location_manager_requests_failed'
        });
        return utils.readNeidFileIfExists(); 
    }

    if (!response.data || !response.data.data || !response.data.data.assets){
        actionCounter.inc({
            action_type: 'location_manager_requests_fail_state'
        });
        throw new Error(`Error getting NEID for device ${os.hostname()}, returned response is in incorrect
        format or does not contain expected data: [${response.data}]`);
    }

    if (utils.isEmptyArray(response.data.data.assets)) {
        actionCounter.inc({
            action_type: 'location_manager_requests_fail_state'
        });
        throw new Error(`Got empty results for NEID for device ${os.hostname()}`);
    }

    if (response.data.data.assets.length > 1) {
        logger.warn(`Returned data from NEID query had more than one results: [${response.data}]. Returning first`);
    }

    const neid = response.data.data.assets[0].screen;
    logger.info(`Got NEID for the device: ${neid}.`); //Whole response: [${JSON.stringify(response.data)}]. hostname: ${os.hostname()}`);

    return neid;
}