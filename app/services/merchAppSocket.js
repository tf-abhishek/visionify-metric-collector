const io = require("socket.io");
const path = require('path');
const config = require('./coolerCacheConfig');
const logger = require('./logger');
const utils = require('./utils');
const { metrics } = require('../helpers/helpers');

const actionCounter = metrics().counter({
  name: 'action__counter_nutrition_data',
  help: 'counter metric',
  labelNames: ['action_type'],
});
const listeningPort = process.env.merchappsocketport || config.merchAppListenPort;
const coolerDataUpdatedKey = 'coolerDataUpdated';
const coolerDataFileFullPath = path.join(config.coolerCacheRootFolder, `coolerData.json`);
const nutritionDataFileFullPath = path.join(config.coolerCacheRootFolder, `nutritionData.json`);
let _server;
let _socket;
let _coolerData = '';
let _coolerDataAsked = false;
let _nutritionData = null;
const nutritionDataKey = 'nutritionData';

exports.listeningPort = listeningPort;

exports.initialize = function () {
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
    
    socket.on('nutritionData', () => {
      logger.info(`Received a 'nutritionData' from merchApp. Will send last nutritionData'`);
      const nutritionDataToSend = _nutritionData || utils.readTextFile(nutritionDataFileFullPath);
      _server.emit(nutritionDataKey, nutritionDataToSend);
      actionCounter.inc({
        action_type: 'nutrition_record_returned'
      }); 
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
};

exports.io = function () {
  return _server;
};

exports.sendMerchAppNutritionData = function (nutritionData) {
  if (_socket) {
    logger.info(`Sending merchApp nutrition data`);
    _server.emit(nutritionDataKey, nutritionData);
  } else {
    _nutritionData = nutritionData;
    logger.warn('Socket was not yet established when trying to send merchApp nutritionData.'
      + ' Will send when connection is established from merchApp');
  }
};

exports.sendMerchAppCoolerDataUpdate = function (coolerData) {
  if (_socket) { //&& _coolerDataAsked)
    logger.info(`Sending merchApp a coolerData update`);
    _server.emit(coolerDataUpdatedKey, coolerData);
  } else {
    _coolerData = coolerData;
    logger.warn('Socket was not yet established when trying to send merchApp a coolerData update.'
      + ' Will send a coolerData update when connection is established from merchApp.');
  }
};
