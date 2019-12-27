const _adPlatformConfig = require('./coolerCacheConfig');
const utils = require('./utils');
const config = require('./coolerCacheConfig');
const httpService = require('./httpService');
const logger = require('./logger');
const path = require('path');
const fs = require('fs');
const axios = require('axios').default;

const _storageLocalAdPlatformDataDir = _adPlatformConfig.storageLocalAdPlatformDataDir;
const _adPlatformDataFilename = 'adPlatformData.json';
const _fullDoorAdAssetTypeKey = 'FullDoorAd';
const _middleBannerAssetTypeKey = 'MiddleBanner';
const _topBannerAssetTypeKey = 'TopBanner';
const _nativeAdAssetTypeKey = 'NativeAd';
const _nativeAdAssetTypeDirectory = 'products';
const _tagAssetTypeKey = 'Tag';
const _tagAssetTypeDirectory = 'tags';
const _labelAssetTypeKey = 'Label';
const _labelAssetTypeKDirectory = 'labels';
const _fullDoorAdDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _fullDoorAdAssetTypeKey);
const _middleBannerDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _middleBannerAssetTypeKey);
const _topBannerDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _topBannerAssetTypeKey);
const _nativeAdDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _nativeAdAssetTypeDirectory);
const _tagDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _tagAssetTypeDirectory);
const _labelDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _labelAssetTypeKDirectory);
const _assetTypeToLocalDirectory = {
    [_fullDoorAdAssetTypeKey]: _fullDoorAdDirectoryPath,
    [_middleBannerAssetTypeKey]: _middleBannerDirectoryPath,
    [_topBannerAssetTypeKey]: _topBannerDirectoryPath,
    [_nativeAdAssetTypeKey]: _nativeAdDirectoryPath,
    [_tagAssetTypeKey]: _tagDirectoryPath,
    [_labelAssetTypeKey]: _labelDirectoryPath,
}

exports.downloadAndSaveAdPlatformAssets = async function (adPlatformData) {
    if (!adPlatformData) {
        logger.error('Empty adPlatform data, cannot process. Aborting.');
        return;
    }
    for (const campaign of adPlatformData) {
        if (!campaign) {
            logger.warn(`An empty campaign encountered`);
            return;
        }
        if (!campaign.AdType) {
            logger.error(`Cannot interpret adType for campaign ${JSON.stringify(campaign)}`);
            return;
        }
        if (!campaign.Assets) {
            logger.warn(`Campaign has no assets: ${campaign}`);

        }

        const dirToSaveTo = _assetTypeToLocalDirectory[campaign.AdType]
        if (!dirToSaveTo) {
            logger.error(`Error: Unfamiliar AdType encountered: ${campaign.AdType}. Skipping.`);
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
        } else {
            saveAdPlatformJson(adPlatformData);
        }

        return adPlatformData;
    } catch (error) {
        logger.error(`Error getting AdPlatform data: ${error}`);
    }
}

const saveAdPlatformJson = function(adPlatformData) {
    let fileFullPath = path.join(_storageLocalAdPlatformDataDir, _adPlatformDataFilename);
    utils.createDirectoriesForAssetsSync(_storageLocalAdPlatformDataDir);
    fs.writeFile(fileFullPath,
        JSON.stringify(adPlatformData),
        { flag: 'w+' },
        function (err) {
            if (err) {
                return logger.error(`Error saving adPlatformData: ${err}`);
            }
            logger.info(`adPlatformData file was saved under ${fileFullPath}`);
        });
}

const buildAdPlatformGetUrl = async function () {
    const screenName = await utils.readScreenNameFromHost();

    return `${_adPlatformConfig.adPlatformBaseUrl}${screenName}?code=${_adPlatformConfig.adPlatformFunctionCode}`;
}

const readAdPlatformDataFromDisk = async function () {
    let fileFullPath = path.join(_storageLocalAdPlatformDataDir, _adPlatformDataFilename);
    fs.readFile(fileFullPath, 'utf8', (err, data) => {
        if (err) {
            logger.error(`Could not read file from ${fileFullPath}. Details:${err}`);
            return;
        }

        return JSON.parse(data);
    });
}

function createDirectoriesForAssets() {    
    utils.createDirectoriesForAssetsSync(_fullDoorAdDirectoryPath, _middleBannerDirectoryPath,
        _topBannerDirectoryPath, _nativeAdDirectoryPath, _tagDirectoryPath);
}