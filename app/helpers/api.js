const express = require('express')
const app = express()
const { metrics } = require('./helpers')

app.get('/metrics', async function (req, res) {
    const metricsResponse = await metrics().getMetrics()
    res.send(metricsResponse)
})

module.exports = {
    app
}