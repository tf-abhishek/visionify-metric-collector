const _adPlatformConfig = require('./coolerCacheConfig');
const utils = require('./utils');
const config = require('./coolerCacheConfig');
const httpService = require('./httpService');
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

exports.downloadAndSaveAdPlatformAssets = async function (adPlatformData) {
    for (const campaign of adPlatformData) {
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
        if (!dirToSaveTo) {
            console.error(`Unfamiliar AdType encountered: ${campaign.AdType}. Skipping.`);
            return;
        }
        const assetsToSave = utils.toDictionary(campaign.Assets.filter(asset => asset.SasLink && asset.FileName),
            asset => asset.FileName, asset => asset.SasLink);

        createDirectoriesForAssets();
        for (var assetFilename in assetsToSave) {
            if (assetsToSave.hasOwnProperty(assetFilename)) {
                const assetUrl = assetsToSave[assetFilename];

                await  httpService.downloadAndSaveAssetsIfModifiedSince(assetUrl, assetFilename, dirToSaveTo);
            }
        }
    };
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
        console.error(`Error getting AdPlatform data: ${error}`);
    }
}

const buildAdPlatformGetUrl = async function () {
    const screenName = await utils.readScreenNameFromHost();

    return `${_adPlatformConfig.adPlatformBaseUrl}${screenName}?code=${_adPlatformConfig.adPlatformFunctionCode}`;
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

function createDirectoriesForAssets() {    
    utils.createDirectoriesForAssetsSync(_fullDoorAdDirectoryPath, _middleBannerDirectoryPath,
        _topBannerDirectoryPath, _nativeAdDirectoryPath, _tagDirectoryPath);
}