
'use strict';

var myArgs = process.argv.slice(2)
//var coolerName = "WBA-16092-000-C012"
var coolerName = myArgs[0]

const coolerPath = `https://planogram-editor-api.azurewebsites.net/screens/`
const tmpCDFile = `../CoolerData.js`;

let file = `${tmpCDFile}`
let fileArray = [file]
const fs = require('fs');
let result
let imageArray = [];
const buildFolder  = 324634818 // set build here
//const coolerName  = 'WBA-16092-000-C001' // set cooler name here
//const coolerPath = `https://planogram-editor-api.azurewebsites.net/screens/`
let imageName
const imagePath = `https://coolerassets.blob.core.windows.net/planogram-images-haw/`
// const imagePath = `https://csiplanogramadcopy.blob.core.windows.net/324634818/tags/`

// curl `$
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



workData()
setTimeout(() => buildList(imageArray), 500)
