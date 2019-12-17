const fs = require('fs');
const readline = require('readline');
const path = require('path');

//var coolerName = "WBA-16092-000-C012"
const coolerPath = `https://planogram-editor-api.azurewebsites.net/screens/`
const imagePath = `https://coolerassets.blob.core.windows.net/planogram-images-haw/`


// IOT HUB MESSANGE BROKER

const Transport = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const Message = require('azure-iot-device').Message;

/*Client.fromEnvironment(Transport, function (err, client) {
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
                console.log('IoT Hub module client initialized with Josh');

                // Send trigger bridge some stuff:
                client.sendOutputEvent('playListData', new Message(
                    JSON.stringify({ assets: [{ 'image': 'abc.jpg' }, { 'image': 'def.jpg' }] })),
                    printResultFor('Sent TriggerBridge assets'));
                console.log('Sent assets to Trigger Bridge');

                setInterval(() => {
                    client.sendOutputEvent('playListData', new Message(
                        JSON.stringify({ assets: [{ 'image': 'abc.jpg' }, { 'image': 'def.jpg' }] })),
                        printResultFor('Sent TriggerBridge assets'));
                console.log('Sent assets to Trigger Bridge');
                }, 20 * 1000);

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
const adPlatformConfig = require('./coolerCacheConfig');
Date.MIN_VALUE = new Date(-8640000000000000);
const screenNameFilePath = 'screenNameFile';    // TODO: this has to be a path on hosting machine
const storageLocalCoolerImagesDir = './yo/';    // TODO: We have to come up with a dir for all containers to feed of
const storageLocalAdPlatformDataDir = './adPlatform/'
const adPlatformDataFilename = 'adPlatformData.json';


const getAdPlatformData = async function () {
    const adPlatformDataLastModified = getFileLastModifiedTime(
        path.join(storageLocalAdPlatformDataDir, adPlatformDataFilename));
    const getHeaders = {
        'If-Modified-Since': adPlatformDataLastModified
    };
    let adPlatformUrl = await buildAdPlatformGetUrl();

    try {
        const adPlatformDataResponse = await axios.get(adPlatformUrl, {
            headers: getHeaders,
        });
        const adPlatformData = adPlatformDataResponse.data;

        if (!Array.isArray(adPlatformData || !adPlatformData.length)) {
            // TODO: better handling
            adPlatformData = await readAdPlatformDataFromDisk();
        }
    } catch (error) {
        const abc = error;
    }

}

const buildAdPlatformGetUrl = async function () {
    _screenName = _screenName || await readScreenNameFromHost();

    return `${adPlatformConfig.adPlatformBaseUrlDev}${_screenName}?code=${adPlatformConfig.adPlatformFunctionCodeDev}`;
}

const readAdPlatformDataFromDisk = async function () {
    let fileFullPath = path.join(storageLocalAdPlatformDataDir, adPlatformDataFilename);
    fs.readFile(fileFullPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Could not read file from ${fileFullPath}. Details:${err}`);
            return;
        }

        return JSON.parse(data);
    });
}



const getCoolerData = async function () {
    const coolerDataUrl = await getCoolerDataUrl();
    let coolerData = await axios.get(coolerDataUrl);
    // Just in case the dir is not there yet - create it so we won't face problems saving downloaded files.
    fs.mkdir(storageLocalCoolerImagesDir, (err) => {
        console.error(`Error creating dir for saving files under ${storageLocalCoolerImagesDir}`)
    });

    await handleImagesDownload(coolerData);

    console.log('done');
}

const getFileLastModifiedTime = function (fileFullPath) {
    let stats = undefined;
    try {
        stats = fs.statSync(fileFullPath);
    } catch (error) {
        return Date.MIN_VALUE;
    }

    return stats.mtime.toUTCString();
}

let _screenName = undefined;
const getCoolerDataUrl = async function () {
    _screenName = _screenName || await readScreenNameFromHost();

    return `${coolerPath}${_screenName}`;
}

const readScreenNameFromHost = async function () {
    let screenName = '';
    const readStream = fs.createReadStream(screenNameFilePath);
    readLineIntefrace = readline.createInterface(readStream);

    for await (const line of readLineIntefrace) {
        screenName = line;
    }

    return screenName;
}

/*(async() =>{
    const sname = await readScreenNameFromHost();
    console.log('sn1: ' + sname)
})()*/

//console.log( getFileLastModifiedTime('apiService.js'));

async function handleImagesDownload(coolerData) {
    const allImages = getAllFilenames(coolerData);
    for (const productImageFilename of allImages) {
        const fileLastModifiedTime = getFileLastModifiedTime(path.join(storageLocalCoolerImagesDir, productImageFilename));
        const fileUrl = `${imagePath}${productImageFilename}`;
        const getHeaders = {
            'If-Modified-Since': fileLastModifiedTime //new Date(Date.now()).toUTCString()
        };
        try {
            // Download the file:
            const response = await axios.get(fileUrl, {
                headers: getHeaders,
                responseType: 'stream'
            });
            console.log(`Downloaded an image from: [${fileUrl}], will save it to: [${storageLocalCoolerImagesDir}]`);
            // Save the file:
            const writeSteam = response.data.pipe(fs.createWriteStream(path.join(storageLocalCoolerImagesDir, productImageFilename)));
            writeSteam.on('error', function (err) {
                console.log(`Error saving image ${productImageFilename} under ${storageLocalCoolerImagesDir}.`
                    + ` Details: ${err}`);
            });
        }
        catch (error) {
            if (error && error.response) {  // HTTP error
                if (error.response.status === 304) {
                    // Not an error:
                    console.log(`File at ${fileUrl} was not modified since last time, skipping.`);
                } else if (error.response.status === 404) {
                    console.error(`File not found: ${fileUrl}`);
                }
            }
            else {
                console.error(`Error getting and saving file from URL ${fileUrl}: ${err}`);
            }
        }
    }
}

function getAllFilenames(coolerData) {
    return getAllProductImagesComponentFilenames(coolerData)
        .concat(getShelvesComponentFilenames(coolerData));
}

function getAllProductImagesComponentFilenames(coolerData) {
    return coolerData.data.allProductImages;
}

function getShelvesComponentFilenames(coolerData) {
    if (!(coolerData.data && coolerData.data.metadata && coolerData.data.metadata.shelves)) {
        console.error(`No Shelves data in coolerData file`);

        return;
    }

    return coolerData.data.metadata.shelves.map(shelf => {
        if (!shelf.slots) return undefined;
        return shelf.slots.map(slot => slot.imageName);
    }).filter(arr => arr !== undefined)
        .reduce((arr1, arr2) => arr1.concat(arr2), []);
}




//getAdPlatformData().then((data) => { console.log('final result: ' + data) });*/