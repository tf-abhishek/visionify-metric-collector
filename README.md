### Sonar Scan
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=csi-cooler-cache&metric=alert_status&token=92063ffc6823f107ea56eaadc7576aa9b55789d8)](https://sonarcloud.io/dashboard?id=csi-cooler-cache)

# Metrics
## Errors and Exceptions Metrics

Errors sample: 
`logger.error('my errors message')`

Exception sample:
```
try {
    ...
} catch (error) {
    logger.error(error, true)
}
```

## Counter
```
const { metrics } = require('./helpers/helpers')
const actionCounter = metrics().counter({
  name: 'action_jobs_counter',
  help: 'jobs counter metric',
  labelNames: ['action_type'],
})

...

appInsightsMetrics().trackEvent({
   name: "playlist_sent", 
   properties: { }
});

actionCounter.inc({
    action_type: 'playlist_sent'
})
```

## Gauge
```
const { metrics } = require('./helpers/helpers')
const actionGauge = metrics().gauge({
  name: 'action_edgehub_connection_gauge',
  help: 'edgehub connection metric',
  labelNames: ['action_type'],
})
...
actionGauge.set(10)
...
actionGauge.inc()
...
actionGauge.dec()
```

## Summary
```
const { metrics } = require('./helpers/helpers')
const actionSummary = metrics().summary({
  name: 'metric_name',
  help: 'metric_help',
  percentiles: [0.01, 0.1, 0.9, 0.99],
})
...
actionSummary.observe(10);
```

## Histogram
```
const { metrics } = require('./helpers/helpers')
const actionHistogram = metrics().histogram({
  name: 'metric_name',
  help: 'metric_help',
  buckets: [0.1, 5, 15, 50, 100, 500],
})
...
actionHistogram.observe(10); // Observe value in histogram
```

For more information please visit: https://www.npmjs.com/package/prom-client