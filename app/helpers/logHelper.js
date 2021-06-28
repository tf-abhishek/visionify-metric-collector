'use strict';

require('dotenv').config()
const path = require('path')
require('winston-daily-rotate-file')
const {getLocalDateTime, timeZoneAbbr} = require('./datetimeHelper')
const {createLogger, format, transports} = require('winston')
const {combine, printf} = format;
const { metrics } = require('./helpers');

const actionCounter = metrics().counter({
    name: 'action_error_counter',
    help: 'error counter metric',
    labelNames: ['action_type'],
});

let logLevel = process.env.LOG_LEVEL || 'info';

const logFilePath = process.env.logfilepath || './logs';
const rotateFileTransport = new (transports.DailyRotateFile)({
    filename: `${logFilePath}/CoolerCache-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    timestamp: true,
});

// set logging format
const myFormat = printf(info => {
    return `${getLocalDateTime()} ${timeZoneAbbr()} - [${info.level}] : ${info.message}`;
});

const consoleTransport = new (transports.Console)({
    'timestamp': true,
    level: logLevel === 'silly' || logLevel === 'debug' ? logLevel : 'info'
});

// instantiate a new Winston Logger with the settings defined above
let loggerClient = createLogger({
    format: combine(
        myFormat
    ),
    transports: [
        rotateFileTransport,
        consoleTransport
    ],
    exitOnError: false
});

loggerClient.stream = {
    write: function (message, encoding) {
        loggerClient.info(message);
    },
};

// catch exceptions in dedicated file
loggerClient.exceptions.handle(
    new transports.File({
        filename: `${logFilePath}/psensor-unhandledExceptions.log`, format: combine(
            myFormat
        )
    })
);

const logger = {
    error: (text, isException = false) => {
        if (isException) {

            appInsightsMetrics().trackEvent({
                name: 'error_exception_logs', 
                properties: { text }
             });

            actionCounter.inc({
                action_type: 'error_exception_logs'
            });
        } else {

            appInsightsMetrics().trackEvent({
                name: 'error_logs', 
                properties: { text }
             });

            actionCounter.inc({
                action_type: 'error_logs'
            });
        }
        loggerClient.error(text);
    },
    info: (text) => {
        loggerClient.info(text);
    },
    debug: (text) => {
        loggerClient.debug(text);
    },
    warn: (text) => {

        appInsightsMetrics().trackEvent({
            name: 'warning_logs', 
            properties: { text }
         });

        actionCounter.inc({
            action_type: 'warning_logs'
        });
        loggerClient.warn(text);
    },
    silly: (text) => {
        loggerClient.silly(text);
    },
};

module.exports = logger;