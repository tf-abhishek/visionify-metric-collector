const path = require('path');
const config = require('./coolerCacheConfig');
const httpService = require('./httpService');
const logger = require('./logger');
const utils = require('./utils');

const _storageLocalSkinDir = path.join(config.coolerCacheAssetsFolder, 'skinBuilder');
const _skinBuilderFilename = 'skin.gzip';

const _skinBuilderBaseUrl = utils.trimUrlEnd(config.skinBuilderUrl) + `/${_skinBuilderFilename}`;

exports.downloadSkinIfUpdated = async function () {
    logger.info(`Getting skin builder file.`);
    const downloaded = await httpService.downloadAndSaveAsset(_skinBuilderBaseUrl, _skinBuilderFilename, _storageLocalSkinDir, true);

    return downloaded;
}
