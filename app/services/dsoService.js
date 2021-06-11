const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const logger = require('./logger');
const hash = require('object-hash');
const { isEmpty } = require('lodash');
const config = require('./coolerCacheConfig');

const dsoFilePath = config.dsoFilePath
const coolerDataFileFullPath = path.join(config.coolerCacheRootFolder, 'coolerData.json');

// check and read dso schedule from coolerData.json file
const getDsoScheduleFromCoolerData = () => {
    try {
        const coolerData = JSON.parse(utils.readTextFile(coolerDataFileFullPath))
        if (!coolerData?.store?.time || isEmpty(coolerData?.store?.time)) {
            logger.warn('dso schedule not found in coolerData.json')
            return false
        }
        return coolerData?.store?.time
    } catch (error) {
        logger.error(`error at [dsoService.getDsoScheduleFromCoolerData]: ${error}`)
    }
}

// save dso schedule to dso config file
const saveDsoSchedule = (dsoConfig, dsoScheduleFromCoolerData) => {
    try {
        dsoConfig['time'] = dsoScheduleFromCoolerData;
        dsoConfig['schedule_updated_at'] = new Date().getTime();

        fs.writeFileSync(dsoFilePath,
            JSON.stringify(dsoConfig),
            { flag: 'w+' });
        logger.info(`dso schedule has been updated. it's saved at ${dsoFilePath}`);
        logger.info(`updated dso schedule: ${JSON.stringify(dsoConfig)}`)
    } catch (error) {
        logger.error(`error at [dsoService.saveDsoSchedule]: ${error}`);
    }
};

// validate dso config file exists and read the schedule
const readDsoConfigFile = () => {
    try {
        if (!utils.doesFileExist(dsoFilePath)) {
            logger.warn(`dso config file not found at ${dsoFilePath}`)
            return [false]
        }
        const dsoConfig = JSON.parse(utils.readTextFile(dsoFilePath))
        const currentDsoSchedule = dsoConfig?.time || {}
        const scheduleUpdatedAt = dsoConfig?.schedule_updated_at || ''
        return [dsoConfig, currentDsoSchedule, scheduleUpdatedAt]
    } catch (error) {
        logger.error(`error at [dsoService.readDsoConfigFile]: ${error}`)
    }
}


exports.handleDso = () => {
    const dsoScheduleFromCoolerData = getDsoScheduleFromCoolerData()
    const [dsoConfig, currentDsoSchedule, scheduleUpdatedAt] = readDsoConfigFile();

    if (!dsoScheduleFromCoolerData || !dsoConfig) {
        return logger.info('aborting saving / updating dso schedule')
    }

    if (hash(currentDsoSchedule) === hash(dsoScheduleFromCoolerData)) {
        return logger.info(`dso schedule hasn't been updated since epoch: ${scheduleUpdatedAt}`)
    }

    saveDsoSchedule(dsoConfig, dsoScheduleFromCoolerData)
}