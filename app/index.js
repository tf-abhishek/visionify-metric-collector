const axios = requrie('axios')
const Transport = require('azure-iot-device-mqtt').Mqtt;
var ModuleClient = require('azure-iot-device').ModuleClient;

process.env.METRIC_URLS = process.env.METRIC_URLS || 'http://edgeHub:9600/metrics, http://edgeAgent:9600/metrics, http://vfyInference:8001/metrics'

ModuleClient.fromEnvironment(Transport, function (err, client) {
  if (err) {
    console.log('error:' + err);
  } else {
    client.open(function (err) {
      if (err) {
        console.error('could not open IotHub client', err);
      } else {
        console.log('The client has successfully been opened. Now waitiing for direct method to be called')
        client.onMethod('getMetric', function (request, response) {
          // readMessage(client, request, response);
          console.log(request, response)
          let modules = process.env.METRIC_URLS || ''
          modules = modules.split(',')
          let metricResults = await Promise.all(modules.map(m => scrapeMetric(m)))
          let result = metricResults.join('\n\n')
          response.body = result
          return
        });
      }
    });
  }
})


async function scrapeMetric(url) {
  var config = {
    method: 'get',
    url: 'url',
  };

  axios(config)
    .then(function (response) {
      // console.log(JSON.stringify(response.data));
      console.log('RESPONSE DATA :: ' + `Module :: ${url}`, response.data, '\n\n\n')
      return response.data
    })
    .catch(function (error) {
      console.log('error :: ' + `Module :: ${url}`, error);
      return ''
    });
}