const axios = require('axios')
const os = require('os')
const parsePrometheusTextFormat = require('parse-prometheus-text-format');

process.env.METRIC_URLS = process.env.METRIC_URLS || 'http://localhost:8001/metrics,http://localhost:8000/metrics' // 'http://edgeHub:9600/metrics, http://edgeAgent:9600/metrics, http://vfyInference:8001/metrics'
console.log('Scraping metrics at there endpoints :: ', process.env.METRIC_URLS)
process.env.INTERVAL = process.env.INTERVAL || 1
process.env.PUSH_URL = process.env.PUSH_URL || 'http://localhost:4000/v1'
process.env.GET_CUSTOMER_ID_URL = process.env.GET_CUSTOMER_ID_URL || 'https://18tx2p0fm6.execute-api.us-east-2.amazonaws.com/api/iot-hub/device'


const PUSH_URL = process.env.PUSH_URL
const DEVICE_ID = process.env.IOTEDGE_DEVICEID || os.hostname();

async function getAllMetric(metadata) {
  const { deviceID, customerID } = metadata
  // get list of urls to scrape metric from
  let modules = process.env.METRIC_URLS || ''
  modules = modules.split(',')

  const timestamp = new Date()

  // get all teh metric and convert them to json
  let metricResults = await Promise.all(modules.map(m => scrapeMetric(m)))
  metricResults = metricResults.join('\n\n')
  metricResults = parsePrometheusTextFormat(metricResults)

  const resultArray = []

  // only for counters.. will add other types later
  for (let metric of metricResults) {
    const { name, help, type, metrics } = metric
    if (type !== "COUNTER") {
      continue
    }
    let baseObj = { name, help, type, timestamp }
    for (let item of metrics) {
      let { edge_device = deviceID, edge_modules, customer_id = customerID } = item.labels || {}
      resultArray.push({ ...baseObj, edge_device, edge_modules, customer_id, value: +item.value })
    }
  }
  // console.log(resultArray)
  return resultArray
}

async function scrapeMetric(url) {
  var config = {
    method: 'get',
    url: url,
  };

  return axios(config)
    .then(function (response) {
      return response.data
    })
    .catch(function (error) {
      console.log('error :: ' + `Module :: ${url}`, error);
      return ''
    });
}

async function sendMetric(url, metadata) {
  let metric = await getAllMetric(metadata)

  var axiosConfig = {
    method: 'post',
    url,
    headers: {
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(metric)
  };


  axios(axiosConfig)
    .then(function (response) {
      console.log('Metrics Pushed successfully to ' + url)
      // console.log(response.data, response.status)
    })
    .catch(function (error) {
      console.error('Unable to push metric to :: ' + url)
      console.error('ERROR :: ', error.toString())
    });

}

async function StartProcess() {
  let url = process.env.GET_CUSTOMER_ID_URL
  var config = {
    method: 'get',
    url: url + `/${DEVICE_ID}`,
    headers: {}
  };

  let customerID = await axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
      return response.data.details.tags.customer
    })
    .catch(function (error) {
      // console.log(error);
      console.log('COuld not find Customer Id for deviceId :: ', DEVICE_ID)
      return null
    });




  // TODO comment it out after development
  if (!customerID) {
    console.log('Could not find the customer ID... Using default customer id of Rhoynar')
  }
  customerID = customerID || 'Rhoynar'



  if (!customerID) {
    console.log('Could not find the customer ID... please make sure the device is registered')
  }



  sendMetric(process.env.PUSH_URL, { deviceID: DEVICE_ID, customerID })

  setInterval(() => {
    sendMetric(process.env.PUSH_URL, { deviceID: DEVICE_ID, customerID })
  }, process.env.INTERVAL * 60 * 1000)
}

StartProcess()
