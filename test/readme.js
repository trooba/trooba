/*jslint esversion:6 */
'use strict';

var Assert = require('assert');
var Querystring = require('querystring');
var Http = require('http');

var nock = require('nock');

var Trooba = require('..');

describe(__filename, function () {
    afterEach(function () {
        nock.cleanAll();
    });

    it('custom API', function (done) {
        var session = nock('http://www.google.com')
            .get('/search?q=nike')
            .reply(200, 'some text');

        function transportFactory(config) {
            function transport(requestPipe) {
                var qs = '?' + Querystring.stringify(requestPipe.context.request);
                var options = {
                    protocol: config.protocol,
                    hostname: config.hostname,
                    path: config.path ?
                        config.path += qs : qs
                };
                // prepare request
                var req = Http.request(options, function (res) {
                    var data = '';
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        data += chunk;
                    });
                    res.on('end', function () {
                        res.body = data;
                        requestPipe.reply(res);
                    });
                });

                req.on('error', function (err) {
                    requestPipe.throw(err);
                });

                req.end();
            }

            transport.api = pipe => {
                return {
                    search: (name, callback) => {
                        pipe({
                            request: {
                                q: name
                            }
                        })
                        .on('error', err => {
                            callback(err);
                        })
                        .on('response', response => {
                            callback(null, response.body);
                        });
                    }
                };
            };

            return transport;
        }

        var client = Trooba.transport(transportFactory, {
            protocol: 'http:',
            hostname: 'www.google.com',
            path: '/search'
        }).create();

        client.search('nike', function (err, response) {
            session.done();
            Assert.ok(!err);
            Assert.ok(response);
            console.log(response);
            done();
        });
    });

    it('generic example', function (done) {
        var session = nock('http://www.google.com')
            .get('/search?q=nike')
            .reply(200, 'some text');

        var Http = require('http');

        function transportFactory(config) {
            return function transport(requestPipe) {
                var options = Object.create(config);
                options.path += '?' + Querystring.stringify(requestPipe.context.request);
                // prepare request
                var req = Http.request(options, function (res) {
                    var data = '';
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        data += chunk;
                    });
                    res.on('end', function () {
                        res.body = data;
                        requestPipe.reply(res);
                    });
                });

                req.on('error', function (err) {
                    requestPipe.throw(err);
                });

                req.end();
            };
        }

        var request = Trooba.transport(transportFactory, {
            protocol: 'http:',
            hostname: 'www.google.com',
            path: '/search'
        }).create();

        request({
            q: 'nike'
        }, function (err, response) {
            session.done();
            Assert.ok(!err);
            Assert.equal(200, response.statusCode);
            done();
        });
    });

    it('retry handler', function (done) {
        var retryCounter = 0;
        function retryFactory(config) {
            return function handler(requestPipe) {
                // init retry context
                if (requestPipe.retry === undefined) {
                    requestPipe.retry = config.retry;
                }

                requestPipe.next()
                .on('error', function (err) {
                    if (requestPipe.retry-- > 0) {
                        requestPipe.next();
                        retryCounter++;
                        return;
                    }
                    requestPipe.throw(err);
                });
            };
        }

        // mock transport
        function mockTransportFactory(config) {
            var count = 1;
            return function mock(requestPipe) {
                // first generate error
                if (count-- > 0) {
                    return requestPipe.throw(new Error('Test error'));
                }
                requestPipe.reply('some text');
            };
        }

        var request = Trooba.transport(mockTransportFactory)
            .use(retryFactory, { retry: 1 })
            .create();

        request({}, function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('some text', response);
            Assert.equal(1, retryCounter);
            done();
        });
    });
});
