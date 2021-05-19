const metricsLib = require('./metrics')
const pkg = require('./../package.json')

const metrics = (config = {}) => {
    if (!global.metrics) {
        global.defaultMetadata = { 
            module: pkg.name 
        }
        global.metrics = metricsLib(config)
    }

    return global.metrics;
};

module.exports = {
    metrics
}