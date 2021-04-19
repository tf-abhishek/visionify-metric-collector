const path = require('path');
const unzipper = require('unzipper');
const fs = require('fs');
const fsAsync = fs.promises;
const config = require('./coolerCacheConfig');
const httpService = require('./httpService');
const logger = require('./logger');
const utils = require('./utils');

const _storageLocalSkinDir = path.join(config.coolerCacheAssetsFolder, 'skinBuilder');
const _skinBuilderFilename = 'skin.gzip';
const _skinCorruptSuffix = '.corrupt';
const _storageLocalSkinDecompressedDir = path.join(_storageLocalSkinDir, 'current');
const _skinCorruptFilename = `${_skinBuilderFilename}${_skinCorruptSuffix}`;
const _skinCorruptFilePath = path.join(_storageLocalSkinDir, _skinCorruptFilename);
const _skinCompressedFilePath = path.join(_storageLocalSkinDir, _skinBuilderFilename);
const _skinBuilderUrl = utils.trimUrlEnd(config.skinBuilderUrl) + `/${_skinBuilderFilename}`;

exports.downloadSkinIfUpdated = async function () {
    logger.info(`Getting skin builder file.`);
    createDirsIfneeded();
    let downloaded = await httpService.downloadAndSaveAsset(_skinBuilderUrl, _skinBuilderFilename, _storageLocalSkinDir, true);

    if (downloaded) {
        try {
            await decompress();
        } catch (error) {
            logger.error(`Could not decompress skin file at ${_skinBuilderUrl}. [${error}]. Will rename to ${_skinCorruptFilename}`, error);
            
            // If we couldn't decompress, archive is probably corrupt. First, delete the old corrupt file, if exists:
            // await safelyDeleteOldCorruptArchive();
            // Then, rename the downloaded skin archive file so next time CC will redownload it.
            await safelyRenameArchive();

            downloaded = false;
        }
    }

    return downloaded;
}

exports.getCurrentStylesJsonFile = async function() {
    // TODO: This should move to merchApp, this is temp for testing
    return await fsAsync.readFile(path.join(_storageLocalSkinDecompressedDir, 'styles.json'));
}

function createDirsIfneeded() {
    utils.createDirectoriesForAssetsSync(_storageLocalSkinDir, _storageLocalSkinDecompressedDir);
}

async function safelyDeleteOldCorruptArchive() {
    try {
        await fsAsync.unlink(_skinCorruptFilePath);
    } catch (unlinkError) {
        if(unlinkError && unlinkError.code == 'ENOENT') { 
            logger.info(`Nothing to delete at ${_skinCorruptFilePath}`);
        } else {
            logger.error(`Could not delete existing corrupt file at ${_skinCorruptFilePath}: [${unlinkError}].`, error);
        }
    }
}

async function safelyRenameArchive() {
    try {
        await fsAsync.rename(_skinCompressedFilePath, _skinCorruptFilePath);
    } catch (renameError) {
        logger.error(`Could not rename existing corrupt file from ${_skinCompressedFilePath} to ${_skinCorruptFilePath}: [${renameError}].`, true);
    }
}


async function safelyRenamePreviousSkinDir() {
    try {
        let timestamp = new Date().toISOString();
        await fsAsync.rename(_storageLocalSkinDecompressedDir, `${_storageLocalSkinDecompressedDir}_${timestamp}`);
    } catch (error) {
        if(error && error.code == 'ENOENT') { 
            logger.info(`Nothing to rename at ${_storageLocalSkinDecompressedDir}`);
        } else {
            logger.error(`Could not rename existing corrupt file from ${_skinCompressedFilePath} to ${_skinCorruptFilePath}: [${error}].`, true);
        }
    }
}

async function decompress() {
    // First, if we already have a skin directory, rename it:
    await safelyRenamePreviousSkinDir();
    // Then, compress into the "current" skin dir:
    await new Promise((resolve, reject) => {
        fs.createReadStream(_skinCompressedFilePath)
        .pipe(unzipper.Extract({ path: _storageLocalSkinDecompressedDir}).on('close', resolve).on('error', reject));
    });
}