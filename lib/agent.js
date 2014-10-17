// Adapted from:
// keep-alive-agent https://github.com/ceejbot/keep-alive-agent,  copyright (c) 2012 C J Silverio, MIT licensed

// Load modules

var Http = require('http');
var Https = require('https');
var Hoek = require('hoek');


// Declare internals

var internals = {
    defaults: {
        keepAlive: true,
        maxFreeSockets: 256
    }
};


exports.Http = internals.HttpAgent = function (options) {

    // If this is node 0.11 or later return the newer agent, it supports keep alive
    var settings = Hoek.applyToDefaults(internals.defaults, options || {});
    var agent = new Http.Agent(settings);
    if (agent.keepAlive) {
        return agent;
    }

    Http.Agent.call(this, settings);

    // Keys are host:port names, values are lists of sockets.
    this._idleSockets = {};

    // Replace the 'free' listener set up by the default node Agent above.
    this.removeAllListeners('free');
    this.on('free', internals.HttpAgent.prototype.free.bind(this));
};

Hoek.inherits(internals.HttpAgent, Http.Agent);


internals.HttpAgent.prototype.free = function (socket, host, port, localAddress) {

    var name = internals.buildNameKey(host, port, localAddress);

    // If the socket is still useful, return it to the idle pool.
    if (this.isSocketUsable(socket)) {
        socket._requestCount = ++socket._requestCount || 1;

        this._idleSockets[name] = this._idleSockets[name] || [];

        if (this._idleSockets[name].length < this.options.maxFreeSockets) {
            this._idleSockets[name].push(socket);
        }
    }

    // If we had any pending requests for this name, send the next one off now.
    if (this.requests[name] && this.requests[name].length) {
        var nextRequest = this.requests[name].shift();
        this.addRequest(nextRequest, host, port, localAddress);
    }
};


internals.HttpAgent.prototype.isSocketUsable = function (socket) {

    return !socket.destroyed;
};


internals.HttpAgent.prototype.addRequest = function (request, host, port, localAddress) {

    var name = internals.buildNameKey(host, port, localAddress);

    var socket = this.nextIdleSocket(name);
    if (socket) {
        return request.onSocket(socket);
    }

    return Http.Agent.prototype.addRequest.call(this, request, host, port, localAddress);
};


internals.HttpAgent.prototype.nextIdleSocket = function (name) {

    if (!this._idleSockets[name]) {
        return null;
    }

    var socket;
    while (socket = this._idleSockets[name].pop()) {
        // Check that this socket is still healthy after sitting around on the shelf.
        if (this.isSocketUsable(socket)) {
            return socket;
        }
    }

    return null;
};


internals.HttpAgent.prototype.removeSocket = function (socket, name, host, port, localAddress) {

    if (this._idleSockets[name] && this._idleSockets[name].indexOf(socket) !== -1) {
        var index = this._idleSockets[name].indexOf(socket);
        this._idleSockets[name].splice(index, 1);
    }

    Http.Agent.prototype.removeSocket.call(this, socket, name, host, port, localAddress);
};


exports.Https = internals.HttpsAgent = function (options) {

    options = options || {};
    options.keepAlive = true;
    var agent = new Https.Agent(options);
    if (agent.keepAlive) {
        return agent;
    }

    Https.Agent.call(this, options);                                // Sets required protocol for node 0.11+
    internals.HttpAgent.call(this, options);

    this.createConnection = Https.globalAgent.createConnection;
};

Hoek.inherits(internals.HttpsAgent, internals.HttpAgent);


internals.HttpsAgent.prototype.isSocketUsable = function (socket) {

    // TLS sockets null out their secure pair's ssl field in destroy() and
    // do not set a destroyed flag the way non-secure sockets do.
    return socket.pair && socket.pair.ssl;
};


internals.buildNameKey = function (host, port, localAddress) {

    var name = host + ':' + port;
    if (localAddress) {
        name += ':' + localAddress;
    }

    return name;
};
