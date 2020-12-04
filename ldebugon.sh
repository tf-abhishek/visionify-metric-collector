#!/bin/bash
#x='coolerCacheRootFolderProd'
#y='coolerCacheRootFolderDebug'
#sed -i -e 's/$x/$y/g' ./app/services/coolerCacheConfig.js

perl -pi -e 's/config.coolerCacheRootFolder = coolerCacheRootFolderProd/config.coolerCacheRootFolder = coolerCacheRootFolderDebug/g' ./app/services/coolerCacheConfig.js

perl -pi -e 's/if \(\!_neid\)/return "WBA-13454-000-C003"; if \(\!_neid\)/g' ./app/services/httpService.js

perl -pi -e 's/initializeEdgeHubClient\(\);/\/\/initializeEdgeHubClient\(\);/g' ./app/downloadAsset.js
