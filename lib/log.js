
// Load modules

var Os = require('os');
var Stream = require('stream');
var Hoek = require('hoek');
var Package = require('../package.json');


// Declare internals

var internals = {
    appVer: Package.version,
    delimiter: new Buffer('\n'),
    host: Os.hostname(),
    module: Package.name
};


module.exports = internals.Log = function (options) {

    Hoek.assert(this.constructor === internals.Log, 'Must be constructed with new');

    options = options || {};
    Stream.Readable.call(this, options);

    this._req = options.req;
    this._res = options.res;
    this._trace = options.trace;
    this._err = options.err;
};

Hoek.inherits(internals.Log, Stream.Readable);


internals.Log.prototype._read = function () {

    var formatted = internals.format(this._err, this._req, this._res, this._trace);
    this.push(formatted);
    this.push(internals.delimiter);
};


internals.format = function (err, req, res, trace) {

    req = req || {};
    res = res || {};

    var data = {
        event: internals.module,
        host: internals.host,
        appVer: internals.appVer,
        trace: trace,                       // contains all method/url and times
        request: {
            headers: req.headers
        },
        response: {
            headers: res.headers,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage
        },
        time: Date.now()
    };

    if (err) {
        data.err = {
            message: err.message,
            stack: err.stack
        };
    }


    return JSON.stringify(data);
};