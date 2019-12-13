const fs = require('fs');
const readline = require('readline');
const path = require('path');

var myArgs = process.argv.slice(2)
//var coolerName = "WBA-16092-000-C012"
var coolerName = myArgs[0]

Date.MIN_VALUE = new Date(-8640000000000000);
const screenNameFilePath = 'screenNameFile';    // TODO: this has to be a path on hosting machine
const storageLocalDir = './';                   // TODO: We have to come up with a dir for all containers to feed of
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
//import { apiService } from "apiService";
//const apiService = require('./apiService')

const getCoolerData = async function() {
    const coolerDataUrl = await getCoolerDataUrl();
console.log(coolerDataUrl);
    let res = await axios.default.get(coolerDataUrl);
    for await (const productImageFilename of res.data.allProductImages) {
        const fileLastModifiedTime = getFileLastModifiedTime(productImageFilename)
        const fileUrl = `${imagePath}${productImageFilename}`;

        const getHeaders = {
            'If-Modified-Since': fileLastModifiedTime   //new Date(Date.now()).toUTCString()
        }
        try {
            const file = await axios.get(fileUrl, {
                headers: getHeaders
            });

            // Save file locally
            fs.writeFile(path.join(storageLocalDir, productImageFilename), JSON.stringify(file), function(err) {
                if(err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
            }); 
        } catch (error) {
            if (errror.response.status !== 304) {
                // We got a reall erorr; log
            }
        }
    }
    
    
    console.log(JSON.stringify(data));
}

const getFileLastModifiedTime = function(filename) {
    try {
        const stats = fs.statSync(path.join(storageLocalDir, filename));
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
getCoolerData().then((data) =>{console.log('final result: ' + data)});
//workData()
//setTimeout(() => buildList(imageArray), 500)
