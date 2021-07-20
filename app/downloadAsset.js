// 'use strict';
// const express = require('express');
// const client = require('prom-client');
// // const collectDefaultMetrics = client.collectDefaultMetrics;

// // define a custom prefix string for application metrics
// // collectDefaultMetrics();

// // a custom histogram metric which represents the latency
// // of each call to our API /api/greeting.
// const histogram = new client.Histogram({
//   name: 'my_application:hello_duration',
//   help: 'Duration of HTTP requests in ms',
//   labelNames: ['method', 'status_code'],
//   buckets: [0.1, 5, 15, 50, 100, 500]
// });

// // create the express application
// const app = express();
// const port = 9001;
// // app.use(bodyParser.json());
// // app.use(bodyParser.urlencoded({extended: false}));

// // our API
// app.use('/api/greeting', (request, response) => {
//   // start the timer for our custom metric - this returns a function
//   // called later to stop the timer
//   const end = histogram.startTimer();
//   const name = request.query.name ? request.query.name : 'World';
//   response.send({content: `Hello, ${name}!`});
//   // stop the timer
//   end({ method: request.method, 'status_code': 200 });
// });

// // expose our metrics at the default URL for Prometheus
// app.get('/metrics', (request, response) => {
// //   response.set('Content-Type', client.register.contentType);
//   response.send(client.register.metrics());
// });

// app.listen(port, () => console.log(`Hello world app listening on port ${port}!`));




const express = require('express')
const app = express()
const client = require('prom-client')
const collectDefaultMetrics = client.collectDefaultMetrics;
// const Registry = client.Registry;
// const register = new Registry();

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
