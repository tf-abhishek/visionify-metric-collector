const utils = require('./utils');
const logger = require('./logger');
const path = require('path');
const fs = require('fs');

exports.shouldRedownloadFile = function(directoryToSaveTo, assetFileName) {
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
        logger.warn(`Could not get expected asset size for file [${filePath}]. Will treat it as a partial/non-existing file and redownload.`);
        
        return '0';
    }
}