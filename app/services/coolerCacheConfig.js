var config = {}

config.adPlatformFunctionCodeDev = 'g21baN81vqQ2dslwD0/P5EZUaRCaZEDY7gOx7snVkoehYCRCeQpgJQ==';
config.adPlatformFunctionCodeQA = 'grGoLFag/dyqMfKyQWSLG7cDHwOpb6QyuguYdgTHfF/tiDTC3ZlMAw==';
config.adPlatformFunctionCodeProd = 'EerZBPr8FiKYA5q6DTskslPRDKsE1l9DGvRW0ajooTmWPmLXaa9nfg==';

config.adPlatformBaseUrlDev = 'https://dev-csi-ad-func.azurewebsites.net/api/external/screenData/';
config.adPlatformBaseUrlQA = 'https://qa-csi-ad-func.azurewebsites.net/api/external/screenData/';
config.adPlatformBaseUrlProd = 'https://prod-ad-func.azurewebsites.net/api/external/screenData/';

config.NeidQueryAddress = 'https://location-manager-api.azurewebsites.net/api/assets/GetData?hostname=';

config.coolerCacheRootFolderProd = '/home/csiadmin/coolerCache';
config.coolerCacheRootFolderDebug = './app/yo';

//config.screenNEIDPath = './app/screenNameFile';
config.merchAppListenPort = 2346;

// Values to use:
config.adPlatformFunctionCode = config.adPlatformFunctionCodeQA;
config.adPlatformBaseUrl = config.adPlatformBaseUrlQA;
config.coolerCacheRootFolder = config.coolerCacheRootFolderProd;
config.coolerCacheAssetsFolder = config.coolerCacheRootFolder + '/resources';
config.storageLocalAdPlatformDataDir = config.coolerCacheAssetsFolder;

module.exports = config;