const express = require('express')
const app = express()
const client = require('prom-client')
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({
    labels: { deviceID: 'abhian-jetson' },
});

const metricCallCounter = new client.Counter({
    name: 'metric_call_counter',
    help: 'metric_call_counter',
});

const internalCounter = new client.Counter({
    name: 'internal_counter',
    help: 'internal_counter',
});

app.get('/metrics', async function (req, res) {
    metricCallCounter.inc()
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
})

setInterval(() => {
    internalCounter.inc()
}, 1000)

app.listen(9001);

process.on('uncaughtException', err => {
    console.error(err);
    process.exit(1);
});
