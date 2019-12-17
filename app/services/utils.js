const fs = require('fs');
const readline = require('readline');

const screenNameFilePath = './app/screenNameFile';    // TODO: this has to be a path on hosting machine
var _screenName = undefined;

exports.readScreenNameFromHost = async function () {
    const readStream = fs.createReadStream(screenNameFilePath);
    readLineIntefrace = readline.createInterface(readStream);

    for await (const line of readLineIntefrace) {
        _screenName = line;
    }

    return _screenName;
}

exports.getFileLastModifiedTime = function (fileFullPath) {
    let stats = undefined;
    try {
        stats = fs.statSync(fileFullPath);
    } catch (error) {
        return Date.MIN_VALUE;
    }

    return stats.mtime.toUTCString();
}