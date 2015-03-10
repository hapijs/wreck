// Load modules

var Code = require('code');
var Lab = require('lab');
var Log = require('../lib/log');


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Log()', function () {

    it('throws without being called with new', function (done) {

        expect(Log).to.throw();
        done();
    });

    it('won\'t throw when called with new and no options', function (done) {

        var log = new Log();
        expect(log).to.exist();
        done();
    });

    it('won\'t throw when called with new and options', function (done) {

        var log = new Log({ req: {} });
        expect(log).to.exist();
        done();
    });

    it('creates a readable stream that can be read and outputs a Buffer', function (done) {

        var log = new Log({ req: {}, res: {} });
        log.once('readable', function () {

            var data = log.read();
            expect(Buffer.isBuffer(data)).to.be.true();
            done();
        });
    });

    it('formats error information in the output', function (done) {

        var log = new Log({ req: {}, res: {}, err: new Error('my error') });
        log.once('readable', function () {

            var data = log.read();
            expect(data.toString()).to.contain('my error');
            done();
        });
    });

    it('won\'t include the response if there isn\'t one', function (done) {

        var log = new Log({ req: {} });
        log.once('readable', function () {

            var data = log.read();
            expect(data.toString()).to.not.contain('res');
            done();
        });
    });
});
