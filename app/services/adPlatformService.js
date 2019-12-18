const _adPlatformConfig = require('./coolerCacheConfig');
const utils = require('./utils');
const config = require('./coolerCacheConfig');
const path = require('path');
const fs = require('fs');
const axios = require('axios').default;

const _storageLocalAdPlatformDataDir = _adPlatformConfig.storageLocalAdPlatformDataDir;
const _adPlatformDataFilename = 'adPlatformData.json';
const _fullDoorAdAssetTypeKey = 'FullDoorAd';
const _middleBannerAssetTypeKey = 'MiddleBanner';
const _topBannerAssetTypeKey = 'TopBanner';
const _nativeAdAssetTypeKey = 'NativeAd';
const _tagAssetTypeKey = 'Tag';
const _fullDoorAdDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _fullDoorAdAssetTypeKey);
const _middleBannerDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _middleBannerAssetTypeKey);
const _topBannerDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _topBannerAssetTypeKey);
const _nativeAdDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _nativeAdAssetTypeKey);
const _tagDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _tagAssetTypeKey);
const _assetTypeToLocalDirectory = {
    [_fullDoorAdAssetTypeKey]: _fullDoorAdDirectoryPath,
    [_middleBannerAssetTypeKey]: _middleBannerDirectoryPath,
    [_topBannerAssetTypeKey]: _topBannerDirectoryPath,
    [_nativeAdAssetTypeKey]: _nativeAdDirectoryPath,
    [_tagAssetTypeKey]: _tagDirectoryPath,
}

exports.downloadAndSaveAdPlatformAssets = async function(adPlatformData) {
    adPlatformData.forEach(campaign => {
        if (!campaign) {
            console.warn(`An empty campaign encountered`);
            return;
        }
        if (!campaign.AdType) {
            console.error(`Cannot interpret adType for campaign ${JSON.stringify(campaign)}`);
            return;
        }
        if (!campaign.Assets) {
            console.warn(`Campaign has no assets: ${campaign}`);

        }

        const dirToSaveTo = _assetTypeToLocalDirectory[campaign.AdType]
        const assetsToSave = campaign.Assets.filter(asset => asset.SasLink && asset.FileName).map(asset => {
            return {[asset.FileName]:  asset.SasLink };
        });
        
        for (var assetFilename in assetsToSave) {
            if (assetsToSave.hasOwnProperty(assetFilename)) {
                const assetUrl = assetsToSave[assetFilename];

                await downloadAsset(assetUrl, assetFilename, dirToSaveTo);
            }
        }
    });
}

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

        if (!utils.isArray(adPlatformData)) {
            // TODO: better handling
            adPlatformData = await readAdPlatformDataFromDisk();
        }

        return adPlatformData;
    } catch (error) {
        console.error(`Error getting AdPlatform data: ${error}`;
    }
}

const downloadAsset = async function(downloadUrl, assetFilename, directoryPathToSaveTo) {
    const fileLastModifiedTime = utils.getFileLastModifiedTime(path.join(directoryPathToSaveTo, assetFilename));
        const getHeaders = {
            'If-Modified-Since': fileLastModifiedTime
        };
    const response = await axios.get(downloadUrl, {
        headers: getHeaders,
        responseType: 'stream'
    });
    console.log(`Downloaded an asset from: [${downloadUrl}], will save it to: [${directoryPathToSaveTo}]`);
    // Save the file:
    const writeSteam = response.data.pipe(fs.createWriteStream(path.join(directoryPathToSaveTo, assetFilename)));
    writeSteam.on('error', function (err) {
        console.log(`Error saving asset ${assetFilename} under ${directoryPathToSaveTo}.`
            + ` Details: ${err}`);
    });
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