import * as Http from 'http';
import * as Net from 'net';

import * as Code from '@hapi/code';
import * as Lab from '@hapi/lab';
import * as Wreck from '..';


const { expect } = Lab.types;


// Provision server

const server = Http.createServer((req, res) => {

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Some payload');
});

await new Promise((resolve) => server.listen(0, resolve));
const address = server.address() as Net.AddressInfo;
const url = `http://localhost:${address.port}`;


// request()

const res = await Wreck.request('get', url);
const body = await Wreck.read(res);

Code.expect(Buffer.isBuffer(body)).to.equal(true);
Code.expect(body.toString()).to.equal('Some payload');

server.close();

expect.error(Wreck.request());


// read()

const stream = Wreck.toReadableStream('One two three');
const result = Buffer.from('One two three');
Code.expect<Buffer>(await Wreck.read(stream)).to.equal(result);
