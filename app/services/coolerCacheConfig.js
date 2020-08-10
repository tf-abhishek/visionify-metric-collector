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
config.planogramurl = process.env.planogramurl || `https://planogram-editor-api.azurewebsites.net/screens/`;
config.NeidQueryAddress = 'https://location-manager-api.azurewebsites.net/api/assets/GetData?hostname=';
config.intervalForCoolerDataDownloadMs = process.env.coolercacheintervalms || 10 * 60 * 1000; // 10 minutes is default
config.intervalForAdPlatformDownloadMs = process.env.adplatformintervalms || 30 * 60 * 1000; // 30 minutes is default
config.intervalForSkinDownload = process.env.skinintervalms || 60 * 60 * 1000;              // Every hour is default
config.defaultStore = process.env.defaultstore || 'WBA';
config.adPlatformFunctionCode = process.env.adplatformkey || config.adPlatformFunctionCodeProd;
config.adPlatformBaseUrl = `${trimUrlEnd(adPlatformHostname)}/api/external/screenData/`
config.coolerCacheRootFolder = coolerCacheRootFolderProd;
config.coolerCacheAssetsFolder = config.coolerCacheRootFolder + '/resources';
config.storageLocalAdPlatformDataDir = config.coolerCacheAssetsFolder;
config.skinBuilderUrl = process.env.skinbuilderurl || 'https://coolerassets.blob.core.windows.net/skin-builder-prod/current/';

function trimUrlEnd(url) {
    if (url.endsWith('/')) {
        return url.slice(0, -1);
    }
    
    return url;
}

module.exports = config;
