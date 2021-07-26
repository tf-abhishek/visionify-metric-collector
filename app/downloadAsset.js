const express = require('express')
const app = express()
const client = require('prom-client')
const collectDefaultMetrics = client.collectDefaultMetrics;
var os = require("os");
let deviceId = os.hostname();
console.log({deviceId})
collectDefaultMetrics({
    labels: { deviceId: deviceId },
});


const plasticColorCounter = new client.Counter({
    name: 'plastic_color_counter',
    help: 'plastic_color_counter',
    labelNames: ['color', 'deviceId'],
})

const metricCallCounter = new client.Counter({
    name: 'metric_call_counter',
    help: 'metric_call_counter',
    labelNames: ['deviceId'],
});

const internalCounter = new client.Counter({
    name: 'internal_counter',
    help: 'internal_counter',
    labelNames: ['deviceId'],
});

app.get('/metrics', async function (req, res) {
    metricCallCounter.inc({
        deviceId: deviceId
    })
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
})

setInterval(() => {
    internalCounter.inc({
        deviceId: deviceId
    })
}, 1000)


setInterval(() => {
    let res = Math.floor(Math.random() * 10);
    plasticColorCounter.inc({
        color: res ? 'white' : 'red',
        deviceId: deviceId
    })
}, 1000)

app.listen(9001);

process.on('uncaughtException', err => {
    console.error(err);
    process.exit(1);
});
