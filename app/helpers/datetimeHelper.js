'use strict';

// this npm module proactively handles DST
const moment = require('moment-timezone');

const timezone = moment.tz.guess();

const timeZoneAbbr = () => moment().tz(timezone).zoneAbbr();
const getUTCDate = () => moment().tz(timezone).utc().format('YYYY-MM-DD');
const getLocalDateTime = () => moment().tz(timezone).format('YYYY-MM-DD HH:mm:ss.SSSS');
const getHourForUTCDate = () => moment().tz(timezone).utc().format('YYYY_MM_DD_HH_00_00');
const getLocalDateTimeUTC = () => moment().tz(timezone).utc().format('YYYY-MM-DD HH:mm:ss.SSSS');
const elapsedTime = (then, now) => {
    const ms = moment(now).diff(moment(then));
    const d = moment.duration(ms);
    const timeElapsed = Math.floor(d.asHours()) + moment.utc(ms).format(":mm:ss.SSSS");
    const timeElapsedReadable = Math.floor(d.asHours()) + 'h ' + moment.utc(ms).format("mm") + 'm ' + moment.utc(ms).format("ss.SSSS") + 's';
    return {timeElapsed, timeElapsedReadable}
};
const daysOld = (date) => {
    const current = moment(getUTCDate())
    const past = moment(date, "YYYY-MM-DD")
    return current.diff(past, 'days')
};


module.exports = {
    daysOld,
    elapsedTime,
    getUTCDate,
    timeZoneAbbr,
    getLocalDateTime,
    getHourForUTCDate,
    getLocalDateTimeUTC
}
