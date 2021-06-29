const metricsLib = require('./metrics')
const pkg = require('./../package.json')
const appInsights = require("applicationinsights");
const config = require('../config.json')

const metrics = (config = {}) => {
    if (!global.metrics) {
        global.defaultMetadata = { 
            module: pkg.name 
        }
        global.metrics = metricsLib(config)
    }

    return global.metrics;
};

const appInsightsMetrics = () => {

    if (!global.appInsightsMetrics) {
        appInsights.setup('config.appInsightsInstrumentationKey').start();
        global.appInsightsMetrics = appInsights.defaultClient;
    }

    return {
        trackEvent: ({ name, properties }) => {
            global.appInsightsMetrics.trackEvent({
                name,
                properties: {
                    module: pkg.name,
                    ...global.defaultMetadata,
                    ...properties
                }
            });
        }
    };
};

module.exports = {
    metrics,
    appInsightsMetrics,
}