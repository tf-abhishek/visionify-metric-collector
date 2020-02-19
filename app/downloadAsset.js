const logger = require('./services/logger');
const config = require('./services/coolerCacheConfig');
const coolerDataService = require('./services/coolerDataService');
const merchAppSocket = require('./services/merchAppSocket');
const getAdPlatformIntervalInMs = config.intervalForAdPlatformDownloadMs;
const getCoolerDataIntervalInMs = config.intervalForCoolerDataDownloadMs;
const socketListenerInterval = 3 * 1000;    // base time: 3 seconds
const socketInitRetryThreshold = 10;        // If we failed for 10 times, do not retry anymore
const Transport = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const Message = require('azure-iot-device').Message;
const adPlatformService = require('./services/adPlatformService');
var socketFailuresCounter = 0;

Date.MIN_VALUE = new Date(-8640000000000000);
Array.prototype.extend = function (other_array) {
    if (!utils.isArray(other_array)) return;
    other_array.forEach(function (v) { this.push(v) }, this);
}


// IOT HUB MESSANGE BROKER
//initializeListenerToMerchApp();
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
    //sendTelemetryTestMessage(client);
    adPlatformService.getAdPlatformData().then(
        (data) => {
            /*try {
                sendPOP(client);
            } catch (error) {
                logger.error(`Error sending POP: ${error}`);
            }*/
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

                await adPlatformService.downloadAndSaveAdPlatformAssets(adPlatformData, false);
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

const getCoolerData = async function () {
    try {
        let coolerData = await coolerDataService.getCoolerData();

        if (coolerDataService.wasCoolerDataUpdated(coolerData)) {
            logger.info(`coolerData was updated, will download assets and then send the file over to merchApp.`);
            await coolerDataService.downloadAndSaveAssetsIfNeeded(coolerData);
            logger.info('Downloaded all coolerData assets');

            //merchAppSocket.sendMerchAppCoolerDataUpdate(coolerData);
            coolerDataService.saveCoolerDataToDisk(coolerData);
        } else {
            logger.info('Got coolerData, however it was not modified since last time, so will only ensure all files exist');
            await coolerDataService.downloadAndSaveAssetsIfNeeded(coolerData, false);
            // To trigger merchApp refresh:
            //merchAppSocket.sendMerchAppCoolerDataUpdate(coolerData);
            coolerDataService.saveCoolerDataToDisk(coolerData);
        }

    } catch (error) {
        const stack = error.stack ? error.stack.split("\n") : '';
        logger.error(`Error in outter loop of getCoolerData: ${error}, [${stack}]. Will keep calling next interval.`)
    }

    setTimeout(async () => {
        await getCoolerData();
    }, getCoolerDataIntervalInMs);
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