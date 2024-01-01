'use strict';

const Http = require('http');
const Https = require('https');
const Path = require('path');
const Fs = require('fs');
const Events = require('events');
const Stream = require('stream');
const Zlib = require('zlib');

const Code = require('code');
const Hoek = require('hoek');
const Lab = require('lab');
const Reload = require('require-reload');
const Wreck = require('../');


const internals = {
    isv4: /^v4/.test(process.version),
    reload: Reload(require),
    payload: new Array(1640).join('0123456789'), // make sure we have a payload larger than 16384 bytes for chunking coverage
    gzippedPayload: Zlib.gzipSync(new Array(1640).join('0123456789')),
    socket: __dirname + '/server.sock',
    emitSymbol: Symbol.for('wreck')
};


const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('request()', () => {

    it('requests a resource with callback', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(internals.payload);
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(Buffer.isBuffer(body)).to.equal(true);
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('requests a POST resource', (done) => {

        const server = Http.createServer((req, res) => {

            expect(req.headers['content-length']).to.equal('16390');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        });

        server.listen(0, () => {

            Wreck.request('post', 'http://localhost:' + server.address().port, { payload: internals.payload }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('requests a POST resource with unicode characters in payload', (done) => {

        const server = Http.createServer((req, res) => {

            expect(req.headers['content-length']).to.equal('14');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        });

        server.listen(0, () => {

            const unicodePayload = JSON.stringify({ field: 'ć' });
            Wreck.request('post', 'http://localhost:' + server.address().port, { payload: unicodePayload }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(unicodePayload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('requests a POST resource with a JSON payload', (done) => {

        const server = Http.createServer((req, res) => {

            expect(req.headers['content-type']).to.equal('application/json');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            req.pipe(res);
        });

        server.listen(0, () => {

            const payload = { my: 'object' };
            Wreck.request('post', 'http://localhost:' + server.address().port, { payload }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(JSON.stringify(payload));
                    server.close();
                    done();
                });
            });
        });
    });

    it('requests a POST resource with a JSON payload and custom content-type header', (done) => {

        const server = Http.createServer((req, res) => {

            expect(req.headers['content-type']).to.equal('application/json-patch+json');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            req.pipe(res);
        });

        server.listen(0, () => {

            const payload = [{ op: 'remove', path: '/test' }];
            const headers = {};
            headers['content-type'] = 'application/json-patch+json';

            Wreck.request('post', 'http://localhost:' + server.address().port, { payload, headers }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(JSON.stringify(payload));
                    server.close();
                    done();
                });
            });
        });
    });

    it('should not overwrite content-length if it is already in the headers', (done) => {

        const server = Http.createServer((req, res) => {

            expect(req.headers['content-length']).to.equal('16390');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        });

        server.listen(0, () => {

            const options = { payload: internals.payload, headers: { 'Content-Length': '16390' } };
            Wreck.request('post', 'http://localhost:' + server.address().port, options, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('should not add content-type if it is already in the headers but not lower cased', (done) => {

        const server = Http.createServer((req, res) => {

            expect(req.headers['content-type']).to.equal('application/json-patch+json');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            req.pipe(res);
        });

        server.listen(0, () => {

            const payload = [{ op: 'remove', path: '/test' }];
            const headers = {};
            headers['Content-Type'] = 'application/json-patch+json';

            Wreck.request('post', 'http://localhost:' + server.address().port, { payload, headers }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(JSON.stringify(payload));
                    server.close();
                    done();
                });
            });
        });
    });

    it('requests a POST resource with headers', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        });

        server.listen(0, () => {

            Wreck.request('post', 'http://localhost:' + server.address().port, { headers: { 'user-agent': 'wreck' }, payload: internals.payload }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('requests a POST resource with stream payload', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        });

        server.listen(0, () => {

            Wreck.request('post', 'http://localhost:' + server.address().port, { payload: Wreck.toReadableStream(internals.payload) }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('requests a resource without callback', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(internals.payload);
            server.close();
            done();
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {});
        });
    });

    describe('unix socket', () => {

        it('requests a resource with callback', (done) => {

            const server = Http.createServer((req, res) => {

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            });

            server.listen(internals.socket, () => {

                Wreck.request('get', '/', { socketPath: internals.socket }, (err, res) => {

                    expect(err).to.not.exist();
                    Wreck.read(res, null, (err, body) => {

                        expect(err).to.not.exist();
                        expect(Buffer.isBuffer(body)).to.equal(true);
                        expect(body.toString()).to.equal(internals.payload);
                        server.close();
                        done();
                    });
                });
            });
        });

        it('requests a POST resource', (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['content-length']).to.equal('16390');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                req.pipe(res);
            });

            server.listen(internals.socket, () => {

                Wreck.request('post', '/', { socketPath: internals.socket, payload: internals.payload }, (err, res) => {

                    expect(err).to.not.exist();
                    Wreck.read(res, null, (err, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(internals.payload);
                        server.close();
                        done();
                    });
                });
            });
        });

        it('requests a POST resource with unicode characters in payload', (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['content-length']).to.equal('14');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                req.pipe(res);
            });

            server.listen(internals.socket, () => {

                const unicodePayload = JSON.stringify({ field: 'ć' });
                Wreck.request('post', '/', { socketPath: internals.socket, payload: unicodePayload }, (err, res) => {

                    expect(err).to.not.exist();
                    Wreck.read(res, null, (err, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(unicodePayload);
                        server.close();
                        done();
                    });
                });
            });
        });

        it('should not overwrite content-length if it is already in the headers', (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['content-length']).to.equal('16390');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                req.pipe(res);
            });

            server.listen(internals.socket, () => {

                const options = { socketPath: internals.socket, payload: internals.payload, headers: { 'Content-Length': '16390' } };
                Wreck.request('post', '/', options, (err, res) => {

                    expect(err).to.not.exist();
                    Wreck.read(res, null, (err, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(internals.payload);
                        server.close();
                        done();
                    });
                });
            });
        });

        it('requests a POST resource with headers', (done) => {

            const server = Http.createServer((req, res) => {

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                req.pipe(res);
            });

            server.listen(internals.socket, () => {

                Wreck.request('post', '/', { socketPath: internals.socket, headers: { 'user-agent': 'wreck' }, payload: internals.payload }, (err, res) => {

                    expect(err).to.not.exist();
                    Wreck.read(res, null, (err, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(internals.payload);
                        server.close();
                        done();
                    });
                });
            });
        });

        it('requests a POST resource with stream payload', (done) => {

            const server = Http.createServer((req, res) => {

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                req.pipe(res);
            });

            server.listen(internals.socket, () => {

                Wreck.request('post', '/', { socketPath: internals.socket, payload: Wreck.toReadableStream(internals.payload) }, (err, res) => {

                    expect(err).to.not.exist();
                    Wreck.read(res, null, (err, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(internals.payload);
                        server.close();
                        done();
                    });
                });
            });
        });

        it('requests a resource without callback', (done) => {

            const server = Http.createServer((req, res) => {

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
                server.close();
                done();
            });

            server.listen(internals.socket, () => {

                Wreck.request('get', '/', { socketPath: internals.socket });
            });
        });
    });

    it('cannot set agent and rejectUnauthorized at the same time', (done) => {

        expect(() => {

            Wreck.request('get', 'https://google.com', { rejectUnauthorized: true, agent: new Https.Agent() }, (err, res) => {

                expect(err).to.not.exist();
            });
        }).to.throw();
        done();
    });

    it('cannot set a false agent and rejectUnauthorized at the same time', (done) => {

        expect(() => {

            Wreck.request('get', 'https://google.com', { rejectUnauthorized: false, agent: false }, (err, res) => {

                expect(err).to.not.exist();
            });
        }).to.throw();
        done();
    });

    it('can set a null agent and rejectUnauthorized at the same time', (done) => {

        expect(() => {

            Wreck.request('get', 'https://google.com', { rejectUnauthorized: false, agent: null }, (err, res) => {

                expect(err).to.not.exist();
            });
        }).to.not.throw();
        done();
    });

    it('requests an https resource', { timeout: 5000 }, (done) => {

        Wreck.request('get', 'https://google.com', { rejectUnauthorized: true }, (err, res) => {

            expect(err).to.not.exist();
            Wreck.read(res, null, (err, body) => {

                expect(err).to.not.exist();
                expect(body.toString()).to.contain('<HTML>');
                done();
            });
        });
    });

    it('requests an https resource with secure protocol set', { timeout: 5000 }, (done) => {

        Wreck.request('get', 'https://google.com', { rejectUnauthorized: true, secureProtocol: 'SSLv23_method' }, (err, res) => {

            expect(err).to.not.exist();
            Wreck.read(res, null, (err, body) => {

                expect(err).to.not.exist();
                expect(body.toString()).to.contain('<HTML>');
                done();
            });
        });
    });

    it('requests an https resource with TLS ciphers set', { timeout: 5000 }, (done) => {

        Wreck.request('get', 'https://google.com', { rejectUnauthorized: true, ciphers: 'HIGH' }, (err, res) => {

            expect(err).to.not.exist();
            Wreck.read(res, null, (err, body) => {

                expect(err).to.not.exist();
                expect(body.toString()).to.contain('<HTML>');
                done();
            });
        });
    });

    it('fails when an https resource has invalid certs and the default rejectUnauthorized', (done) => {

        const httpsOptions = {
            key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
            cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
        };

        const server = Https.createServer(httpsOptions, (req, res) => {

            res.writeHead(200);
            res.end();
        });

        server.listen(0, (err) => {

            expect(err).to.not.exist();

            Wreck.request('get', 'https://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.exist();
                done();
            });
        });
    });

    it('succeeds when an https resource has unauthorized certs and rejectUnauthorized is false', (done) => {

        const httpsOptions = {
            key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
            cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
        };

        const server = Https.createServer(httpsOptions, (req, res) => {

            res.writeHead(200);
            res.end();
        });

        server.listen(0, (err) => {

            expect(err).to.not.exist();

            Wreck.request('get', 'https://localhost:' + server.address().port, { rejectUnauthorized: false }, (err, res) => {

                expect(err).to.not.exist();
                done();
            });
        });
    });

    it('applies rejectUnauthorized when redirected', (done) => {

        const httpsOptions = {
            key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
            cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
        };

        let gen = 0;
        const server = Https.createServer(httpsOptions, (req, res) => {

            if (!gen++) {
                res.writeHead(301, { 'Location': '/' });
                res.end();
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end();
            }
        });

        server.listen(0, (err) => {

            expect(err).to.not.exist();

            Wreck.request('get', 'https://localhost:' + server.address().port, { redirects: 1, rejectUnauthorized: false }, (err, res) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                server.close();
                done();
            });
        });
    });

    it('requests a resource with downstream dependency', (done) => {

        const up = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(internals.payload);
        });

        up.listen(0, () => {

            const down = Http.createServer((req, res1) => {

                res1.writeHead(200, { 'Content-Type': 'text/plain' });
                Wreck.request('get', 'http://localhost:' + up.address().port, { downstreamRes: res1 }, (err, res2) => {

                    expect(err).to.not.exist();
                    res2.pipe(res1);
                });
            });

            down.listen(0, () => {

                Wreck.request('get', 'http://localhost:' + down.address().port, {}, (err, res) => {

                    expect(err).to.not.exist();
                    Wreck.read(res, null, (err, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(internals.payload);
                        up.close();
                        down.close();
                        done();
                    });
                });
            });
        });
    });

    it('does not follow redirections by default', (done) => {

        let gen = 0;
        const server = Http.createServer((req, res) => {

            if (!gen++) {
                res.writeHead(301, { 'Location': 'http://localhost:' + server.address().port });
                res.end();
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(res.statusCode).to.equal(301);
                    server.close();
                    done();
                });
            });
        });
    });

    it('handles redirections', (done) => {

        let gen = 0;
        const server = Http.createServer((req, res) => {

            if (!gen++) {
                res.writeHead(301, { 'Location': 'http://localhost:' + server.address().port });
                res.end();
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 1, beforeRedirect: null, redirected: null }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('handles 301 redirections without overriding the HTTP method', (done) => {

        const payload = 'HELLO POST';
        let gen = 0;
        const server = Http.createServer((req, res) => {

            expect(req.method).to.equal('POST');
            Wreck.read(req, null, (err, res2) => {

                expect(err).to.not.exist();
                expect(res2.toString()).to.equal(payload);

                if (!gen++) {
                    res.writeHead(301, { 'Location': 'http://localhost:' + server.address().port });
                    res.end();
                }
                else {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end(internals.payload);
                }
            });
        });

        server.listen(0, () => {

            Wreck.request('POST', 'http://localhost:' + server.address().port, { redirects: 1, beforeRedirect: null, redirected: null, payload }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('handles redirections from http to https', (done) => {

        const httpsOptions = {
            key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
            cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
        };

        const httpsServer = Https.createServer(httpsOptions, (req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end();
        });

        httpsServer.listen(0, (err) => {

            expect(err).to.not.exist();

            const httpServer = Http.createServer((req, res) => {

                res.writeHead(302, { 'Location': 'https://127.0.0.1:' + httpsServer.address().port });
                res.end();
            });

            httpServer.listen(0, (err) => {

                expect(err).to.not.exist();

                Wreck.request('get', 'http://localhost:' + httpServer.address().port, { redirects: 1, rejectUnauthorized: false }, (err, res) => {

                    expect(err).to.not.exist();
                    expect(res.statusCode).to.equal(200);
                    httpServer.close();
                    httpsServer.close();
                    done();
                });
            });
        });
    });

    it('handles redirections with relative location', (done) => {

        let gen = 0;
        const server = Http.createServer((req, res) => {

            if (!gen++) {
                res.writeHead(301, { 'Location': '/' });
                res.end();
            }
            else {
                expect(req.url).to.equal('/');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 1 }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('ignores 303 redirections by default', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(303, { 'Location': 'http://localhost:' + server.address().port });
            res.end();
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 1, beforeRedirect: null, redirected: null }, (err, res) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(303);
                server.close();
                done();
            });
        });
    });

    it('handles 303 redirections when allowed', (done) => {

        let gen = 0;
        const server = Http.createServer((req, res) => {

            if (!gen++) {
                res.writeHead(303, { 'Location': 'http://localhost:' + server.address().port });
                res.end();
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 1, beforeRedirect: null, redirected: null, redirect303: true }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('handles redirections with different host than baseUrl in defaults', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(301, { 'Location': 'https://hapi.dev' });
            res.end();
        });

        server.listen(0, () => {

            const wreckA = Wreck.defaults({ baseUrl: 'http://localhost:' + server.address().port });
            wreckA.request('get', '/redirect', {
                redirects: 1,
                redirected: (statusCode, location, req) => {

                    expect(location).to.equal('https://hapi.dev');

                    if (req.output) {
                        expect(req.output[0]).to.include('hapi.dev');
                    }
                    else {
                        expect(req.outputData[0].data).to.include('hapi.dev');
                    }
                }
            }, done);
        });
    });

    it('reaches max redirections count', (done) => {

        let gen = 0;
        const server = Http.createServer((req, res) => {

            if (gen++ < 2) {
                res.writeHead(301, { 'Location': 'http://localhost:' + server.address().port });
                res.end();
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 1 }, (err, res) => {

                expect(err.message).to.equal('Maximum redirections reached');
                server.close();
                done();
            });
        });
    });

    it('handles malformed redirection response', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(301);
            res.end();
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 1 }, (err, res) => {

                expect(err.message).to.equal('Received redirection without location');
                server.close();
                done();
            });
        });
    });

    it('handles redirections with POST stream payload', (done) => {

        let gen = 0;
        const server = Http.createServer((req, res) => {

            if (!gen++) {
                res.writeHead(307, { 'Location': '/' });
                res.end();
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                Wreck.read(req, null, (err, res2) => {

                    expect(err).to.not.exist();
                    res.end(res2);
                });
            }
        });

        server.listen(0, () => {

            const payload = new Array(1639).join('0123456789');
            const stream = Wreck.toReadableStream(payload);
            Wreck.request('post', 'http://localhost:' + server.address().port, { redirects: 1, payload: stream }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('calls beforeRedirect option callback before redirections', (done) => {

        let gen = 0;
        const server = Http.createServer((req, res) => {

            if (gen++ < 2) {
                res.writeHead(301, { 'Location': 'http://localhost:' + server.address().port + '/redirected/' });
                res.end();
            }
            else {
                expect(req.url).to.equal('/redirected/');
                expect(req.headers['x-test']).to.equal('Modified');

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        });

        const beforeRedirectCallback = function (redirectMethod, statusCode, location, headers, redirectOptions, next) {

            const dest = `http://localhost:${server.address().port}/redirected/`;
            expect(redirectMethod).to.equal('GET');
            expect(statusCode).to.equal(301);
            expect(location).to.equal(dest);
            expect(redirectOptions).to.exist();
            expect(headers.location).to.equal(dest);

            redirectOptions.headers = {
                'x-test': 'Modified'
            };

            return next();
        };

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 5, beforeRedirect: beforeRedirectCallback }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('calls redirected option callback on redirections', (done) => {

        let gen = 0;
        const server = Http.createServer((req, res) => {

            if (gen++ < 2) {
                res.writeHead(301, { 'Location': 'http://localhost:' + server.address().port + '/redirected/' });
                res.end();
            }
            else {
                expect(req.url).to.equal('/redirected/');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(internals.payload);
            }
        });

        let redirects = 0;
        const redirectedCallback = function (statusCode, location, req) {

            expect(statusCode).to.equal(301);
            expect(location).to.equal('http://localhost:' + server.address().port + '/redirected/');
            expect(req).to.exist();
            redirects++;
        };

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 5, redirected: redirectedCallback }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    expect(redirects).to.equal(2);
                    server.close();
                    done();
                });
            });
        });
    });

    it('rejects non-function value for redirected option', (done) => {

        expect(() => {

            Wreck.request('get', 'https://google.com', { redirects: 1, redirected: true }, (err, res) => {

                expect(err).to.not.exist();
            });
        }).to.throw();
        done();
    });

    it('handles request errors with a boom response', (done) => {

        const server = Http.createServer((req, res) => {

            req.destroy();
            res.end();
        });

        server.once('listening', () => {

            Wreck.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '' }, (err) => {

                expect(err.code).to.equal('ECONNRESET');
                done();
            });
        });

        server.listen(0);
    });

    it('handles request errors with a boom response when payload is being sent', (done) => {

        const server = Http.createServer((req, res) => {

            req.destroy();
            res.end();
        });

        server.once('listening', () => {

            Wreck.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '' }, (err) => {

                expect(err.code).to.equal('ECONNRESET');
                done();
            });
        });

        server.listen(0);
    });

    it('handles response errors with a boom response', (done) => {

        const server = Http.createServer((req, res) => {

            res.destroy();
        });

        server.once('listening', () => {

            Wreck.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '' }, (err) => {

                expect(err.code).to.equal('ECONNRESET');
                done();
            });
        });

        server.listen(0);
    });

    it('handles errors when remote server is unavailable', (done) => {

        Wreck.request('get', 'http://127.0.0.1:10', { payload: '' }, (err) => {

            expect(err).to.exist();
            done();
        });
    });

    it('handles a timeout during a socket close', (done) => {

        const server = Http.createServer((req, res) => {

            req.once('error', () => { });
            res.once('error', () => { });

            setTimeout(() => {

                req.destroy();
            }, 5);
        });

        server.once('error', () => { });

        server.once('listening', () => {

            Wreck.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '', timeout: 5 }, (err) => {

                expect(err).to.exist();
                server.close();

                setTimeout(done, 5);
            });
        });

        server.listen(0);
    });

    it('handles an error after a timeout', (done) => {

        const server = Http.createServer((req, res) => {

            req.once('error', () => { });
            res.once('error', () => { });

            setTimeout(() => {

                res.socket.write('ERROR');
            }, 5);
        });

        server.once('error', () => { });

        server.once('listening', () => {

            Wreck.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '', timeout: 5 }, (err) => {

                expect(err).to.exist();
                server.close();

                setTimeout(done, 5);
            });
        });

        server.listen(0);
    });

    it('allows request without a callback', (done) => {

        const server = Http.createServer((req, res) => {

            res.end('ok');
        });

        server.once('listening', () => {

            Wreck.request('get', 'http://127.0.0.1:' + server.address().port);
            done();
        });

        server.listen(0);
    });

    it('requests can be aborted', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end();
        });

        server.listen(0, () => {

            const req = Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err) => {

                expect(err).to.exist();
                expect(err.code).to.equal('ECONNRESET');
                done();
            });

            req.abort();
        });
    });

    it('request shortcuts can be aborted', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end();
        });

        server.listen(0, () => {

            const req = Wreck.get('http://localhost:' + server.address().port, (err) => {

                expect(err).to.exist();
                expect(err.code).to.equal('ECONNRESET');
                done();
            });

            req.abort();
        });
    });

    it('in-progress requests can be aborted', (done) => {

        let wreck;
        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end();

            wreck.abort();
        });

        server.listen(0, () => {

            wreck = Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err) => {

                expect(err).to.exist();
                expect(err.code).to.equal('ECONNRESET');
                done();
            });
        });
    });

    it('uses agent option', (done) => {

        const agent = new Http.Agent();
        expect(Object.keys(agent.sockets).length).to.equal(0);

        Wreck.request('get', 'http://localhost:0/', { agent }, (err, res) => {

            expect(err).to.exist();
            expect(Object.keys(agent.sockets).length).to.equal(1);
            done();
        });
    });

    it('applies agent option when redirected', (done) => {

        let gen = 0;
        const server = Http.createServer((req, res) => {

            if (!gen++) {
                res.writeHead(301, { 'Location': '/' });
                res.end();
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end();
            }
        });

        const agent = new Http.Agent();
        let requestCount = 0;
        const addRequest = agent.addRequest;
        agent.addRequest = function () {

            requestCount++;
            addRequest.apply(agent, arguments);
        };

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { redirects: 1, agent }, (err, res) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(requestCount).to.equal(2);
                server.close();
                done();
            });
        });
    });

    it('pooling can be disabled by setting agent to false', (done) => {

        let complete;

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.write('foo');

            complete = complete || function () {

                res.end();
            };
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { agent: false, timeout: 15 }, (err, res) => {

                expect(err).to.not.exist();
                expect(Object.keys(Wreck.agents.http.sockets).length).to.equal(0);
                expect(Object.keys(Wreck.agents.http.requests).length).to.equal(0);

                Wreck.request('get', 'http://localhost:' + server.address().port + '/thatone', { agent: false, timeout: 15 }, (err, innerRes) => {

                    expect(err).to.not.exist();

                    expect(Object.keys(Wreck.agents.http.sockets).length).to.equal(0);
                    expect(Object.keys(Wreck.agents.http.requests).length).to.equal(0);

                    complete();

                    Wreck.read(res, null, () => {

                        setTimeout(() => {

                            expect(Object.keys(Wreck.agents.http.sockets).length).to.equal(0);
                            expect(Object.keys(Wreck.agents.http.requests).length).to.equal(0);

                            done();
                        }, 100);
                    });
                });
            });
        });
    });

    it('requests payload in buffer', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            req.pipe(res);
        });

        server.listen(0, () => {

            const buf = Buffer.from(internals.payload, 'ascii');

            Wreck.request('post', 'http://localhost:' + server.address().port, { payload: buf }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(internals.payload);
                    server.close();
                    done();
                });
            });
        });
    });

    it('requests head method', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            req.pipe(res);
        });

        server.listen(0, () => {

            Wreck.request('head', 'http://localhost:' + server.address().port, { payload: null }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal('');
                    server.close();
                    done();
                });
            });
        });
    });

    it('post null payload', (done) => {

        const server = Http.createServer((req, res) => {

            res.statusCode = 500;
            res.end();
        });

        server.listen(0, () => {

            Wreck.request('post', 'http://localhost:' + server.address().port, { headers: { connection: 'close' }, payload: null }, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal('');
                    server.close();
                    done();
                });
            });
        });
    });

    it('handles read timeout', (done) => {

        const server = Http.createServer((req, res) => {

            setTimeout(() => {

                res.writeHead(200);
                res.write(internals.payload);
                res.end();
            }, 2000);
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { timeout: 100 }, (err, res) => {

                expect(err).to.exist();
                expect(err.output.statusCode).to.equal(504);
                done();
            });
        });
    });

    it('cleans socket on agent deferred read timeout', (done) => {

        let complete;

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.write('foo');

            complete = complete || function () {

                res.end();
            };
        });

        server.listen(0, () => {

            const agent = new Http.Agent({ maxSockets: 1 });
            expect(Object.keys(agent.sockets).length).to.equal(0);

            Wreck.request('get', 'http://localhost:' + server.address().port, { agent, timeout: 15 }, (err, res) => {

                expect(err).to.not.exist();
                expect(Object.keys(agent.sockets).length).to.equal(1);
                expect(Object.keys(agent.requests).length).to.equal(0);

                Wreck.request('get', 'http://localhost:' + server.address().port + '/thatone', { agent, timeout: 15 }, (err, innerRes) => {

                    expect(err).to.exist();
                    expect(err.output.statusCode).to.equal(504);

                    expect(Object.keys(agent.sockets).length).to.equal(1);
                    expect(Object.keys(agent.requests).length).to.equal(1);

                    complete();

                    Wreck.read(res, null, () => {

                        setTimeout(() => {

                            expect(Object.keys(agent.sockets).length).to.equal(0);
                            expect(Object.keys(agent.requests).length).to.equal(0);

                            done();
                        }, 100);
                    });
                });
            });
        });
    });

    it('defaults maxSockets to Infinity', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.write(internals.payload);
            res.end();
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, { timeout: 100 }, (err, res) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(Wreck.agents.http.maxSockets).to.equal(Infinity);
                done();
            });
        });
    });

    it('maxSockets on default agents can be changed', (done) => {

        let complete;

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.write('foo');

            complete = complete || function () {

                res.end();
            };
        });

        server.listen(0, () => {

            Wreck.agents.http.maxSockets = 1;

            Wreck.request('get', 'http://localhost:' + server.address().port, { timeout: 15 }, (err, res) => {

                expect(err).to.not.exist();

                Wreck.request('get', 'http://localhost:' + server.address().port + '/thatone', { timeout: 15 }, (err, innerRes) => {

                    expect(err).to.exist();
                    expect(err.output.statusCode).to.equal(504);

                    complete();

                    Wreck.read(res, null, () => {

                        Wreck.agents.http.maxSockets = Infinity;
                        done();
                    });
                });
            });
        });
    });
});

describe('options.baseUrl', () => {

    it('uses baseUrl option with trailing slash and uri is prefixed with a slash', (done) => {

        const request = Wreck.request('get', '/foo', { baseUrl: 'http://localhost:0/' }, (err, res) => {

            expect(err).to.exist();         // Can't connect
            expect(internals.header(request, 'host')).to.equal('localhost:0');
            done();
        });
    });

    it('uses baseUrl option without trailing slash and uri is prefixed with a slash', (done) => {

        const request = Wreck.request('get', '/foo', { baseUrl: 'http://localhost' }, Hoek.ignore);

        expect(internals.header(request, 'host')).to.equal('localhost');
        expect(request.path).to.equal('/foo');
        done();
    });

    it('uses baseUrl option with trailing slash and uri is prefixed without a slash', (done) => {

        const request = Wreck.request('get', 'foo', { baseUrl: 'http://localhost/' }, Hoek.ignore);

        expect(internals.header(request, 'host')).to.equal('localhost');
        expect(request.path).to.equal('/foo');
        done();
    });

    it('uses baseUrl option without trailing slash and uri is prefixed without a slash', (done) => {

        const request = Wreck.request('get', 'foo', { baseUrl: 'http://localhost' }, Hoek.ignore);

        expect(internals.header(request, 'host')).to.equal('localhost');
        expect(request.path).to.equal('/foo');
        done();
    });

    it('uses baseUrl option when uri is an empty string', (done) => {

        const request = Wreck.request('get', '', { baseUrl: 'http://localhost' }, Hoek.ignore);

        expect(internals.header(request, 'host')).to.equal('localhost');
        expect(request.path).to.equal('/');
        done();
    });

    it('uses baseUrl option with a path', (done) => {

        const request = Wreck.request('get', '/bar', { baseUrl: 'http://localhost/foo' }, Hoek.ignore);

        expect(internals.header(request, 'host')).to.equal('localhost');
        expect(request.path).to.equal('/foo/bar');
        done();
    });

    it('uses baseUrl option with a path and removes extra slashes', (done) => {

        const request = Wreck.request('get', '/bar', { baseUrl: 'http://localhost/foo/' }, Hoek.ignore);

        expect(internals.header(request, 'host')).to.equal('localhost');
        expect(request.path).to.equal('/foo/bar');
        done();
    });

    it('uses baseUrl option with a url that has a querystring', (done) => {

        const request = Wreck.request('get', '/bar?test=hello', { baseUrl: 'http://localhost/foo' }, Hoek.ignore);

        expect(internals.header(request, 'host')).to.equal('localhost');
        expect(request.path).to.equal('/foo/bar?test=hello');
        done();
    });
});

describe('read()', () => {

    it('handles errors with a boom response', (done) => {

        const res = new Events.EventEmitter();
        res.pipe = function () { };

        Wreck.read(res, null, (err) => {

            expect(err.isBoom).to.equal(true);
            done();
        });

        res.emit('error', new Error('my error'));
    });

    it('handles "close" emit', (done) => {

        const res = new Events.EventEmitter();
        res.pipe = function () { };

        Wreck.read(res, null, (err) => {

            expect(err.isBoom).to.equal(true);
            done();
        });

        res.emit('close');
    });

    it('handles requests that close early', (done) => {

        let clientReq;
        const handler = (req, res) => {

            Wreck.read(req, null, (err) => {

                expect(err).to.be.an.error();
                expect(err.message).to.equal('Payload stream closed prematurely');
            });
            clientReq.abort();
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
            'content-length': '123'
        };

        const server = Http.createServer(handler);

        server.listen(0, () => {

            clientReq = Wreck.request('post', 'http://localhost:' + server.address().port, { payload, headers }, (err, res) => {

                expect(err).to.be.an.error();
                expect(err.isBoom).to.equal(true);
                done();
            });
        });
    });

    it('errors on partial payload transfers', (done) => {

        const handler = (req, res) => {

            res.setHeader('content-length', 2000);
            res.writeHead(200);
            res.write(internals.payload.slice(0, 1000));
            res.end();
        };

        const server = Http.createServer(handler);

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.not.be.an.error();
                expect(res.statusCode).to.equal(200);
                expect(res.headers['transfer-encoding']).to.not.exist();
                Wreck.read(res, null, (err) => {

                    expect(err).to.be.an.error();
                    expect(err.message).to.equal('Payload stream closed prematurely');
                    expect(err.isBoom).to.equal(true);
                    done();
                });
            });
        });
    });

    it('errors on partial payload transfers (chunked)', (done) => {

        const handler = (req, res) => {

            res.writeHead(200);
            res.write(internals.payload);
            setTimeout(() => {

                res.destroy(new Error('go away'));
            }, 10);
        };

        const server = Http.createServer(handler);

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.not.be.an.error();
                expect(res.statusCode).to.equal(200);
                expect(res.headers['transfer-encoding']).to.equal('chunked');

                Wreck.read(res, null, (err) => {

                    expect(err).to.be.an.error();
                    expect(err.message).to.equal('Payload stream closed prematurely');
                    expect(err.isBoom).to.equal(true);
                    done();
                });
            });
        });
    });

    it('times out when stream read takes too long', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.write(internals.payload);
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, { timeout: 100 }, (err, body) => {

                    expect(err).to.exist();
                    expect(err.output.statusCode).to.equal(408);
                    expect(body).to.not.exist();
                    server.close();
                    done();
                });
            });
        });
    });

    it('errors when stream is too big', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.write(internals.payload);
            res.end(internals.payload);
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.not.exist();
                Wreck.read(res, { maxBytes: 120 }, (err, body) => {

                    expect(err).to.exist();
                    expect(err.output.statusCode).to.equal(400);
                    expect(body).to.not.exist();
                    server.close();
                    done();
                });
            });
        });
    });

    it('reads a file streamed via HTTP', (done) => {

        const path = Path.join(__dirname, '../LICENSE.md');
        const stats = Fs.statSync(path);
        const fileStream = Fs.createReadStream(path);

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            fileStream.pipe(res);
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);

                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.length).to.equal(stats.size);
                    server.close();
                    done();
                });
            });
        });
    });

    it('reads a multiple buffers response', (done) => {

        const path = Path.join(__dirname, '../LICENSE.md');
        const stats = Fs.statSync(path);
        const file = Fs.readFileSync(path);

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.write(file);
            setTimeout(() => {

                res.write(file);
                res.end();
            }, 100);
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);

                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.length).to.equal(stats.size * 2);
                    server.close();
                    done();
                });
            });
        });
    });

    it('writes a file streamed via HTTP', (done) => {

        const path = Path.join(__dirname, '../LICENSE.md');
        const stats = Fs.statSync(path);
        const fileStream = Fs.createReadStream(path);

        const server = Http.createServer((req, res) => {

            res.writeHead(200);

            Wreck.read(req, null, (err, body) => {

                expect(err).to.not.exist();
                res.end(body);
            });
        });

        server.listen(0, () => {

            Wreck.request('post', 'http://localhost:' + server.address().port, { payload: fileStream }, (err, res) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);

                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.length).to.equal(stats.size);
                    server.close();
                    done();
                });
            });
        });
    });

    it('handles responses with no headers', (done) => {

        const res = Wreck.toReadableStream(internals.payload);
        Wreck.read(res, { json: true }, (err) => {

            expect(err).to.equal(null);
            done();
        });
    });

    it('handles responses with no headers (with gunzip)', (done) => {

        const res = Wreck.toReadableStream(internals.gzippedPayload);
        Wreck.read(res, { json: true, gunzip: true }, (err) => {

            expect(err).to.equal(null);
            done();
        });
    });

    it('skips destroy when not available', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.write(internals.payload);
            res.end(internals.payload);
        });

        server.listen(0, () => {

            Wreck.request('get', 'http://localhost:' + server.address().port, {}, (err, res) => {

                expect(err).to.not.exist();

                res.destroy = null;
                Wreck.read(res, { maxBytes: 120 }, (err, body) => {

                    expect(err).to.exist();
                    expect(err.output.statusCode).to.equal(400);
                    expect(body).to.not.exist();
                    server.close();
                    done();
                });
            });
        });
    });

    it('allows custom handling of response event and read works', (done) => {

        const path = Path.join(__dirname, '../LICENSE.md');
        const stats = Fs.statSync(path);
        const fileStream = Fs.createReadStream(path);

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            Wreck.read(req, null, (err, body) => {

                expect(err).to.not.exist();
                res.end(body);
            });
        });

        server.listen(0, () => {

            const req = Wreck.request('post', 'http://localhost:' + server.address().port, { payload: fileStream });

            req.once('response', (res) => {

                expect(res.statusCode).to.equal(200);

                Wreck.read(res, null, (err, body) => {

                    expect(err).to.not.exist();
                    expect(body.length).to.equal(stats.size);
                    server.close();
                    done();
                });
            });
        });
    });
});

describe('parseCacheControl()', () => {

    it('parses valid header', (done) => {

        const header = Wreck.parseCacheControl('must-revalidate, max-age=3600');
        expect(header).to.exist();
        expect(header['must-revalidate']).to.equal(true);
        expect(header['max-age']).to.equal(3600);
        done();
    });

    it('parses valid header with quoted string', (done) => {

        const header = Wreck.parseCacheControl('must-revalidate, max-age="3600"');
        expect(header).to.exist();
        expect(header['must-revalidate']).to.equal(true);
        expect(header['max-age']).to.equal(3600);
        done();
    });

    it('errors on invalid header', (done) => {

        const header = Wreck.parseCacheControl('must-revalidate, b =3600');
        expect(header).to.not.exist();
        done();
    });

    it('errors on invalid max-age', (done) => {

        const header = Wreck.parseCacheControl('must-revalidate, max-age=a3600');
        expect(header).to.not.exist();
        done();
    });
});

describe('Shortcut', () => {

    it('get request', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            Wreck.get('http://localhost:' + server.address().port, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload.toString()).to.equal('ok');
                server.close();
                done();
            });
        });
    });

    it('get request without callback returns a promise', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            Wreck.get(`http://localhost:${server.address().port}`).then((result) => {

                expect(result.res.statusCode).to.equal(200);
                expect(result.payload.toString()).to.equal('ok');
                server.close();
                done();
            });
        });
    });

    it('get request with a promise and onRequest function can abort the request', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            const onRequest = (req) => {

                req.abort();
            };

            Wreck.get(`http://localhost:${server.address().port}`, { onRequest }).then((result) => {

                expect(result).to.not.exist();
            }).catch((err) => {

                expect(err).to.exist();
                expect(err.message).to.contain('hang up');
                server.close();
                done();
            });
        });
    });

    it('get request without callback rejects errors on bad request', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            const port = server.address().port;
            server.close();

            Wreck.get(`http://localhost:${port}`).catch((err) => {

                expect(err).to.exist();
                done();
            });
        });
    });

    it('post request', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            Wreck.post(`http://localhost:${server.address().port}`, { payload: '123' }, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload.toString()).to.equal('ok');
                server.close();
                done();
            });
        });
    });


    it('post request with a promise and onRequest function can abort the request', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            const onRequest = (req) => {

                req.abort();
            };

            Wreck.post(`http://localhost:${server.address().port}`, { onRequest, payload: Wreck.toReadableStream(internals.payload) }).then((result) => {

                expect(result).to.not.exist();
            }).catch((err) => {

                expect(err).to.exist();
                expect(err.message).to.contain('hang up');
                server.close();
                done();
            });
        });
    });

    it('patch request', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            Wreck.patch(`http://localhost:${server.address().port}`, { payload: '123' }, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload.toString()).to.equal('ok');
                server.close();
                done();
            });
        });
    });

    it('put request', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            Wreck.put('http://localhost:' + server.address().port, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload.toString()).to.equal('ok');
                server.close();
                done();
            });
        });
    });

    it('delete request', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            Wreck.delete('http://localhost:' + server.address().port, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload.toString()).to.equal('ok');
                server.close();
                done();
            });
        });
    });

    it('errors on bad request', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            const port = server.address().port;
            server.close();

            Wreck.get('http://localhost:' + port, (err, res, payload) => {

                expect(err).to.exist();
                done();
            });
        });
    });

    it('handles error responses with a boom error object', (done) => {

        const server = Http.createServer((req, res) => {

            res.setHeader('content-type', 'application/json');
            res.setHeader('x-custom', 'yes');
            res.writeHead(400);
            res.end(JSON.stringify({ details: 'failed' }));
        });

        server.once('listening', () => {

            Wreck.get('http://127.0.0.1:' + server.address().port, { json: true }, (err) => {

                expect(err.isBoom).to.be.true();
                expect(err.message).to.equal('Response Error: 400 Bad Request');
                expect(err.data.isResponseError).to.be.true();
                expect(err.data.headers).to.include({ 'x-custom': 'yes' });
                expect(err.data.payload).to.equal({ details: 'failed' });
                expect(err.data.response.statusCode).to.equal(400);
                done();
            });
        });

        server.listen(0);
    });
});

describe('json', () => {

    it('json requested and received', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ foo: 'bar' }));
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: true
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload).to.not.equal(null);
                expect(payload.foo).to.exist();
                server.close();
                done();
            });
        });
    });

    it('json-based type requested and received', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'application/vnd.api+json' });
            res.end(JSON.stringify({ foo: 'bar' }));
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: true
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload).to.not.equal(null);
                expect(payload.foo).to.exist();
                server.close();
                done();
            });
        });
    });

    it('json requested but not received - flag is ignored', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: true
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload).to.not.equal(null);
                server.close();
                done();
            });
        });
    });

    it('invalid json received', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('ok');
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: true
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.exist();
                server.close();
                done();
            });
        });
    });

    it('json not requested but received as string', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ foo: 'bar' }));
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: false
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload).to.not.equal(null);
                server.close();
                done();
            });
        });
    });

    it('should not be parsed on empty buffer', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(204, { 'Content-Type': 'application/json' });
            res.end();
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: 'SMART'
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(204);
                expect(payload).to.equal(null);
                server.close();
                done();
            });
        });
    });

    it('will try to parse json in "force" mode, regardless of the header', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(JSON.stringify({ foo: 'bar' }));
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: 'force'
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload).to.not.equal(null);
                expect(payload).to.equal({
                    foo: 'bar'
                });
                server.close();
                done();
            });
        });
    });

    it('will error on invalid json received in "force" mode', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ok');
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: 'force'
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.exist();
                server.close();
                done();
            });
        });
    });

    it('will try to parse json in "strict" mode', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ foo: 'bar' }));
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: 'strict'
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload).to.not.equal(null);
                expect(payload).to.equal({
                    foo: 'bar'
                });
                server.close();
                done();
            });
        });
    });

    it('will error on invalid content-type header in "strict" mode', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(JSON.stringify({ foo: 'bar' }));
        });

        server.listen(0, () => {

            const port = server.address().port;
            const options = {
                json: 'strict'
            };

            Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                expect(err).to.exist();
                expect(err.output.statusCode).to.equal(406);
                server.close();
                done();
            });
        });
    });
});

describe('gunzip', () => {

    describe('true', () => {

        it('automatically handles gzip', (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['accept-encoding']).to.equal('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            });

            server.listen(0, () => {

                const port = server.address().port;
                const options = {
                    json: true,
                    gunzip: true
                };

                Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                    expect(err).to.not.exist();
                    expect(res.statusCode).to.equal(200);
                    expect(payload).to.not.equal(null);
                    expect(payload.foo).to.exist();
                    server.close();
                    done();
                });
            });
        });

        it('automatically handles gzip (with identity)', (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['accept-encoding']).to.equal('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip, identity' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            });

            server.listen(0, () => {

                const port = server.address().port;
                const options = {
                    json: true,
                    gunzip: true
                };

                Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                    expect(err).to.not.exist();
                    expect(res.statusCode).to.equal(200);
                    expect(payload).to.not.equal(null);
                    expect(payload.foo).to.exist();
                    server.close();
                    done();
                });
            });
        });

        it('automatically handles gzip (without json)', (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['accept-encoding']).to.equal('gzip');
                res.writeHead(200, { 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            });

            server.listen(0, () => {

                const port = server.address().port;
                const options = {
                    gunzip: true
                };

                Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                    expect(err).to.not.exist();
                    expect(res.statusCode).to.equal(200);
                    expect(payload.toString()).to.equal('{"foo":"bar"}');
                    server.close();
                    done();
                });
            });
        });

        it('automatically handles gzip (ignores when not gzipped)', (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['accept-encoding']).to.equal('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ foo: 'bar' }));
            });

            server.listen(0, () => {

                const port = server.address().port;
                const options = {
                    json: true,
                    gunzip: true
                };

                Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                    expect(err).to.not.exist();
                    expect(res.statusCode).to.equal(200);
                    expect(payload).to.not.equal(null);
                    expect(payload.foo).to.exist();
                    server.close();
                    done();
                });
            });
        });

        it('handles gzip errors', { skip: internals.isv4 }, (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['accept-encoding']).to.equal('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })).slice(0, 10));
            });

            server.listen(0, () => {

                const port = server.address().port;
                const options = {
                    json: true,
                    gunzip: true
                };

                Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                    expect(err).to.be.an.error(internals.isv4 ? 'Unexpected end of input' : 'unexpected end of file');
                    expect(res.statusCode).to.equal(200);
                    server.close();
                    done();
                });
            });
        });
    });

    describe('false/undefined', () => {

        it('fails parsing gzipped content', (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['accept-encoding']).to.not.exist();
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            });

            server.listen(0, () => {

                const port = server.address().port;
                const options = {
                    json: true
                };

                Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                    expect(err).to.be.an.error(internals.isv4 ? 'Unexpected token \u001f' : 'Unexpected token \u001f in JSON at position 0');
                    expect(res.statusCode).to.equal(200);
                    expect(payload).to.equal(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
                    server.close();
                    done();
                });
            });
        });
    });

    describe('force', () => {

        it('forcefully handles gzip', (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['accept-encoding']).to.equal('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })));
            });

            server.listen(0, () => {

                const port = server.address().port;
                const options = {
                    json: true,
                    gunzip: 'force'
                };

                Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                    expect(err).to.not.exist();
                    expect(res.statusCode).to.equal(200);
                    expect(payload).to.not.equal(null);
                    expect(payload.foo).to.exist();
                    server.close();
                    done();
                });
            });
        });

        it('handles gzip errors', { skip: internals.isv4 }, (done) => {

            const server = Http.createServer((req, res) => {

                expect(req.headers['accept-encoding']).to.equal('gzip');
                res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
                res.end(Zlib.gzipSync(JSON.stringify({ foo: 'bar' })).slice(0, 10));
            });

            server.listen(0, () => {

                const port = server.address().port;
                const options = {
                    json: true,
                    gunzip: 'force'
                };

                Wreck.get('http://localhost:' + port, options, (err, res, payload) => {

                    expect(err).to.be.an.error(internals.isv4 ? 'Unexpected end of input' : 'unexpected end of file');
                    expect(res.statusCode).to.equal(200);
                    server.close();
                    done();
                });
            });
        });
    });
});

describe('toReadableStream()', () => {

    it('handle empty payload', (done) => {

        const stream = Wreck.toReadableStream();
        expect(stream instanceof Stream).to.be.true();
        const read = stream.read();                           // Make sure read has no problems
        expect(read).to.be.null();
        done();
    });

    it('handle explicit encoding', (done) => {

        const data = 'Hello';
        const stream = Wreck.toReadableStream(data, 'ascii');
        expect(stream instanceof Stream).to.be.true();
        const read = stream.read();
        expect(read.toString()).to.equal(data);
        done();
    });

    it('chunks to requested size', (done) => {

        let buf;
        const data = new Array(101).join('0123456789');
        const stream = Wreck.toReadableStream(data);

        buf = stream.read(100);
        expect(buf.length).to.equal(100);

        buf = stream.read(400);
        expect(buf.length).to.equal(400);

        buf = stream.read();
        expect(buf.length).to.equal(500);

        buf = stream.read();
        expect(buf).to.equal(null);

        done();
    });
});

describe('Events', () => {

    it('emits response event when wreck is finished', (done) => {

        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        process[internals.emitSymbol].once('response', (err, details) => {

            expect(err).to.not.exist();
            expect(details.req).to.exist();
            expect(details.res).to.exist();
            expect(typeof details.start).to.equal('number');
            expect(details.uri.href).to.equal('http://localhost:' + server.address().port + '/');
            done();
        });


        server.listen(0, () => {

            Wreck.put('http://localhost:' + server.address().port, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload.toString()).to.equal('ok');
                server.close();
            });
        });
    });

    it('response event includes error when it occurs', { timeout: 10000 }, (done) => {

        Wreck.once('response', (err, details) => {

            expect(err).to.exist();
            expect(details).to.exist();
            expect(details.req).to.exist();
            expect(details.res).to.not.exist();
            done();
        });

        Wreck.get('http://127.0.0.1', { timeout: 10 }, (err) => {

            expect(err).to.exist();
        });

    });

    it('multiple requests execute the same response handler', { timeout: 10000 }, (done) => {

        let count = 0;
        const handler = (err, details) => {

            expect(err).to.exist();
            expect(details.req).to.exist();
            expect(details.res).to.not.exist();
            count++;
        };

        Wreck.on('response', handler);

        Wreck.get('http://127.0.0.1', { timeout: 10 }, (err) => {

            expect(err).to.exist();

            Wreck.get('http://127.0.0.1', { timeout: 10 }, (err) => {

                expect(err).to.exist();
                expect(count).to.equal(2);
                Wreck.removeListener('response', handler);
                done();
            });
        });
    });

    it('won\'t overwrite existing emitter', (done) => {

        internals.reload('../');
        expect(process[internals.emitSymbol]).to.exist();
        process[internals.emitSymbol] = true;

        internals.reload('../');
        expect(process[internals.emitSymbol]).to.equal(true);
        delete process[internals.emitSymbol];
        internals.reload('../');

        done();
    });

    it('emits request event before wreck sends a request', (done) => {

        const server = Http.createServer((req, res) => {

            expect(req.headers.foo).to.equal('bar');
            res.writeHead(200);
            res.end('ok');
        });

        Wreck.once('request', (uri, options) => {

            expect(uri.href).to.equal('http://localhost:' + server.address().port + '/');
            expect(options).to.exist();

            uri.headers.foo = 'bar';
        });

        server.listen(0, () => {

            Wreck.put('http://localhost:' + server.address().port, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload.toString()).to.equal('ok');
                server.close();
                done();
            });
        });
    });

    it('clears once handlers from global emitter', (done) => {

        const wreckEvents = process[Symbol.for('wreck')];
        const server = Http.createServer((req, res) => {

            res.writeHead(200);
            res.end('ok');
        });

        let onceHandlerFired = false;
        wreckEvents.once('request', () => {

            onceHandlerFired = true;
        });


        server.listen(0, () => {

            expect(wreckEvents.listeners('request').length).to.equal(1);
            Wreck.get('http://localhost:' + server.address().port, (err, res, payload) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(200);
                expect(payload.toString()).to.equal('ok');
                expect(onceHandlerFired).to.equal(true);
                expect(wreckEvents.listeners('request').length).to.equal(0);
                server.close();
                done();
            });
        });
    });
});

describe('Defaults', () => {

    it('rejects attempts to use defaults without an options hash', (done) => {

        expect(() => {

            Wreck.defaults();
        }).to.throw();
        done();
    });

    it('respects defaults without bleeding across instances', (done) => {

        const optionsA = { headers: { foo: 123 } };
        const optionsB = { headers: { bar: 321 } };

        const wreckA = Wreck.defaults(optionsA);
        const wreckB = Wreck.defaults(optionsB);
        const wreckAB = wreckA.defaults(optionsB);

        const req1 = wreckA.request('get', 'http://localhost:0/', { headers: { banana: 911 } }, (err) => {

            expect(err).to.exist();
            expect(internals.header(req1, 'banana')).to.exist();
            expect(internals.header(req1, 'foo')).to.exist();
            expect(internals.header(req1, 'bar')).to.not.exist();

            const req2 = wreckB.request('get', 'http://localhost:0/', { headers: { banana: 911 } }, (err) => {

                expect(err).to.exist();
                expect(internals.header(req2, 'banana')).to.exist();
                expect(internals.header(req2, 'foo')).to.not.exist();
                expect(internals.header(req2, 'bar')).to.exist();

                const req3 = wreckAB.request('get', 'http://localhost:0/', { headers: { banana: 911 } }, (err) => {

                    expect(err).to.exist();
                    expect(internals.header(req3, 'banana')).to.exist();
                    expect(internals.header(req3, 'foo')).to.exist();
                    expect(internals.header(req3, 'bar')).to.exist();

                    done();
                });
            });
        });
    });

    it('applies defaults correctly to requests', (done) => {

        const optionsA = { headers: { Accept: 'foo', 'Test': 123 } };
        const optionsB = { headers: { Accept: 'bar' } };

        const wreckA = Wreck.defaults(optionsA);

        const req1 = wreckA.request('get', 'http://localhost:0/', optionsB, (err) => {

            expect(err).to.exist();
            expect(internals.header(req1, 'accept')).to.equal('bar');
            expect(internals.header(req1, 'test')).to.equal(123);

            done();
        });
    });

    it('defaults inherits agents properly', (done) => {

        const wreckNoDefaults = Wreck.defaults({});
        const wreckDefaults = Wreck.defaults({
            agents: {
                https: new Https.Agent({ maxSockets: 1 }),
                http: new Http.Agent({ maxSockets: 1 }),
                httpsAllowUnauthorized: new Https.Agent({ maxSockets: 1, rejectUnauthorized: false })
            }
        });

        expect(Wreck.agents.http.maxSockets).to.equal(wreckNoDefaults.agents.http.maxSockets);
        expect(wreckDefaults.agents.http.maxSockets).to.not.equal(wreckNoDefaults.agents.http.maxSockets);
        expect(wreckDefaults.agents.http.maxSockets).to.equal(1);
        expect(wreckDefaults.agents.https.maxSockets).to.equal(1);
        expect(wreckDefaults.agents.httpsAllowUnauthorized.maxSockets).to.equal(1);

        done();
    });

    it('defaults disallows agents without all 3 types', (done) => {

        expect(() => {

            Wreck.defaults({
                agents: {
                    'http': new Http.Agent({ maxSockets: Infinity })
                }
            });
        }).to.throw();

        expect(() => {

            Wreck.defaults({
                agents: {
                    'https': new Https.Agent({ maxSockets: 1 })
                }
            });
        }).to.throw();

        expect(() => {

            Wreck.defaults({
                agents: {
                    'httpsAllowUnauthorized': new Https.Agent({ maxSockets: Infinity, rejectUnauthorized: false })
                }
            });
        }).to.throw();

        expect(() => {

            Wreck.defaults({
                agents: {
                    'http': new Http.Agent({ maxSockets: Infinity }),
                    'https': new Https.Agent({ maxSockets: 1 })
                }
            });
        }).to.throw();

        expect(() => {

            Wreck.defaults({
                agents: {
                    'http': new Http.Agent({ maxSockets: Infinity }),
                    'httpsAllowUnauthorized': new Https.Agent({ maxSockets: Infinity, rejectUnauthorized: false })
                }
            });
        }).to.throw();

        expect(() => {

            Wreck.defaults({
                agents: {
                    'https': new Https.Agent({ maxSockets: 1 }),
                    'httpsAllowUnauthorized': new Https.Agent({ maxSockets: Infinity, rejectUnauthorized: false })
                }
            });
        }).to.throw();

        expect(() => {

            Wreck.defaults({
                agents: {}
            });
        }).to.throw();

        done();
    });

    it('default agents can be overrode in request()', (done) => {

        const wreck = Wreck.defaults({
            agents: {
                https: new Https.Agent({ maxSockets: 1 }),
                http: new Http.Agent({ maxSockets: 1 }),
                httpsAllowUnauthorized: new Https.Agent({ maxSockets: 1, rejectUnauthorized: false })
            }
        });

        expect(wreck.agents.http.maxSockets).to.equal(1);
        const agent = new Http.Agent({ maxSockets: 2 });
        const req = wreck.request('get', 'http://localhost:0/', { agent }, (err, res) => {

            expect(err).to.exist();
        });

        expect(req.agent.maxSockets).to.equal(2);

        done();
    });
});


internals.header = function (request, header) {

    const headers = typeof request.getHeaders === 'function' ? request.getHeaders() : request._headers;
    return headers[header];
};
