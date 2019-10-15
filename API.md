## Usage

```javascript
const Wreck = require('@hapi/wreck');

const example = async function () {

    const { res, payload } = await Wreck.get('http://example.com');
    console.log(payload.toString());
};

try {
    example();
}
catch (ex) {
    console.error(ex);
}
```

### Advanced

```javascript
const Wreck = require('@hapi/wreck');

const method = 'GET'; // GET, POST, PUT, DELETE
const uri = '/';
const readableStream = Wreck.toReadableStream('foo=bar');

const wreck = Wreck.defaults({
    headers: { 'x-foo-bar': 123 },
    agents: {
        https: new Https.Agent({ maxSockets: 100 }),
        http: new Http.Agent({ maxSockets: 1000 }),
        httpsAllowUnauthorized: new Https.Agent({ maxSockets: 100, rejectUnauthorized: false })
    }
});

// cascading example -- does not alter `wreck`
// inherits `headers` and `agents` specified above
const wreckWithTimeout = wreck.defaults({
    timeout: 5
});

// all attributes are optional
const options = {
    baseUrl: 'https://www.example.com',
    payload: readableStream || 'foo=bar' || Buffer.from('foo=bar'),
    headers: { /* http headers */ },
    redirects: 3,
    beforeRedirect: (redirectMethod, statusCode, location, resHeaders, redirectOptions, next) => next(),
    redirected: function (statusCode, location, req) {},
    timeout: 1000,    // 1 second, default: unlimited
    maxBytes: 1048576, // 1 MB, default: unlimited
    rejectUnauthorized: true || false,
    agent: null,         // Node Core http.Agent
    secureProtocol: 'SSLv3_method', // The SSL method to use
    ciphers: 'DES-CBC3-SHA' // The TLS ciphers to support
};

const example = async function () {

    const promise = wreck.request(method, uri, options);
    try {
        const res = await promise;
        const body = await Wreck.read(res, options);
        console.log(body.toString());
    }
    catch (err) {
        // Handle errors
    }
};
```

Use `promise.req.abort()` to terminate the request early. Note that this is limited to the initial request only.
If the request was already redirected, aborting the original request will not abort execution of pending redirections.

### `defaults(options)`

Returns a *new* instance of Wreck which merges the provided `options` with those provided on a per-request basis. You can call defaults repeatedly to build up multiple clients.
- `options` - Config object containing settings for both `request` and `read` operations as well as:
    - `agents` - an object that contains the agents for pooling connections with the following required keys:
        - `http` - an [HTTP Agent](http://nodejs.org/api/http.html#http_class_http_agent) instance.
        - `https` - an [HTTPS Agent](https://nodejs.org/api/https.html#https_class_https_agent) instance.
        - `httpsAllowUnauthorized` - an [HTTPS Agent](https://nodejs.org/api/https.html#https_class_https_agent) instance.
    - `events` - if `true`, enables events. Events are available via the `events` emitter property.

### `request(method, uri, [options])`

Initiate an HTTP request.
- `method` - a string specifying the HTTP request method. Defaults to `'GET'`.
- `uri` - the URI of the requested resource.

- `options` - optional configuration object with the following keys:

    - `agent` - Node Core [http.Agent](http://nodejs.org/api/http.html#http_class_http_agent). Defaults to either `wreck.agents.http` or `wreck.agents.https`.  Setting to `false` disables agent pooling.

    - `baseUrl` - fully qualified URL string used as the base URL. Most useful with `Wreck.defaults()` when making multiple requests to the same domain. For example, if `baseUrl` is `https://example.com/api/`, then requesting `/end/point?test=true` will fetch `https://example.com/end/point?test=true`. Any query string in the `baseUrl` will be overwritten with the query string in the `uri` When `baseUrl` is given, `uri` must also be a string. In order to retain the `/api/` portion of the `baseUrl` in the example, the `path` must not start with a leading `/` and the `baseUrl` must end with a trailing `/`.

    - `beforeRedirect` - a function to call before a redirect is triggered, using the signature `async function(redirectMethod, statusCode, location, resHeaders, redirectOptions, next)` where:
          - `redirectMethod` - A string specifying the redirect method.
          - `statusCode` - HTTP status code of the response that triggered the redirect.
          - `location` - The redirect location string.
          - `resHeaders` - An object with the headers received as part of the redirection response.
          - `redirectOptions` - Options that will be applied to the redirect request. Changes to this object are applied to the redirection request.
          - `next` - the callback function called to perform the redirection using signature `function()`.
          
    - `ciphers` - [TLS](https://nodejs.org/api/tls.html#tls_modifying_the_default_tls_cipher_suite) list of TLS ciphers to override node's default. The possible values depend on your installation of OpenSSL. Read the official OpenSSL docs for possible [TLS_CIPHERS](https://www.openssl.org/docs/man1.0.2/apps/ciphers.html#CIPHER-LIST-FORMAT).

    - `headers` - an object containing the request headers.

    - `payload` - the request body as a string, Buffer, readable stream, or an object that can be serialized using `JSON.stringify()`.

    - `redirect303` - if `true`, a HTTP 303 status code will redirect using a GET method. Defaults to `false` (no redirection on 303).

    - `redirected` - a function to call when a redirect was triggered, using the signature `function(statusCode, location, req)` where:

      - `statusCode` - HTTP status code of the response that triggered the redirect.
      - `location` - The redirected location string.
      - `req` - The new [ClientRequest](http://nodejs.org/api/http.html#http_class_http_clientrequest) object which replaces the one initially returned.

    - `redirectMethod` - override the HTTP method used when following 301 and 302 redirections. Defaults to the original method.

    - `redirects` - the maximum number of redirects to follow. Default to `false` (no redirects).

    - `rejectUnauthorized` - [TLS](http://nodejs.org/api/tls.html) flag indicating whether the client should reject a response from a server with invalid certificates. This cannot be set at the same time as the `agent` option is set.

    - `secureProtocol` - [TLS](http://nodejs.org/api/tls.html) flag indicating the SSL method to use, e.g. `SSLv3_method` to force SSL version 3. The possible values depend on your installation of OpenSSL. Read the official OpenSSL docs for possible [SSL_METHODS](http://www.openssl.org/docs/ssl/ssl.html#DEALING_WITH_PROTOCOL_METHODS).

    - `socketPath` - a UNIX socket path string for direct server connection.

    - `timeout` - number of milliseconds to wait without receiving a response before aborting the request. Defaults to `0` (no limit).

Returns a promise that resolves into a node response object. The promise has a `req` property which is the instance of the node.js [ClientRequest](http://nodejs.org/api/http.html#http_class_http_clientrequest) object.

### `read(response, options)`

- `response` - An HTTP Incoming Message object.
- `options` - `null` or a configuration object with the following optional keys:

    - `gunzip` - determines how to handle gzipped payloads. Defaults to `false`.
        - `true` - only try to gunzip if the response indicates a gzip content-encoding.
        - `false` - explicitly disable gunzipping.
        - `force` - try to gunzip regardless of the content-encoding header.

    - `json` - determines how to parse the payload as JSON:
        - `false` - leaves payload raw. This is the default value.
        - `true` - only try `JSON.parse` if the response indicates a JSON content-type.
        - `'strict'` - as `true`, except returns an error for non-JSON content-type.
        - `'force'` - try `JSON.parse` regardless of the content-type header.

    - `maxBytes` - the maximum allowed response payload size. Defaults to `0` (no limit).

    - `timeout` - the number of milliseconds to wait while reading data before aborting handling of the response. Defaults to `0`.

Returns a promise that resolves into the payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

#### Notes about gunzip

When using gunzip, HTTP headers `Content-Encoding`, `Content-Length`, `Content-Range` and `ETag` won't reflect the reality as the payload has been uncompressed.

### `get(uri, [options])`

Convenience method for GET operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.

Returns a promise that resolves into an object with the following properties:
    - `res` - The [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
       object, which is a readable stream that has "ended" and contains no more data to read.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

Throws any error that may have occurred during handling of the request or a Boom error object if the response has an error status
code (i.e. 4xx or 5xx). If the error is a boom error object it will have the following properties in addition to the standard boom
properties:
    - `data.isResponseError` - boolean, indicates if the error is a result of an error response status code
    - `data.headers` - object containing the response headers
    - `data.payload` - the payload in the form of a Buffer or as a parsed object
    - `data.res` - the [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage) object

### `post(uri, [options])`

Convenience method for POST operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.

Returns a promise that resolves into an object with the following properties:
    - `res` - The [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
       object, which is a readable stream that has "ended" and contains no more data to read.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

Throws any error that may have occurred during handling of the request or a Boom error object if the response has an error status
code (i.e. 4xx or 5xx). If the error is a boom error object it will have the following properties in addition to the standard boom
properties:
    - `data.isResponseError` - boolean, indicates if the error is a result of an error response status code
    - `data.headers` - object containing the response headers
    - `data.payload` - the payload in the form of a Buffer or as a parsed object
    - `data.res` - the [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage) object

### `patch(uri, [options])`

Convenience method for PATCH operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.

Returns a promise that resolves into an object with the following properties:
    - `res` - The [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
       object, which is a readable stream that has "ended" and contains no more data to read.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

Throws any error that may have occurred during handling of the request or a Boom error object if the response has an error status
code (i.e. 4xx or 5xx). If the error is a boom error object it will have the following properties in addition to the standard boom
properties:
    - `data.isResponseError` - boolean, indicates if the error is a result of an error response status code
    - `data.headers` - object containing the response headers
    - `data.payload` - the payload in the form of a Buffer or as a parsed object
    - `data.res` - the [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage) object

### `put(uri, [options])`

Convenience method for PUT operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.

Returns a promise that resolves into an object with the following properties:
    - `res` - The [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
       object, which is a readable stream that has "ended" and contains no more data to read.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

Throws any error that may have occurred during handling of the request or a Boom error object if the response has an error status
code (i.e. 4xx or 5xx). If the error is a boom error object it will have the following properties in addition to the standard boom
properties:
    - `data.isResponseError` - boolean, indicates if the error is a result of an error response status code
    - `data.headers` - object containing the response headers
    - `data.payload` - the payload in the form of a Buffer or as a parsed object
    - `data.res` - the [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage) object

### `delete(uri, [options])`

Convenience method for DELETE operations.
- `uri` - The URI of the requested resource.
- `options` - Optional config object containing settings for both `request` and
  `read` operations.

Returns a promise that resolves into an object with the following properties:
    - `res` - The [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
       object, which is a readable stream that has "ended" and contains no more data to read.
    - `payload` - The payload in the form of a Buffer or (optionally) parsed JavaScript object (JSON).

Throws any error that may have occurred during handling of the request or a Boom error object if the response has an error status
code (i.e. 4xx or 5xx). If the error is a boom error object it will have the following properties in addition to the standard boom
properties:
    - `data.isResponseError` - boolean, indicates if the error is a result of an error response status code
    - `data.headers` - object containing the response headers
    - `data.payload` - the payload in the form of a Buffer or as a parsed object
    - `data.res` - the [HTTP Incoming Message](https://nodejs.org/api/http.html#http_class_http_incomingmessage) object

### `toReadableStream(payload, [encoding])`

Creates a [readable stream](http://nodejs.org/api/stream.html#stream_class_stream_readable)
for the provided payload and encoding.
- `payload` - The Buffer or string to be wrapped in a readable stream.
- `encoding` - The encoding to use. Must be a valid Buffer encoding, such as 'utf8' or 'ascii'.

<!-- eslint-disable no-unused-vars -->
<!-- eslint-disable no-undef -->
```javascript
const stream = Wreck.toReadableStream(Buffer.from('Hello', 'ascii'), 'ascii');
const read = stream.read();
// read -> 'Hello'
```

### `parseCacheControl(field)`

Parses the provided *cache-control* request header value into an object containing
a property for each directive and it's value. Boolean directives, such as "private"
or "no-cache" will be set to the boolean `true`.
- `field` - The header cache control value to be parsed.

<!-- eslint-disable no-unused-vars -->
<!-- eslint-disable no-undef -->
```javascript
const result = Wreck.parseCacheControl('private, max-age=0, no-cache');
// result.private -> true
// result['max-age'] -> 0
// result['no-cache'] -> true
```

### `agents`

An object containing the node agents used for pooling connections for `http` and `https`. The properties are `http`, `https`, and `httpsAllowUnauthorized` which is an `https` agent with `rejectUnauthorized` set to false.  All agents have `maxSockets` configured to `Infinity`.  They are each instances of the Node.js [Agent](http://nodejs.org/api/http.html#http_class_http_agent) and expose the standard properties.

For example, the following code demonstrates changing `maxSockets` on the `http` agent.

 ```js
 const Wreck = require('@hapi/wreck');

 Wreck.agents.http.maxSockets = 20;
 ```

Below is another example that sets the certificate details for all HTTPS requests.

```js
const HTTPS = require('https');
const Wreck = require('@hapi/wreck');

Wreck.agents.https = new HTTPS.Agent({
    cert,
    key,
    ca
});
```

### Events

To enable events, use `Wreck.defaults({ events: true })`. Events are available via the `events` emitter attached to the client returned by `Wreck.defaults()`.

#### `preRequest`

The request event is emitted just before *wreck* creates a request.  The
handler should accept the following arguments `(uri, options)` where:

  - `uri` - the result of `new URL(uri)`. This will provide information about
  the resource requested.  Also includes the headers and method.
  - `options` - the options passed into the request function.  This will include
  a payload if there is one.

Since the `preRequest` event executes on a global event handler, you can intercept
and decorate `uri` and `options` before a request is created.

#### `request`

The request event is emitted just after *wreck* creates a request.  The handler should accept the following arguments `(req)` where:

  - `req` - the raw [`ClientRequest`](https://nodejs.org/api/http.html#http_class_http_clientrequest) object created from the `uri`, before `end` has been called.

Since the `request` event executes on a global event handler, you can intercept
and add listeners to a request.

#### `response`

The response event is always emitted for any request that *wreck* makes.  The
handler should accept the following arguments `(err, details)` where:

  - `err` - a Boom error
  - `details` - object with the following properties
    - `req` - the raw `ClientHttp` request object
    - `res` - the raw `IncomingMessage` response object
    - `start` - the time that the request was initiated
    - `uri` - the result of `new URL(uri)`. This will provide information about
    the resource requested.  Also includes the headers and method.

This event is useful for logging all requests that go through *wreck*. The `err`
and `res` arguments can be undefined depending on if an error occurs.  Please
be aware that if multiple modules are depending on the same cached *wreck*
module that this event can fire for each request made across all modules.  The
`start` property is the timestamp when the request was started.  This can be
useful for determining how long it takes *wreck* to get a response back and
processed.
