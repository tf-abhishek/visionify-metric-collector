'use strict';

const zlib = require('zlib');
const logger = require('./logHelper')

// encode the buffer in base 64. UTF8 will not work.

const compress = (dataToCompress) => {
    return new Promise((resolve) => {
        zlib.brotliCompress(dataToCompress, {
            params: {
                [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
            }
        }, (err, compressedData) => {
            if (err) {
                logger.error(`error while compressing data: [${dataToCompress}]. hence returning uncompressed data`);
                resolve(dataToCompress);
            } else {
                logger.debug(`data: [${dataToCompress}] compressed successfully`);
                resolve(compressedData);
            }
        })
    })
}

module.exports = {compress}