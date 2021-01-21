const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('./coolerCacheConfig');
const logger = require('./logger');
const sendMessageToModule = require('./iotClient')
//const screenNameFilePath = config.screenNEIDPath;
var _screenName = undefined;

/*exports.getScreenNameForDevice = async function () {
    // We used to expect this to be located on a filename, however we now use a REST call instead.
    const readStream = fs.createReadStream(screenNameFilePath);
    readLineIntefrace = readline.createInterface(readStream);

    for await (const line of readLineIntefrace) {
        _screenName = line;
    }

    return _screenName;
}*/

exports.getFileLastModifiedTime = function (fileFullPath) {
    let stats = undefined;
    try {
        stats = fs.statSync(fileFullPath);
    } catch (error) {
        return Date.MIN_VALUE;
    }

    return stats.mtime.toUTCString();
}

exports.doesFileExist = function(fileFullPath) {
    return fs.existsSync(fileFullPath);
}

exports.readTextFile = function(fileFullPath) {
    return fs.readFileSync(fileFullPath, 'utf8');
}

exports.writeNeidFile = function (neid) {
    createDirSync(config.coolerCacheRootFolder);
    fs.writeFileSync(path.join(config.coolerCacheRootFolder, 'neid'), neid, { encoding: 'utf8' });
}

// Throws if neid file does not exist:
exports.readNeidFileIfExists = function () {
    return fs.readFileSync(path.join(config.coolerCacheRootFolder, 'neid'), 'utf8');
}

exports.createDirectoriesForAssetsSync = function (...directories) {
    // console.log('+++++++++++++++++++++++++++++++++++++++++++-------------------------------++++++++++++++++++++++++')
    directories.forEach(directory => createDirSync(directory));
    // let createDirectoryPromises = []
    // for (let item of directories) {
    //     createDirectoryPromises.push(new Promise(resolve => {
    //         createDirSync(directory)
    //         resolve()
    //     }))
    // }

    // console.log('+++++++++++++++++++++++++++++++++++++++++++')

    // return Promise.all(createDirectoryPromises).then(data => {
    //     ///////////////////////////////////////////////////////////////////////////////////
    //     //send intermoduleCommunication....................................................
    //     console.log('syncing directory complete..............................')
    //     sendMessageToModule('downloadStatus', {
    //         downloadStatus: true
    //     })
    //     return data
    // })
}

exports.getFilesizeInBytes = function (filePathAndName) {
    var stats = fs.statSync(filePathAndName);
    var fileSizeInBytes = stats["size"];

    return fileSizeInBytes;
}

exports.isArray = function (arr) {
    return Array.isArray(arr);// && arr.length;
}

exports.isEmptyArray = function (arr) {
    return Array.isArray(arr) && arr.length === 0;
}

exports.isNonEmptyArray = function (arr) {
    return Array.isArray(arr) && arr.length && arr.length > 0;
}

exports.toDistinctDictionary = function (arr, keyFunc, valueFunc) {
    let results = {};
    const distinctArr = [...new Set(arr,)];

    /*var ocurred = {};
    const distinctArr = arr.filter(entry => {
        if (ocurred[keyFunc(entry)]) {
            return false;
        }
        ocurred[keyFunc(entry)] = true;

        return true;
    });*/

    distinctArr.forEach(element => {
        if (results[keyFunc(element)]) {
            logger.warn(`Element with key ${keyFunc(element)} already exists in the dictionary. This shouldn't happen in a distinct array.`);
        } else {
            results[keyFunc(element)] = valueFunc(element);
        }
    })

    return results;
}

exports.toDictionary = function (arr, keyFunc, valueFunc) {
    let results = {};

    arr.forEach(element => {
        if (results[keyFunc(element)]) {
            throw `Element with key ${keyFunc(element)} already exists in the dictionary.`;
        }

        results[keyFunc(element)] = valueFunc(element);
    })

    return results;
}

// Very simple, specific implementation to OUR case:
exports.toUnconfidentialUrl = function (url) {
    return url.split('?')[0];
}

function createDirSync(dirPath) {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
        logger.error(`Error creating dir for saving files under ${dirPath}: ${error}`)
    }
}
