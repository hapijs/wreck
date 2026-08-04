import { describe, expectTypeOf, it } from 'vitest';

import Wreck from '../src/index.js';

import type * as Http from 'node:http';
import type * as Stream from 'node:stream';

// Every assertion here goes through expectTypeOf, never a live call: vitest collects this
// file as a runtime suite as well as a type suite, so an invoked Wreck method would open a
// real socket.

describe('typings', () => {
    describe('request()', () => {
        it('resolves an incoming message carrying the client request', () => {
            expectTypeOf(Wreck.request).returns.toEqualTypeOf<
                Promise<Http.IncomingMessage> & { req: Http.ClientRequest }
            >();
            expectTypeOf(Wreck.request).toBeCallableWith('get', 'http://localhost');
            expectTypeOf(Wreck.request).toBeCallableWith('get', 'http://localhost', { redirects: 1 });
        });

        it('requires a method and a url', () => {
            // @ts-expect-error method and url are required
            expectTypeOf(Wreck.request).toBeCallableWith();
        });
    });

    describe('read()', () => {
        it('resolves a Buffer unless parameterized otherwise', () => {
            // Wrapped rather than instantiated so the assertion sees the T default resolved, and
            // so the sample stream stays a type — an uninvoked arrow body needs no runtime value.
            const readDefault = (res: Stream.Readable) => Wreck.read(res);
            const readJson = (res: Stream.Readable) => Wreck.read(res, { json: true });

            expectTypeOf(readDefault).returns.toEqualTypeOf<Promise<Buffer>>();
            expectTypeOf(Wreck.read<{ foo: string }>).returns.toEqualTypeOf<Promise<{ foo: string }>>();
            expectTypeOf(readJson).returns.toEqualTypeOf<Promise<Buffer>>();
        });
    });

    describe('toReadableStream()', () => {
        it('returns a readable stream', () => {
            expectTypeOf(Wreck.toReadableStream).returns.toEqualTypeOf<Stream.Readable>();
            expectTypeOf(Wreck.toReadableStream).toBeCallableWith('One two three');
            expectTypeOf(Wreck.toReadableStream).toBeCallableWith([Buffer.from('One'), 'two'], 'ascii');
        });
    });

    describe('parseCacheControl()', () => {
        it('returns the parsed parameters or null', () => {
            expectTypeOf(Wreck.parseCacheControl).returns.toExtend<{ 'max-age'?: number } | null>();
        });
    });

    describe('defaults()', () => {
        it('returns another client', () => {
            expectTypeOf(Wreck.defaults).returns.toEqualTypeOf<typeof Wreck>();
            expectTypeOf(Wreck.defaults).toBeCallableWith({ baseUrl: 'http://localhost' });
        });

        it('requires an options object', () => {
            // @ts-expect-error options are required
            expectTypeOf(Wreck.defaults).toBeCallableWith();
        });
    });

    describe('shortcuts', () => {
        it('resolve a response paired with the payload', () => {
            expectTypeOf(Wreck.get<string>).returns.toEqualTypeOf<
                Promise<{ res: Http.IncomingMessage; payload: string }>
            >();
            expectTypeOf(Wreck.post<string>).returns.toEqualTypeOf<
                Promise<{ res: Http.IncomingMessage; payload: string }>
            >();
            expectTypeOf(Wreck.patch<string>).returns.toEqualTypeOf<
                Promise<{ res: Http.IncomingMessage; payload: string }>
            >();
            expectTypeOf(Wreck.put<string>).returns.toEqualTypeOf<
                Promise<{ res: Http.IncomingMessage; payload: string }>
            >();
            expectTypeOf(Wreck.delete<string>).returns.toEqualTypeOf<
                Promise<{ res: Http.IncomingMessage; payload: string }>
            >();
        });
    });

    describe('agents', () => {
        it('exposes the three pooled agents', () => {
            expectTypeOf(Wreck.agents.http).toExtend<Http.Agent>();
            expectTypeOf(Wreck.agents.https).toExtend<Http.Agent>();
            expectTypeOf(Wreck.agents.httpsAllowUnauthorized).toExtend<Http.Agent>();
        });
    });
});
