![nipple Logo](https://raw.github.com/hapijs/nipple/master/images/nipple.png)

HTTP Client Utilities

[![Build Status](https://secure.travis-ci.org/hapijs/nipple.png)](http://travis-ci.org/hapijs/nipple)

Lead Maintainer: [Wyatt Preul](https://github.com/wpreul)

## Usage
### Basic
```javascript
var Nipple = require('nipple');

Nipple.get('https://google.com/', function (err, res, payload) {
    /* do stuff */
});
```

### Advanced
```javascript
var Nipple = require('nipple');

var method = 'GET'; // GET, POST, PUT, DELETE
var uri    = 'https://google.com/';
var readableStream = Nipple.toReadableStream('foo=bar');

// all attributes are optional
var options = {
    payload:   readableStream || 'foo=bar' || new Buffer('foo=bar'),
    headers:   { /* http headers */ },
    redirects: 3,
    timeout:   1000,    // 1 second, default: unlimited
    maxBytes:  1048576, // 1 MB, default: unlimited
    rejectUnauthorized: true || false,
    downstreamRes: null,
    agent: null         // Node Core http.Agent
};

var optionalCallback = function (err, res) {

    // buffer the response stream
    Nipple.read(res, function (err, body) {
        /* do stuff */
    });
};

Nipple.request(method, uri, options, optionalCallback);
```


### `request(method, uri, options, [callback])`
- `method` -
- `uri` -
- `options` -
    - `payload` -
    - `headers` -
    - `rejectUnauthorized` -
    - `redirects` -
    - `agent` -
    - `timeout` -
- `callback` -

### `read(response, [options], callback)`
- `response` -
- `options` -
    - `timeout` -
    - `json` -
    - `maxBytes` -
- `callback` -

### `get(uri, [options], callback)`

Convenience method for DELETE operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.
- `callback` - The callback function using the signature `function (err, response, payload)` where:
    - `err` - Any errors that may have occurred during handling of the request.
    - `response` - The [HTTP Incoming Message](http://nodejs.org/api/http.html#http_http_incomingmessage)
       object, which is also a readable stream.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

### `post(uri, [options], callback)`

Convenience method for DELETE operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.
- `callback` - The callback function using the signature `function (err, response, payload)` where:
    - `err` - Any errors that may have occurred during handling of the request.
    - `response` - The [HTTP Incoming Message](http://nodejs.org/api/http.html#http_http_incomingmessage)
       object, which is also a readable stream.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

### `put(uri, [options], callback)`

Convenience method for DELETE operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.
- `callback` - The callback function using the signature `function (err, response, payload)` where:
    - `err` - Any errors that may have occurred during handling of the request.
    - `response` - The [HTTP Incoming Message](http://nodejs.org/api/http.html#http_http_incomingmessage)
       object, which is also a readable stream.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

### `delete(uri, [options], callback)`

Convenience method for DELETE operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.
- `callback` - The callback function using the signature `function (err, response, payload)` where:
    - `err` - Any errors that may have occurred during handling of the request.
    - `response` - The [HTTP Incoming Message](http://nodejs.org/api/http.html#http_http_incomingmessage)
       object, which is also a readable stream.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).


### `toReadableStream(payload, [encoding])`

Creates a [readable stream](http://nodejs.org/api/stream.html#stream_class_stream_readable)
for the provided payload and encoding.
- `payload` - The Buffer or string to be wrapped in a readable stream.
- `encoding` - The encoding to use. Must be a valid Buffer encoding, such as 'utf8' or 'ascii'.

```javascript
var stream = Nipple.toReadableStream(new Buffer('Hello', 'ascii'), 'ascii');
var read = stream.read();
// read -> 'Hello'
```

### `parseCacheControl(field)`

Parses the provided *cache-control* request header value into an object containing
a property for each directive and it's value. Boolean directives, such as "private"
or "no-cache" will be set to the boolean `true`.
- `field` - The header cache control value to be parsed.

```javascript
var  result = Nipple.parseCacheControl('private, max-age=0, no-cache');
// result.private -> true
// result['max-age'] -> 0
// result['no-cache'] -> true
```
