
// Load modules

var Os = require('os');
var Stream = require('stream');
var Hoek = require('hoek');
var SafeStringify = require('json-stringify-safe');
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

    var event = {
        event: internals.module,
        host: internals.host,
        appVer: internals.appVer,
        trace: trace,
        time: Date.now(),
        req: req
    };

    if (err) {
        event.err = {
            message: err.message,
            stack: err.stack
        };
    }

    if (res) {
        event.res = res;
    }

    return SafeStringify(event);
};