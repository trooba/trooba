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
            function transport(requestContext, reply) {
                var qs = '?' + Querystring.stringify(requestContext.request);
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
                        reply(null, res);
                    });
                });

                req.on('error', reply);

                req.end();
            }

            transport.api = pipe => {
                return {
                    search: (name, callback) => {
                        pipe({
                            request: {
                                q: name
                            }
                        }, responseContext => {
                            callback(responseContext.error,
                                responseContext.response && responseContext.response.body);
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
            return function transport(requestContext, reply) {
                var options = Object.create(config);
                options.path += '?' + Querystring.stringify(requestContext.request);
                // prepare request
                var req = Http.request(options, function (res) {
                    var data = '';
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        data += chunk;
                    });
                    res.on('end', function () {
                        res.body = data;
                        reply(null, res);
                    });
                });

                req.on('error', reply);

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
            return function handler(requestContext, action) {
                // init retry context
                if (requestContext.retry === undefined) {
                    requestContext.retry = config.retry;
                }
                action.next(function (responseContext) {
                    if (responseContext.error && requestContext.retry-- > 0) {
                        retryCounter++;
                        action.next();
                        return;
                    }
                    action.reply();
                });
            };
        }

        // mock transport
        function mockTransportFactory(config) {
            var count = 1;
            return function mock(requestContext, reply) {
                // first generate error
                if (count-- > 0) {
                    return reply(new Error('Test error'));
                }
                reply(null, 'some text');
            };
        }

        var request = Trooba.transport(mockTransportFactory)
            .use(retryFactory, { retry: 1 })
            .create();

        request({}, function (err, response) {
            Assert.ok(!err);
            Assert.equal('some text', response);
            Assert.equal(1, retryCounter);
            done();
        });
    });
});
