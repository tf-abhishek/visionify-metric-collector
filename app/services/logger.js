const { createLogger, format, transports } = require('winston');
const moment = require('moment-timezone');
require('winston-daily-rotate-file');
//const env = process.env.NODE_ENV;
const { combine, printf } = format;

const timestamp = () => moment().tz('America/Chicago').format('YYYY-MM-DD HH:mm:ss');

const myFormat = printf(info => {
    return `${timestamp()} - [${info.level}] : ${info.message}`;
});
const logFilePath = process.env.logfilepath || './logs';

const rotateFileTransport = new (transports.DailyRotateFile)({
    filename: `${logFilePath}/CoolerCache-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    timestamp: true,
});

const etransports = {
    console: new (transports.Console)({ 'timestamp': true }),
    rotateFile: rotateFileTransport
};

let logLevel = process.env.loglevel || 'info';
/* Set logging level to error if Production deployment 
if (env === 'PROD') {
  logLevel = process.env.loglevel || 'error';
}*/

let logger = createLogger({
    level: logLevel,
    format: combine(
        myFormat
    ),
    transports: [
        etransports.console,
        etransports.rotateFile
    ]
});

logger.stream = {
    write: function (message, encoding) {
        logger.info(message);
    },
};
logger.exceptions.handle(
    new transports.File({ filename: 'CC-unhandledExceptions.log' })
);
logger.exitOnError = false;

module.exports = logger;
