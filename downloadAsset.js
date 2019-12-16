const fs = require('fs');
const readline = require('readline');
const path = require('path');

var myArgs = process.argv.slice(2)
//var coolerName = "WBA-16092-000-C012"
var coolerName = myArgs[0]


const coolerPath = `https://planogram-editor-api.azurewebsites.net/screens/`


const tmpCDFile = `../CoolerData.js`;
let file = `${tmpCDFile}`
let fileArray = [file]
let result
let imageArray = [];
const buildFolder  = 324634818 // set build here
//const coolerName  = 'WBA-16092-000-C001' // set cooler name here
//const coolerPath = `https://planogram-editor-api.azurewebsites.net/screens/`
let imageName
const imagePath = `https://coolerassets.blob.core.windows.net/planogram-images-haw/`
// const imagePath = `https://csiplanogramadcopy.blob.core.windows.net/324634818/tags/`

//If-Modified-Since
const configOpen = '<monitor_sync_config version="1">\n';
const syncOptions = '<sync expiry="0" refresh_period="180000" timeout_period="30000">\n';
const imageSyncOptions = '<sync expiry="0" refresh_period="64800000" timeout_period="30000">\n';
const urlSyncMode = '<url sync_mode="1">\n';
const urlClose = '</url>\n'
const syncClose = "</sync>\n";
const configClose = '</monitor_sync_config>'
const coolerDataFromTemplate = `<from>${coolerPath}${coolerName}/bsversion</from>\n`
const coolerDataToTemplate = `<to>/opt/broadsign/suite/bsp/share/documents/${buildFolder}/CoolerData.js</to>\n`
// const coolerDataToTemplate = `<to>C:/ProgramData/BroadSign/bsp/share/bsp/documents/${buildFolder}/CoolerData.js</to>\n`
const coolerDataConfigString = syncOptions + urlSyncMode + coolerDataFromTemplate + coolerDataToTemplate + urlClose + syncClose
//let fullConfig = "configOpen + coolerDataConfigString"
let fullConfig = ""

const readFile = function(file, imageArray) {
    let data = fs.readFile(`${file}`,'utf8',(err, data) => {
        //console.log(`${data}!`);
        if (err) throw err;
        const regx = /([^,[\]:]+?png)/g
        let found = data.match(regx);
        found.forEach((index) => {
            //console.log(`${index}!\n`);
            const cutIndex =  index.indexOf('"')
            //console.log(`${index}!\n`);
            const sliced =  index.slice(cutIndex + 1)
            //console.log(`${index}!\n`);
            const matchResult = imageArray.filter((found) => (found === sliced))
            if(!matchResult[0]) {
                imageArray.push(sliced)
            } else {
                const matchIndex = imageArray.indexOf(matchResult[0])
                imageArray[matchIndex] = sliced
            } 
        })
        return found
    })
    //console.log('after read all Images in config: ', imageArray)
}

const workData = (async () => {
    const finish = await readFile(file, imageArray)
})

const buildList = function(imageArray) {
    //console.log('all Images in config: ', imageArray)
    imageArray.forEach((image) => {
        imageName = image
        const imgFromTemplate = `curl "${imagePath}${imageName}" -o "${imageName}" -C -\n`;
        fullConfig += imgFromTemplate
        
    })
    //fullConfig += configClose
    fs.writeFile(`cache-Assets.sh`, fullConfig, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log(`cache-Assets.sh file was saved!`);
    }); 
    //console.log(fullConfig)
}









const axios = require('axios').default;
const adPlatformConfig = require('./coolerCacheConfig');
Date.MIN_VALUE = new Date(-8640000000000000);
const screenNameFilePath = 'screenNameFile';    // TODO: this has to be a path on hosting machine
const storageLocalCoolerImagesDir = './yo/';    // TODO: We have to come up with a dir for all containers to feed of
const storageLocalAdPlatformDataDir = './adPlatform/'
const adPlatformDataFilename = 'adPlatformData.json';


const getAdPlatformData = async function() {
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

const buildAdPlatformGetUrl = async function() {
    _screenName = _screenName || await readScreenNameFromHost();

    return `${adPlatformConfig.adPlatformBaseUrlDev}${_screenName}?code=${adPlatformConfig.adPlatformFunctionCodeDev}`;
}

const readAdPlatformDataFromDisk = async function(){
    let fileFullPath = path.join(storageLocalAdPlatformDataDir, adPlatformDataFilename);
    fs.readFile(fileFullPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Could not read file from ${fileFullPath}. Details:${err}`);
            return;
        }

        return JSON.parse(data);
    });
}



const getCoolerData = async function() {
    const coolerDataUrl = await getCoolerDataUrl();
    let coolerData = await axios.get(coolerDataUrl);
    // Just in case the dir is not there yet - create it so we won't face problems saving downloaded files.
    fs.mkdir(storageLocalCoolerImagesDir, (err) =>{
        console.error(`Error creating dir for saving files under ${storageLocalCoolerImagesDir}`)
    });
    
    await handleImagesDownload(coolerData);
    
    console.log('done');
}

const getFileLastModifiedTime = function(fileFullPath) {
    let stats = undefined;
    try {
        stats = fs.statSync(fileFullPath);
    } catch (error) {
        return Date.MIN_VALUE;
    }

    return stats.mtime.toUTCString();
}

let _screenName = undefined;
const getCoolerDataUrl = async function() {
    _screenName = _screenName || await readScreenNameFromHost();

    return `${coolerPath}${_screenName}`;
}

const readScreenNameFromHost = async function() {
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
getAdPlatformData().then((data) =>{console.log('final result: ' + data)});

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

//workData()
//setTimeout(() => buildList(imageArray), 500)
