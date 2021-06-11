var config = {}

config.adPlatformFunctionCodeDev = 'g21baN81vqQ2dslwD0/P5EZUaRCaZEDY7gOx7snVkoehYCRCeQpgJQ==';
config.adPlatformFunctionCodeQA = 'grGoLFag/dyqMfKyQWSLG7cDHwOpb6QyuguYdgTHfF/tiDTC3ZlMAw==';
config.adPlatformFunctionCodeProd = 'EerZBPr8FiKYA5q6DTskslPRDKsE1l9DGvRW0ajooTmWPmLXaa9nfg==';//TODO DELETE

config.adPlatformBaseUrlDev = 'https://dev-csi-ad-func.azurewebsites.net/api/external/screenData/';
config.adPlatformBaseUrlQA = 'https://qa-csi-ad-func.azurewebsites.net/api/external/screenData/';
config.adPlatformBaseUrlProd = 'https://prod-ad-func.azurewebsites.net/api/external/screenData/';

const adPlatformHostname = process.env.adplatformurl || 'https://prod-ad-func.azurewebsites.net';

const coolerCacheRootFolderProd = '/home/csiadmin/coolerCache';
const coolerCacheRootFolderDebug = './app/yo';

//config.screenNEIDPath = './app/screenNameFile';

// Values to use:
config.merchAppListenPort = 2346;
config.universalPlangramImageStorageUrl = process.env.universalPlangramImageStorageUrl || 'https://univplanostoragesa.blob.core.windows.net/univplanoimagesprod/';
config.planogramurl = process.env.planogramurl || `https://planogram-editor-api.azurewebsites.net/screens/`;
config.NeidQueryAddress = process.env.NeidQueryAddress || 'https://coolerscreens.azure-api.net/location-manager/api/assets/GetData?hostname=';
config.intervalForCoolerDataDownloadMs = process.env.coolercacheintervalms || 10 * 60 * 1000; // 10 minutes is default
config.intervalForAdPlatformDownloadMs = process.env.adplatformintervalms || 30 * 60 * 1000; // 30 minutes is default
config.defaultStore = process.env.defaultstore || 'WBA';
config.adPlatformFunctionCode = process.env.adplatformkey || config.adPlatformFunctionCodeProd;
config.adPlatformBaseUrl = `${trimUrlEnd(adPlatformHostname)}/api/external/screenData/`
config.coolerCacheRootFolder = coolerCacheRootFolderProd;
config.coolerCacheAssetsFolder = config.coolerCacheRootFolder + '/resources';
config.storageLocalAdPlatformDataDir = config.coolerCacheAssetsFolder;
config.dsoFilePath = process.env.dsoFilePath || '/usr/local/bin/dso/config/config.json'

// DB values for cookie project nutrition data
// These are defaulted to prod values but can be rewritten by env variables set in the deployment
config.nutritionDbName = process.env.nutritionDbName || 'productdata';
config.nutritionDbServer = process.env.nutritionDbServer || 'csi-rvaetl-sql.database.windows.net';
config.nutritionDbUsername = process.env.nutritionDbUsername || 'csi_readonly';
config.nutritionDbPassword = process.env.nutritionDbPassword || 'C00l3rsD2t2#s';

function trimUrlEnd(url) {
    if (url.endsWith('/')) {
        return url.slice(0, -1);
    }
    
    return url;
}

module.exports = config;
