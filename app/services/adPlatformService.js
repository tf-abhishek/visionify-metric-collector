const _adPlatformConfig = require('./coolerCacheConfig');
const utils = require('./utils');
const config = require('./coolerCacheConfig');
const httpService = require('./httpService');
const fileRecoveryUtils = require('./fileRecoveryUtils');
const logger = require('./logger');
const path = require('path');
const fs = require('fs');
const axios = require('axios').default;

const _storageLocalAdPlatformDataDir = _adPlatformConfig.coolerCacheRootFolder;
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
const _spotlightAdAssetTypeKey = 'SpotlightAd';
const _spotlightAdAssetTypeDirectory = 'SpotAd';
const _fullDoorAdDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _fullDoorAdAssetTypeKey);
const _middleBannerDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _middleBannerAssetTypeKey);
const _topBannerDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _topBannerAssetTypeKey);
const _nativeAdDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _nativeAdAssetTypeDirectory);
const _tagDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _tagAssetTypeDirectory);
const _labelDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _labelAssetTypeKDirectory);
const _spotlightAdDirectoryPath = path.join(config.storageLocalAdPlatformDataDir, _spotlightAdAssetTypeDirectory);
const _assetTypeToLocalDirectory = {
    [_fullDoorAdAssetTypeKey]: _fullDoorAdDirectoryPath,
    [_middleBannerAssetTypeKey]: _middleBannerDirectoryPath,
    [_topBannerAssetTypeKey]: _topBannerDirectoryPath,
    [_nativeAdAssetTypeKey]: _nativeAdDirectoryPath,
    [_tagAssetTypeKey]: _tagDirectoryPath,
    [_labelAssetTypeKey]: _labelDirectoryPath,
    [_spotlightAdAssetTypeKey]: _spotlightAdDirectoryPath
}
const _adPlatformNothingChanged = 'Not modified';

let _firstAdPlatformServiceRun = true;

exports.adPlatformNothingChanged = _adPlatformNothingChanged;

exports.downloadAndSaveAdPlatformAssets = async function (adPlatformData, forceDownload = true) {
    if (!adPlatformData || utils.isEmptyArray(adPlatformData)) {
        logger.info('Empty adPlatform data, nothing to download. Aborting.');
        return;
    }
    if (adPlatformData === _adPlatformNothingChanged) {
        logger.info('No changes in ad-platform data');
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
        const assetsToSave = utils.toDistinctDictionary(campaign.Assets.filter(asset => asset.SasLink && asset.FileName),
            asset => asset.FileName, asset => asset.SasLink);

        createDirectoriesForAssets();
        for (var assetFilename in assetsToSave) {
            if (assetsToSave.hasOwnProperty(assetFilename)) {
                const shouldRedownloadFile = fileRecoveryUtils.shouldRedownloadFile(dirToSaveTo, assetFilename);
                if (forceDownload || shouldRedownloadFile) {
                    const assetUrl = assetsToSave[assetFilename];
                    if (!forceDownload) {
                        logger.info(`Noticed an ad-platform asset that was not downloaded in previous cycle: ${assetFilename}, will download again`);
                    }
        
                    const shouldUseIfModifiedSince = !shouldRedownloadFile;
                    await httpService.downloadAndSaveAsset(assetUrl, assetFilename, dirToSaveTo, shouldUseIfModifiedSince);
                }
            }
        }
    };
}

exports.getAdPlatformData = async function (forceDownload = false) {
let adPlatformUrl;

    try {
        const adPlatformDataLastModified = utils.getFileLastModifiedTime(
            path.join(_storageLocalAdPlatformDataDir, _adPlatformDataFilename));
        const getHeaders = forceDownload ? {} : getAdPlatformRequestHeaders(adPlatformDataLastModified);
        adPlatformUrl = await buildAdPlatformGetUrl();
        
        const adPlatformDataResponse = await axios.get(adPlatformUrl, {
            headers: getHeaders,
        });
        let adPlatformData = adPlatformDataResponse.data;

        if (!utils.isArray(adPlatformData)) {
            // TODO: better handling
            logger.warn(`adPlatformData is not an array. Will fallback to read from disk. Contents: ${adPlatformData}`);
            adPlatformData = await readAdPlatformDataFromDisk();
        } else {
            saveAdPlatformJson(adPlatformData);
        }

        return adPlatformData;
    } catch (error) {
        if (error && error.response) { // HTTP error
            if (error.response.status === 304) {
                // Not an error:
                logger.info(`File at ${utils.toUnconfidentialUrl(adPlatformUrl)} was not modified compared to local copy, will not download.`);

                return _adPlatformNothingChanged;
            }
        } else {
            const stack = error.stack ? error.stack.split("\n") : '';
            logger.error(`Error getting AdPlatform data from ${adPlatformUrl}: ${error}. [${stack}]`);
        }
    }
}

exports.readAdPlatformDataFromDiskSync = function () {
    let fileFullPath = path.join(_storageLocalAdPlatformDataDir, _adPlatformDataFilename);

    return JSON.parse(utils.readTextFile(fileFullPath));
}

const readAdPlatformDataFromDisk = async function () {
    let fileFullPath = path.join(_storageLocalAdPlatformDataDir, _adPlatformDataFilename);
    fs.readFile(fileFullPath, 'utf8', (err, data) => {
        if (err) {
            logger.error(`Could not read file from ${fileFullPath}. Details:${err}`);
            return '';
        }

        return JSON.parse(data);
    });
}

const getAdPlatformRequestHeaders = function(adPlatformDataLastModified) {
    // Motive: Since we could have potentially switched doors, the "last modified time" for our
    // local ad-platform-data file might be related to a different door, and we do not want to
    // get an empty response based on that. Therfeore, after boot, we will always get adPlatformData.
    const adPlatformGetHeaders = _firstAdPlatformServiceRun ? { } : {
        'If-Modified-Since': adPlatformDataLastModified
    };

    _firstAdPlatformServiceRun = false;

    return adPlatformGetHeaders;
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
    const neid = await httpService.getNEID();

    return `${_adPlatformConfig.adPlatformBaseUrl}${neid}?code=${_adPlatformConfig.adPlatformFunctionCode}`;
}

function createDirectoriesForAssets() {    
    utils.createDirectoriesForAssetsSync(_fullDoorAdDirectoryPath, _middleBannerDirectoryPath,
        _topBannerDirectoryPath, _nativeAdDirectoryPath, _tagDirectoryPath, _spotlightAdDirectoryPath);
}