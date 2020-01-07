const io = require("socket.io");
const config = require('./coolerCacheConfig');
const logger = require('./logger');
const listeningPort = process.env.merchappsocketport || config.merchAppListenPort;
let server;

exports.listeningPort = listeningPort;

exports.initialize = function() {
    server = io.listen(listeningPort);

    logger.info('Listening on port ' + listeningPort);
    server.on("connection", (socket) => {
        logger.info(`Client connected [id=${socket.id}]`);
        // Current assumption: merchApp is the only valid client.
        
        socket.on("disconnect", () => {
            logger.info(`Client gone [id=${socket.id}]`);
        });
    });
}

exports.sendMerchAppCoolerDataUpdate = function(coolerData) {
    const updatedKey = 'coolerDataUpdated';
    //const updatedValue =  { updatedKey: true };

    //logger.info(`Sending merchApp a coolerData update: ${coolerData}`)
    server.emit(updatedKey, coolerData);
}