const utils = require('./utils');
const path = require('path');
const axios = require('axios').default;
const fs = require('fs');
const config = require('./coolerCacheConfig');

const _coolerPath = `https://planogram-editor-api.azurewebsites.net/screens/`
const _storageLocalCoolerImagesDir = path.join(config.coolerCacheRootFolder, 'products');
const _imagePath = `https://coolerassets.blob.core.windows.net/planogram-images-haw/`

exports.handleImagesDownload = async function (coolerData) {
    // Just in case the dir is not there yet - create it so we won't face problems saving downloaded files.
    createDirForAssets();

    const allImages = getAllFilenames(coolerData);
    for (const productImageFilename of allImages) {
        const fileLastModifiedTime = utils.getFileLastModifiedTime(path.join(_storageLocalCoolerImagesDir, productImageFilename));
        const fileUrl = `${_imagePath}${productImageFilename}`;
        const getHeaders = {
            'If-Modified-Since': fileLastModifiedTime //new Date(Date.now()).toUTCString()
        };
        try {
            // Download the file:
            const response = await axios.get(fileUrl, {
                headers: getHeaders,
                responseType: 'stream'
            });
            console.log(`Downloaded an image from: [${fileUrl}], will save it to: [${_storageLocalCoolerImagesDir}]`);
            // Save the file:
            const writeSteam = response.data.pipe(fs.createWriteStream(path.join(_storageLocalCoolerImagesDir, productImageFilename)));
            writeSteam.on('error', function (err) {
                console.log(`Error saving image ${productImageFilename} under ${_storageLocalCoolerImagesDir}.`
                    + ` Details: ${err}`);
            });
        }
        catch (error) {
            if (error && error.response) {  // HTTP error
                if (error.response.status === 304) {
                    // Not an error:
                    console.log(`File at ${fileUrl} was not modified since last time, skipping.`);
                } else if (error.response.status === 404) {
                    console.error(`File not found: ${fileUrl}`);
                }
            }
            else {
                console.error(`Error getting and saving file from URL ${fileUrl}: ${err}`);
            }
        }
    }
}

exports.getCoolerDataUrl = async function () {
    const screenName = await utils.readScreenNameFromHost();

    return `${_coolerPath}${screenName}`;
}

exports.saveAndPrependCoolerData = function(coolerData) {
    if (typeof window !== 'undefined') {
        window.coolerData = coolerData;
    } else {
        console.warn(`Window is not defined; Cannot create coolerData object on it`);
    }

    fs.writeFile(path.join(config.coolerCacheRootFolderDebug, `coolerData.json`), JSON.stringify(coolerData), function (err) {
        if (err) {
            return console.error(`Error saving coolerData: ${err}`);
        }
        console.log(`coolerData file was saved under ${config.coolerCacheRootFolderDebug}`);
    });
}

function createDirForAssets() {
    fs.mkdir(_storageLocalCoolerImagesDir, (err) => {
        console.error(`Error creating dir for saving files under ${_storageLocalCoolerImagesDir}`)
    });
}

function getAllFilenames(coolerData) {
    return getAllProductImagesComponentFilenames(coolerData)
        .concat(getShelvesComponentFilenames(coolerData));
}

function getAllProductImagesComponentFilenames(coolerData) {
    return coolerData.data.allProductImages;
}

function getShelvesComponentFilenames(coolerData) {
    if (!(coolerData.data && coolerData.data.metadata && coolerData.data.metadata.shelves)) {
        console.error(`No Shelves data in coolerData file`);

        return;
    }

    return coolerData.data.metadata.shelves.map(shelf => {
        if (!shelf.slots) return undefined;
        return shelf.slots.map(slot => slot.imageName);
    }).filter(arr => arr !== undefined)
        .reduce((arr1, arr2) => arr1.concat(arr2), []);
}