const fs = require('fs');
const readline = require('readline');
const path = require('path');

//var coolerName = "WBA-16092-000-C012"


// IOT HUB MESSANGE BROKER

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
                setInterval(() => {
                    sendDataToTriggerBridge(client);
                console.log('Sent some data to Josh');
                }, 20 * 1000);
            }
        });
    }
});

    

                // Act on input messages to the module.
                /*client.on('inputMessage', function (inputName, msg) {
                    console.log('i got the message');
                    pipeMessage(client, inputName, msg);
                });*//*
            }
        });
    }
});
// This function just pipes the messages without any change.
/*
function pipeMessage(client, inputName, msg) {
    client.complete(msg, printResultFor('Receiving message'));

    if (inputName === 'input1') {
        var message = msg.getBytes().toString('utf8');
        if (message) {
            var outputMsg = new Message(message);
            console.log('This is the message', message);
            client.sendOutputEvent('output1', outputMsg, printResultFor('Sending received message'));
        }
    }
}*/

function sendDataToTriggerBridge(client) {
    adPlatformService.getAdPlatformData().then(
        (data) => {
            client.sendOutputEvent(
                'playListData', 
                new Message(JSON.stringify(data)),
                printResultFor('Sent TriggerBridge assets'));
            console.log(`Sent the following data to Trigger Bridge: ${JSON.stringify(data)}`);
        });
        //console.log(`Sent the following data to TB: ${JSON.stringify(data)}`));

    
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


const coolerDataService = require('./services/coolerDataService');

const getCoolerData = async function () {
    const coolerDataUrl = await coolerDataService.getCoolerDataUrl();
    let coolerData = await axios.get(coolerDataUrl);
    coolerDataService.saveAndPrependCoolerData(coolerData.data);

    await coolerDataService.handleImagesDownload(coolerData);

    console.log('done');
}





/*(async() =>{
    const sname = await readScreenNameFromHost();
    console.log('sn1: ' + sname)
})()*/

//console.log( getFileLastModifiedTime('apiService.js'));




//getCoolerData().then((data) => console.log('Finished!'));
//adPlatformService.getAdPlatformData().then((data) => console.log(`yep done: ${JSON.stringify(data)}`));
//getAdPlatformData().then((data) => { console.log('final result: ' + data) });*/