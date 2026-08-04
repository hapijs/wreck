import * as Dns from 'node:dns';
import * as Events from 'node:events';
import * as Fs from 'node:fs';
import * as Http from 'node:http';
import * as Https from 'node:https';
import * as Path from 'node:path';
import * as Stream from 'node:stream';
import { fileURLToPath } from 'node:url';
import * as Zlib from 'node:zlib';

import * as Boom from '@hapi/boom';
import * as Hoek from '@hapi/hoek';
import { describe, expect, it, onTestFinished } from 'vitest';

import Wreck from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

const internals = {
    payload: new Array(1640).join('0123456789'), // make sure we have a payload larger than 16384 bytes for chunking coverage
    gzippedPayload: Zlib.gzipSync(new Array(1640).join('0123456789')),
    socket: __dirname + '/server.sock',
    emitSymbol: Symbol.for('wreck'),
    refusePort: ['win19', 'win22'].includes(process.env.ImageOS) ? 777 : 0,
};

describe('request()', () => {
    it('requests a resource', async () => {
        const server = await internals.server();
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);
        const body = await Wreck.read(res);

        expect(Buffer.isBuffer(body)).toBe(true);
        expect(body.toString()).toBe(internals.payload);
    });

    it.skipIf(!process.features.ipv6)('requests a resource with IPv6', async () => {
        const server = await internals.server();
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', 'http://[::1]:' + server.address().port);
        const body = await Wreck.read(res);

        expect(Buffer.isBuffer(body)).toBe(true);
        expect(body.toString()).toBe(internals.payload);
    });

    it('requests a DELETE resource with payload', async () => {
        const handler = (req, res) => {
            expect(req.headers['content-length']).toBe('16390');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('delete', `http://localhost:${server.address().port}`, {
            payload: internals.payload,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('requests a POST resource', async () => {
        const handler = (req, res) => {
            expect(req.headers['content-length']).toBe('16390');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, {
            payload: internals.payload,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('requests a POST resource with unicode characters in payload', async () => {
        const handler = (req, res) => {
            expect(req.headers['content-length']).toBe('14');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const unicodePayload = JSON.stringify({ field: 'ć' });
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, {
            payload: unicodePayload,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(unicodePayload);
    });

    it('requests a POST resource with a JSON payload', async () => {
        const handler = (req, res) => {
            expect(req.headers['content-type']).toBe('application/json');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            req.pipe(res);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const payload = { my: 'object' };
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, { payload });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(JSON.stringify(payload));
    });

    it('requests a POST resource with a JSON payload and custom content-type header', async () => {
        const handler = (req, res) => {
            expect(req.headers['content-type']).toBe('application/json-patch+json');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            req.pipe(res);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const payload = [{ op: 'remove', path: '/test' }];
        const headers = {};
        headers['content-type'] = 'application/json-patch+json';

        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, { payload, headers });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(JSON.stringify(payload));
    });

    it('should not overwrite content-length if it is already in the headers', async () => {
        const handler = (req, res) => {
            expect(req.headers['content-length']).toBe('16390');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { payload: internals.payload, headers: { 'Content-Length': '16390' } };
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, options);
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('should not add content-type if it is already in the headers but not lower cased', async () => {
        const handler = (req, res) => {
            expect(req.headers['content-type']).toBe('application/json-patch+json');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            req.pipe(res);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const payload = [{ op: 'remove', path: '/test' }];
        const headers = {};
        headers['Content-Type'] = 'application/json-patch+json';

        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, { payload, headers });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(JSON.stringify(payload));
    });

    it('requests a POST resource with headers', async () => {
        const server = await internals.server('echo');
        onTestFinished(() => server.close());
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, {
            headers: { 'user-agent': 'wreck' },
            payload: internals.payload,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('requests a POST resource with stream payload', async () => {
        const server = await internals.server('echo');
        onTestFinished(() => server.close());
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, {
            payload: Wreck.toReadableStream(internals.payload),
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('cannot set agent and rejectUnauthorized at the same time', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        await expect(
            Wreck.request('get', `http://localhost:${server.address().port}`, {
                rejectUnauthorized: true,
                agent: new Https.Agent(),
            }),
        ).rejects.toThrow();
    });

    it('cannot set a false agent and rejectUnauthorized at the same time', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        await expect(
            Wreck.request('get', `http://localhost:${server.address().port}`, {
                rejectUnauthorized: false,
                agent: false,
            }),
        ).rejects.toThrow();
    });

    it('can set a null agent and rejectUnauthorized at the same time', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        await expect(
            Wreck.request('get', `http://localhost:${server.address().port}`, {
                rejectUnauthorized: false,
                agent: null,
            }),
        ).resolves.not.toThrow();
    });

    it('requests an https resource', async () => {
        const res = await Wreck.request('get', 'https://google.com', { rejectUnauthorized: true });
        const body = await Wreck.read(res);
        expect(body.toString()).toContain('<HTML>');
    });

    it('requests an https resource with secure protocol set', async () => {
        const res = await Wreck.request('get', 'https://google.com', {
            rejectUnauthorized: true,
            secureProtocol: 'SSLv23_method',
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toContain('<HTML>');
    });

    it('requests an https resource with TLS ciphers set', async () => {
        const res = await Wreck.request('get', 'https://google.com', { rejectUnauthorized: true, ciphers: 'HIGH' });
        const body = await Wreck.read(res);
        expect(body.toString()).toContain('<HTML>');
    });

    it('fails when an https resource has invalid certs and the default rejectUnauthorized', async () => {
        const server = await internals.https();
        onTestFinished(() => server.close());
        await expect(Wreck.request('get', 'https://localhost:' + server.address().port)).rejects.toThrow();
    });

    it('succeeds when an https resource has unauthorized certs and rejectUnauthorized is false', async () => {
        const server = await internals.https();
        onTestFinished(() => server.close());
        await Wreck.request('get', 'https://localhost:' + server.address().port, { rejectUnauthorized: false });
    });

    it('applies rejectUnauthorized when redirected', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (!gen++) {
                res.writeHead(301, { Location: '/' });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end();
            }
        };

        const server = await internals.https(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', 'https://localhost:' + server.address().port, {
            redirects: 1,
            rejectUnauthorized: false,
        });
        expect(res.statusCode).toBe(200);
    });

    it('does not follow redirections by default', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (!gen++) {
                res.writeHead(301, { Location: `http://localhost:${server.address().port}` });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);
        await Wreck.read(res);
        expect(res.statusCode).toBe(301);
    });

    it('handles redirections', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (!gen++) {
                res.writeHead(301, { Location: `http://localhost:${server.address().port}` });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, {
            redirects: 1,
            beforeRedirect: null,
            redirected: null,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('handles 301 redirections without overriding the HTTP method', async () => {
        const payload = 'HELLO POST';
        let gen = 0;
        const handler = async (req, res) => {
            expect(req.method).toBe('POST');
            const res2 = await Wreck.read(req);
            expect(res2.toString()).toBe(payload);

            if (!gen++) {
                res.writeHead(301, { Location: `http://localhost:${server.address().port}` });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('POST', `http://localhost:${server.address().port}`, {
            redirects: 1,
            beforeRedirect: null,
            redirected: null,
            payload,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('overrides 301 redirection method', async () => {
        const payload = 'HELLO POST';
        let gen = 0;
        const handler = async (req, res) => {
            const res2 = await Wreck.read(req);

            if (!gen++) {
                expect(req.method).toBe('POST');
                expect(res2.toString()).toBe(payload);
                res.writeHead(301, { Location: `http://localhost:${server.address().port}` });
                res.end();
            } else {
                expect(req.method).toBe('GET');
                expect(res2.toString()).toBe('');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('POST', `http://localhost:${server.address().port}`, {
            redirectMethod: 'GET',
            redirects: 1,
            beforeRedirect: null,
            redirected: null,
            payload,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('handles redirections with new host', async () => {
        const handler = (req, res) => {
            res.writeHead(302, { Location: 'http://localhost:' + http2.address().port });
            res.end();
        };

        const http1 = await internals.server(handler);
        const http2 = await internals.server();

        const headers = {}; // Headers object is needed to trigger bug

        const res = await Wreck.request('get', 'http://localhost:' + http1.address().port, { redirects: 1, headers });
        expect(res.statusCode).toBe(200);
        http1.close();
        http2.close();
    });

    it('handles redirections with new hostname, removing authorization, cookie, and proxy-authorization headers', async () => {
        const handler1 = (req, res) => {
            res.writeHead(302, { Location: 'http://127.0.0.1:' + http2.address().port });
            res.end();
        };

        const handler2 = (req, res) => {
            // request must have 'x-foo' header, but must not have 'authorization', 'cookie' or 'proxy-authorization'
            if (
                req.headers.authorization ||
                req.headers.cookie ||
                req.headers['proxy-authorization'] ||
                !req.headers['x-foo']
            ) {
                res.writeHead(500);
            }

            res.end();
        };

        const http1 = await internals.server(handler1);
        const http2 = await internals.server(handler2);

        const headers = {
            authorization: 'some-auth-key',
            cookie: 'some-cookie',
            'proxy-authorization': 'some-proxy-auth',
            'x-foo': 'something-else',
        };

        const res = await Wreck.request('get', 'http://localhost:' + http1.address().port, { redirects: 1, headers });
        expect(res.statusCode).toBe(200);
        http1.close();
        http2.close();
    });

    it('removes sensitive headers when redirected to a different port on the same hostname', async () => {
        const handler2 = (req, res) => {
            if (req.headers.authorization || req.headers.cookie || req.headers['proxy-authorization']) {
                res.writeHead(500);
                return res.end();
            }

            res.writeHead(200);
            res.end();
        };

        const http2 = await internals.server(handler2);

        const handler1 = (req, res) => {
            res.writeHead(302, { Location: 'http://localhost:' + http2.address().port });
            res.end();
        };

        const http1 = await internals.server(handler1);

        const headers = {
            authorization: 'some-auth-key',
            cookie: 'some-cookie',
            'proxy-authorization': 'some-proxy-auth',
        };

        const res = await Wreck.request('get', 'http://localhost:' + http1.address().port, { redirects: 1, headers });
        expect(res.statusCode).toBe(200);
        http1.close();
        http2.close();
    });

    it('removes sensitive headers when redirected to a different scheme on the same hostname', async () => {
        const handler1 = (req, res) => {
            res.writeHead(302, { Location: 'https://127.0.0.1:' + https.address().port });
            res.end();
        };

        const handler2 = (req, res) => {
            if (req.headers.authorization || req.headers.cookie || req.headers['proxy-authorization']) {
                res.writeHead(500);
                return res.end();
            }

            res.writeHead(200);
            res.end();
        };

        const https = await internals.https(handler2);
        const http = await internals.server(handler1);

        const headers = {
            authorization: 'some-auth-key',
            cookie: 'some-cookie',
            'proxy-authorization': 'some-proxy-auth',
        };

        const res = await Wreck.request('get', 'http://localhost:' + http.address().port, {
            redirects: 1,
            rejectUnauthorized: false,
            headers,
        });
        expect(res.statusCode).toBe(200);
        http.close();
        https.close();
    });

    it('preserves proxy-authorization header on same-hostname redirect', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (!gen++) {
                res.writeHead(301, { Location: '/' });
                res.end();
                return;
            }

            // proxy-authorization must persist across same-host redirect
            if (req.headers['proxy-authorization'] !== 'some-proxy-auth') {
                res.writeHead(500);
            }

            res.end();
        };

        const server = await internals.server(handler);

        const headers = {
            'proxy-authorization': 'some-proxy-auth',
        };

        const res = await Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 1, headers });
        expect(res.statusCode).toBe(200);
        server.close();
    });

    it('handles redirections from http to https', async () => {
        const handler = (req, res) => {
            res.writeHead(302, { Location: 'https://127.0.0.1:' + https.address().port });
            res.end();
        };

        const https = await internals.https();
        const http = await internals.server(handler);

        const res = await Wreck.request('get', 'http://localhost:' + http.address().port, {
            redirects: 1,
            rejectUnauthorized: false,
        });
        expect(res.statusCode).toBe(200);
        http.close();
        https.close();
    });

    it('handles redirections with relative location', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (!gen++) {
                res.writeHead(301, { Location: '/' });
                res.end();
            } else {
                expect(req.url).toBe('/');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, { redirects: 1 });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('ignores 303 redirections by default', async () => {
        const handler = (req, res) => {
            res.writeHead(303, { Location: `http://localhost:${server.address().port}` });
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, {
            redirects: 1,
            beforeRedirect: null,
            redirected: null,
        });
        expect(res.statusCode).toBe(303);
    });

    it('handles 303 redirections when allowed', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (!gen++) {
                res.writeHead(303, { Location: `http://localhost:${server.address().port}` });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, {
            redirects: 1,
            beforeRedirect: null,
            redirected: null,
            redirect303: true,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('handles redirections with different host than baseUrl in defaults', async () => {
        const handler = (req, res) => {
            res.writeHead(301, { Location: 'https://hapi.dev' });
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const wreckA = Wreck.defaults({ baseUrl: `http://localhost:${server.address().port}` });
        const options = {
            redirects: 1,
            redirected: (statusCode, location, req) => {
                expect(location).toBe('https://hapi.dev');
                if (req.output) {
                    expect(req.output[0]).toContain('hapi.dev');
                } else {
                    expect(req.outputData[0].data).toContain('hapi.dev');
                }
            },
        };

        await wreckA.request('get', '/redirect', options);
    });

    it('handles uri with different host than baseUrl in defaults', async () => {
        const server = await internals.server();
        onTestFinished(() => server.close());
        const wreckA = Wreck.defaults({ baseUrl: 'http://no.such.domain.error' });
        const res = await wreckA.request('get', `http://localhost:${server.address().port}`);
        const body = await Wreck.read(res);
        expect(Buffer.isBuffer(body)).toBe(true);
        expect(body.toString()).toBe(internals.payload);
    });

    it('handles uri with WHATWG parsing', async () => {
        const promise = Wreck.get('http://localhost%60malicious.org');
        await expect(promise).rejects.toThrow();
    });

    it('reaches max redirections count', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (gen++ < 2) {
                res.writeHead(301, { Location: `http://localhost:${server.address().port}` });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        await expect(
            Wreck.request('get', `http://localhost:${server.address().port}`, { redirects: 1 }),
        ).rejects.toThrow('Maximum redirections reached');
    });

    it('handles malformed redirection response', async () => {
        const handler = (req, res) => {
            res.writeHead(301);
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        await expect(
            Wreck.request('get', `http://localhost:${server.address().port}`, { redirects: 1 }),
        ).rejects.toThrow('Received redirection without location');
    });

    it('handles redirections with POST stream payload', async () => {
        let gen = 0;
        const handler = async (req, res) => {
            if (!gen++) {
                res.writeHead(307, { Location: '/' });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                const res2 = await Wreck.read(req);
                res.end(res2);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const payload = new Array(1639).join('0123456789');
        const stream = Wreck.toReadableStream(payload);
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, {
            redirects: 1,
            payload: stream,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(payload);
    });

    it('handles timeouts after a redirect', async () => {
        let redirectCount = 0;
        let timeout = 0;

        const handler = (req, res) => {
            setTimeout(() => {
                res.writeHead(302, { Location: `http://localhost:${server.address().port}` });
                res.end();
            }, timeout);

            redirectCount++;
            timeout = 20;
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const err = await internals.rejection(
            Wreck.request('get', `http://localhost:${server.address().port}`, { redirects: 5, timeout: 40 }),
        );
        expect(err.output.statusCode).toBe(504);

        // Validate that no further requests are made

        const targetCount = redirectCount;
        await Hoek.wait(30);
        expect(redirectCount).toBe(targetCount);
    });

    it('calls beforeRedirect option callback before redirections', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (gen++ < 2) {
                res.writeHead(301, { Location: `http://localhost:${server.address().port}` + '/redirected/' });
                res.end();
            } else {
                expect(req.url).toBe('/redirected/');
                expect(req.headers['x-test']).toBe('Modified');

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const beforeRedirectCallback = function (redirectMethod, statusCode, location, headers, redirectOptions, next) {
            const dest = `http://localhost:${server.address().port}/redirected/`;
            expect(redirectMethod).toBe('GET');
            expect(statusCode).toBe(301);
            expect(location).toBe(dest);
            expect(redirectOptions).toBeDefined();
            expect(headers.location).toBe(dest);

            redirectOptions.headers = {
                'x-test': 'Modified',
            };

            return next();
        };

        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, {
            redirects: 5,
            beforeRedirect: beforeRedirectCallback,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('cancels redirect if beforeRedirect callback is called with an error', async () => {
        const handler = (req, res) => {
            res.writeHead(301, { Location: `http://localhost:${server.address().port}` + '/redirected/' });
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const err = new Error('Cancel');
        const beforeRedirectCallback = function (redirectMethod, statusCode, location, headers, redirectOptions, next) {
            return next(err);
        };

        const thrown = await internals.rejection(
            Wreck.request('get', `http://localhost:${server.address().port}`, {
                redirects: 5,
                beforeRedirect: beforeRedirectCallback,
            }),
        );
        expect(thrown.isBoom).toBe(true);
        expect(thrown.message).toBe('Invalid redirect: Cancel');
    });

    it('calls redirected option callback on redirections', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (gen++ < 2) {
                res.writeHead(301, { Location: `http://localhost:${server.address().port}` + '/redirected/' });
                res.end();
            } else {
                expect(req.url).toBe('/redirected/');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        let redirects = 0;
        const redirectedCallback = function (statusCode, location, req) {
            expect(statusCode).toBe(301);
            expect(location).toBe(`http://localhost:${server.address().port}` + '/redirected/');
            expect(req).toBeDefined();
            redirects++;
        };

        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, {
            redirects: 5,
            redirected: redirectedCallback,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
        expect(redirects).toBe(2);
    });

    it('rejects non-function value for redirected option', async () => {
        await expect(Wreck.request('get', 'https://google.com', { redirects: 1, redirected: true })).rejects.toThrow();
    });

    it('handles request errors with a boom response', async () => {
        const handler = (req, res) => {
            req.destroy();
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const err = await internals.rejection(Wreck.request('get', 'http://127.0.0.1:' + server.address().port));
        expect(err.isBoom).toBe(true);
    });

    it('handles request errors with a boom response when payload is being sent', async () => {
        const handler = (req, res) => {
            req.destroy();
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const err = await internals.rejection(
            Wreck.request('get', 'http://127.0.0.1:' + server.address().port, { payload: internals.payload }),
        );
        expect(err.isBoom).toBe(true);
    });

    it('handles response errors with a boom response (res.destroy)', async () => {
        const handler = (req, res) => {
            res.destroy();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const err = await internals.rejection(Wreck.request('get', 'http://127.0.0.1:' + server.address().port));
        expect(err.isBoom).toBe(true);
    });

    it('handles errors when remote server is unavailable', async () => {
        await expect(Wreck.request('get', 'http://127.0.0.1:10')).rejects.toThrow();
    });

    it('handles a timeout during a socket close', async () => {
        const handler = (req, res) => {
            req.once('error', () => {});
            res.once('error', () => {});

            setTimeout(() => {
                req.destroy();
            }, 5);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        await expect(
            Wreck.request('get', 'http://127.0.0.1:' + server.address().port, { timeout: 5 }),
        ).rejects.toThrow();
    });

    it('handles an error after a timeout', async () => {
        const handler = (req, res) => {
            req.once('error', () => {});
            res.once('error', () => {});

            setTimeout(() => {
                res.socket.write('ERROR');
            }, 5);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        await expect(
            Wreck.request('get', 'http://127.0.0.1:' + server.address().port, { timeout: 5 }),
        ).rejects.toThrow();
    });

    it('ignores negative timeout', async () => {
        const server = await internals.server();
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);
        const body = await Wreck.read(res, { timeout: -1 });

        expect(Buffer.isBuffer(body)).toBe(true);
        expect(body.toString()).toBe(internals.payload);
    });

    it('requests can be aborted', async () => {
        const server = await internals.server();
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', `http://localhost:${server.address().port}`);
        promise.req.abort();
        await expect(promise).rejects.toThrow();
    });

    it('in-progress requests can be aborted', async () => {
        const handler = (req, res) => {
            res.writeHead(200);
            res.end();

            promise.req.abort();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', `http://localhost:${server.address().port}`);
        await expect(promise).rejects.toThrow();
    });

    it('uses agent option', async () => {
        const agent = new Http.Agent();
        expect(Object.keys(agent.sockets).length).toBe(0);

        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        await expect(
            Wreck.request('get', `http://localhost:${server.address().port}`, { agent }),
        ).resolves.not.toThrow();
        expect(Object.keys(agent.sockets).length).toBe(1);
    });

    it('applies agent option when redirected', async () => {
        let gen = 0;
        const handler = (req, res) => {
            if (!gen++) {
                res.writeHead(301, { Location: '/' });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end();
            }
        };

        const agent = new Http.Agent();
        let requestCount = 0;
        const addRequest = agent.addRequest;
        agent.addRequest = function (...args) {
            requestCount++;
            addRequest.apply(agent, args);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, { redirects: 1, agent });
        expect(res.statusCode).toBe(200);
        expect(requestCount).toBe(2);
    });

    it('pooling can be disabled by setting agent to false', async () => {
        let complete;

        const handler = (req, res) => {
            res.writeHead(200);
            res.write('foo');

            complete =
                complete ||
                function () {
                    res.end();
                };
        };

        const server = await internals.server(handler);
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, {
            agent: false,
            timeout: 50,
        });
        expect(Object.keys(Wreck.agents.http.sockets).length).toBe(0);
        expect(Object.keys(Wreck.agents.http.requests).length).toBe(0);

        await Wreck.request('get', `http://localhost:${server.address().port}` + '/thatone', {
            agent: false,
            timeout: 50,
        });
        expect(Object.keys(Wreck.agents.http.sockets).length).toBe(0);
        expect(Object.keys(Wreck.agents.http.requests).length).toBe(0);

        complete();

        await Wreck.read(res);

        expect(Object.keys(Wreck.agents.http.sockets).length).toBe(0);
        expect(Object.keys(Wreck.agents.http.requests).length).toBe(0);
    });

    it('requests payload in buffer', async () => {
        const server = await internals.server('echo');
        onTestFinished(() => server.close());
        const buf = Buffer.from(internals.payload, 'ascii');

        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, { payload: buf });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe(internals.payload);
    });

    it('requests head method', async () => {
        const server = await internals.server('echo');
        onTestFinished(() => server.close());
        const res = await Wreck.request('head', `http://localhost:${server.address().port}`, { payload: null });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe('');
    });

    it('post null payload', async () => {
        const handler = (req, res) => {
            res.statusCode = 500;
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, {
            headers: { connection: 'close' },
            payload: null,
        });
        const body = await Wreck.read(res);
        expect(body.toString()).toBe('');
    });

    it('handles request timeout', async () => {
        const handler = (req, res) => {
            setTimeout(() => {
                res.writeHead(200);
                res.write(internals.payload);
                res.end();
            }, 2000);
        };

        const server = await internals.server(handler);
        const err = await internals.rejection(
            Wreck.request('get', `http://localhost:${server.address().port}`, { timeout: 100 }),
        );
        expect(err.output.statusCode).toBe(504);
    });

    it('cleans socket on agent deferred request timeout', async () => {
        let complete;

        const handler = (req, res) => {
            res.writeHead(200);
            res.write('foo');

            complete =
                complete ||
                function () {
                    res.end();
                };
        };

        const server = await internals.server(handler);

        const agent = new Http.Agent({ maxSockets: 1 });
        expect(Object.keys(agent.sockets).length).toBe(0);

        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, { agent, timeout: 15 });
        expect(Object.keys(agent.sockets).length).toBe(1);
        expect(Object.keys(agent.requests).length).toBe(0);

        const err = await internals.rejection(
            Wreck.request('get', `http://localhost:${server.address().port}` + '/thatone', { agent, timeout: 15 }),
        );
        expect(err.output.statusCode).toBe(504);

        expect(Object.keys(agent.sockets).length).toBe(1);
        expect(Object.keys(agent.requests).length).toBe(1);

        complete();

        await Wreck.read(res);
        await Hoek.wait(100);
        expect(Object.keys(agent.sockets).length).toBe(0);
        expect(Object.keys(agent.requests).length).toBe(0);
    });

    it('defaults maxSockets to Infinity', async () => {
        const server = await internals.server();
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, { timeout: 100 });
        expect(res.statusCode).toBe(200);
        expect(Wreck.agents.http.maxSockets).toBe(Infinity);
    });

    it('maxSockets on default agents can be changed', async () => {
        let complete;

        const handler = (req, res) => {
            res.writeHead(200);
            res.write('foo');

            complete =
                complete ||
                function () {
                    res.end();
                };
        };

        const server = await internals.server(handler);
        Wreck.agents.http.maxSockets = 1;

        const res = await Wreck.request('get', `http://localhost:${server.address().port}`, { timeout: 15 });

        const err = await internals.rejection(
            Wreck.request('get', `http://localhost:${server.address().port}` + '/thatone', { timeout: 15 }),
        );
        expect(err.output.statusCode).toBe(504);

        complete();

        await Wreck.read(res);
        Wreck.agents.http.maxSockets = Infinity;
    });

    it('sets the auth value on the request', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '/foo', {
            baseUrl: `http://username:password@localhost:${server.address().port}`,
        });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.getHeader('authorization')).toBeDefined();
    });

    it('sets the auth value on the request with missing username', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '/foo', {
            baseUrl: `http://:password@localhost:${server.address().port}/`,
        });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.getHeader('authorization')).toBeDefined();
    });

    describe.skipIf(process.platform === 'win32')('unix socket', () => {
        it('requests a resource', async () => {
            const server = await internals.server(null, internals.socket);
            onTestFinished(() => server.close());
            const res = await Wreck.request('get', '/', { socketPath: internals.socket });
            const body = await Wreck.read(res);
            expect(Buffer.isBuffer(body)).toBe(true);
            expect(body.toString()).toBe(internals.payload);
        });

        it('requests a resource at a subpath', async () => {
            const server = await internals.server(null, internals.socket);
            onTestFinished(() => server.close());
            const res = await Wreck.request('get', '/subpath', { socketPath: internals.socket });
            expect(res.req.path).toBe('/subpath');
        });

        it('requests a resource at a subpath with a default top level path', async () => {
            const server = await internals.server(null, internals.socket);
            onTestFinished(() => server.close());
            const wreck = Wreck.defaults({ socketPath: internals.socket });
            const res = await wreck.request('get', '/subpath');
            expect(res.req.path).toBe('/subpath');
        });

        it('requests a POST resource', async () => {
            const server = await internals.server('echo', internals.socket);
            onTestFinished(() => server.close());
            const res = await Wreck.request('post', '/', { socketPath: internals.socket, payload: internals.payload });
            const body = await Wreck.read(res);
            expect(body.toString()).toBe(internals.payload);
        });

        it('requests a POST resource with unicode characters in payload', async () => {
            const server = await internals.server('echo', internals.socket);
            onTestFinished(() => server.close());
            const unicodePayload = JSON.stringify({ field: 'ć' });
            const res = await Wreck.request('post', '/', { socketPath: internals.socket, payload: unicodePayload });
            const body = await Wreck.read(res);
            expect(body.toString()).toBe(unicodePayload);
        });

        it('should not overwrite content-length if it is already in the headers', async () => {
            const server = await internals.server('echo', internals.socket);
            onTestFinished(() => server.close());
            const options = {
                socketPath: internals.socket,
                payload: internals.payload,
                headers: { 'Content-Length': '16390' },
            };
            const res = await Wreck.request('post', '/', options);
            const body = await Wreck.read(res);
            expect(body.toString()).toBe(internals.payload);
        });

        it('requests a POST resource with headers', async () => {
            const server = await internals.server('echo', internals.socket);
            onTestFinished(() => server.close());
            const res = await Wreck.request('post', '/', {
                socketPath: internals.socket,
                headers: { 'user-agent': 'wreck' },
                payload: internals.payload,
            });
            const body = await Wreck.read(res);
            expect(body.toString()).toBe(internals.payload);
        });

        it('requests a POST resource with stream payload', async () => {
            const server = await internals.server('echo', internals.socket);
            onTestFinished(() => server.close());
            const res = await Wreck.request('post', '/', {
                socketPath: internals.socket,
                payload: Wreck.toReadableStream(internals.payload),
            });
            const body = await Wreck.read(res);
            expect(body.toString()).toBe(internals.payload);
        });

        it('requests a POST resource with headers using post shortcut', async () => {
            const server = await internals.server('echo', internals.socket);
            onTestFinished(() => server.close());
            const { payload } = await Wreck.post('/', {
                socketPath: internals.socket,
                headers: { 'user-agent': 'wreck' },
                payload: internals.payload,
            });
            expect(payload.toString()).toBe(internals.payload);
        });
    });

    it.skipIf(process.platform !== 'win32')('errors on unix socket under Windows', async () => {
        await expect(Wreck.request('get', '/', { socketPath: '/some/path/to/nothing' })).rejects.toThrow();
    });
});

describe('options.lookup', () => {
    it('uses the lookup function to resolve the server ip address', async () => {
        let dnsLookupCalled = false;

        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        await Wreck.request('get', `http://localhost:${server.address().port}/`, {
            lookup: (hostname, options, callback) => {
                dnsLookupCalled = true;
                return Dns.lookup(hostname, options, callback);
            },
        });
        expect(dnsLookupCalled).toBe(true);
    });

    it('uses the lookup function and fails if the lookup function rejects the domain', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', `http://localhost:${server.address().port}/`, {
            lookup: (_hostname, _options, callback) => callback(new Error('failed lookup')),
        });
        await expect(promise).rejects.toThrow('Client request error: failed lookup');
    });
});

describe('options.hints', () => {
    it('passes the hint parameter to the lookup function to resolve the server ip address', async () => {
        const expectedHints = Dns.ADDRCONFIG;
        let actualHints;

        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        await Wreck.request('get', `http://localhost:${server.address().port}/`, {
            lookup: (hostname, options, callback) => {
                actualHints = options.hints;
                return Dns.lookup(hostname, options, callback);
            },
            hints: expectedHints,
        });
        expect(actualHints).toBe(expectedHints);
    });
});

describe('options.family', () => {
    it('passes the family parameter to the lookup function to resolve the server ip address', async () => {
        const expectedFamily = 4;
        let actualFamily;

        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        await Wreck.request('get', `http://localhost:${server.address().port}/`, {
            lookup: (hostname, options, callback) => {
                actualFamily = options.family;
                return Dns.lookup(hostname, options, callback);
            },
            family: expectedFamily, // IPv4
        });
        expect(actualFamily).toBe(expectedFamily);
    });
});

describe('options.baseUrl', () => {
    it('uses path when path is a full URL', async () => {
        const unboundPort = await internals.unusedPort();
        const promise = Wreck.request('get', `http://localhost:${unboundPort}/foo`, { baseUrl: 'http://localhost:0/' });
        await expect(promise).rejects.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${unboundPort}`);
    });

    it('uses lower-case host header when path is not a full URL', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '/foo', {
            baseUrl: `http://localhost:${server.address().port}`,
            headers: { host: 'localhost:8080' },
        });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe('localhost:8080');
    });

    it('uses upper-case host header when path is not a full URL', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '/foo', {
            baseUrl: `http://localhost:${server.address().port}/`,
            headers: { Host: 'localhost:8080' },
        });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe('localhost:8080');
    });

    it('ignores host header when it is undefined', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '/foo', {
            baseUrl: `http://localhost:${server.address().port}/`,
            headers: { host: undefined },
        });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
    });

    it('uses baseUrl option with trailing slash and uri is prefixed with a slash', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '/foo', { baseUrl: `http://localhost:${server.address().port}/` });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
    });

    it('uses baseUrl option without trailing slash and uri is prefixed with a slash', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '/foo', { baseUrl: `http://localhost:${server.address().port}` });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.path).toBe('/foo');
    });

    it('uses baseUrl option with trailing slash and uri is prefixed without a slash', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', 'foo', { baseUrl: `http://localhost:${server.address().port}/` });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.path).toBe('/foo');
    });

    it('uses baseUrl option without trailing slash and uri is prefixed without a slash', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', 'foo', { baseUrl: `http://localhost:${server.address().port}` });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.path).toBe('/foo');
    });

    it('uses baseUrl option when uri is an empty string', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '', { baseUrl: `http://localhost:${server.address().port}` });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.path).toBe('/');
    });

    it('uses baseUrl option with a path', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '/bar', { baseUrl: `http://localhost:${server.address().port}/foo` });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.path).toBe('/bar');
    });

    it('uses baseUrl option with a relative path', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', 'bar', { baseUrl: `http://localhost:${server.address().port}/foo/` });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.path).toBe('/foo/bar');
    });

    it('uses baseUrl option with a path and removes extra slashes', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', '/bar', { baseUrl: `http://localhost:${server.address().port}/foo/` });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.path).toBe('/bar');
    });

    it('uses baseUrl option with a url that has a querystring', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', 'bar?test=hello', {
            baseUrl: `http://localhost:${server.address().port}/foo/`,
        });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.path).toBe('/foo/bar?test=hello');
    });

    it('uses baseUrl option with a url that has a querystring will override any base querystring', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = Wreck.request('get', 'bar?test=hello', {
            baseUrl: `http://localhost:${server.address().port}/foo/?test=hi`,
        });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.getHeader('host')).toBe(`localhost:${server.address().port}`);
        expect(promise.req.path).toBe('/foo/bar?test=hello');
    });
});

describe('read()', () => {
    it('handles errors with a boom response', async () => {
        const res = new Events.EventEmitter();
        res.pipe = function () {};

        const promise = Wreck.read(res);
        res.emit('error', new Error('my error'));

        const err = await internals.rejection(promise);
        expect(err.message).toBe('Payload stream error: my error');
        expect(err.isBoom).toBe(true);
        expect(err.output.statusCode).toBe(500);
    });

    it('retains boom response error', async () => {
        const res = new Events.EventEmitter();
        res.pipe = function () {};

        const promise = Wreck.read(res);
        res.emit('error', Boom.badRequest('You messed up'));

        const err = await internals.rejection(promise);
        expect(err.message).toBe('You messed up');
        expect(err.isBoom).toBe(true);
        expect(err.output.statusCode).toBe(400);
    });

    it('handles "close" emit', async () => {
        const res = new Events.EventEmitter();
        res.pipe = function () {};

        const promise = Wreck.read(res);
        res.emit('close');

        const err = await internals.rejection(promise);
        expect(err.isBoom).toBe(true);
    });

    it('handles requests that close early', async () => {
        let readPromise;
        let readError;
        const handler = (req, res) => {
            readPromise = Wreck.read(req).catch((err) => {
                readError = err;
            });
            promise.req.abort();
        };

        const payload = new Stream.Readable();
        let written = 0;
        payload._read = function () {
            if (written < 1) {
                this.push(Buffer.alloc(1));
                ++written;
            }
        };

        const headers = {
            'content-length': '123',
        };

        const server = await internals.server(handler);
        const promise = Wreck.request('post', `http://localhost:${server.address().port}`, { payload, headers });
        await expect(promise).rejects.toThrow();
        await readPromise;
        expect(readError.message).toBe('Payload stream closed prematurely');
        expect(readError.isBoom).toBe(true);
    });

    it('errors on partial payload transfers', async () => {
        const handler = (req, res) => {
            res.setHeader('content-length', 2000);
            res.writeHead(200);
            res.write(internals.payload.slice(0, 1000));
            res.end();
        };

        const server = await internals.server(handler);
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);
        expect(res.statusCode).toBe(200);
        expect(res.headers['transfer-encoding']).toBeUndefined();
        const err = await internals.rejection(Wreck.read(res));
        expect(err.message).toBe('Payload stream closed prematurely');
        expect(err.isBoom).toBe(true);
    });

    it('errors on partial payload transfers (chunked)', async () => {
        const handler = (req, res) => {
            res.writeHead(200);
            res.write(internals.payload);
            setTimeout(() => {
                res.destroy(new Error('go away'));
            }, 10);
        };

        const server = await internals.server(handler);
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);
        expect(res.statusCode).toBe(200);
        expect(res.headers['transfer-encoding']).toBe('chunked');
        const err = await internals.rejection(Wreck.read(res));
        expect(err.message).toBe('Payload stream closed prematurely');
        expect(err.isBoom).toBe(true);
    });

    it('will not pipe the stream if no socket can be established', async () => {
        const agent = new internals.SlowAgent();
        const stream = new Stream.Readable({
            read() {
                read = true;
                this.push(null);
            },
        });
        let read = false;

        const promiseA = Wreck.request('post', 'http://localhost:0', {
            agent,
            payload: stream,
        });

        await expect(promiseA).rejects.toThrow(/Unable to obtain socket/);
        expect(read).toBe(false);

        const handler = (req, res) => {
            res.writeHead(200);
            res.end(internals.payload);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, {
            payload: stream,
        });
        expect(res.statusCode).toBe(200);
        expect(read).toBe(true);
    });

    it('will handle stream payload errors between request creation and connection establishment', async () => {
        const agent = new internals.SlowAgent();
        const stream = new Stream.Readable();
        const promiseA = Wreck.request('post', 'http://localhost:0', {
            agent,
            payload: stream,
        });

        process.nextTick(() => {
            stream.emit('error', new Error('Asynchronous stream error'));
        });

        await expect(promiseA).rejects.toThrow(/Asynchronous stream error/);
    });

    it('will handle requests with payloads using re-used sockets', async () => {
        const server = await internals.server('echo');
        const agent = new Http.Agent({
            keepAlive: true,
        });
        const streamA = Wreck.toReadableStream('hello world', 'utf8');
        const { payload: payloadA } = await Wreck.post(`http://localhost:${server.address().port}`, {
            agent,
            payload: streamA,
        });

        expect(payloadA.toString('utf8')).toBe('hello world');

        const streamB = Wreck.toReadableStream('hello world', 'utf8');
        const { payload: payloadB } = await Wreck.post(`http://localhost:${server.address().port}`, {
            agent,
            payload: streamB,
        });

        expect(payloadB.toString('utf8')).toBe('hello world');
    });

    it('times out when stream read takes too long', async () => {
        const TestStream = class extends Stream.Readable {
            _read(size) {
                if (this.isDone) {
                    return;
                }

                this.isDone = true;

                this.push('x');
                this.push('y');
                setTimeout(() => {
                    this.push(null);
                }, 200);
            }
        };

        const err = await internals.rejection(Wreck.read(new TestStream(), { timeout: 100 }));
        expect(err).toBeDefined();
        expect(err.output.statusCode).toBe(408);
    });

    it('errors when stream is too big', async () => {
        const server = await internals.server();
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);
        const err = await internals.rejection(Wreck.read(res, { maxBytes: 120 }));
        expect(err.output.statusCode).toBe(413);
    });

    it('ignores maxBytes when stream is not too big', async () => {
        const server = await internals.server();
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);
        await Wreck.read(res, { maxBytes: 120000 });
    });

    it('reads a file streamed via HTTP', async () => {
        const path = Path.join(__dirname, '../LICENSE.md');
        const stats = Fs.statSync(path);
        const fileStream = Fs.createReadStream(path);

        const handler = (req, res) => {
            res.writeHead(200);
            fileStream.pipe(res);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);
        expect(res.statusCode).toBe(200);

        const body = await Wreck.read(res);
        expect(body.length).toBe(stats.size);
    });

    it('reads a multiple buffers response', async () => {
        const path = Path.join(__dirname, '../LICENSE.md');
        const stats = Fs.statSync(path);
        const file = Fs.readFileSync(path);

        const handler = (req, res) => {
            res.writeHead(200);
            res.write(file);
            setTimeout(() => {
                res.write(file);
                res.end();
            }, 100);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);
        expect(res.statusCode).toBe(200);

        const body = await Wreck.read(res);
        expect(body.length).toBe(stats.size * 2);
    });

    it('writes a file streamed via HTTP', async () => {
        const path = Path.join(__dirname, '../LICENSE.md');
        const stats = Fs.statSync(path);
        const fileStream = Fs.createReadStream(path);

        const handler = async (req, res) => {
            res.writeHead(200);
            res.end(await Wreck.read(req));
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const res = await Wreck.request('post', `http://localhost:${server.address().port}`, { payload: fileStream });
        expect(res.statusCode).toBe(200);

        const body = await Wreck.read(res);
        expect(body.length).toBe(stats.size);
    });

    it('handles responses with no headers', async () => {
        const res = Wreck.toReadableStream(internals.payload);
        await Wreck.read(res, { json: true });
    });

    it('handles responses with no headers (with gunzip)', async () => {
        const res = Wreck.toReadableStream(internals.gzippedPayload);
        await Wreck.read(res, { json: true, gunzip: true });
    });

    it('skips destroy when not available', async () => {
        const server = await internals.server();
        onTestFinished(() => server.close());
        const res = await Wreck.request('get', `http://localhost:${server.address().port}`);

        res.destroy = null;
        res._readableState.autoDestroy = false; // As of node v16 autoDestroy is on, causing node to attempt to call destroy()
        const err = await internals.rejection(Wreck.read(res, { maxBytes: 120 }));
        expect(err.output.statusCode).toBe(413);
    });
});

describe('parseCacheControl()', () => {
    it('parses valid header', () => {
        const header = Wreck.parseCacheControl('must-revalidate, max-age=3600');
        expect(header).not.toBeNull();
        expect(header['must-revalidate']).toBe(true);
        expect(header['max-age']).toBe(3600);
    });

    it('parses valid header with quoted string', () => {
        const header = Wreck.parseCacheControl('must-revalidate, max-age="3600"');
        expect(header).not.toBeNull();
        expect(header['must-revalidate']).toBe(true);
        expect(header['max-age']).toBe(3600);
    });

    it('errors on invalid header', () => {
        const header = Wreck.parseCacheControl('must-revalidate, b =3600');
        expect(header).toBeNull();
    });

    it('errors on invalid max-age', () => {
        const header = Wreck.parseCacheControl('must-revalidate, max-age=a3600');
        expect(header).toBeNull();
    });
});

describe('Shortcut', () => {
    it('get request', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`);
        expect(res.statusCode).toBe(200);
        expect(payload.toString()).toBe('ok');
    });

    it('post request', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const { res, payload } = await Wreck.post(`http://localhost:${server.address().port}`, { payload: '123' });
        expect(res.statusCode).toBe(200);
        expect(payload.toString()).toBe('ok');
    });

    it('patch request', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const { res, payload } = await Wreck.patch(`http://localhost:${server.address().port}`, { payload: '123' });
        expect(res.statusCode).toBe(200);
        expect(payload.toString()).toBe('ok');
    });

    it('put request', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const { res, payload } = await Wreck.put(`http://localhost:${server.address().port}`);
        expect(res.statusCode).toBe(200);
        expect(payload.toString()).toBe('ok');
    });

    it('delete request', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const { res, payload } = await Wreck.delete(`http://localhost:${server.address().port}`);
        expect(res.statusCode).toBe(200);
        expect(payload.toString()).toBe('ok');
    });

    it('delete request with payload', async () => {
        const handler = (req, res) => {
            expect(req.headers['content-length']).toBe('16390');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const { res, payload } = await Wreck.delete('http://localhost:' + server.address().port, {
            payload: internals.payload,
        });
        expect(res.statusCode).toBe(200);
        expect(payload.toString()).toBe(internals.payload);
    });

    it('errors on bad request', async () => {
        const server = await internals.server('fail');
        onTestFinished(() => server.close());
        await expect(Wreck.get(`http://localhost:${server.address().port}`)).rejects.toThrow();
    });

    it('handles error responses with a boom error object', async () => {
        const handler = (req, res) => {
            res.setHeader('content-type', 'application/json');
            res.setHeader('x-custom', 'yes');
            res.writeHead(400);
            res.end(JSON.stringify({ details: 'failed' }));
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const err = await internals.rejection(Wreck.get('http://127.0.0.1:' + server.address().port, { json: true }));
        expect(err.isBoom).toBe(true);
        expect(err.message).toBe('Response Error: 400 Bad Request');
        expect(err.data.isResponseError).toBe(true);
        expect(err.data.headers).toMatchObject({ 'x-custom': 'yes' });
        expect(err.data.payload).toStrictEqual({ details: 'failed' });
        expect(err.data.res.statusCode).toBe(400);
    });
});

describe('json', () => {
    it('json requested and received', async () => {
        const handler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ foo: 'bar' }));
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: true };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(200);
        expect(payload).not.toBe(null);
        expect(payload.foo).toBeDefined();
    });

    it('json-based type requested and received', async () => {
        const handler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/vnd.api+json' });
            res.end(JSON.stringify({ foo: 'bar' }));
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: true };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(200);
        expect(payload).not.toBe(null);
        expect(payload.foo).toBeDefined();
    });

    it('json requested but not received - flag is ignored', async () => {
        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const options = { json: true };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(200);
        expect(payload).not.toBe(null);
    });

    it('invalid json received', async () => {
        const handler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('ok');
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: true };

        await expect(Wreck.get(`http://localhost:${server.address().port}`, options)).rejects.toThrow();
    });

    it('json not requested but received as string', async () => {
        const handler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ foo: 'bar' }));
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: false };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(200);
        expect(payload).not.toBe(null);
    });

    it('should not be parsed on empty buffer (json: SMART)', async () => {
        const handler = (req, res) => {
            res.writeHead(204, { 'Content-Type': 'application/json' });
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: 'SMART' };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(204);
        expect(payload).toBe(null);
    });

    it('should not be parsed on empty buffer (json: force)', async () => {
        const handler = (req, res) => {
            res.writeHead(204, { 'Content-Type': 'application/json' });
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: 'force' };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(204);
        expect(payload).toBe(null);
    });

    it('should return the empty buffer on text content-type (json: true)', async () => {
        const handler = (req, res) => {
            res.writeHead(204, { 'Content-Type': 'text/plain' });
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: true };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(204);
        expect(Buffer.isBuffer(payload)).toBe(true);
        expect(payload.toString()).toBe('');
    });

    it('should return null on empty buffer with text content-type (json: force)', async () => {
        const handler = (req, res) => {
            res.writeHead(204, { 'Content-Type': 'text/plain' });
            res.end();
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: 'force' };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(204);
        expect(payload).toBe(null);
    });

    it('will try to parse json in "force" mode, regardless of the header', async () => {
        const handler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(JSON.stringify({ foo: 'bar' }));
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: 'force' };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(200);
        expect(payload).not.toBe(null);
        expect(payload).toStrictEqual({ foo: 'bar' });
    });

    it('will error on invalid json received in "force" mode', async () => {
        const handler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ok');
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: 'force' };

        await expect(Wreck.get(`http://localhost:${server.address().port}`, options)).rejects.toThrow();
    });

    it('will try to parse json in "strict" mode', async () => {
        const handler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ foo: 'bar' }));
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: 'strict' };

        const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
        expect(res.statusCode).toBe(200);
        expect(payload).not.toBe(null);
        expect(payload).toStrictEqual({ foo: 'bar' });
    });

    it('will error on invalid content-type header in "strict" mode', async () => {
        const handler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(JSON.stringify({ foo: 'bar' }));
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const options = { json: 'strict' };

        const err = await internals.rejection(Wreck.get(`http://localhost:${server.address().port}`, options));
        expect(err.output.statusCode).toBe(406);
    });
});

describe('gunzip', () => {
    describe('true', () => {
        it('automatically handles gzip', async () => {
            const handler = (req, res) => {
                expect(req.headers['accept-encoding']).toBe('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            };

            const server = await internals.server(handler);
            onTestFinished(() => server.close());
            const options = { json: true, gunzip: true };
            const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
            expect(res.statusCode).toBe(200);
            expect(payload).not.toBe(null);
            expect(payload.foo).toBeDefined();
        });

        it('automatically handles gzip (manual header)', async () => {
            const handler = (req, res) => {
                expect(req.headers['accept-encoding']).toBe('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            };

            const server = await internals.server(handler);
            onTestFinished(() => server.close());
            const options = { json: true, gunzip: true, headers: { 'accept-encoding': 'gzip' } };
            const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
            expect(res.statusCode).toBe(200);
            expect(payload).not.toBe(null);
            expect(payload.foo).toBeDefined();
        });

        it('automatically handles gzip (with identity)', async () => {
            const handler = (req, res) => {
                expect(req.headers['accept-encoding']).toBe('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip, identity' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            };

            const server = await internals.server(handler);
            onTestFinished(() => server.close());
            const options = { json: true, gunzip: true };
            const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
            expect(res.statusCode).toBe(200);
            expect(payload).not.toBe(null);
            expect(payload.foo).toBeDefined();
        });

        it('automatically handles gzip (without json)', async () => {
            const handler = (req, res) => {
                expect(req.headers['accept-encoding']).toBe('gzip');
                res.writeHead(200, { 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            };

            const server = await internals.server(handler);
            onTestFinished(() => server.close());
            const options = { gunzip: true };
            const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
            expect(res.statusCode).toBe(200);
            expect(payload.toString()).toBe('{"foo":"bar"}');
        });

        it('automatically handles gzip (ignores when not gzipped)', async () => {
            const handler = (req, res) => {
                expect(req.headers['accept-encoding']).toBe('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ foo: 'bar' }));
            };

            const server = await internals.server(handler);
            onTestFinished(() => server.close());
            const options = { json: true, gunzip: true };
            const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
            expect(res.statusCode).toBe(200);
            expect(payload).not.toBe(null);
            expect(payload.foo).toBeDefined();
        });

        it('handles gzip errors', async () => {
            const handler = (req, res) => {
                expect(req.headers['accept-encoding']).toBe('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })).slice(0, 10));
            };

            const server = await internals.server(handler);
            onTestFinished(() => server.close());
            const options = { json: true, gunzip: true };

            const err = await internals.rejection(Wreck.get(`http://localhost:${server.address().port}`, options));
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('unexpected end of file');
            expect(err.data.res.statusCode).toBe(200);
        });
    });

    describe('false/undefined', () => {
        it('fails parsing gzipped content', async () => {
            const handler = (req, res) => {
                expect(req.headers['accept-encoding']).toBeUndefined();
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            };

            const server = await internals.server(handler);
            onTestFinished(() => server.close());
            const options = { json: true };

            const err = await internals.rejection(Wreck.get(`http://localhost:${server.address().port}`, options));
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toMatch(/Unexpected token/);
            expect(Boom.isBoom(err)).toBe(true);
            expect(err.data.res.statusCode).toBe(200);
            expect(err.data.payload.equals(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })))).toBe(true);
        });
    });

    describe('force', () => {
        it('forcefully handles gzip', async () => {
            const handler = (req, res) => {
                expect(req.headers['accept-encoding']).toBe('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            };

            const server = await internals.server(handler);
            onTestFinished(() => server.close());
            const options = { json: true, gunzip: 'force' };
            const { res, payload } = await Wreck.get(`http://localhost:${server.address().port}`, options);
            expect(res.statusCode).toBe(200);
            expect(payload).not.toBe(null);
            expect(payload.foo).toBeDefined();
        });

        it('handles gzip errors', async () => {
            const handler = (req, res) => {
                expect(req.headers['accept-encoding']).toBe('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })).slice(0, 10));
            };

            const server = await internals.server(handler);
            onTestFinished(() => server.close());
            const options = { json: true, gunzip: 'force' };

            const err = await internals.rejection(Wreck.get(`http://localhost:${server.address().port}`, options));
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('unexpected end of file');
            expect(err.data.res.statusCode).toBe(200);
        });
    });
});

describe('toReadableStream()', () => {
    it('handle empty payload', () => {
        const stream = Wreck.toReadableStream();
        expect(stream instanceof Stream.default).toBe(true);
        const read = stream.read(); // Make sure read has no problems
        expect(read).toBeNull();
    });

    it('handle explicit encoding', () => {
        const data = 'Hello';
        const stream = Wreck.toReadableStream(data, 'ascii');
        expect(stream instanceof Stream.default).toBe(true);
        const read = stream.read();
        expect(read.toString()).toBe(data);
    });

    it('chunks to requested size', () => {
        let buf;
        const data = new Array(101).join('0123456789');
        const stream = Wreck.toReadableStream(data);

        buf = stream.read(100);
        expect(buf.length).toBe(100);

        buf = stream.read(400);
        expect(buf.length).toBe(400);

        buf = stream.read();
        expect(buf.length).toBe(500);

        buf = stream.read();
        expect(buf).toBe(null);
    });

    it('defers end-of-stream while the payload exceeds the high water mark', () => {
        // A single _read() never drains a payload larger than the high water mark, so this is
        // the only shape that exercises the branch where the stream is not yet exhausted.

        const hwm = Stream.getDefaultHighWaterMark(false);
        const stream = Wreck.toReadableStream('x'.repeat(hwm + 10));

        expect(stream.read(hwm).length).toBe(hwm);
        expect(stream.read().length).toBe(10);
        expect(stream.read()).toBeNull();
    });

    it('does not signal end after a partial _read', () => {
        const data = Buffer.alloc(1000, 'x');
        const stream = Wreck.toReadableStream(data);

        stream._read(400); // partial read leaves position < length
        expect(stream._position).toBe(400);
        expect(stream.readableEnded).toBe(false);

        stream._read(1000); // drains remainder, signals end
        expect(stream._position).toBe(1000);
    });
});

describe('Events', () => {
    it('emits response event when wreck is finished', async () => {
        const wreck = Wreck.defaults({ events: true });
        let once = false;
        wreck.events.once('response', (err, details) => {
            expect(err).toBeNull();
            expect(details.req).toBeDefined();
            expect(details.res).toBeDefined();
            expect(typeof details.start).toBe('number');
            expect(details.uri.href).toBe(`http://localhost:${server.address().port}` + '/');
            once = true;
        });

        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const { res, payload } = await wreck.put(`http://localhost:${server.address().port}`);
        expect(res.statusCode).toBe(200);
        expect(payload.toString()).toBe('ok');
        expect(once).toBe(true);
    });

    it('response event includes error when it occurs', async () => {
        const wreck = Wreck.defaults({ events: true });
        let once = false;
        wreck.events.once('response', (err, details) => {
            expect(err).toBeDefined();
            expect(details).toBeDefined();
            expect(details.req).toBeDefined();
            expect(details.res).toBeUndefined();
            once = true;
        });

        const server = await internals.server('fail');
        onTestFinished(() => server.close());
        await expect(wreck.get(`http://localhost:${server.address().port}`, { timeout: 10 })).rejects.toThrow();
        expect(once).toBe(true);
    });

    it('multiple requests execute the same response handler', async () => {
        let count = 0;
        const handler = (err, details) => {
            expect(err).toBeDefined();
            expect(details.req).toBeDefined();
            expect(details.res).toBeUndefined();
            count++;
        };

        const wreck = Wreck.defaults({ events: true });
        wreck.events.on('response', handler);

        const server = await internals.server('fail');
        onTestFinished(() => server.close());
        await expect(wreck.get(`http://localhost:${server.address().port}`, { timeout: 10 })).rejects.toThrow();
        await expect(wreck.get(`http://localhost:${server.address().port}`, { timeout: 10 })).rejects.toThrow();
        expect(count).toBe(2);
    });

    it('emits preRequest event before wreck creates a request', async () => {
        const handler = (req, res) => {
            expect(req.headers.foo).toBe('bar');
            res.writeHead(200);
            res.end('ok');
        };

        const server = await internals.server(handler);
        const wreck = Wreck.defaults({ events: true });
        wreck.events.once('preRequest', (uri, options) => {
            expect(uri.href).toBe('http://user:pass@localhost:' + server.address().port + '/');
            expect(options).toBeDefined();
            expect(uri.auth).toBe('user:pass');

            uri.headers.foo = 'bar';
        });

        const { res, payload } = await wreck.put('http://user:pass@localhost:' + server.address().port);
        expect(res.statusCode).toBe(200);
        expect(payload.toString()).toBe('ok');
    });

    it('emits request event after wreck creates a request', async () => {
        const handler = (req, res) => {
            res.writeHead(200);
            res.end('ok');
        };

        const server = await internals.server(handler);
        onTestFinished(() => server.close());
        const wreck = Wreck.defaults({ events: true });
        wreck.events.once('request', (req) => {
            expect(req).toBeDefined();
        });

        const { res, payload } = await wreck.put(`http://localhost:${server.address().port}`);
        expect(res.statusCode).toBe(200);
        expect(payload.toString()).toBe('ok');
    });
});

describe('Defaults', () => {
    it('rejects attempts to use defaults without an options hash', () => {
        expect(() => {
            Wreck.defaults();
        }).toThrow();
    });

    // Windows takes longer to error
    it('respects defaults without bleeding across instances', async () => {
        const optionsA = { headers: { foo: 123 } };
        const optionsB = { headers: { bar: 321 } };

        const wreckA = Wreck.defaults(optionsA);
        const wreckB = Wreck.defaults(optionsB);
        const wreckAB = wreckA.defaults(optionsB);

        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise1 = wreckA.request('get', `http://127.0.0.1:${server.address().port}/`, {
            headers: { banana: 911 },
        });
        await expect(promise1).resolves.not.toThrow();
        expect(promise1.req.getHeader('banana')).toBeDefined();
        expect(promise1.req.getHeader('foo')).toBeDefined();
        expect(promise1.req.getHeader('bar')).toBeUndefined();

        const promise2 = wreckB.request('get', `http://127.0.0.1:${server.address().port}/`, {
            headers: { banana: 911 },
        });
        await expect(promise2).resolves.not.toThrow();
        expect(promise2.req.getHeader('banana')).toBeDefined();
        expect(promise2.req.getHeader('foo')).toBeUndefined();
        expect(promise2.req.getHeader('bar')).toBeDefined();

        const promise3 = wreckAB.request('get', `http://127.0.0.1:${server.address().port}/`, {
            headers: { banana: 911 },
        });
        await expect(promise3).resolves.not.toThrow();
        expect(promise3.req.getHeader('banana')).toBeDefined();
        expect(promise3.req.getHeader('foo')).toBeDefined();
        expect(promise3.req.getHeader('bar')).toBeDefined();
    });

    it('applies defaults correctly to requests', async () => {
        const optionsA = { headers: { Accept: 'foo', Test: 123 } };
        const optionsB = { headers: { Accept: 'bar' } };

        const wreckA = Wreck.defaults(optionsA);

        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise1 = wreckA.request('get', `http://127.0.0.1:${server.address().port}/`, optionsB);
        await expect(promise1).resolves.not.toThrow();
        expect(promise1.req.getHeader('accept')).toBe('bar');
        expect(promise1.req.getHeader('test')).toBe(123);
    });

    it('defaults inherits agents properly', () => {
        const wreckNoDefaults = Wreck.defaults({});
        const wreckDefaults = Wreck.defaults({
            agents: {
                https: new Https.Agent({ maxSockets: 1 }),
                http: new Http.Agent({ maxSockets: 1 }),
                httpsAllowUnauthorized: new Https.Agent({ maxSockets: 1, rejectUnauthorized: false }),
            },
        });

        expect(Wreck.agents.http.maxSockets).toBe(wreckNoDefaults.agents.http.maxSockets);
        expect(wreckDefaults.agents.http.maxSockets).not.toBe(wreckNoDefaults.agents.http.maxSockets);
        expect(wreckDefaults.agents.http.maxSockets).toBe(1);
        expect(wreckDefaults.agents.https.maxSockets).toBe(1);
        expect(wreckDefaults.agents.httpsAllowUnauthorized.maxSockets).toBe(1);
    });

    it('defaults disallows agents without all 3 types', () => {
        expect(() => {
            Wreck.defaults({
                agents: {
                    http: new Http.Agent({ maxSockets: Infinity }),
                },
            });
        }).toThrow();

        expect(() => {
            Wreck.defaults({
                agents: {
                    https: new Https.Agent({ maxSockets: 1 }),
                },
            });
        }).toThrow();

        expect(() => {
            Wreck.defaults({
                agents: {
                    httpsAllowUnauthorized: new Https.Agent({ maxSockets: Infinity, rejectUnauthorized: false }),
                },
            });
        }).toThrow();

        expect(() => {
            Wreck.defaults({
                agents: {
                    http: new Http.Agent({ maxSockets: Infinity }),
                    https: new Https.Agent({ maxSockets: 1 }),
                },
            });
        }).toThrow();

        expect(() => {
            Wreck.defaults({
                agents: {
                    http: new Http.Agent({ maxSockets: Infinity }),
                    httpsAllowUnauthorized: new Https.Agent({ maxSockets: Infinity, rejectUnauthorized: false }),
                },
            });
        }).toThrow();

        expect(() => {
            Wreck.defaults({
                agents: {
                    https: new Https.Agent({ maxSockets: 1 }),
                    httpsAllowUnauthorized: new Https.Agent({ maxSockets: Infinity, rejectUnauthorized: false }),
                },
            });
        }).toThrow();

        expect(() => {
            Wreck.defaults({
                agents: {},
            });
        }).toThrow();
    });

    it('default agents can be overrode in request()', async () => {
        const wreck = Wreck.defaults({
            agents: {
                https: new Https.Agent({ maxSockets: 1 }),
                http: new Http.Agent({ maxSockets: 1 }),
                httpsAllowUnauthorized: new Https.Agent({ maxSockets: 1, rejectUnauthorized: false }),
            },
        });

        expect(wreck.agents.http.maxSockets).toBe(1);
        const agent = new Http.Agent({ maxSockets: 2 });

        const server = await internals.server('ok');
        onTestFinished(() => server.close());
        const promise = wreck.request('get', `http://localhost:${server.address().port}/`, { agent });
        await expect(promise).resolves.not.toThrow();
        expect(promise.req.agent.maxSockets).toBe(2);
    });
});

internals.rejection = async function (promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }

    throw new Error('Expected promise to reject');
};

internals.unusedPort = function () {
    return new Promise((resolve, reject) => {
        const server = Http.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
};

internals.server = function (handler, socket) {
    if (typeof handler !== 'function') {
        if (handler === 'echo') {
            handler = (req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                req.pipe(res);
            };
        } else if (handler === 'fail') {
            handler = (req, res) => {
                res.socket.destroy();
            };
        } else if (handler === 'ok') {
            handler = (req, res) => {
                res.writeHead(200);
                res.end('ok');
            };
        } else {
            handler = (req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            };
        }
    }

    const server = Http.createServer((req, res) => {
        const isValidHost = () => {
            return (
                req.headers.host === 'localhost:' + server.address().port ||
                req.headers.host === '127.0.0.1:' + server.address().port ||
                req.headers.host === '[::1]:' + server.address().port
            );
        };

        if (!socket && !isValidHost()) {
            res.writeHead(500);
            return res.end('bad host: ' + req.headers.host);
        }

        return handler(req, res);
    });
    return new Promise((resolve) => {
        server.listen(socket || 0, () => resolve(server));
    });
};

internals.https = function (handler) {
    if (!handler) {
        handler = (req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        };
    }

    const httpsOptions = {
        key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
        cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n',
    };

    const server = Https.createServer(httpsOptions, handler);
    return new Promise((resolve) => {
        server.listen(0, () => resolve(server));
    });
};

internals.SlowAgent = class SlowAgent extends Http.Agent {
    createConnection(options, cb) {
        setTimeout(cb, 200, new Error('Unable to obtain socket'));
    }
};
