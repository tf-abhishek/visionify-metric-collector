const fs = require('fs');
const readline = require('readline');
const path = require('path');
const utils = require('./services/utils');
const logger = require('./services/logger');
const config = require('./services/coolerCacheConfig');
const merchAppSocket = require('./services/merchAppSocket');
var http = require('http');
var static = require('node-static');
var socketFailuresCounter = 0;
//var coolerName = "WBA-16092-000-C012"


// IOT HUB MESSANGE BROKER

const getAdPlatformIntervalInMs = config.intervalForAdPlatformDownloadMs;
const getCoolerDataIntervalInMs = config.intervalForCoolerDataDownloadMs;
const socketListenerInterval = 3 * 1000;    // base time: 3 seconds
const socketInitRetryThreshold = 10;        // If we failed for 10 times, do not retry anymore
const Transport = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const Message = require('azure-iot-device').Message;
const adPlatformService = require('./services/adPlatformService');

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
                sendDataToTriggerBridge(client);
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

function sendDataToTriggerBridge(client) {
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
                logger.info('Looks like adPlatformData did not change since last time. Will take no action.');
            }
            
            // In any case, schedule another call to Ad-Platform:
            setTimeout(() => { 
                sendDataToTriggerBridge(client);
            }, getAdPlatformIntervalInMs);
        }, (err) => {
            logger.error(`Error getting Ad-Platform data: ${err}. Will keep looping.`);

            setTimeout(() => { 
                sendDataToTriggerBridge(client);
            }, getAdPlatformIntervalInMs);
        });
}

function sendTelemetryTestMessage(client) {
    var messageBody = JSON.stringify(Object.assign({}, {
        "Weather": {
            "Temperature": 50,
            "Time": "2020-01-01T00:00:00.000Z",
            "PrevTemperatures": [
                20,
                30,
                40
            ],
        }
    }));
    
    // Encode message body using UTF-8  
    var messageBytes = Buffer.from(messageBody, "utf8");
    
    var message = new Message(messageBytes);
    
    // Set message body type and content encoding 
    message.contentEncoding = "utf-8";
    message.contentType = "application/json";
    
    // Add other custom application properties   
    message.properties.add("telemetry", "true");
    
    logger.info(`*** SENDING TELEMETRY: ${message.data} ***`);

    try {
        client.sendEvent(message, function (err) {
            if (err) {
                logger.error('*** TELEMETRY send error: ' + err.toString());
            } else {
                logger.info(`*** TELEMETRY message sent :${message.data}. Content type : ${message.contentEncoding}, ${message.contentType}. props:${message.properties}`);
            }
          });

          client.sendOutputEvent('*', message, function(err, res) {
            if (err) logger.error('error: ' + err.toString());
            if (res) logger.info('status: ' + res);
          });
    } catch (error) {
        logger.error(`Error sending telemetry: ${error}`);
    }

    /*
    client.sendEvent(message, (err, res) => {
        if (err) logger.error('error: ' + err.toString());
        if (res) logger.info('status: ' + res.constructor.name);
    });*/
}

function sendPOP(client) {
    let message = new Message(JSON.stringify({ 
        played: 1, 
        time: new Date(Date.now()).toUTCString() 
    }))

    logger.info(`*** SENDING POP: *** ${message.data}`);
    
    client.sendEvent(message, function (err) {
        if (err) {
            logger.error('*** POP send error: ' + err.toString());
        } else {
            logger.info(`*** POP message sent :${message.data}. Content type : ${message.contentEncoding}, ${message.contentType}`);
        }
      });
/*
    client.sendEvent(message, (err, res) => {
        if (err) logger.error('error: ' + err.toString());
        if (res) logger.info('status: ' + res.constructor.name);
    });*/
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

const axios = require('axios').default;
Date.MIN_VALUE = new Date(-8640000000000000);
Array.prototype.extend = function (other_array) {
    if (!utils.isArray(other_array)) return;
    other_array.forEach(function (v) { this.push(v) }, this);
}

const coolerDataService = require('./services/coolerDataService');

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