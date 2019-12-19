var config = {}

config.adPlatformFunctionCodeDev = 'g21baN81vqQ2dslwD0/P5EZUaRCaZEDY7gOx7snVkoehYCRCeQpgJQ==';
config.adPlatformFunctionCodeQA = 'grGoLFag/dyqMfKyQWSLG7cDHwOpb6QyuguYdgTHfF/tiDTC3ZlMAw==';

config.adPlatformBaseUrlDev = 'https://dev-csi-ad-func.azurewebsites.net/api/external/screenData/';
config.adPlatformBaseUrlQA = 'https://qa-csi-ad-func.azurewebsites.net/api/external/screenData/';

config.coolerCacheRootFolderProd = '/home/csiadmin/coolerCache';
config.coolerCacheRootFolderDebug = './app/yo/';

config.screenNEIDPath = './app/screenNameFile';    // TODO: this has to be a path on hosting machine

// Values to use:
config.adPlatformFunctionCode = config.adPlatformFunctionCodeDev;
config.adPlatformBaseUrl = config.adPlatformBaseUrlDev;
config.coolerCacheRootFolder = config.coolerCacheRootFolderDebug
config.storageLocalAdPlatformDataDir = config.coolerCacheRootFolder;// + '/adPlatform/';

module.exports = config;