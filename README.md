![wreck Logo](https://raw.github.com/hapijs/wreck/master/images/wreck.png)

HTTP Client Utilities

[![Build Status](https://secure.travis-ci.org/hapijs/wreck.png)](http://travis-ci.org/hapijs/wreck)

Lead Maintainer: [Wyatt Preul](https://github.com/wpreul)

## Usage
### Basic
```javascript
var Wreck = require('wreck');

Wreck.get('https://google.com/', function (err, res, payload) {
    /* do stuff */
});
```

### Advanced
```javascript
var Wreck = require('wreck');

var method = 'GET'; // GET, POST, PUT, DELETE
var uri    = 'https://google.com/';
var readableStream = Wreck.toReadableStream('foo=bar');

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
    Wreck.read(res, null, function (err, body) {
        /* do stuff */
    });
};

Wreck.request(method, uri, options, optionalCallback);
```


### `request(method, uri, [options, [callback]])`

Initiate an HTTP request.
- `method` - A string specifying the HTTP request method, defaulting to 'GET'.
- `uri` - The URI of the requested resource.
- `options` - An optional configuration object. To omit this argument but still
  use a callback, pass `null` in this position. The options object supports the
  following optional keys:
    - `payload` - The request body as string, Buffer, or Readable Stream.
    - `headers` - An object containing request headers.
    - `rejectUnauthorized` - [TLS](http://nodejs.org/api/tls.html) flag indicating
      whether the client should reject a response from a server with invalid certificates.
    - `redirects` - The maximum number of redirects to follow.
    - `agent` - Node Core [http.Agent](http://nodejs.org/api/http.html#http_class_http_agent).
    - `timeout` - The number of milliseconds to wait without receiving a response
      before aborting the request. Defaults to unlimited.
- `callback` - The optional callback function using the signature `function (err, response)` where:
    - `err` - Any error that may have occurred during the handling of the request.
    - `response` - The [HTTP Incoming Message](http://nodejs.org/api/http.html#http_http_incomingmessage)
       object, which is also a readable stream.

### `read(response, options, callback)`
- `response` - An HTTP Incoming Message object.
- `options` - `null` or a configuration object with the following optional keys:
    - `timeout` - The number of milliseconds to wait while reading data before
    aborting handling of the response. Defaults to unlimited.
    - `json` - A flag indicating whether the payload should be parsed as JSON
    if the response indicates a JSON content-type.
    - `maxBytes` - The maximum allowed response payload size. Defaults to unlimited.
- `callback` - The callback function using the signature `function (err, payload)` where:
    - `err` - Any error that may have occurred while reading the response.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

### `get(uri, [options], callback)`

Convenience method for GET operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.
- `callback` - The callback function using the signature `function (err, response, payload)` where:
    - `err` - Any error that may have occurred during handling of the request.
    - `response` - The [HTTP Incoming Message](http://nodejs.org/api/http.html#http_http_incomingmessage)
       object, which is also a readable stream.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

### `post(uri, [options], callback)`

Convenience method for POST operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.
- `callback` - The callback function using the signature `function (err, response, payload)` where:
    - `err` - Any error that may have occurred during handling of the request.
    - `response` - The [HTTP Incoming Message](http://nodejs.org/api/http.html#http_http_incomingmessage)
       object, which is also a readable stream.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

### `put(uri, [options], callback)`

Convenience method for PUT operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.
- `callback` - The callback function using the signature `function (err, response, payload)` where:
    - `err` - Any error that may have occurred during handling of the request.
    - `response` - The [HTTP Incoming Message](http://nodejs.org/api/http.html#http_http_incomingmessage)
       object, which is also a readable stream.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

### `delete(uri, [options], callback)`

Convenience method for DELETE operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.
- `callback` - The callback function using the signature `function (err, response, payload)` where:
    - `err` - Any error that may have occurred during handling of the request.
    - `response` - The [HTTP Incoming Message](http://nodejs.org/api/http.html#http_http_incomingmessage)
       object, which is also a readable stream.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).


### `toReadableStream(payload, [encoding])`

Creates a [readable stream](http://nodejs.org/api/stream.html#stream_class_stream_readable)
for the provided payload and encoding.
- `payload` - The Buffer or string to be wrapped in a readable stream.
- `encoding` - The encoding to use. Must be a valid Buffer encoding, such as 'utf8' or 'ascii'.

```javascript
var stream = Wreck.toReadableStream(new Buffer('Hello', 'ascii'), 'ascii');
var read = stream.read();
// read -> 'Hello'
```

### `parseCacheControl(field)`

Parses the provided *cache-control* request header value into an object containing
a property for each directive and it's value. Boolean directives, such as "private"
or "no-cache" will be set to the boolean `true`.
- `field` - The header cache control value to be parsed.

```javascript
var  result = Wreck.parseCacheControl('private, max-age=0, no-cache');
// result.private -> true
// result['max-age'] -> 0
// result['no-cache'] -> true
```
