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
//const logFilePath = path.join('/home/csiadmin/psensorApp/', 'logs');

// set logging format
const myFormat = printf(info => {
    return `${getLocalDateTime()} ${timeZoneAbbr()} - [${info.level}] : ${info.message}`;
});

// set transports
//const rotateFileTransport = new (transports.DailyRotateFile)({
//    filename: `${logFilePath}/psensor-%DATE%.log`,
//    datePattern: 'YYYY-MM-DD',
//    zippedArchive: true,
//    maxSize: '5m',
//    maxFiles: '14d',
//    timestamp: true,
//    level: logLevel === 'silly' ? 'silly' : 'debug'
//});
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
        //rotateFileTransport,
        consoleTransport
    ],
    exitOnError: false
});

//loggerClient.stream = {
//    write: function (message, encoding) {
//        loggerClient.info(message);
//    },
//};

// catch exceptions in dedicated file
//loggerClient.exceptions.handle(
//    new transports.File({
//        filename: `${logFilePath}/psensor-unhandledExceptions.log`, format: combine(
//            myFormat
//        )
//    })
//);

const logger = {
    error: (text, isException = false) => {
        if (isException) {
            actionCounter.inc({
                action_type: 'error_exception_logs'
            });
        } else {
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