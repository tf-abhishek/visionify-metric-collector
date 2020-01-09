const io = require("socket.io");
const path = require('path');
const config = require('./coolerCacheConfig');
const logger = require('./logger');
const utils = require('./utils');
const listeningPort = process.env.merchappsocketport || config.merchAppListenPort;
const coolerDataUpdatedKey = 'coolerDataUpdated';
const coolerDataFileFullPath = path.join(config.coolerCacheRootFolder, `coolerData.json`);
let _server;
let _socket;
let _coolerData = '';
let _coolerDataAsked = false;

exports.listeningPort = listeningPort;

exports.initialize = function() {
    _server = io.listen(listeningPort);
    logger.info('Listening on port ' + listeningPort);

    logger.info('Listening on port ' + listeningPort);
    _server.on("connection", (socket) => {
        logger.info(`Client connected [id=${socket.id}]`);
        // Current assumption: merchApp is the only valid client.
        _socket = socket;
        socket.on('coolerDataUpdated', () => {
            logger.info(`Received a 'coolerDataUpdated' from merchApp. Will send my latest coolerData.`);
            _coolerDataAsked = true;
            const coolerDataToSend = _coolerData ? _coolerData : utils.readTextFile(coolerDataFileFullPath);
            _server.emit(coolerDataUpdatedKey, coolerDataToSend);
        });

        /*if (_coolerData) {
            logger.info('It looks like coolerData was ready before connection was established. Sending coolerData to merchApp now.');
            socket.emit(coolerDataUpdatedKey, _coolerData);
            _coolerData = '';
        } else {
            logger.info('It looks like coolerData is empty. ######## Will send what I have on file');//Will send coolerData to merchApp when it is updated.');
            let coolerDataToSend;
            try {
                coolerDataToSend = utils.readTextFile(coolerDataFileFullPath);
            } catch (error) {
                logger.warn(`coolerData files was not found on disk, will not send it to merchApp. `);
            }
            _server.emit(coolerDataUpdatedKey, { dogName: 'Walter'});
        }*/
        socket.on("disconnect", () => {
            _coolerDataAsked = false;
            _socket = undefined;
            logger.info(`Client gone [id=${socket.id}]`);
        });
    });
}

exports.io = function() {
    return _server;
}

/*exports.merchAppIsReady = function() {

}*/

exports.sendMerchAppCoolerDataUpdate = function(coolerData) {
    if (_socket) { //&& _coolerDataAsked)
        logger.info(`############## Sending merchApp a coolerData update`);
        _server.emit(coolerDataUpdatedKey, coolerData);
    } else {
        _coolerData = coolerData;
        logger.warn('Socket was not yet established when trying to send merchApp a coolerData update.'
            + ' Will send a coolerData update when connection is established from merchApp.');
    }
}