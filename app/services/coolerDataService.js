const utils = require('./utils');
const path = require('path');
const axios = require('axios').default;
const fs = require('fs');
const config = require('./coolerCacheConfig');

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
var _assetCategoryToDirectoryDictionary = undefined;

exports.getCoolerDataUrl = async function () {
    const screenName = await utils.readScreenNameFromHost();

    return `${_coolerPath}${screenName}`;
}

exports.saveAndPrependCoolerData = function (coolerData) {
    /*if (typeof window !== 'undefined') {
        window.coolerData = coolerData;
    } else {
        console.warn(`Window is not defined; Cannot create coolerData object on it`);
    }*/
    createDirectoriesForAssets();

    fs.writeFile(path.join(config.coolerCacheRootFolder, `coolerData.js`),
        'window.coolerData=' + JSON.stringify(coolerData),
        { flag: 'w+' },
        function (err) {
            if (err) {
                return console.error(`Error saving coolerData: ${err}`);
            }
            console.log(`coolerData file was saved under ${config.coolerCacheRootFolder}`);
        });
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

function getAssetCategoryToDirectoryAndBaseUrlDictionary() {
    if (_assetCategoryToDirectoryDictionary !== undefined) return _assetCategoryToDirectoryDictionary;
    _assetCategoryToDirectoryDictionary = {};

    _assetCategoryToDirectoryDictionary[_productsAssetKey] = [_storageLocalProductsImagesDir, _productsImagesUrl];
    _assetCategoryToDirectoryDictionary[_labelsAssetKey] = [_storageLocalLabelsImagesDir, _labelsImagesUrl];
    _assetCategoryToDirectoryDictionary[_tagsAssetKey] = [_storageLocalTagsImagesDir, _tagsImagesUrl];

    return _assetCategoryToDirectoryDictionary;
}

async function downloadAndSaveAssetsImpl(directoryToSaveTo, baseUrl, imageCollection) {
    for (const imageFilename of imageCollection) {
        const fileLastModifiedTime = utils.getFileLastModifiedTime(path.join(directoryToSaveTo, imageFilename));
        const fileUrl = `${baseUrl}${imageFilename}`;
        const getHeaders = {
            'If-Modified-Since': fileLastModifiedTime
        };
        try {
            // Download the file:
            const response = await axios.get(fileUrl, {
                headers: getHeaders,
                responseType: 'stream'
            });
            console.log(`Downloaded an image from: [${fileUrl}], will save it to: [${directoryToSaveTo}]`);
            // Save the file:
            const writeSteam = response.data.pipe(fs.createWriteStream(path.join(directoryToSaveTo, imageFilename)));
            writeSteam.on('error', function (err) {
                console.log(`Error saving image ${imageFilename} under ${directoryToSaveTo}.`
                    + ` Details: ${err}`);
            });
        }
        catch (error) {
            if (error && error.response) { // HTTP error
                if (error.response.status === 304) {
                    // Not an error:
                    console.log(`File at ${fileUrl} was not modified since last time, skipping.`);
                }
                else if (error.response.status === 404) {
                    console.error(`File not found: ${fileUrl}`);
                }
            }
            else {
                console.error(`Error getting and saving file from URL ${fileUrl}: ${err}`);
            }
        }
    }
}

function createDirectoriesForAssets() {
    /*fs.mkdir(_storageLocalCoolerRootDir, (err) => {
        console.error(`Error creating root dir for coolerCache under: ${_storageLocalCoolerRootDir}.`
            + ` Details: [${err}]`);
    });*/
    createDirSync(_storageLocalProductsImagesDir);
    createDirSync(_storageLocalLabelsImagesDir);
    createDirSync(_storageLocalTagsImagesDir);
    /*fs.mkdir(_storageLocalCoolerImagesDir, { recursive: true }, (err) => {
        console.error(`Error creating dir for saving files under ${_storageLocalCoolerImagesDir}: ${err}`)
    });*/
}

function createDirSync(dirPath) {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
        console.error(`Error creating dir for saving files under ${dirPath}: ${error}`)
    }
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
        console.error(`No Shelves data in coolerData file`);

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
        console.error('No products in coolerData file');

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