const _adPlatformConfig = require('./coolerCacheConfig');
const utils = require('./utils');
const path = require('path');
const fs = require('fs');
const axios = require('axios').default;

const _storageLocalAdPlatformDataDir = _adPlatformConfig.storageLocalAdPlatformDataDir;
const _adPlatformDataFilename = 'adPlatformData.json';

exports.getAdPlatformData = async function () {
    const adPlatformDataLastModified = utils.getFileLastModifiedTime(
        path.join(_storageLocalAdPlatformDataDir, _adPlatformDataFilename));
    const getHeaders = {
        'If-Modified-Since': adPlatformDataLastModified
    };
    let adPlatformUrl = await buildAdPlatformGetUrl();

    try {
        const adPlatformDataResponse = await axios.get(adPlatformUrl, {
            headers: getHeaders,
        });
        const adPlatformData = adPlatformDataResponse.data;

        if (!Array.isArray(adPlatformData || !adPlatformData.length)) {
            // TODO: better handling
            adPlatformData = await readAdPlatformDataFromDisk();
        }

        return adPlatformData;
    } catch (error) {
        const abc = error;
    }
}

const buildAdPlatformGetUrl = async function () {
    const screenName = await utils.readScreenNameFromHost();

    return `${_adPlatformConfig.adPlatformBaseUrlDev}${screenName}?code=${_adPlatformConfig.adPlatformFunctionCodeDev}`;
}

const readAdPlatformDataFromDisk = async function () {
    let fileFullPath = path.join(_storageLocalAdPlatformDataDir, _adPlatformDataFilename);
    fs.readFile(fileFullPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Could not read file from ${fileFullPath}. Details:${err}`);
            return;
        }

        return JSON.parse(data);
    });
}