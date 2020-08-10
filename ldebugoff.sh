#!/bin/bash
#x='coolerCacheRootFolderProd'
#y='coolerCacheRootFolderDebug'
#sed -i -e 's/$x/$y/g' ./app/services/coolerCacheConfig.js

perl -pi -e 's/config.coolerCacheRootFolder = coolerCacheRootFolderDebug/config.coolerCacheRootFolder = coolerCacheRootFolderProd/g' ./app/services/coolerCacheConfig.js

perl -pi -e 's/return "WBA-13454-000-C003"; //g' ./app/services/httpService.js

perl -pi -e 's/\/\/initializeEdgeHubClient/initializeEdgeHubClient/g' ./app/downloadAsset.js
