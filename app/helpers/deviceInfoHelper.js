'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const logger = require('../services/logger')

const getNEID = async () => {
    // First I want to read the file
    return new Promise((resolve, reject) => {
      var content
      fs.readFile(
        path.normalize('/home/csiadmin/coolerCache/neid'),
        function read(err, data) {
          if (err) {
            logger.info(err)
            reject(err)
          }
          if (data) {
            content = data.toString()
            resolve(content)
          } else {
            logger.info('no content found in file')
          }
        }
      )
    })
}

const getHostname = () => os.hostname()

const getDeviceDetails = async () => {
  const [neid, hostname] = await Promise.all([device.getNEID(), device.getHostname()]);
  global.defaultMetadata = { 
      ...global.defaultMetadata,
      neid, hostname, 
  };
  logger.info(`setting NEID: [${neid}] and hostname: [${hostname}]`);
  return  [neid, hostname]
}

module.exports = {
    getNEID,
    getHostname,
    getDeviceDetails,
};