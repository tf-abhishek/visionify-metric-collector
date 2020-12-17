const { Connection, Request } = require("tedious");
const path = require('path');
const fs = require('fs');
const utils = require('./utils');
const logger = require('./logger');
const config = require('./coolerCacheConfig');
const merchAppSocket = require('./merchAppSocket');
const nutritionDataFileFullPath = path.join(config.coolerCacheRootFolder, 'nutritionData.json');
const MACRO_DICTIONARY = {
  ['Calcium, Ca']: 'Calcium',
  ['Carbohydrate, by difference']: 'Carbs',
  Cholesterol: 'Cholesterol',
  Energy: 'Calories',
  ['Potassium, K']: 'Potassium',
  ['Fatty acids, total saturated']: 'Sat Fat',
  ['Fatty acids, total monounsaturated']: 'MonoUnsat Fat',
  ['Fatty acids, total polyunsaturated']: 'PolyUnsat Fat',
  ['Fatty acids, total trans']: 'Trans Fat',
  ['Fiber, total dietary']: 'Fiber',
  ['Iron, Fe']: 'Iron',
  ['Protein']: 'Protein',
  ['Sodium, Na']: 'Sodium',
  ['Sugars, total including NLEA']: 'Sugar',
  ['Total lipid (fat)']: 'Fat',
  ['Vitamin A, IU']: 'Vitamin A',
  ['Vitamin C, total ascorbic acid']: 'Vitamin C',
  ['Vitamin D (D2 + D3), International Units']: 'Vitamin D',
  ['Vitamin E (label entry primarily)']: 'Vitamin E',
};
const retailerNameDictionary = {
  GGO: 'GetGo',
  KRO: 'Kroger',
  WBA: 'Walgreens',
};

const closeConnection = (connection) => {
  if(connection) {
    logger.info('Closing Nutrition DB Connection');
    connection.close();
  } else {
    logger.info('Attempted to close a non-existent connection');
  }
};

const dbConfig = {
  authentication: {
    options: {
      userName: config.nutritionDbUsername,
      password: config.nutritionDbPassword,
    },
    type: "default",
  },
  server: config.nutritionDbServer,
  options: {
    database: config.nutritionDbName,
    encrypt: true,
    validateBulkLoadParameters: true,
  },
};

const queryNutritionDatabase = ({ upcs, retailer, connection }) => {
  const nutritionData = {};
  const upcDelimitedString = upcs.join(',');
  logger.info(`Reading Nutrition Data Table...`);
  
  try {
    const request = new Request(
      `EXEC usp_select_nutrient_info @upc = '${upcDelimitedString}'
        ,@retailer_name = '${retailer}'`,
      (err, rowCount) => {
        if (err) {
          logger.error(`New Request Error: ${err.message}`);
        } else {
          logger.info(`Finished ${rowCount} requests for following UPCs, ${Object.keys(nutritionData).join(', ')}`);
          if (Object.keys(nutritionData).length === 0) {
            logger.info('No nutrition data available for the products on this door');
          } else {
            saveNutritionDataToDisk(nutritionData);
            merchAppSocket.sendMerchAppNutritionData(nutritionData);
          }
        }
  
        closeConnection(connection);
      },
    );
    // Data is coming in the format of:
    // retailerId | universalUPC | upc | nutrient_name | nutrient_value | nutrient_unit | category
    request.on('row', columns => {
      const upc = columns[0].value;
      const macroName = MACRO_DICTIONARY[columns[3].value];
      if (nutritionData[upc]) {
        // Add macro to upc in nutrition data
        nutritionData[upc] = {
          ...nutritionData[upc],
          [macroName]: {
            value: columns[5].value,
            unit: columns[4].value,
          },
        };
      } else {
        // Initialize the correct upc in the data and add category
        // Category is only added once because it is included in every row
        nutritionData[upc] = {
          Category: columns[6].value,
          [macroName]: {
            value: columns[5].value,
            unit: columns[4].value,
          },
        };
      }
    });
    
    connection.execSql(request);
  } catch (e) {
    closeConnection(connection);
    logger.error(`queryNutritionDatabase error: ${e}`);
  }
};

const saveNutritionDataToDisk = function (nutritionData) {
  try {
    fs.writeFileSync(nutritionDataFileFullPath,
      JSON.stringify(nutritionData),
      { flag: 'w+' });
    logger.info(`nutritionData file was saved under ${config.coolerCacheRootFolder}`);
  } catch (error) {
    logger.error(`Error saving nutritionData: ${error}`);
  }
  
};

exports.nutritionDataExists = function () {
  return utils.doesFileExist(nutritionDataFileFullPath);
};

// Create new db connection
exports.getNutritionData = function (coolerData) {
  let connection;
  const upcs = coolerData.products.map(product => product.gtin);
  const retailer = retailerNameDictionary[coolerData.name.split('-')[0]] || '';
  
  try {
    connection = new Connection(dbConfig);
    connection.connect();
    // Attempt to connect and execute queries if connection goes through
    connection.on('connect', err => {
      if (err) {
        logger.error(`Error while connecting to Nutrition DB: ${err} ${err.message}`);
        closeConnection(connection);
      } else {
        logger.info('Connected To Nutrition DB');
        queryNutritionDatabase({ upcs, retailer, connection });
      }
    });
    
    connection.on('error', err => {
      logger.error(`Nutrition DB Connection Error: ${err}`);
    });
    
  } catch (e) {
    closeConnection(connection);
    logger.error(`Error with db setup: ${e}`);
  }
};
