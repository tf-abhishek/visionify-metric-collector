'use strict';

const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
const defaultLabels = ['neid', 'hostname', 'module'];

const getMetricData = (data = {}, metadata = {}) => {
  let metricData = data;
  if (typeof metricData === 'object') {
    metricData = {
      ...metadata,
      ...data,
    };
  }
  return metricData;
};

const metricClientConfig = (config = {}) => {
  const labelNames = config.labelNames && config.labelNames.length > 0 ? config.labelNames.concat(defaultLabels) : defaultLabels;
  
  return {
      ...config,
      labelNames,
  };
};

class Counter {
  constructor(client) {
    this.client = client;
  }

  inc(data = {}) {
    const theData = {
      ...global.defaultMetadata,
      ...data,
    };
    return this.client.inc(getMetricData(theData));
  }
}

class Gauge {
  constructor(client) {
    this.client = client;
  }

  inc(data = {}) {
    const theData = {
      ...global.defaultMetadata,
      ...data,
    };
    this.client.inc(getMetricData(theData));
  }

  dec(data = {}) {
    const theData = {
      ...global.defaultMetadata,
      ...data,
    };
    this.client.dec(getMetricData(theData));
  }

  set(data = {}) {
    const theData = {
      ...global.defaultMetadata,
      ...data,
    };
    this.client.set(getMetricData(theData));
  }

  setToCurrentTime() {
    this.client.setToCurrentTime();
  }

  startTimer() {
    this.client.startTimer();
  }
}
class Histogram {
  constructor(client) {
    this.client = client;
  }

  observe(data = {}) {
    const theData = {
      ...global.defaultMetadata,
      ...data,
    };
    this.client.observe(getMetricData(theData));
  }

  startTimer() {
    this.client.startTimer();
  }
}
class Summary {
  constructor(client) {
    this.client = client;
  }

  observe(data = {}) {
    const theData = {
      ...global.defaultMetadata,
      ...data,
    };
    this.client.observe(getMetricData(theData));
  }

  startTimer() {
    this.client.startTimer();
  }
}

const clientWrapper = (config = {}) => {
  collectDefaultMetrics({
    timeout: config.timeout || 5000,
    prefix: config.prefix || 'default_metrics_',
  });

  const getMetrics = () => client.register.metrics();

  const counter = (config = {}) => {
    const configuration = metricClientConfig(config);
    const metricClient = new client.Counter(configuration);
    return new Counter(metricClient);
  };

  const gauge = (config = {}) => {
    const configuration = metricClientConfig(config);
    const metricClient = new client.Gauge(configuration);
    return new Gauge(metricClient);
  };

  const summary = (config = {}) => {    
    const configuration = metricClientConfig(config);
    const metricClient = new client.Summary(configuration);
    return new Summary(metricClient);
  };

  const histogram = (config = {}) => {
    const configuration = metricClientConfig(config);
    const metricClient = new client.Histogram(configuration);
    return new Histogram(metricClient);
  };

  return {
    getMetrics,
    counter,
    gauge,
    summary,
    histogram,
  };
};

module.exports = config => clientWrapper(config);