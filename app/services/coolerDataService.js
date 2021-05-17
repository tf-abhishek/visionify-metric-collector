const utils = require('./utils');
const fileRecoveryUtils = require('./fileRecoveryUtils');
const path = require('path');
const axios = require('axios').default;
const fs = require('fs');
const config = require('./coolerCacheConfig');
const httpService = require('./httpService');
const logger = require('./logger');
const retry = require('async-retry');

const _coolerPath = config.planogramurl;
const _tagsImagesUrl = `https://coolerassets.blob.core.windows.net/planogram-images-tags/`;
const _labelsImagesUrl = `https://coolerassets.blob.core.windows.net/planogram-images-labels/`;
const _imageFileExtension = 'png';
const _productsAssetKey = 'products';
const _labelsAssetKey = 'labels';
const _tagsAssetKey = 'tags';
const _storageLocalProductsImagesDir = path.join(config.coolerCacheAssetsFolder, _productsAssetKey);
const _storageLocalTagsImagesDir = path.join(config.coolerCacheAssetsFolder, _tagsAssetKey);
const _storageLocalLabelsImagesDir = path.join(config.coolerCacheAssetsFolder, _labelsAssetKey);
const coolerDataFileFullPath = path.join(config.coolerCacheRootFolder, `coolerData.json`);  // Outside assets folder!
const retailerToProductsUrlMap = {
    'WBA': 'https://coolerassets.blob.core.windows.net/planogram-images-haw/',
    'LCL': 'https://coolerassets.blob.core.windows.net/planogram-images-map/',
    'GGO': 'https://coolerassets.blob.core.windows.net/planogram-images-gg/',
    'KRO': 'https://coolerassets.blob.core.windows.net/planogram-images-kro/',
    'WMT': 'https://coolerassets.blob.core.windows.net/planogram-images-wmt/',
    'CSD': 'https://coolerassets.blob.core.windows.net/planogram-images-csd/'
};
const retailerToCoolerDataUrlMap = {
    'WBA': _coolerPath,
    'GGO': _coolerPath,
    'KRO': _coolerPath,
    'WMT': _coolerPath,
    'CSD': _coolerPath,
    'LCL': 'https://planogram-editor-pilot-api-qa.azurewebsites.net/screens/'
}
const retailerToCoolerDataUrlSuffixMap = {
    'WBA': '',
    'GGO': '',
    'KRO': '',
    'WMT': '',
    'CSD': '',
    'LCL': '/planomap'
}
var _assetCategoryToDirectoryDictionary = undefined;
var _neid;

exports.getCoolerData = async function () {
    let coolerDataResponse;

    await retry(async bail => {
        logger.info(`Getting coolerData.`);
        coolerDataResponse = await axios.get(await getCoolerDataUrl());
    }, {
            retries: 5,
            onRetry: (err) => logger.warn(`Will retry error [${err}]`)
        });

    return coolerDataResponse ? coolerDataResponse.data : '';
}

exports.saveCoolerDataToDisk = function (coolerData) {
    createDirectoriesForAssets();

    try {
        fs.writeFileSync(coolerDataFileFullPath,
            JSON.stringify(coolerData),
            { flag: 'w+' });
        logger.info(`coolerData file was saved under ${config.coolerCacheRootFolder}`);
    } catch (error) {
        logger.error(`Error saving coolerData: ${error}`);
    }

    /*fs.writeFile(coolerDataFileFullPath,
        /*coolerDataWindowPrependPrefix + *//*JSON.stringify(coolerData),
{ flag: 'w+' },
function (err) {
if (err) {
    return logger.error(`Error saving coolerData: ${err}`);
}
logger.info(`coolerData file was saved under ${config.coolerCacheRootFolder}`);
});*/
}

exports.wasCoolerDataUpdated = function (currentCoolerData) {
    let previousCoolerData;
    try {
        previousCoolerData = utils.readTextFile(coolerDataFileFullPath);
    } catch (error) {
        logger.warn(`Could not read previous coolerData file from: ${coolerDataFileFullPath},
        reason: [${error}]. Will therefore refer to it as the first time and return a positive result.`);

        return true;
    }

    //return previousCoolerData.toLocaleLowerCase() === (coolerDataWindowPrependPrefix + currentCoolerData).toLocaleLowerCase;
    return previousCoolerData.toLocaleLowerCase() !== JSON.stringify(currentCoolerData).toLocaleLowerCase();
}

exports.downloadAndSaveAssetsIfNeeded = async function (coolerData, forceDownloadAnyway = true) {
    // Just in case the dir is not there yet - create it so we won't face problems saving downloaded files.
    createDirectoriesForAssets();

    const allImagesDictionary = getAllDirsToFilenamesDictionary(coolerData);
    const assetCategoryToDirectoryAndBaseUrlDictionary = await getAssetCategoryToDirectoryAndBaseUrlDictionary(coolerData);

    let downloaded = false;
    for (var assetCategory in allImagesDictionary) {
        // check if the property/key is defined in the object itself, not in parent
        if (allImagesDictionary.hasOwnProperty(assetCategory)) {
            const imageCollection = allImagesDictionary[assetCategory];
            const assetDirectoryPath = assetCategoryToDirectoryAndBaseUrlDictionary[assetCategory][0];
            const assetBaseUrl = assetCategoryToDirectoryAndBaseUrlDictionary[assetCategory][1];

            downloaded = await downloadAndSaveAssetsImpl(assetDirectoryPath, assetBaseUrl, imageCollection, forceDownloadAnyway) || downloaded;
        }
    }

    return downloaded;
}

async function getNeid() {
    if (!_neid) {
        _neid = await httpService.getNEID();
    }

    return _neid;
}

exports.setNeid = async function (updatedNeid) {
    if (updatedNeid) {
        _neid = updatedNeid;
    }
}

async function getAssetCategoryToDirectoryAndBaseUrlDictionary(coolerData) {
    if (_assetCategoryToDirectoryDictionary !== undefined) return _assetCategoryToDirectoryDictionary;
    _assetCategoryToDirectoryDictionary = {};

    const productImagesUrl = await getProductImagesUrl(coolerData);
    _assetCategoryToDirectoryDictionary[_productsAssetKey] = [_storageLocalProductsImagesDir, productImagesUrl];
    _assetCategoryToDirectoryDictionary[_labelsAssetKey] = [_storageLocalLabelsImagesDir, _labelsImagesUrl];
    _assetCategoryToDirectoryDictionary[_tagsAssetKey] = [_storageLocalTagsImagesDir, _tagsImagesUrl];

    return _assetCategoryToDirectoryDictionary;
}

async function getProductImagesUrl(coolerData) {
    const neid = await getNeid();
    const upcEnabled = utils.getAdaptableTagsEnabled(coolerData);

    if (upcEnabled)  {
        logger.info(`Using UPC image store: ${config.universalPlangramImageStorageUrl}`);
        return config.universalPlangramImageStorageUrl;
    }
    else {
        const url = getFromDictionary(neid, retailerToProductsUrlMap, "product assets");
        logger.info(`Using retailer image store: ${config.universalPlangramImageStorageUrl}`);
        return url;
    }
}

async function getCoolerDataUrl() {
    const neid = await getNeid();

    const coolerDataUrl = getFromDictionary(neid, retailerToCoolerDataUrlMap, "coolerData");
    const coolerDataUrlSuffix = getFromDictionary(neid, retailerToCoolerDataUrlSuffixMap, "coolerData");

    return `${coolerDataUrl}${neid}${coolerDataUrlSuffix}`;
}

function getFromDictionary(neid, dictionary, queryTarget) {
    let retailer = neid.split('-')[0];

    if (!(retailer in dictionary)) {
        logger.error(`Could not derive retailer from NEID ${neid} in order to query ${queryTarget}. Will default to ${config.defaultStore}`);
        retailer = config.defaultStore;
    }

    //logger.info(`Cooler Data will be retrieved for retailer: ${retailer}.`)
    return dictionary[retailer];
}

async function downloadAndSaveAssetsImpl(directoryToSaveTo, baseUrl, imageCollection, forceDownloadAnyway) {
    let downloaded = false;
    if (!directoryToSaveTo || !baseUrl) {
        logger.error(`Cannot download asset since either the directory to save to or the base Url is empty;
         baseUrl: [${baseUrl}], directoryToSaveTo: [${directoryToSaveTo}]`);
        return false;
    }
    for (const imageFilename of imageCollection) {
        const shouldRedownloadFile = fileRecoveryUtils.shouldRedownloadFile(directoryToSaveTo, imageFilename);
        if (forceDownloadAnyway || shouldRedownloadFile) {
            const fileUrl = `${baseUrl}${imageFilename}`;
            if (!forceDownloadAnyway) {
                logger.info(`Noticed a file that was not fully downloaded in previous cycle: ${imageFilename}, will download again`);
            }

            const shouldUseIfModifiedSince = !shouldRedownloadFile;
            downloaded = await httpService.downloadAndSaveAsset(fileUrl, imageFilename, directoryToSaveTo, shouldUseIfModifiedSince) || downloaded;
        } else {
            //logger.info(`Asset`)
        }
    }

    return downloaded;
}
/*
function shouldRedownloadFile(directoryToSaveTo, assetFileName) {
    const assetFullPath = path.join(directoryToSaveTo, assetFileName);
    
    return !fs.existsSync(assetFullPath) || isFilePartial(assetFullPath);
}

function isFilePartial(assetFullPath) {
    const fileRealSize = utils.getFilesizeInBytes(assetFullPath);
    const fileExpectedSize = getFileExpectedSize(`${assetFullPath}.size`);
    
    return `${fileRealSize}` !== fileExpectedSize
}

function getFileExpectedSize(filePath) {
    try {
        const fileExpectedSize = fs.readFileSync(filePath);
        
        return fileExpectedSize.toString('utf-8');
    } catch (error) {
        logger.warn(`Could not get expected asset size for file [${filePath}]. Will treat it as a partial file and redownload.`);
        
        return '0';
    }
}*/

function createDirectoriesForAssets() {
    utils.createDirectoriesForAssetsSync(_storageLocalProductsImagesDir,
        _storageLocalLabelsImagesDir, _storageLocalTagsImagesDir);
}

function getAllDirsToFilenamesDictionary(coolerData) {
    let results = {};

    results[_productsAssetKey] = getAllProductImagesFilenames(coolerData);
    const labelsAndTagsFilenamesDictionary = getLabelsAndTagsComponentFilenamesDictionary(coolerData);
    results[_tagsAssetKey] = labelsAndTagsFilenamesDictionary[_tagsAssetKey];
    results[_labelsAssetKey] = labelsAndTagsFilenamesDictionary[_labelsAssetKey];

    return results;
}

// We use "trim" on all the filenames since at least once there was an occurance where a tag had trailing
// spaces at the end of the filename, which led to a 404 error of a file that would otherwise have existed.
function getAllProductImagesFilenames(coolerData) {
    return Array.from(new Set(getAllProductImagesComponentFilenames(coolerData)
        .concat(getShelvesComponentFilenames(coolerData))));
}

function getAllProductImagesComponentFilenames(coolerData) {
    return coolerData.allProductImages.map(imageFilename => imageFilename.trim());
}

function getShelvesComponentFilenames(coolerData) {
    if (!(coolerData.metadata && coolerData.metadata.shelves)) {
        logger.error(`No Shelves data in coolerData file`);

        return;
    }

    return coolerData.metadata.shelves.map(shelf => {
        if (!shelf.slots) return undefined;
        return shelf.slots.map(slot => slot.imageName.trim());
    }).filter(arr => arr !== undefined)
        .reduce((arr1, arr2) => arr1.concat(arr2), []);
}

function getLabelsAndTagsComponentFilenamesDictionary(coolerData) {
    if (!(coolerData && coolerData.products)) {
        logger.error('No products in coolerData file');

        return;
    }
    let results = {};
    let tags = new Set();
    let labels = new Set();

    coolerData.products.forEach(product => {
        if (utils.isNonEmptyArray(product.labels)) {
            product.labels.map(label =>
                `${label.trim()}.${_imageFileExtension}`).forEach(labels.add, labels);
        }
        if (product.tag) {
            tags.add(`${product.tag.trim()}.${_imageFileExtension}`);
        }
    })

    results[_labelsAssetKey] = Array.from(labels);
    results[_tagsAssetKey] = Array.from(tags);

    return results;
}
