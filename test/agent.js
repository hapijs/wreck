// Load modules

var Http = require('http');
var Https = require('https');
var Hoek = require('hoek');
var Lab = require('lab');
var Agent = require('../lib/agent');
var Wreck = require('../');


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Lab.expect;


describe('Http()', function () {

    it('can be created with undefined options', function (done) {

        var agent = new Agent.Http();
        expect(agent).to.exist;
        done();
    });

    it('returns the builtin Http Agent when it supports keep alive', function (done) {

        var existingAgent = Http.Agent;
        Http.Agent = function (options) {

            existingAgent.call(this, options);
            this.keepAlive = true;
        };
        Hoek.inherits(Http.Agent, existingAgent);

        var agent = new Agent.Http();
        expect(agent.isSocketUsable).to.not.exist;
        Http.Agent = existingAgent;
        done();
    });

    it('returns the new Agent when builtin node Agent doesn\'t support keep alive', function (done) {

        var existingAgent = Http.Agent;
        Http.Agent = function (options) {

            existingAgent.call(this, options);
            this.keepAlive = undefined;
        };
        Hoek.inherits(Http.Agent, existingAgent);

        var agent = new Agent.Http();
        expect(agent.isSocketUsable).to.exist;
        Http.Agent = existingAgent;
        done();
    });

    it('requests reuse existing sockets when they can', function (done) {

        var server = Http.createServer(function (req, res) {

            res.writeHead(200);
            res.end();
        });

        server.listen(0, function () {

            var existingAgent = Http.Agent;
            Http.Agent = function (options) {

                existingAgent.call(this, options);
                this.keepAlive = undefined;
            };
            Hoek.inherits(Http.Agent, existingAgent);

            var agent = new Agent.Http();
            Http.Agent = existingAgent;

            Wreck.get('http://localhost:' + server.address().port, { agent: agent }, function (err) {

                expect(err).to.not.exist;
                Wreck.get('http://localhost:' + server.address().port, { agent: agent }, function (err) {

                    expect(err).to.not.exist;
                    expect(Object.keys(agent._idleSockets).length).to.equal(1);
                    done();
                });
            });
        });
    });

    it('won\'t allow a destroyed socket to be reused', function (done) {

        var server = Http.createServer(function (req, res) {

            res.writeHead(200);
            res.end();
        });

        server.listen(0, function () {

            var existingAgent = Http.Agent;
            Http.Agent = function (options) {

                existingAgent.call(this, options);
                this.keepAlive = undefined;
            };
            Hoek.inherits(Http.Agent, existingAgent);

            var agent = new Agent.Http();
            Http.Agent = existingAgent;
            var port = server.address().port;
            Wreck.get('http://localhost:' + port, { agent: agent }, function (err) {

                expect(err).to.not.exist;
                Wreck.get('http://localhost:' + port, { agent: agent }, function (err) {

                    expect(err).to.not.exist;
                    agent._idleSockets['localhost:' + port][0].destroyed = true;
                    agent._idleSockets['localhost:' + port][0].emit('free');
                    Wreck.get('http://localhost:' + port, { agent: agent }, function (err) {

                        expect(err).to.not.exist;
                        expect(agent._idleSockets['localhost:' + port][0].destroyed).to.equal(false);
                        done();
                    });
                });
            });
        });
    });

    it('sockets can be removed from an origin', function (done) {

        var server = Http.createServer(function (req, res) {

            res.writeHead(200);
            res.end();
        });

        server.listen(0, function () {

            var existingAgent = Http.Agent;
            Http.Agent = function (options) {

                existingAgent.call(this, options);
                this.keepAlive = undefined;
            };
            Hoek.inherits(Http.Agent, existingAgent);

            var agent = new Agent.Http();
            Http.Agent = existingAgent;

            var port = server.address().port;
            Wreck.get('http://localhost:' + port, { agent: agent }, function (err) {

                expect(err).to.not.exist;

                Wreck.get('http://localhost:' + port, { agent: agent }, function (err) {

                    expect(err).to.not.exist;
                });

                var req = Wreck.get('http://localhost:' + port, { agent: agent }, function (err) {

                    expect(err).to.not.exist;
                });

                req.once('socket', function (socket) {

                    agent.removeSocket(socket, 'localhost:' + port, 'localhost', port, socket.address);

                    Wreck.get('http://localhost:' + port, { agent: agent }, function (err) {

                        expect(err).to.not.exist;
                        done();
                    });
                });
            });
        });
    });

    it('requests can be added for a local address', function (done) {

        var existingAgent = Http.Agent;
        Http.Agent = function (options) {

            existingAgent.call(this, options);
            this.keepAlive = undefined;
        };
        Hoek.inherits(Http.Agent, existingAgent);

        var agent = new Agent.Http();
        Http.Agent = existingAgent;

        var req = new Http.ClientRequest({ agent: agent });
        req.on('error', function () {});
        agent.addRequest(req, 'localhost', '0', '/local');
        expect(agent.sockets['localhost:0:/local']).to.exist;
        done();
    });

    it('requests can be removed for a local address', function (done) {

        var existingAgent = Http.Agent;
        Http.Agent = function (options) {

            existingAgent.call(this, options);
            this.keepAlive = undefined;
        };
        Hoek.inherits(Http.Agent, existingAgent);

        var agent = new Agent.Http();
        Http.Agent = existingAgent;

        var req = new Http.ClientRequest({ agent: agent });
        req.on('error', function () {});
        agent.addRequest(req, 'localhost', '0', '/local');
        agent.addRequest(req, 'localhost', '0', '/local');
        agent._idleSockets = { 'localhost:0:/local': [agent.sockets['localhost:0:/local']]}
        agent.removeSocket(agent.sockets['localhost:0:/local'], 'localhost:0:/local', 'localhost', '0', '/local');
        expect(agent._idleSockets['localhost:0:/local'].length).to.equal(0);
        done();
    });

    it('maxFreeSockets setting is honored', function (done) {

        var existingAgent = Http.Agent;
        Http.Agent = function (options) {

            existingAgent.call(this, options);
            this.keepAlive = undefined;
        };
        Hoek.inherits(Http.Agent, existingAgent);

        var agent = new Agent.Http({ maxFreeSockets: 1 });
        Http.Agent = existingAgent;

        var req = new Http.ClientRequest({ agent: agent });
        req.on('error', function () {});
        agent.emit('free', req, 'localhost', '0', '/local');
        agent.emit('free', req, 'localhost', '0', '/local');
        agent.emit('free', req, 'localhost', '0', '/local');

        expect(agent._idleSockets['localhost:0:/local'].length).to.equal(1);
        done();
    });

    it('freeSocketsTimeout setting is honored when set', function (done) {

        var existingAgent = Http.Agent;
        Http.Agent = function (options) {

            existingAgent.call(this, options);
            this.keepAlive = undefined;
        };
        Hoek.inherits(Http.Agent, existingAgent);

        var agent = new Agent.Http({ freeSocketsTimeout: 1 });
        Http.Agent = existingAgent;

        var server = Http.createServer(function (req, res) {}, 0);

        server.listen(function () {

            var port = server.address().port;
            var req = new Http.ClientRequest({ agent: agent, port: port });
            req.on('error', function () {});
            agent.emit('free', req, 'localhost', port);
            var socket = req.agent.sockets['localhost:' + port][0];
            expect(socket.destroyed).to.equal(false);

            setTimeout(function () {

                expect(socket.destroyed).to.equal(true);
                done();
            }, 10);
        });
    });

    it('won\'t destroy a socket when freeSocketsTimeout is 0', function (done) {

        var existingAgent = Http.Agent;
        Http.Agent = function (options) {

            existingAgent.call(this, options);
            this.keepAlive = undefined;
        };
        Hoek.inherits(Http.Agent, existingAgent);

        var agent = new Agent.Http({ freeSocketsTimeout: 0 });
        Http.Agent = existingAgent;

        var server = Http.createServer(function (req, res) {}, 0);

        server.listen(function () {

            var port = server.address().port;
            var req = new Http.ClientRequest({ agent: agent, port: port });
            req.on('error', function () {});
            agent.emit('free', req, 'localhost', port);
            var socket = req.agent.sockets['localhost:' + port][0];
            expect(socket.destroyed).to.equal(false);

            setTimeout(function () {

                expect(socket.destroyed).to.equal(false);
                done();
            }, 10);
        });
    });
});


describe('Https()', function () {

    it('can be created with undefined options', function (done) {

        var agent = new Agent.Https();
        expect(agent).to.exist;
        done();
    });

    it('returns the builtin Https Agent when it supports keep alive', function (done) {

        var existingAgent = Https.Agent;
        Https.Agent = function (options) {

            existingAgent.call(this, options);
            this.keepAlive = true;
        };
        Hoek.inherits(Https.Agent, existingAgent);

        var agent = new Agent.Https();
        expect(agent.isSocketUsable).to.not.exist;
        Https.Agent = existingAgent;
        done();
    });

    it('returns the new Agent when builtin node Agent doesn\'t support keep alive', function (done) {

        var existingAgent = Https.Agent;
        Https.Agent = function (options) {

            existingAgent.call(this, options);
            this.keepAlive = undefined;
        };
        Hoek.inherits(Https.Agent, existingAgent);

        var agent = new Agent.Https();
        expect(agent.isSocketUsable).to.exist;
        Https.Agent = existingAgent;
        done();
    });

    it('won\'t allow a destroyed socket to be reused', function (done) {

        var httpsOptions = {
            key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
            cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
        };

        var server = Https.createServer(httpsOptions, function (req, res) {

            res.writeHead(200);
            res.end();
        });

        server.listen(0, function () {

            var existingAgent = Https.Agent;
            Https.Agent = function (options) {

                existingAgent.call(this, options);
                this.keepAlive = undefined;
            };
            Hoek.inherits(Https.Agent, existingAgent);

            var agent = new Agent.Https({ rejectUnauthorized: false });
            Https.Agent = existingAgent;
            var port = server.address().port;
            Wreck.get('https://localhost:' + port, { agent: agent }, function (err) {

                expect(err).to.not.exist;
                Wreck.get('https://localhost:' + port, { agent: agent }, function (err) {

                    expect(err).to.not.exist;
                    agent._idleSockets['localhost:' + port][0].pair = null;
                    agent._idleSockets['localhost:' + port][0].emit('free');
                    Wreck.get('https://localhost:' + port, { agent: agent }, function (err) {

                        expect(err).to.not.exist;
                        expect(agent._idleSockets['localhost:' + port][0].pair).to.exist;
                        done();
                    });
                });
            });
        });
    });
});