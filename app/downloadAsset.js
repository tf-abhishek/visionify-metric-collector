const express = require('express')
const app = express()
const client = require('prom-client')
const collectDefaultMetrics = client.collectDefaultMetrics;
var os = require("os");
let deviceId = process.env.IOTEDGE_DEVICEID || os.hostname();
console.log({ deviceId })

collectDefaultMetrics({
    labels: { edge_device: deviceId },
});

const person_enter = new client.Counter({
    name: 'person_enter',
    help: 'Number of time someone enters the room.',
    labelNames: ['edge_device', 'customerID'],
})

const person_exit = new client.Counter({
    name: 'person_exit',
    help: 'Number of time someone exits the room.',
    labelNames: ['edge_device', 'customerID'],
})

const room_empty_duration = new client.Counter({
    name: 'room_empty_duration',
    help: 'duration of time someone was in the room.',
    labelNames: ['edge_device', 'customerID'],
})

const room_occupied_duration = new client.Counter({
    name: 'room_occupied_duration',
    help: 'duration of time room was empty.',
    labelNames: ['edge_device', 'customerID'],
})

let in_duration_count = 0
let out_duration_count = 0
let was_in = false
let is_in = 'false'

setInterval(() => {
    if (is_in) {
        in_duration_count++
    } else {
        out_duration_count++
    }
}, 1000)

setInterval(() => {
    was_in = is_in

    if (Math.random() < 0.2291) {
        is_in = !is_in
    }

    if (is_in) {
        if (was_in != is_in)
            person_enter.inc({
                edge_device: deviceId,
                customerID: 'Default'
            })
    } else {
        if (was_in != is_in)
            person_exit.inc({
                edge_device: deviceId,
                customerID: 'Default'
            })
    }
}, 60 * 1000)

setInterval(() => {
    room_empty_duration.inc({
        edge_device: deviceId,
        customerID: 'Default'
    }, in_duration_count)

    room_occupied_duration.inc({
        edge_device: deviceId,
        customerID: 'Default'
    }, out_duration_count)

    in_duration_count = 0
    out_duration_count = 0

}, 60 * 1000) //every minute



















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
