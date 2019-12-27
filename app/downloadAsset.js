const fs = require('fs');
const readline = require('readline');
const path = require('path');
const utils = require('./services/utils');

//var coolerName = "WBA-16092-000-C012"


// IOT HUB MESSANGE BROKER

const getAdPlatformIntervalInMs = 60 * 1000;//60 * 60 * 1000;   // 1 Hour
const getCoolerDataIntervalInMs = 60 * 1000;        // 1 Minute
const Transport = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const Message = require('azure-iot-device').Message;
const adPlatformService = require('./services/adPlatformService');

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

function sendDataToTriggerBridge(client) {
    adPlatformService.getAdPlatformData().then(
        (data) => {
            if (data) {
                console.log('Got some data from Ad-Platform.')
                adPlatformService.downloadAndSaveAdPlatformAssets(data).then(
                    (emptyData) => {
                        client.sendOutputEvent(
                            'playListData',
                            new Message(JSON.stringify(data)),
                            printResultFor('Sent TriggerBridge assets'));
                        console.log(`Sent AdPlatform JSON to TriggerBridge`);
                    })
            } else {
                console.log('Ad-Platform did not return any data, which means no changes since last call.')
            }
            // In any case, schedule another call to Ad-Platform:
            setTimeout(() => { 
                sendDataToTriggerBridge(client);
            }, getAdPlatformIntervalInMs);
        }, (err) => {
            console.error(`Error getting Ad-Platform data: ${err}. Will keep looping.`);

            setTimeout(() => { 
                sendDataToTriggerBridge(client);
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

const axios = require('axios').default;
Date.MIN_VALUE = new Date(-8640000000000000);
Array.prototype.extend = function (other_array) {
    if (!utils.isArray(other_array)) return;
    other_array.forEach(function (v) { this.push(v) }, this);
}

const coolerDataService = require('./services/coolerDataService');

const getCoolerData = async function () {
    let coolerData = await coolerDataService.getCoolerData();
    coolerDataService.saveAndPrependCoolerData(coolerData);

    try {
        await coolerDataService.downloadAndSaveAssets(coolerData);
    } catch (error) {
        console.error(`Error in outter loop of getCoolerData: ${error}. Will keep calling next interval.`)
    }

    setTimeout(async () => {
        await getCoolerData();
    }, getCoolerDataIntervalInMs);
}


//sendDataToTriggerBridge({sendOutputEvent: function(...abc) {console.log(abc)}});
//getCoolerData().then((data) => console.log('Finished!'));
//adPlatformService.getAdPlatformData().then((data)=> adPlatformService.downloadAndSaveAdPlatformAssets(data).then((d) => console.log('That took awhile...')));
//getAdPlatformData().then((data) => { console.log('final result: ' + data) });*/