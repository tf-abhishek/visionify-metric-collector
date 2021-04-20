const logger = require('./services/logger');
const config = require('./services/coolerCacheConfig');
const coolerDataService = require('./services/coolerDataService');
const merchAppSocket = require('./services/merchAppSocket');
const skinBuilderService = require('./services/skinBuilderService');
const getAdPlatformIntervalInMs = config.intervalForAdPlatformDownloadMs;
const getCoolerDataIntervalInMs = config.intervalForCoolerDataDownloadMs;
const skinUpdateInterval = config.intervalForSkinDownload;
const socketListenerInterval = 3 * 1000;    // base time: 3 seconds
const socketInitRetryThreshold = 100;        // If we failed for 100 times, do not retry anymore
const Transport = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const Message = require('azure-iot-device').Message;
const adPlatformService = require('./services/adPlatformService');
var socketFailuresCounter = 0;
var prevCoolerData = '';

const _config = require('./config.json')
const { device, api } = require('./helpers')
const { app } = api

Date.MIN_VALUE = new Date(-8640000000000000);
Array.prototype.extend = function (other_array) {
    if (!utils.isArray(other_array)) return;
    other_array.forEach(function (v) { this.push(v) }, this);
}

async function init() {
    await device.getDeviceDetails();
    logger.info('Starting metrics endpoint in GET /metrics');
    app.listen(_config.api.port);
}

function initializeEdgeHubClient() {
    // IOT HUB MESSANGE BROKER
    return new Promise((resolve, reject) => {
        Client.fromEnvironment(Transport, function (err, client) {
            if (err) {
                reject(err);
            } else {
                client.on('error', function (err) {
                    reject(err);
                });

                // connect to the Edge instance
                client.open(function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('IoT Hub module client initialized, going to get coolerData');

                        getCoolerData().then((data) => console.log('Got cooler data, saved it and all!'));
                        // Send trigger bridge some stuff:                
                        handleAdPlatform(client);

                        handleSkinBuilder();
                        resolve();
                    }
                });
            }
        });
    });
}

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
            for ${socketInitRetryThreshold} times. Will not be able to update merchApp with coolerData changes.`, true)
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


async function handleSkinBuilder() {
    try {
        const newSkin = await skinBuilderService.downloadSkinIfUpdated();
    
        if (newSkin) {
            merchAppSocket.sendMerchAppSkinUpdate();
        } else {
            logger.info('No new skin to update');
        }
    } catch (error) {
        logger.error(`An error occurred when trying to check for/get a Skin update: [${error}]`, true);
    }
    
    setTimeout(async () => {
        await handleSkinBuilder();
    }, skinUpdateInterval);
}

const sendCoolerDataToMerchApp = function(coolerData) {
    if (JSON.stringify(coolerData) != JSON.stringify(prevCoolerData)) {
        console.log(`Will send updated cooler data to merchapp`);//: \n${JSON.stringify(coolerData)}\n\n`);
        merchAppSocket.sendMerchAppCoolerDataUpdate(coolerData);

        prevCoolerData = coolerData;
    } else {
        console.log('New coolerData seems to be identical to previous one.');
    }
}

const getCoolerData = async function () {
    try {
        let coolerData = await coolerDataService.getCoolerData();

        if (coolerDataService.wasCoolerDataUpdated(coolerData)) {
            logger.info(`coolerData was updated, will download assets and then send the file over to merchApp.`);
            await coolerDataService.downloadAndSaveAssetsIfNeeded(coolerData);
            logger.info('Downloaded all coolerData assets');

            //merchAppSocket.sendMerchAppCoolerDataUpdate(coolerData);
            coolerDataService.saveCoolerDataToDisk(coolerData);
            sendCoolerDataToMerchApp(coolerData);
        } else {
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
        logger.error(`Error in outter loop of getCoolerData: ${error}, [${stack}]. Will keep calling next interval.`, true)
    }

    setTimeout(async () => {
        await getCoolerData();
    }, getCoolerDataIntervalInMs);
}

//getCoolerData().then((data) => console.log('Finished!'));
//adPlatformService.getAdPlatformData().then((data)=> adPlatformService.downloadAndSaveAdPlatformAssets(data).then((d) => console.log('That took awhile...')));
//handleSkinBuilder().then((a) => console.log('Finished skin stuff'));

process.on('uncaughtException', err => {
    // TODO: Send telemetry of that exception
    console.error(err);
    process.exit(1);
});

(async () => {
    initializeListenerToMerchApp();
    await initializeEdgeHubClient();
    await init();
})();