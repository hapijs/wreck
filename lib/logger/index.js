// Load modules

var EventEmitter = require('events').EventEmitter;
var FS = require('fs');
var Stream = require('stream');
var SafeStringify = require('json-stringify-safe');
var Util = require('util');


// Declare internals

var internals = {};


internals.Logger = function () {

    var self = this;

    self.file = process.env.WRECK_DEBUG_FILE;
    self.console = process.env.WRECK_DEBUG_CONSOLE;

    if (self.file) {
        self.active = true;
        self.stream = FS.createWriteStream(self.file, { flags: 'a+' });

        self.on('write', function (data) {
            self.stream.write(data);
        });
    }

    if (self.console) {
        self.active = true;
        self.on('write', function (data) {
            console.log(data);
        });
    }
}


Util.inherits(internals.Logger, EventEmitter);


internals.Logger.prototype.log = function (logData, read) {

    var self = this;

    if (!self.active) {
        return;
    }

    if (logData.err) {
        internals.log(self, logData);
    }
    else {
        read(logData.req.res, null, function (err, payload) {

            logData.payload = payload;
            internals.log(self, logData);
        });
    }
}


internals.log = function (self, logData) {

    var data = {
        method: logData.req.method,
        url: logData.url,
        options: logData.options,
        response: {
            payload: logData.payload ? logData.payload.toString() : undefined,
            headers: logData.req.res ? logData.req.res.headers : undefined,
            statusCode: logData.req.res ? logData.req.res.statusCode : undefined,
            statusMessage: logData.req.res ? logData.req.res.statusMessage : undefined
        },
        beginTime: new Date(logData.beginTime),
        endTime: new Date(),
        responseTime: new Date().getTime() - logData.beginTime,
        error: logData.err,
    };

    var out = SafeStringify(data, null, 4);
    self.emit('write', out);

}


module.exports = internals.Logger;
