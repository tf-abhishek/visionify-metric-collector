'use strict';

const os = require('os')
const axios = require('axios').default
const logger = require('../helpers/logHelper')
const neidUrlBase = 'https://location-manager-api.azurewebsites.net/api/assets/GetData?hostname=';


const getNEID = async () => {
    let response;
    try {
        const neidUrl = `${neidUrlBase}${getHostname()}`;
        response = await axios.get(neidUrl);
        logger.debug(`request.get: [${neidUrl}]. response: [${JSON.stringify(response.data)}]`)

        if (!response.data || !response.data.data || !response.data.data.assets) {
            throw (`returned response is in incorrect format or does not contain expected data: ${response.data}`);
        }

        if (Array.isArray(response.data.data.assets) && response.data.data.assets.length === 0) {
            throw (`got empty results for NEID`);
        }

        if (response.data.data.assets.length > 1) {
            logger.warn(`returned data from NEID query had more than one result(s): ${response.data}. returning first`);
        }

        return response.data.data.assets[0].screen.trim() || 'NEID';

    } catch (err) {
        logger.error(`error getting NEID for device hostname ${getHostname()}: ${err}`, true);
        return 'NEID';
    }
}

const getHostname = () => os.hostname();


module.exports = {
    getNEID,
    getHostname
}