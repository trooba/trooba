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

        function transportFactory() {
            function transport(pipe, config) {
                pipe.on('request', function (request) {
                    var qs = '?' + Querystring.stringify(request);
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
                            pipe.respond(res);
                        });
                    });

                    req.on('error', function (err) {
                        pipe.throw(err);
                    });

                    req.end();
                });

                pipe.set('api', function (pipe) {
                    return {
                        search: function search(name, callback) {
                            pipe.create()
                            .on('error', function (err) {
                                callback(err);
                            })
                            .on('response', function (response) {
                                callback(null, response.body);
                            })
                            .request({
                                q: name
                            });
                        }
                    };
                });
            }

            return transport;
        }

        var client = Trooba.use(transportFactory(), {
            protocol: 'http:',
            hostname: 'www.google.com',
            path: '/search'
        }).build().create('api');

        client.search('nike', function (err, response) {
            session.done();
            Assert.ok(!err);
            Assert.ok(response);
            console.log(response);
            done();
        });
    });

    it('generic example, callback', function (done) {
        var session = nock('https://www.trooba-test.com')
            .get('/search?q=nike')
            .reply(200, 'some text');

        var Https = require('https');

        function transport(pipe, config) {
            pipe.on('request', function (request) {
                var options = JSON.parse(JSON.stringify(config));
                options.path += '?' + Querystring.stringify(request);
                // prepare 
                var req = Https.request(options, function (res) {
                    var data = '';
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        data += chunk;
                    });
                    res.on('end', function () {
                        res.body = data;
                        pipe.respond(res);
                    });
                });

                req.on('error', function (err) {
                    pipe.throw(err);
                });

                req.end();
            });

        }

        Trooba.use(transport, {
            protocol: 'https:',
            hostname: 'www.trooba-test.com',
            path: '/search'
        })
        .build()
        .create()
        .request({
            q: 'nike'
        }, function (err, response) {
            try {
                session.done();
                Assert.ok(!err);
                Assert.equal(200, response.statusCode);
                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('generic example, listeners', function (done) {
        var session = nock('http://www.google.com')
            .get('/search?q=nike')
            .reply(200, 'some text');

        var Http = require('http');

        function transport(pipe, config) {
            pipe.on('request', function (request) {
                var options = JSON.parse(JSON.stringify(config));
                options.path += '?' + Querystring.stringify(request);
                // prepare request
                var req = Http.request(options, function (res) {
                    var data = '';
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        data += chunk;
                    });
                    res.on('end', function () {
                        res.body = data;
                        pipe.respond(res);
                    });
                });

                req.on('error', function (err) {
                    pipe.throw(err);
                });

                req.end();
            });

        }

        var pipe = Trooba.use(transport, {
            protocol: 'http:',
            hostname: 'www.google.com',
            path: '/search'
        }).build();

        pipe.create().request({
            q: 'nike'
        })
        .on('error', done)
        .on('response', function (response) {
            session.done();
            Assert.equal(200, response.statusCode);
            done();
        });
    });

    it('retry handler', function (done) {
        var retryCounter = 0;
        function retry(pipe, config) {
            pipe.on('request', function (request, next) {
                var retry = config.retry;

                pipe.on('error', function (err) {
                    if (retry-- > 0) {
                        // re-try request
                        retryCounter++;
                        pipe.request(request);
                        return;
                    }
                    pipe.throw(err);
                });

                // continue with request flow
                next();
            });
        }

        // mock transport
        function createMockTransport() {
            var count = 1;
            return function mock(pipe) {
                pipe.on('request', function () {
                    // first generate error
                    if (count-- > 0) {
                        return pipe.throw(new Error('Test error'));
                    }
                    pipe.respond('some text');
                });
            };
        }

        var client = Trooba
            .use(retry, { retry: 1 })
            .use(createMockTransport())
            .build();

        client.create().request({}, function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('some text', response);
            Assert.equal(1, retryCounter);
            done();
        });
    });
});
