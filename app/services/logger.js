const { createLogger, format, transports } = require('winston');
const moment = require('moment-timezone');
require('winston-daily-rotate-file');
//const env = process.env.NODE_ENV;
const { combine, printf } = format;
const timestamp = () => moment().tz('America/Chicago').format('YYYY-MM-DD HH:mm:ss');

const { metrics } = require('./../helpers/helpers');
const actionCounter = metrics().counter({
    name: 'action_error_counter',
    help: 'error counter metric',
    labelNames: ['action_type'],
});

const myFormat = printf(info => {
    return `${timestamp()} - [${info.level}] : ${info.message}`;
});
const logFilePath = process.env.logfilepath || './logs';

//const rotateFileTransport = new (transports.DailyRotateFile)({
//    filename: `${logFilePath}/CoolerCache-%DATE%.log`,
//    datePattern: 'YYYY-MM-DD',
//    zippedArchive: true,
//    maxSize: '20m',
//    maxFiles: '14d',
//    timestamp: true,
//});

//const etransports = {
//    console: new (transports.Console)({ 'timestamp': true }),
//    rotateFile: rotateFileTransport
//};

let logLevel = process.env.loglevel || 'info';
/* Set logging level to error if Production deployment 
if (env === 'PROD') {
  logLevel = process.env.loglevel || 'error';
}*/

let loggerClient = createLogger({
    level: logLevel,
    format: combine(
        myFormat
    ),
//    transports: [
//        etransports.console,
//        etransports.rotateFile
//    ]
});

//loggerClient.stream = {
//    write: function (message, encoding) {
//        logger.info(message);
//    },
//};
//loggerClient.exceptions.handle(
//    new transports.File({ filename: 'CC-unhandledExceptions.log' })
//);
//loggerClient.exitOnError = false;

const logger = {
    error: (text, isException = false) => {
        if (isException) {
            actionCounter.inc({
                action_type: 'error_exception_logs'
            })
        } else {
          actionCounter.inc({
            action_type: 'error_logs'
          })
        }
        let strText = typeof text === 'object' ? JSON.stringify(text) : text
        loggerClient.error(strText)
    },
    info: (text) => {
        loggerClient.info(text)
    },
    debug: (text) => {
        loggerClient.debug(text)
    },
    warn: (text) => {
        actionCounter.inc({
            action_type: 'warning_logs'
        })
        loggerClient.warn(text)
    },
    silly: (text) => {
        loggerClient.silly(text)
    },
  }

module.exports = logger;
