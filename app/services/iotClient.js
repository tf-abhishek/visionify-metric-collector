var Message = require('azure-iot-device').Message;
let CLIENT

async function setClient(client) {
    CLIENT = client
    console.log('Client Has been set ..................................')
    return true
}

async function sendMessageToModule(msgChannel, msgObject) {
    console.log('recieved message to send message to client.............................', msgChannel, msgObject)
    if (!msgChannel) {
        // throw new Error('Please specify a message Channel')
        console.error('Please specify a message Channel')
        return 
    }
    if (!CLIENT) {
        // throw new Error('Client Not Found')
        console.error('Client Not Found')
        return 
    }
    var message = JSON.stringify(msgObject || {})
    if (message) {
        var outputMsg = new Message(message);
        CLIENT.sendOutputEvent(msgChannel, outputMsg, (err, res) => {
            console.log(err, res)
        });
    }
}




module.exports = {
    setClient,
    sendMessageToModule
}