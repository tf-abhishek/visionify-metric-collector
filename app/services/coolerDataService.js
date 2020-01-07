const utils = require('./utils');
const path = require('path');
const axios = require('axios').default;
const fs = require('fs');
const config = require('./coolerCacheConfig');
const httpService = require('./httpService');
const logger = require('./logger');

const _coolerPath = `https://planogram-editor-api.azurewebsites.net/screens/`
const _productsImagesUrl = `https://coolerassets.blob.core.windows.net/planogram-images-haw/`
const _tagsImagesUrl = `https://coolerassets.blob.core.windows.net/planogram-images-tags/`
const _labelsImagesUrl = `https://coolerassets.blob.core.windows.net/planogram-images-labels/`
const _imageFileExtension = 'png';
const _productsAssetKey = 'products';
const _labelsAssetKey = 'labels';
const _tagsAssetKey = 'tags';
const _storageLocalCoolerCacheRootDir = config.coolerCacheRootFolder;
const _storageLocalProductsImagesDir = path.join(config.coolerCacheRootFolder, _productsAssetKey);
const _storageLocalTagsImagesDir = path.join(config.coolerCacheRootFolder, _tagsAssetKey);
const _storageLocalLabelsImagesDir = path.join(config.coolerCacheRootFolder, _labelsAssetKey);
const coolerDataFileFullPath = path.join(config.coolerCacheRootFolder, `coolerData.js`);
const coolerDataWindowPrependPrefix = 'window.coolerData=';
var _assetCategoryToDirectoryDictionary = undefined;

exports.getCoolerData = async function () {
    logger.info(`Getting coolerData.`);
    const coolerDataResponse = await axios.get(await getCoolerDataUrl());

    return coolerDataResponse.data;
}

exports.saveCoolerDataToDisk = function (coolerData) {
    createDirectoriesForAssets();

    // We don't prepend anymore
    fs.writeFile(coolerDataFileFullPath,
        /*coolerDataWindowPrependPrefix + */JSON.stringify(coolerData),
        { flag: 'w+' },
        function (err) {
            if (err) {
                return logger.error(`Error saving coolerData: ${err}`);
            }
            logger.info(`coolerData file was saved under ${config.coolerCacheRootFolder}`);
        });
}

exports.wasCoolerDataUpdated = function(currentCoolerData) {
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

exports.downloadAndSaveAssets = async function (coolerData) {
    // Just in case the dir is not there yet - create it so we won't face problems saving downloaded files.
    createDirectoriesForAssets();

    const allImagesDictionary = getAllDirsToFilenamesDictionary(coolerData);
    const assetCategoryToDirectoryAndBaseUrlDictionary = getAssetCategoryToDirectoryAndBaseUrlDictionary();
    
    for (var assetCategory in allImagesDictionary) {
        // check if the property/key is defined in the object itself, not in parent
        if (allImagesDictionary.hasOwnProperty(assetCategory)) {
            const imageCollection = allImagesDictionary[assetCategory];
            const assetDirectoryPath = assetCategoryToDirectoryAndBaseUrlDictionary[assetCategory][0];
            const assetBaseUrl = assetCategoryToDirectoryAndBaseUrlDictionary[assetCategory][1];

            await downloadAndSaveAssetsImpl(assetDirectoryPath, assetBaseUrl, imageCollection);
        }
    }
}

const getCoolerDataUrl = async function () {
    const neid = await httpService.getNEID();

    return `${_coolerPath}${neid}`;
}

function getAssetCategoryToDirectoryAndBaseUrlDictionary() {
    if (_assetCategoryToDirectoryDictionary !== undefined) return _assetCategoryToDirectoryDictionary;
    _assetCategoryToDirectoryDictionary = {};

    _assetCategoryToDirectoryDictionary[_productsAssetKey] = [_storageLocalProductsImagesDir, _productsImagesUrl];
    _assetCategoryToDirectoryDictionary[_labelsAssetKey] = [_storageLocalLabelsImagesDir, _labelsImagesUrl];
    _assetCategoryToDirectoryDictionary[_tagsAssetKey] = [_storageLocalTagsImagesDir, _tagsImagesUrl];

    return _assetCategoryToDirectoryDictionary;
}

async function downloadAndSaveAssetsImpl(directoryToSaveTo, baseUrl, imageCollection) {
    if (!directoryToSaveTo || !baseUrl) {
        logger.error(`Cannot download asset since either the directory to save to or the base Url is empty;
         baseUrl: [${baseUrl}], directoryToSaveTo: [${directoryToSaveTo}]`);
        return;
    }
    for (const imageFilename of imageCollection) {
        const fileUrl = `${baseUrl}${imageFilename}`;

        await httpService.downloadAndSaveAssetsIfModifiedSince(fileUrl, imageFilename, directoryToSaveTo);
    }
}

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