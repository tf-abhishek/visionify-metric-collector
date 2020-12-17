const fs = require('fs');
const logger = require('./services/logger');
const config = require('./services/coolerCacheConfig');
const coolerDataService = require('./services/coolerDataService');
const httpService = require('./services/httpService');
const merchAppSocket = require('./services/merchAppSocket');
const nutritionDataService = require('./services/nutritionDataService');
const getAdPlatformIntervalInMs = config.intervalForAdPlatformDownloadMs;
const getCoolerDataIntervalInMs = config.intervalForCoolerDataDownloadMs;
const socketListenerInterval = 3 * 1000;    // base time: 3 seconds
const socketInitRetryThreshold = 100;        // If we failed for 100 times, do not retry anymore
const Transport = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const Message = require('azure-iot-device').Message;
const adPlatformService = require('./services/adPlatformService');
var socketFailuresCounter = 0;
var prevCoolerData = '';

Date.MIN_VALUE = new Date(-8640000000000000);
Array.prototype.extend = function (other_array) {
  if (!utils.isArray(other_array)) return;
  other_array.forEach(function (v) {
    this.push(v);
  }, this);
};

initializeListenerToMerchApp();
// IOT HUB MESSANGE BROKER
Client.fromEnvironment(Transport, function (err, client) {
    if (err) {
        throw err;
    } else {
        client.on('error', function (err) {
            throw err;
        });

        // connect to the Edge instance
        client.open(function (err) {
            if (err) {
                throw err;
            } else {
                console.log('IoT Hub module client initialized, going to get coolerData');
                
                getCoolerData().then((data) => console.log('Got cooler data, saved it and all!'));
                // Send trigger bridge some stuff:
                handleAdPlatform(client);

                client.on('inputMessage', function (inputName, msg) {
                    console.log(`Entered inputMessage`);
                    logger.info(`Entered inputMessage`);
                    
                    if (inputName == "refreshCoolerData"){
                        console.log(`Entered refreshCoolerData`);
                        getCoolerData(true).then((data) => console.log('Got cooler data, saved it and all!'));
                        console.log('Direct Method is called to update CoolerData.json file');
                    }

                    if (inputName == "refreshNEID"){
                        console.log(`Entered refreshNEID`);
                        const _neid = httpService.getNEID(true);
                        console.log(`Direct Method is called to update NEID: ${_neid}`);
                    }
                });
            }
        });
    }
});

function initializeListenerToMerchApp() {
    try {
        merchAppSocket.initialize();
    } catch (error) {
        socketFailuresCounter++;
        logger.warn(`Failed to open a socket for merchApp communication on port ${merchAppSocket.listeningPort}`);
        if (socketFailuresCounter < socketInitRetryThreshold) {
            logger.info('Retrying to initialize listener socket for merchApp.');
            setInterval(() => {
                initializeListenerToMerchApp();
            }, socketListenerInterval * socketFailuresCounter);
        } else {
            // TODO: A metric to fire; this is of very high importance.
            logger.error(`Fatal error; Could not initiate socket listener on port ${merchAppSocket.listeningPort}
            for ${socketInitRetryThreshold} times. Will not be able to update merchApp with coolerData changes.`)
        }
    }
}

function handleAdPlatform(client) {
    logger.info('Requesting Ad-Platform data');
    
    adPlatformService.getAdPlatformData().then(
        (data) => {
            if (data !== adPlatformService.adPlatformNothingChanged) {
                logger.info('Got a response from Ad-Platform. Will download and then send playlist to triggerBridge');
                adPlatformService.downloadAndSaveAdPlatformAssets(data).then(
                    (emptyData) => {
                        client.sendOutputEvent(
                            'playListData',
                            new Message(JSON.stringify(data)),
                            printResultFor('Sent TriggerBridge assets'));
                            logger.info(`Sent AdPlatform JSON to TriggerBridge`);
                    });
            } else {
                logger.info('Looks like adPlatformData did not change since last time. Will just verify assets are in-place and complete.');
                const adPlatformData = adPlatformService.readAdPlatformDataFromDiskSync();

                adPlatformService.downloadAndSaveAdPlatformAssets(adPlatformData, false);
            }
            
            // In any case, schedule another call to Ad-Platform:
            setTimeout(() => {
                handleAdPlatform(client);
            }, getAdPlatformIntervalInMs);
        }, (err) => {
            logger.error(`Error getting Ad-Platform data: ${err}. Will keep looping.`);

            setTimeout(() => {
                handleAdPlatform(client);
            }, getAdPlatformIntervalInMs);
        });
}

// Helper function to print results in the console
function printResultFor(op) {
    return function printResult(err, res) {
        if (err) {
            console.error(op + ' error: ' + err.toString());
        }
        if (res) {
            console.log(op + ' status: ' + res.constructor.name);
        }
    };
}

// IOT HUB MESSANGE BROKER

const sendCoolerDataToMerchApp = function(coolerData) {
    if (JSON.stringify(coolerData) != JSON.stringify(prevCoolerData)) {
        console.log(`Will send updated cooler data to merchapp`);//: \n${JSON.stringify(coolerData)}\n\n`);
        merchAppSocket.sendMerchAppCoolerDataUpdate(coolerData);

        prevCoolerData = coolerData;
    } else {
        console.log('New coolerData seems to be identical to previous one.');
    }
}

const getCoolerData = async function (isOnDemandCall = false) {
    try {
        let coolerData = await coolerDataService.getCoolerData();

        if (coolerDataService.wasCoolerDataUpdated(coolerData)) {
            logger.info(`coolerData was updated, will download assets and then send the file over to merchApp.`);
            await coolerDataService.downloadAndSaveAssetsIfNeeded(coolerData);
            logger.info('Downloaded all coolerData assets');
            
            // Get nutrition data for each product
            nutritionDataService.getNutritionData(coolerData);
          
            //merchAppSocket.sendMerchAppCoolerDataUpdate(coolerData);
            coolerDataService.saveCoolerDataToDisk(coolerData);
            sendCoolerDataToMerchApp(coolerData);
        } else {
            if (!nutritionDataService.nutritionDataExists()) {
                logger.info('Nutrition data file not present. Downloading now.')
                nutritionDataService.getNutritionData(coolerData);
            } else {
                logger.info('Nutrition data file present. No download needed');
            }
            
            logger.info('Got coolerData, however it was not modified since last time, so will only ensure all files exist');
            const downloaded = await coolerDataService.downloadAndSaveAssetsIfNeeded(coolerData, false);
            // To trigger merchApp refresh:
            if (downloaded) {
                //merchAppSocket.sendMerchAppCoolerDataUpdate(coolerData);
                coolerDataService.saveCoolerDataToDisk(coolerData);
                sendCoolerDataToMerchApp(coolerData);
            }
        }

    } catch (error) {
        const stack = error.stack ? error.stack.split("\n") : '';
        logger.error(`Error in outter loop of getCoolerData: ${error}, [${stack}]. Will keep calling next interval.`)
    }

    if(!isOnDemandCall)
    {
        setTimeout(async () => {
            await getCoolerData();
        }, getCoolerDataIntervalInMs);
    }
}


//sendDataToTriggerBridge({sendOutpu--tEvent: function(...abc) {console.log(abc)}});
//getCoolerData().then((data) => console.log('Finished!'));
//adPlatformService.getAdPlatformData().then((data)=> adPlatformService.downloadAndSaveAdPlatformAssets(data).then((d) => console.log('That took awhile...')));
//getAdPlatformData().then((data) => { console.log('final result: ' + data) });*/

process.on('uncaughtException', err => {
    // TODO: Send telemetry of that exception
    console.error(err);
    process.exit(1);
  });
