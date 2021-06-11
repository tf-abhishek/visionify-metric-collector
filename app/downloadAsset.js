const fs = require('fs');
const logger = require('./helpers/logHelper');
const config = require('./services/coolerCacheConfig');
const coolerDataService = require('./services/coolerDataService');
const httpService = require('./services/httpService');
const merchAppSocket = require('./services/merchAppSocket');
const { setClient, sendMessageToModule } = require('./services/iotClient')
const nutritionDataService = require('./services/nutritionDataService');
const dsoService = require('./services/dsoService');
const skinBuilderService = require('./services/skinBuilderService');
const getAdPlatformIntervalInMs = config.intervalForAdPlatformDownloadMs;
const getCoolerDataIntervalInMs = config.intervalForCoolerDataDownloadMs;
const skinUpdateInterval = config.intervalForSkinDownload;
const socketListenerInterval = 3 * 1000;    // base time: 3 seconds
const socketInitRetryThreshold = 100;        // If we failed for 100 times, do not retry anymore
const enableDso = process.env.enableDso || false; // set in the deployment manifest. truthy value will write dso to file
const Transport = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const Message = require('azure-iot-device').Message;
const adPlatformService = require('./services/adPlatformService');
var socketFailuresCounter = 0;
var prevCoolerData = '';

logger.info(`should dso be set? --> ${enableDso}`)

const _config = require('./config.json')
const { device, api } = require('./helpers')
const { app } = api
const { metrics } = require('./helpers/helpers');

const actionCounter = metrics().counter({
    name: 'action__counter_ad_platform',
    help: 'counter metric',
    labelNames: ['action_type'],
});

Date.MIN_VALUE = new Date(-8640000000000000);
Array.prototype.extend = function (other_array) {
    if (!utils.isArray(other_array)) return;
    other_array.forEach(function (v) {
        this.push(v);
    }, this);
};

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
                setClient(client)
                console.log('IoT Hub module client initialized, going to get coolerData');

                getCoolerData().then((data) => {
                    console.log('Got cooler data, saved it and all!')
                    console.log('sending downloadStatus message now.....................')
                    sendMessageToModule('downloadStatus', {
                        downloadStatus: true
                    })
                });
                // Send trigger bridge some stuff:                
                handleAdPlatform(client);

                client.on('inputMessage', function (inputName, msg) {
                    console.log(`Entered inputMessage`);
                    logger.info(`Entered inputMessage`);

                    if (inputName == "refreshCoolerData") {
                        console.log(`Entered refreshCoolerData`);
                        getCoolerData(true).then((data) => {
                            console.log('Got cooler data, saved it and all!')
                            console.log('sending downloadStatus message now.....................')
                            sendMessageToModule('downloadStatus', {
                                downloadStatus: true
                            })
                        });
                        console.log('Direct Method is called to update CoolerData.json file');
                    }

                    if (inputName == "refreshNEID") {
                        console.log(`Entered refreshNEID`);
                        const _neid = httpService.getNEID(true);
                        // set neid after update
                        coolerDataService.setNeid(_neid);
                        console.log(`Direct Method is called to update NEID: ${_neid}`);
                        sendMessageToModule('downloadStatus', {
                            downloadStatus: false
                        })
                        getCoolerData(true).then((data) => {
                            console.log('Got cooler data, saved it and all!')
                            console.log('sending downloadStatus message now.....................')
                            sendMessageToModule('downloadStatus', {
                                downloadStatus: true
                            })
                        });
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
    actionCounter.inc({
        action_type: 'ad_platform_campaign_requests'
    });
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
            actionCounter.inc({
                action_type: 'ad_platform_campaign_requests_failed'
            });
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

const sendCoolerDataToMerchApp = function (coolerData) {
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
        let isCoolerDataFileUpdated = false;
        let coolerData = await coolerDataService.getCoolerData();

        if (coolerDataService.wasCoolerDataUpdated(coolerData)) {
            logger.info(`coolerData was updated, will download assets and then send the file over to merchApp.`);
            await coolerDataService.downloadAndSaveAssetsIfNeeded(coolerData);
            logger.info('Downloaded all coolerData assets');

            // Get nutrition data for each product
            nutritionDataService.getNutritionData(coolerData);

            //merchAppSocket.sendMerchAppCoolerDataUpdate(coolerData);
            isCoolerDataFileUpdated = coolerDataService.saveCoolerDataToDisk(coolerData);
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
                isCoolerDataFileUpdated = coolerDataService.saveCoolerDataToDisk(coolerData);
                sendCoolerDataToMerchApp(coolerData);
            }
        }

        // handle dso if its enabled and coolerData.json updated
        if (isCoolerDataFileUpdated && enableDso) {
            dsoService.handleDso()
        }

    } catch (error) {
        const stack = error.stack ? error.stack.split("\n") : '';
        logger.error(`Error in outter loop of getCoolerData: ${error}, [${stack}]. Will keep calling next interval.`, true)
    }

    if (!isOnDemandCall) {
        setTimeout(async () => {
            await getCoolerData();
        }, getCoolerDataIntervalInMs);
    }
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
