const metricsLib = require('./metrics')

const metrics = (config = {}) => {
    if (!global.metrics) {
        global.metrics = metricsLib(config)
    }

    return global.metrics;
};

module.exports = {
    metrics
}