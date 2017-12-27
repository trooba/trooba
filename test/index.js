/*jshint esversion:6 */
'use strict';

var Assert = require('assert');
var Domain = require('domain');
var NodeUtils = require('util');
var _ = require('lodash');
var Async = require('async');
var Trooba = require('../pipe');

describe(__filename, function () {
    it('should create transport from factory function', function () {
        var client = Trooba.use(function () {
            return function tr(pipe) {
            };
        });
        Assert.ok(client);
        Assert.ok(client.use);
        Assert.ok(client.build);
    });

    it('should create transport from module reference', function () {
        var client = Trooba.use(require.resolve('./fixtures/test-transport'));
        Assert.ok(client);
        Assert.ok(client.use);
        Assert.ok(client.build);
    });

    it('should not invoke init during trooba.build', function (done) {
        Trooba.use(function tr(pipe) {
            done(new Error('should not happen'));
        })
        .build();

        setImmediate(done);
    });

    it('should call transport with context', function (done) {
        var pipe = Trooba.use(function tr(pipe) {
            Assert.ok(pipe);
            pipe.on('request', function onRequest(request) {
                Assert.ok(request);
                Assert.equal('thy', pipe.context.fer);
                Assert.deepEqual({
                    foo: 'bar'
                }, request);

                pipe.context.qaz = 'wsx';
                setTimeout(function () {
                    pipe.send({
                        type: 'response',
                        direction: 2,
                        data: {
                            qaz: 'qwe'
                        }
                    });
                }, 10);
            });
        })
        .build()
        .create({
            fer: 'thy'
        });

        pipe
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.ok(response);
            Assert.equal('wsx', pipe.context.qaz);
            Assert.deepEqual({
                qaz: 'qwe'
            }, response);
            done();
        })
        .send({
            type: 'request',
            data: {
                foo: 'bar'
            }
        });
    });

    it('should pass configuration to the transport', function (done) {
        Trooba.use(function tr(pipe, config) {
            Assert.deepEqual({
                asd: 'zxc'
            }, config);
            pipe.on('request', function () {
                pipe.send({
                    type: 'response',
                    data: _.assign({
                        qaz: 'qwe'
                    }, config),
                    direction: 2
                });
            });
        }, {
            asd: 'zxc'
        })
        .build()
        .create()
        .send({
            type: 'request',
            data: {foo: 'bar'}
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.ok(response);
            Assert.deepEqual({
                qaz: 'qwe',
                asd: 'zxc'
            }, response);
            done();
        });
    });

    it('should pass configuration to the api impl', function (done) {
        var injectApi = {
            interfaces: {
                client: function factory(pipe, config) {
                    return {
                        hello: function (name, callback) {
                            pipe
                            .create({
                                greeting: config.greeting
                            })
                            .on('error', function (err) {
                                callback(err);
                            })
                            .on('response', function (response) {
                                callback(undefined, response);
                            })
                            .send('request', name);
                        }
                    };
                }
            }
        };

        var client = Trooba
        .use(injectApi, {
            greeting: 'Hello %s'
        })
        .use(function tr(pipe) {
            pipe.on('request', function (request) {
                pipe.send('response', NodeUtils.format(pipe.context.greeting,
                    request), 2);
            });
        })
        .build()
        .create('client');

        client.hello('John', function validateResponse(err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.ok(response);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should handle error from response', function (done) {
        Trooba.use(function tr(pipe) {
            pipe.on('request', function () {
                pipe.throw(new Error('Test Error'));
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', function validateResponse(err) {
            Assert.ok(err);
            Assert.equal('Test Error', err.message);
            done();
        });
    });

    it('should call handler', function (done) {
        Trooba
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                next({
                    foo: request.foo,
                    rvb: 'zxc'
                });
            });
        })
        .use(function transport(pipe) {
            pipe.on('request', function (request) {
                pipe.send('response', request, 2);
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual({
                rvb: 'zxc',
                foo: 'bar'
            }, response);
            done();
        });
    });

    it('should modify request in handler', function (done) {
        Trooba
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                next({
                    rvb: 'zxc'
                });
            });
        })
        .use(function transport(pipe) {
            pipe.on('request', function (request) {
                pipe.send('response', request, 2);
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual({
                rvb: 'zxc'
            }, response);
            done();
        });
    });

    it('should resolve handler from module reference', function (done) {
        Trooba
        .use(require.resolve('./fixtures/handler'))
        .use(function transport(pipe) {
            pipe.on('request', function (request) {
                pipe.send('response', request, 2);
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual({
                test: true,
                foo: 'bar'
            }, response);
            done();
        });

    });

    it('should call handler and return response', function (done) {
        Trooba
        .use(function handler(pipe) {
            pipe.on('request', function (request) {
                request.dfg = 'cvb';
                pipe.send('response', request, 2);
            });
        })
        .use(function transport(pipe) {
            pipe.on('request', function () {
                done(new Error('Should not happen'));
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual({
                foo: 'bar',
                dfg: 'cvb'
            }, response);
            done();
        });
    });

    it('should call handler with config', function (done) {
        Trooba
        .use(function handler(pipe, config) {
            pipe.on('request', function (request) {
                request.dfg = config.cfg;
                pipe.send('response', request, 2);
            });
        }, {
            cfg: 'thy'
        })
        .use(function transport(pipe) {
            pipe.on('request', function () {
                done(new Error('Should not happen'));
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual({
                foo: 'bar',
                dfg: 'thy'
            }, response);
            done();
        });
    });

    it('should preserve properties in shared pipe.store', function (done) {
        var pipe = Trooba
        .use(function (pipe) {
            pipe.on('request', function (request) {
                if (request === 'get') {
                    return pipe.send('response', pipe.store.request, 2);
                }
                pipe.store.request = request;
            });
        })
        .build();

        pipe.create().send('request', 'foo');
        pipe.create().send('request', 'get')
        .on('error', done)
        .on('response', function (response) {
            Assert.equal('foo', response);
            done();
        });
    });

    it('should execute a chain', function (done) {
        Trooba
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                request.fa1 = 'zx1';
                next();
            });
        })
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                request.fa2 = 'zx2';
                next();
            });
        })
        .use(function transport(pipe) {
            pipe.on('request', function (request) {
                request.tra = 'asd';
                pipe.send('response', request, 2);
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual({
                foo: 'bar',
                tra: 'asd',
                fa1: 'zx1',
                fa2: 'zx2'
            }, response);
            done();
        });
    });

    it('should execute a chain and propagate requestContext implicitly', function (done) {

        Trooba
        .use(function handler(pipe) {
            pipe.context.fa1 = 'zx1';
        })
        .use(function handler(pipe) {
            pipe.context.fa2 = 'zx2';
        })
        .use(function tr(pipe) {
            pipe.on('request', function onRequest(request) {
                request.tra = 'asd';
                Object.keys(pipe.context).forEach(function (name) {
                    if (name !== 'transport' && name.charAt(0) !== '$') {
                        request[name] = pipe.context[name];
                    }
                });
                pipe.send('response', request, 2);
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual({
                foo: 'bar',
                tra: 'asd',
                fa1: 'zx1',
                fa2: 'zx2'
            }, response);
            done();
        });
    });

    it('should re-execute a chain', function (done) {
        var client = Trooba
        .use(function handler(pipe) {
            pipe.on('request', function(request, next) {
                request.chain.push('i1');
                next();
            });
        })
        .use(function handler(pipe) {
            pipe.on('request', function(request, next) {
                request.chain.push('i2');
                next();
            });
        })
        .use(function handler(pipe) {
            pipe.on('request', function(request, next) {
                request.chain.push('i3');
                next();
            });
        })
        .use(function tr(pipe) {
            pipe.on('request', function(request) {
                request.chain.push('tr');
                pipe.send('response', request, 2);
            });
        })
        .build();

        client.create().send('request', {
            chain: ['q']
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual([
                'q',
                'i1',
                'i2',
                'i3',
                'tr'
            ], response.chain);

            client.create().send('request', {
                chain: ['q']
            })
            .on('error', done)
            .on('response', function validateResponse(response) {
                Assert.deepEqual([
                    'q',
                    'i1',
                    'i2',
                    'i3',
                    'tr'
                ], response.chain);
                done();
            });


        });
    });

    it('should handle pipe.throw(error) in transport by switching it to reply implicitly', function (done) {
        Trooba
        .use(function handler(pipe) {
            pipe.on('request', function () {
                pipe.throw(new Error('Test'));
            });
        })
        .use(function handler(pipe) {
            pipe.on('request', function () {
                done(new Error('should not happen'));
            });
        })
        .use(function tr(pipe) {
            pipe.on('request', function () {
                done(new Error('should not happen'));
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', function validateResponse(err) {
            Assert.deepEqual('Test', err.message);
            done();
        });

    });

    describe('domain', function () {
        after(function () {
            while(process.domain) {
                process.domain.exit();
            }
        });

        it('should send error back if no target consumer found for the request by default', function (done) {
            var order = [];
            var domain = Domain.create();
            domain.run(function () {
                Trooba
                .use(function handler(pipe) {
                    order.push('zx1');
                })
                .use(function handler(pipe) {
                    order.push('zx2');
                })
                .use(function handler(pipe) {
                    pipe.on('request', function () {
                        setImmediate(function () {
                            pipe.send('response', 'ok', 2);
                        });
                    });
                })
                .build()
                .create({
                    validate: {
                        response: true
                    }
                })
                .send('request', {
                    foo: 'bar'
                });
            });

            domain.once('error', function (err) {
                Assert.equal('No target consumer found for message response:"ok"', err.message);
                Assert.deepEqual(['zx1', 'zx2'], order);
                done();
            });
        });

        it('should send error back if no target consumer found when the request is enforced', function (done) {
            var order = [];
            Trooba
            .use(function handler(pipe) {
                order.push('zx1');
            })
            .use(function handler(pipe) {
                order.push('zx2');
            })
            .use(function handler(pipe) {

            })
            .build()
            .create({
                validate: {
                    request: true
                }
            })
            .send('request', {
                foo: 'bar'
            })
            .on('error', function (err) {
                Assert.equal('No target consumer found for message request:{"foo":"bar"}', err.message);
                Assert.deepEqual(['zx1', 'zx2'], order);
                done();
            });
        });

        it('should send error back if no target consumer found for the response', function (done) {
            var order = [];

            Trooba
            .use(function handler(pipe) {
                order.push('zx1');
            })
            .use(function handler(pipe) {
                order.push('zx2');
            })
            .use(function handler(pipe) {
                pipe.on('request', function () {
                    setImmediate(function () {
                        pipe.send('response', 'ok', 2);
                    });
                });
            })
            .build()
            .create({
                validate: {
                    response: true
                }
            })
            .on('error', function (err) {
                Assert.equal('No target consumer found for message response:"ok"', err.message);
                Assert.deepEqual(['zx1', 'zx2'], order);
                done();
            })
            .send('request', {
                foo: 'bar'
            });
        });

        it('should send error back if no target consumer found for the response, one point pipe', function (done) {
            Trooba
            .use(function handler(pipe) {
                pipe.on('request', function () {
                    setImmediate(function () {
                        pipe.send('response', 'ok', 2);
                    });
                });
            })
            .build()
            .create({
                validate: {
                    response: true
                }
            })
            .on('error', function (err) {
                Assert.equal('No target consumer found for message response:"ok"', err.message);
                done();
            })
            .send('request', {
                foo: 'bar'
            });
        });

        it('should throw error if no error handler is registered', function (done) {
            var domain = Domain.create();
            domain.run(function () {
                Trooba
                .use(function handler(pipe) {
                    pipe.on('request', function () {
                        // make it async
                        setImmediate(function () {
                            pipe.throw(new Error('Test'));
                        });
                    });
                })
                .use(function handler(pipe) {
                    pipe.on('request', function () {
                        done(new Error('should not happen'));
                    });
                })
                .use(function tr(pipe) {
                    pipe.on('request', function () {
                        done(new Error('should not happen'));
                    });
                })
                .build()
                .create()
                .send('request', {
                    foo: 'bar'
                });
            });
            domain.once('error', function (err) {
                Assert.equal('Test', err.message);
                done();
            });
        });

        it('should preserve domain context in parallel', function (done) {
            var match = 0;
            var maxInFlight = 0;
            function transport(pipe) {
                pipe.on('request', function (request) {
                    // simulate async
                    setTimeout(function () {
                        if (pipe.context.foo === request.foo) {
                            match++;
                        }

                        setTimeout(function () {
                            pipe.send('response', {
                                foo: request.foo,
                            }, 2);

                        }, Math.round(100 * Math.random()));
                    }, Math.round(100 * Math.random()));

                });
            }

            function domainInjector(pipe) {
                pipe.on('request', function (request, next) {
                    var domain = Domain.create();
                    domain.run(function () {
                        process.domain.bar = request.foo;
                        // simulate async
                        setTimeout(function () {
                            pipe.context.foo = request.foo;

                            setTimeout(next, Math.round(100 * Math.random()));
                        }, Math.round(100 * Math.random()));
                    });
                });

                pipe.on('response', function (response, next) {
                    Assert.ok(process.domain);
                    Assert.equal(process.domain.bar, response.foo);
                    next();
                });
            }

            function handlerCtxModifier(pipe) {
                pipe.on('request', function (request, next) {
                    // simulate async
                    setTimeout(function () {
                        pipe.context.foo = request.foo;

                        setTimeout(next, Math.round(100 * Math.random()));
                    }, Math.round(100 * Math.random()));
                });
            }

            var requestCounter = 0;
            function handlerRequestCounter(pipe) {
                pipe.on('request', function (request, next) {
                    maxInFlight = Math.max(maxInFlight, requestCounter);
                    // simulate async
                    setTimeout(function () {
                        requestCounter++;

                        setTimeout(next, Math.round(100 * Math.random()));
                    }, Math.round(100 * Math.random()));
                });

                pipe.on('response', function (response, next) {
                    // simulate async
                    setTimeout(function () {
                        requestCounter--;

                        setTimeout(next, Math.round(100 * Math.random()));
                    }, Math.round(100 * Math.random()));
                });
            }

            var pipe = Trooba
                .use(domainInjector)
                .use(handlerCtxModifier)
                .use(handlerRequestCounter)
                .use(transport)
                .build();

            function makeRequest(index, next) {
                var request = {
                    foo: index
                };
                pipe.create()
                .send('request', request)
                .on('error', next)
                .on('response', function (response) {
                    Assert.deepEqual(request, response);
                    next();
                });
            }

            Async.times(1000, makeRequest, function (err, results) {
                Assert.ok(!err);
                Assert.equal(1000, results.length);
                Assert.equal(0, requestCounter);
                console.log('Max in-flight', maxInFlight);
                done();
            });

        });

        it('should handle once error and throw error when second one comes', function (done) {
            done = (function (count, done) {
                return function (err) {
                    if (count-- > 1) {
                        return done(err);
                    }
                };
            })(2, done);

            var pipe = Trooba.use(function (pipe) {
                pipe.once('request', function () {
                    pipe.throw(new Error('Bad'));
                    setTimeout(function () {
                        pipe.throw(new Error('Bad again'));
                    }, 10);
                });
            })
            .build()
            .create();

            var domain = Domain.create();
            domain.run(function () {
                pipe.send('request', {})
                .once('error', function (err) {
                    Assert.equal('Bad', err.message, err.stack);
                    done();
                });
            });
            domain.once('error', function (err) {
                Assert.equal('Bad again', err.message, err.stack);
                done();
            });

        });
    });

    it('should handle double next without error', function (done) {
        Trooba
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                request.fa2 = 'zx2';
                next();
                next();
            });
        })
        .use(function tr(pipe) {
            pipe.on('request', function (request) {
                request.tra = 'asd';
                pipe.send('response', request, 2);
            });
        })
        .build()
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual({
                tra: 'asd',
                fa2: 'zx2',
                foo: 'bar'
            }, response);

            done();
        });
    });

    it('should keep handlers order', function (done) {
        Trooba
        .use(function handler(pipe) {
            pipe.context.order.push('zx1');
        })
        .use(function handler(pipe) {
            pipe.context.order.push('zx2');
        })
        .use(function handler(pipe) {
            pipe.context.order.push('zx3');
        })
        .use(function tr(pipe) {
            pipe.on('request', function () {
                pipe.context.order.push('tr');
                pipe.send('response', pipe.context.order, 2);
            });
        })
        .build()
        .create({
            order: []
        })
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.equal(['zx1', 'zx2', 'zx3', 'tr'].toString(),
                response.toString());
            done();
        });
    });

    it('should go full cycle with chunks', function (done) {
        var trCount = 0;
        var order = [];
        var pipeCtx = Trooba
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                order.push('zx1-req');
                pipe.on('response', function (response, next) {
                    order.push('zx1-res');

                    pipe.on('response:data', function (data, next) {
                        order.push('zx1-' + (data || 'end'));
                        next();
                    });

                    next();
                });

                next();
            });

        })
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                order.push('zx2-req');

                pipe.on('response', function asyncHandler(response, next) {
                    order.push('zx2-res');
                    next();
                })
                .on('error', function asyncHandler(err, next) {
                    if (pipe.context.retry-- > 0) {
                        order.push('retry');
                        pipe.send('request', request);
                        pipe.resume();
                    }
                });

                next();
            });
        })
        .use(function handler(pipe) {

            pipe
            .on('request', function (request, next) {
                order.push('zx3-req');
                next();
            })
            .on('response', function (response, next) {
                order.push('zx3-res');
                next();
            })
            .on('response:data', function (data, next) {
                order.push('zx3-' + (data || 'end'));
                next();
            });

        })
        .use(function transport(pipe) {
            pipe.on('request', function () {
                order.push('tr');
                if (trCount++ < 1) {
                    pipe.throw(new Error('Timeout'));
                    return;
                }
                pipe.send('response', 'pong', 2);
                setImmediate(function () {
                    pipe.send('response:data', 'data1', 2);
                    setImmediate(function () {
                        pipe.send('response:data', 'data2', 2);
                        pipe.send('response:data', undefined, 2);
                    });
                });
            });
        })
        .build()
        .create({
            retry: 1
        })
        .send('request', 'ping');

        pipeCtx
        .on('error', done)
        .on('response:data', function validateResponse(data, next) {
            if (data !== undefined) {
                return next();
            }

            Assert.equal([
                'zx1-req',
                'zx2-req',
                'zx3-req',
                'tr',
                'retry',
                'zx3-req',
                'tr',
                'zx3-res',
                'zx2-res',
                'zx1-res',
                'zx3-data1',
                'zx1-data1',
                'zx3-data2',
                'zx3-end',
                'zx1-data2',
                'zx1-end'
            ].toString(), order.toString());
            done();
        });

    });

    it('should link two pipes via "use", propagate request, response', function (done) {
        var order = [];
        var pipeTo = Trooba
        .use(function h1_1(pipe) {
            pipe.on('request', function onRequest(request, next) {
                order.push('req-p1-h1');
                next();
            });
            pipe.on('response', function onRequest(request, next) {
                order.push('res-p1-h1');
                next();
            });
        })
        .use(function h1_2(pipe) {
            pipe.on('request', function onRequest(request, next) {
                order.push('req-p1-h2');
                next();
            });
            pipe.on('response', function onRequest(request, next) {
                order.push('res-p1-h2');
                next();
            });
        })
        .use(function tr(pipe) {
            pipe.on('request', function onRequest(request) {
                order.push('tr1');
                pipe.send('response', {
                    p: pipe.context.p,
                    c: pipe.context.c,
                    foo: request.foo
                }, 2);
            });
        });

        var pipeFrom = Trooba
        .use(function h2_1(pipe) {
            pipe.on('request', function onRequest(request, next) {
                order.push('req-p2-h1');
                next();
            });
            pipe.on('response', function onRequest(request, next) {
                order.push('res-p2-h1');
                next();
            });
        })
        .use(function () {
            return pipeTo;
        })
        .use(function h2_2(pipe) {
            pipe.on('request', function onRequest(request, next) {
                order.push('req-p2-h2');
                next();
            });
            pipe.on('response', function onRequest(request, next) {
                order.push('res-p2-h2');
                next();
            });
        })
        .build()
        .create({
            p: 2,
            c: 1
        });

        pipeFrom
        .send('request', {
            foo: 'bar'
        })
        .on('response', function (response) {
            Assert.deepEqual([
                'req-p2-h1',
                'req-p1-h1',
                'req-p1-h2',
                'tr1',
                'res-p1-h2',
                'res-p1-h1',
                'res-p2-h1'
            ], order);
            Assert.deepEqual({
                p: 2,
                c: 1,
                foo: 'bar'
            }, response);

            done();
        });
    });

    it('should keep order in a stream, when error is thrown', function (done) {
        var _response;
        var _data = [];

        Trooba
        .use(function good(pipe) {
            pipe.on('response:data', function (data, next) {
                next();
            });
        })
        .use(function tr(pipe) {
            pipe.on('request', function onRequest(request) {
                pipe.send('response', 'pong', 2);
                pipe.send('response:data', 'data1', 2);
                pipe.throw(new Error('Boom'));
            });
        })
        .build()
        .create()
        .on('response', function (response, next) {
            _response = response;
            next();
        })
        .on('error', function (err) {
            Assert.ok(err);
            Assert.equal('Boom', err.message);
            Assert.equal('pong', _response);
            Assert.deepEqual(['data1'], _data);
            done();
        })
        .on('response:data', function (data, next) {
            _data.push(data);
            Assert.ok(data !== undefined, 'End of stream should never be reached');
            next();
        })
        .send('request', 'ping');
    });

    it('should execute generic API many times in parallel', function (done) {
        var match = 0;
        var maxInFlight = 0;
        function transport(pipe) {
            pipe.on('request', function (request) {
                // simulate async
                setTimeout(function () {
                    if (pipe.context.foo === request.foo) {
                        match++;
                    }

                    setTimeout(function () {
                        pipe.send('response', {
                            foo: request.foo,
                        }, 2);

                    }, Math.round(100 * Math.random()));
                }, Math.round(100 * Math.random()));

            });
        }

        function handlerCtxModifier(pipe) {
            pipe.on('request', function (request, next) {
                // simulate async
                setTimeout(function () {
                    pipe.context.foo = request.foo;

                    setTimeout(next, Math.round(100 * Math.random()));
                }, Math.round(100 * Math.random()));
            });
        }

        var requestCounter = 0;
        function handlerRequestCounter(pipe) {
            pipe.on('request', function (request, next) {
                maxInFlight = Math.max(maxInFlight, requestCounter);
                // simulate async
                setTimeout(function () {
                    requestCounter++;

                    setTimeout(next, Math.round(100 * Math.random()));
                }, Math.round(100 * Math.random()));
            });

            pipe.on('response', function (response, next) {
                // simulate async
                setTimeout(function () {
                    requestCounter--;

                    setTimeout(next, Math.round(100 * Math.random()));
                }, Math.round(100 * Math.random()));
            });
        }

        var pipe = Trooba
            .use(handlerCtxModifier)
            .use(handlerRequestCounter)
            .use(transport)
            .build();

        function makeRequest(index, next) {
            var request = {
                foo: index
            };
            pipe.create().send('request', request)
            .on('error', next)
            .on('response', function (response) {
                Assert.deepEqual(request, response);
                next();
            });
        }

        Async.times(1000, makeRequest, function (err, results) {
            Assert.ok(!err);
            Assert.equal(1000, results.length);
            Assert.equal(0, requestCounter);
            console.log('Max in-flight', maxInFlight);
            done();
        });
    });

    it('should execute custom API many times in parallel', function (done) {
        var match = 0;
        var maxInFlight = 0;
        function transport(pipe) {
            pipe.on('request', function (request) {
                // simulate async
                setTimeout(function () {
                    if (pipe.context.foo === request.foo) {
                        match++;
                    }

                    setTimeout(function () {
                        pipe.send('response', {
                            foo: request.foo,
                        }, 2);

                    }, Math.round(100 * Math.random()));
                }, Math.round(100 * Math.random()));

            });
        }

        function handlerCtxModifier(pipe) {
            pipe.on('request', function (request, next) {
                // simulate async
                setTimeout(function () {
                    pipe.context.foo = request.foo;

                    setTimeout(next, Math.round(100 * Math.random()));
                }, Math.round(100 * Math.random()));
            });
        }

        var requestCounter = 0;
        function handlerRequestCounter(pipe) {
            pipe.on('request', function (request, next) {
                maxInFlight = Math.max(maxInFlight, requestCounter);
                // simulate async
                setTimeout(function () {
                    requestCounter++;

                    setTimeout(next, Math.round(100 * Math.random()));
                }, Math.round(100 * Math.random()));
            });

            pipe.on('response', function (response, next) {
                // simulate async
                setTimeout(function () {
                    requestCounter--;

                    setTimeout(next, Math.round(100 * Math.random()));
                }, Math.round(100 * Math.random()));
            });
        }

        var client = Trooba
            .use(handlerCtxModifier)
            .use(handlerRequestCounter)
            .use(transport)
            .use({
                interfaces: {
                    client: function clientFactory(pipe) {
                        return {
                            doRequest: function (index, callback) {
                                pipe.create().send('request', {
                                    foo: index
                                })
                                .on('error', callback)
                                .on('response', function (response) {
                                    callback(null, response);
                                });
                            }
                        };
                    }
                }
            })
            .build()
            .create('client');

        function makeRequest(index, next) {
            client.doRequest(index, function (err, response) {
                Assert.ok(!err);
                Assert.deepEqual(index, response.foo);
                next();
            });
        }

        Async.times(1000, makeRequest, function (err, results) {
            Assert.ok(!err);
            Assert.equal(1000, results.length);
            Assert.equal(0, requestCounter);
            console.log('Max in-flight', maxInFlight);
            done();
        });
    });

    it('should not allow hook to the same event in the same handler', function (done) {
        var client = Trooba.use(function (pipe) {
            pipe.on('request', function () {});

            Assert.throws(function () {
                pipe.on('request', function () {});
            }, /The hook has already been registered, you can use only one hook for specific event type: request/);
            done();
        })
        .build()
        .create();

        client.send('request', 'ping');
    });

    it('should handle once error', function (done) {
        var pipe = Trooba.use(function (pipe) {
            pipe.on('request', function () {
                pipe.throw(new Error('Boom'));
            });
        })
        .build()
        .create();

        pipe
        .send('request')
        .once('error', function (err, next) {
            Assert.equal('Boom', err.message);
            pipe.resume();
            pipe.send('request').once('error', function (err) {
                Assert.equal('Boom', err.message);
                done();
            });
        });
    });

    it('should handle once request', function (done) {
        var pipe = Trooba.use(function (pipe) {
            pipe.once('request', function (request, next) {
                done();
                next();
            });
        })
        .build()
        .create();

        pipe
        .send('request')
        .send('request');
    });

    it('should handle once response', function (done) {
        var pipe = Trooba.use(function (pipe) {
            pipe.once('request', function (request) {
                pipe.send('response', 'pong', 2);
                pipe.send('response', 'pong', 2);
            });
        })
        .build()
        .create()
        .once('response', function (response, next) {
            done();
            next();
        });

        pipe.send('request', 'ping');
    });

    it('should replace error', function (done) {
        Trooba
        .use(function replace(pipe) {
            pipe.on('error', function (err, next) {
                next(new Error('Another bad'));
            });
        })
        .use(function (pipe) {
            pipe.once('request', function () {
                pipe.throw(new Error('Bad'));
            });
        })
        .build()
        .create()
        .send('request')
        .once('error', function (err) {
            Assert.equal('Another bad', err.message);
            done();
        });

    });

    it('should replace request', function (done) {
        Trooba
        .use(function replace(pipe) {
            pipe.once('request', function (request, next) {
                next('replaced');
            });
        })
        .use(function (pipe) {
            pipe.once('request', function (request) {
                pipe.send('response', request, 2);
            });
        })
        .build()
        .create()
        .send('request', 'original')
        .once('response', function (response) {
            Assert.equal('replaced', response);
            done();
        });

    });

    it('should replace response', function (done) {
        Trooba
        .use(function replace(pipe) {
            pipe.on('response', function (response, next) {
                next('replaced');
            });
        })
        .use(function (pipe) {
            pipe.once('request', function (request) {
                Assert.equal('original', request);
                pipe.send('response', request, 2);
            });
        })
        .build()
        .create()
        .send('request', 'original')
        .once('response', function (response) {
            Assert.equal('replaced', response);
            done();
        });

    });

    it('should send sync custom message for custom handler', function (done) {
        var order = [];
        Trooba
        .use(function replace(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                // since we get sync message we do not need to call any next method
                // one cannot prevent it from propagation down the pipeline

                Assert.equal('function skip() {}', next.toString());

                order.push('replace');

                pipe.context.data = 'foo';
            });
        })
        .use(function shouldNotAffect(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                // since we get sync message we do not need to call any next method
                // one cannot prevent it from propagation down the pipeline
                Assert.equal('function skip() {}', next.toString());
                order.push('shouldNotAffect');
                // symulate delayed context change that should not affect reponse
                setTimeout(function () {
                    pipe.context.data = 'boom';
                }, 10);
            });
        })
        .use(function transport(pipe) {
            pipe.on('custom-handle-message', function (data) {
                order.push('tr');
                pipe.send('response', data+pipe.context.data, 2);
            });
        })
        .build()
        .create()
        .once('response', function (response) {
            Assert.deepEqual(['replace', 'shouldNotAffect', 'tr'], order);
            Assert.equal('barfoo', response);

            done();
        })
        .send({
            type: 'custom-handle-message',
            direction: 1,
            data: 'bar',
            sync: true
        });
    });

    it('should send async custom message for custom handler', function (done) {
        var order = [];
        Trooba
        .use(function replace(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                order.push('replace');
                // this change will be overwritten by the next handler
                pipe.context.data = 'foo';
                next();
            });
        })
        .use(function shouldNotAffect(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                order.push('shouldNotAffect');
                // since we get sync message we do not need to call any next method
                // one cannot prevent it from propagation down the pipeline

                // symulate delayed context change that should not affect reponse
                setTimeout(function () {
                    pipe.context.data = 'boom';
                    next();
                }, 10);
            });
        })
        .use(function (pipe) {
            pipe.on('custom-handle-message', function (data) {
                order.push('tr');
                pipe.send('response', data+pipe.context.data, 2);
            });
        })
        .build()
        .create()
        .once('response', function (response) {
            Assert.deepEqual(['replace', 'shouldNotAffect', 'tr'], order);

            Assert.equal('barboom', response);

            done();
        })
        .send({
            type: 'custom-handle-message',
            direction: 1,
            data: 'bar',
            sync: false
        });
    });

    it('should send async custom message for custom handler', function (done) {
        var order = [];
        Trooba
        .use(function replace(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                order.push('replace');
                // this change will be overwritten by the next handler
                pipe.context.data = 'foo';
                next();
            });
        })
        .use(function shouldNotAffect(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                order.push('shouldNotAffect');
                // since we get sync message we do not need to call any next method
                // one cannot prevent it from propagation down the pipeline

                // symulate delayed context change that should not affect reponse
                setTimeout(function () {
                    pipe.context.data = 'boom';
                    next();
                }, 10);
            });
        })
        .use(function (pipe) {
            pipe.on('custom-handle-message', function (data) {
                order.push('tr');
                pipe.send('response', data+pipe.context.data, 2);
            });
        })
        .build()
        .create()
        .once('response', function (response) {
            Assert.deepEqual(['replace', 'shouldNotAffect', 'tr'], order);

            Assert.equal('barboom', response);

            done();
        })
        .send({
            type: 'custom-handle-message',
            flow: 1,
            data: 'bar',
            sync: false
        });
    });

    it('should catch all response messages', function (done) {
        var pipe = Trooba
        .use(function (pipe) {
            pipe.on('request', function () {
                pipe.send('response', 'response', 2);
                pipe.send('response:data', 'foo', 2);
                pipe.send('response:data', 'bar', 2);
                pipe.send('response:end', undefined, 2);
            });
        })
        .build()
        .create();

        var reqData = [];
        pipe.send('request')
        .on('*', function (message) {
            reqData.push(message.data);
            message.next();
        })
        .once('response:end', function (data, next) {
            Assert.deepEqual(['response', 'foo', 'bar'], reqData);
            done();
        });

    });

    it('should catch all messages', function (done) {
        var messages = [];
        var pipe = Trooba
        .use(function catchhAll(pipe) {
            pipe.on('*', function (message) {
                messages.push(message.data);
                message.next();
            });
        })
        .use(function (pipe) {
            pipe.on('request', function () {
                pipe.send('response', 'response', 2);
                pipe.send('response:data', 'foo', 2);
                pipe.send('response:data', 'bar', 2);
                pipe.send('response:end', undefined, 2);
            });
        })
        .build()
        .create()
        .send('request', 'request');

        pipe.once('response:end', function (data, next) {
            Assert.deepEqual(['request', 'response', 'foo', 'bar', undefined], messages);
            done();
        });

    });

    it('should handle multiple calls without conflicts', function (done) {
        var pipe = Trooba
        .use(function handler(pipe) {
            // noop
        })
        .use(function tr(pipe) {
            pipe.on('request', function (request) {
                pipe.send('response', request, 2);
            });
        })
        .build();

        pipe
        .create()
        .send('request', {
            foo: 'bar'
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.deepEqual({foo:'bar'}, response);

            pipe.create().send('request', {
                foo: 'qaz'
            })
            .on('error', done)
            .on('response', function validateResponse(response) {
                Assert.deepEqual({foo:'qaz'}, response);
                done();
            });
        });
    });

    it('should expose custom API', function (done) {
        var custom = function () {};
        custom.interfaces = {
            api: function (pipe) {
                return {
                    hello: function () {},
                    bye: function () {}
                };
            }
        };
        var client = Trooba.use(custom)
        .build()
        .create('api');
        Assert.ok(client.hello);
        Assert.ok(client.bye);
        done();
    });

    it('should call transport API with custom api', function () {
        function tr(pipe) {
            pipe.on('request', function (request) {
                setTimeout(function () {
                    pipe.send('response', pipe.context.type +
                        ' ' + request, 2);
                }, 10);
            });
        }

        tr.interfaces = {
            api: function (pipe) {
                return {
                    hello: function (name, callback) {
                        return pipe
                        .create({
                            type: 'hello'
                        })
                        .on('error', callback)
                        .on('response', callback.bind(null, null))
                        .send('request', name);
                    },
                    bye: function (name, callback) {
                        return pipe

                        .create({
                            type: 'bye'
                        })
                        .on('error', callback)
                        .on('response', callback.bind(null, null))
                        .send('request', name);
                    }
                };
            }
        };

        var client = Trooba.use(tr).build().create('api');
        client.hello('John', function (err, response) {
            Assert.equal('hello John', response);
        });

        client.hello('Bob', function (err, response) {
            Assert.equal('hello Bob', response);
        });

        client.bye('John', function (err, response) {
            Assert.equal('bye John', response);
        });

        client.bye('Bob', function (err, response) {
            Assert.equal('bye Bob', response);
        });
    });

    describe('nested pipes', function () {
        it('should build pipe out of main and child pipe', function (next) {
            var seq = [];
            Trooba
            .use(function () {
                seq.push('main.before');
            })
            .use(function (pipe) {
                return Trooba
                    .use(function () {
                        seq.push('child.one');
                    })
                    .use(function () {
                        seq.push('child.two');
                    });
            })
            .use(function (pipe) {
                seq.push('main.after');
                Assert.deepEqual('main.before/child.one/child.two/main.after', seq.join('/'));
                next();
            })
            .build()
            .create()
            .send('request');
        });

        it('should build pipe out of main and child pipe and run ping-pong', function (next) {
            var seq = [];
            Trooba
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    seq.push('main.before.req');
                    next();
                });

                pipe.on('response', function (response, next) {
                    seq.push('main.before.res');
                    next();
                });
            })
            .use(function () {
                return Trooba
                    .use(function (pipe) {
                        pipe.on('request', function (request, next) {
                            seq.push('child.one.req');
                            next();
                        });

                        pipe.on('response', function (response, next) {
                            seq.push('child.one.res');
                            next();
                        });
                    })
                    .use(function (pipe) {
                        pipe.on('request', function (request, next) {
                            seq.push('child.two.req');
                            next();
                        });

                        pipe.on('response', function (response, next) {
                            seq.push('child.two.res');
                            next();
                        });
                    });
            })
            .use(function (pipe) {
                pipe.on('request', function () {
                    seq.push('main.after');
                    Assert.deepEqual('main.before.req/child.one.req/child.two.req/main.after', seq.join('/'));
                    pipe.send('response', 'pong', 2);
                });
            })
            .build()
            .create()
            .send('request', 'ping')
            .on('response', function (response) {
                Assert.deepEqual('main.before.req/child.one.req/child.two.req/main.after/child.two.res/child.one.res/main.before.res', seq.join('/'));
                next();
            });
        });
    });

    describe('order', function () {
        it.skip('should keep order between request and chunks, short pipe', function (done) {
            var pipe = new Trooba()
            .use(function h3(pipe) {
                var order = [];
                pipe.on('request', function (request) {
                    setTimeout(function () {
                        order.push(request);
                        pipe.resume();
                    }, 50);
                });
                pipe.on('request:data', function (data) {
                    if (!data) {
                        Assert.deepEqual([
                            'r1', 'd1', 'd2'
                        ], order);
                        done();
                        return;
                    }
                    order.push(data);
                    pipe.resume();
                });
            })
            .build();

            pipe.create().streamRequest('r1')
                .write('d1')
                .write('d2')
                .end();
        });

        it('should handle mutiple resume by mistake', function (done) {
            var pipe = new Trooba()
            .use(function h(pipe) {
                var order = [];
                pipe.on('request', function (request) {
                    setTimeout(function () {
                        order.push(request);
                        pipe.respond();
                        pipe.respond();
                        pipe.resume();
                        pipe.resume();
                    }, 50);
                });
                pipe.on('request:data', function (data) {
                    if (!data) {
                        Assert.deepEqual([
                            'r1', 'd1', 'd2'
                        ], order);
                        done();
                        return;
                    }
                    order.push(data);
                    pipe.resume();
                });
            })
            .build();

            pipe.create().streamRequest('r1')
                .write('d1')
                .write('d2')
                .end();
        });

        it('should keep order between request and chunks', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('request', function (request, next) {
                    setTimeout(function delay() {
                        next();
                    }, 50);
                });
            })
            .use(function h2(pipe) {
                pipe.on('request:data', function (data, next) {
                    setTimeout(function delay() {
                        next();
                    }, 50);
                });
            })
            .use(function h3(pipe) {
                var order = [];
                pipe.on('request', function (request) {
                    order.push(request);
                    pipe.resume();
                });
                pipe.on('request:data', function (data) {
                    if (!data) {
                        Assert.deepEqual([
                            'r1', 'd1', 'd2'
                        ], order);
                        done();
                        return;
                    }
                    order.push(data);
                    pipe.resume();
                });
            })
            .build();

            pipe.create().streamRequest('r1')
                .write('d1')
                .write('d2')
                .end();
        });

        it('should keep order between response and chunks', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('response', function (response, next) {
                    setTimeout(function delay() {
                        next();
                    }, 100);
                });
            })
            .use(function h2(pipe) {
                pipe.on('request', function (request) {
                    pipe.streamResponse('r1')
                        .write('d1')
                        .write('d2')
                        .end();
                });

            })
            .build();

            var order = [];

            pipe.create().request()
                .on('response', function (response, next) {
                    order.push(response);
                    next();
                })
                .on('response:data', function (data, next) {
                    if (data) {
                        order.push(data);
                    }
                    else {
                        Assert.deepEqual([
                            'r1', 'd1', 'd2'
                        ], order);
                        done();
                    }
                    next();
                });

        });

        it('should keep order between response and chunks, partial requestStream', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('response', function (response, next) {
                    setTimeout(function delay() {
                        next();
                    }, 100);
                });
            })
            .use(function h2(pipe) {
                pipe.on('request', function (request) {
                    pipe.streamResponse('r1')
                        .write('d1')
                        .write('d2')
                        .end();
                });

            })
            .build();

            var order = [];

            pipe.create().streamRequest('r1')
                .on('response', function (response, next) {
                    order.push(response);
                    next();
                })
                .on('response:data', function (data, next) {
                    if (data) {
                        order.push(data);
                    }
                    else {
                        Assert.deepEqual([
                            'r1', 'd1', 'd2'
                        ], order);
                        done();
                    }
                    next();
                });
                // no end or write stream used

        });

        it('should keep order between request and its chunks and response and its chunks, echo mode', function (done) {
            var pipe = new Trooba()
            .use(function hdata(pipe) {
                var reqCount = 0;
                var resCount = 0;
                pipe.on('request:data', function (request, next) {
                    if (reqCount++ > 0) {
                        return next();
                    }
                    setTimeout(function delay() {
                        next();
                    }, 100);
                });
                pipe.on('response:data', function (data, next) {
                    if (resCount++ > 0) {
                        return next();
                    }
                    setTimeout(function delay() {
                        next();
                    }, 100);
                });
            })
            .use(function h1(pipe) {
                pipe.on('request', function (request, next) {
                    setTimeout(function delay() {
                        next();
                    }, 100);
                });
            })
            .use(function h2(pipe) {
                var stream;
                pipe.on('request', function (request) {
                    stream = pipe.streamResponse(request);
                });
                pipe.on('request:data', function (data, next) {
                    stream.write(data);
                    next();
                });
            })
            .build();

            var order = [];

            pipe.create().streamRequest('r1')
                .write('d1')
                .write('d2')
                .end()
                .on('response', function (response, next) {
                    order.push(response);
                    next();
                })
                .on('response:data', function (data, next) {
                    if (data) {
                        order.push(data);
                    }
                    else {
                        Assert.deepEqual([
                            'r1', 'd1', 'd2'
                        ], order);
                        done();
                    }
                    next();
                });
        });

        it('should keep order between request and its chunks and response and its chunks, echo mode, parallel execution', function (done) {
            var pipe = new Trooba()
            .use(function hdata(pipe) {
                var reqCount = 0;
                var resCount = 0;
                pipe.on('request:data', function (request, next) {
                    if (reqCount++ > 0) {
                        return next();
                    }
                    setTimeout(function delay() {
                        next();
                    }, 50);
                });
                pipe.on('response:data', function (data, next) {
                    if (resCount++ > 0) {
                        return next();
                    }
                    setTimeout(function delay() {
                        next();
                    }, 50);
                });
            })
            .use(function h1(pipe) {
                pipe.on('request', function (request, next) {
                    setTimeout(function delay() {
                        next();
                    }, 50);
                });
            })
            .use(function h2(pipe) {
                var stream;
                pipe.on('request', function (request) {
                    stream = pipe.streamResponse(request);
                });
                pipe.on('request:data', function (data, next) {
                    stream.write(data);
                    next();
                });
            })
            .build();

            var count = 0;
            var MAX = 1000;

            function doRequest(n, done) {
                var order = [];
                pipe.create().streamRequest('r1_' + n)
                    .write('d1_' + n)
                    .write('d2_' + n)
                    .end()
                    .on('response', function (response, next) {
                        order.push(response);
                        next();
                    })
                    .on('response:data', function (data, next) {
                        if (data) {
                            order.push(data);
                        }
                        else {
                            Assert.deepEqual([
                                'r1_' + n, 'd1_' + n, 'd2_' + n
                            ], order);
                            count++;
                            done();
                        }
                        next();
                    });
            }

            Async.times(MAX, doRequest, function () {
                Assert.equal(MAX, count);
                done();
            });

        });

        it('should not block single response flow when request stream flow is paused', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('request:data', function (data, next) {
                    setTimeout(function delay() {
                        next();
                    }, 100);
                });
            })
            .use(function h2(pipe) {
                pipe.on('request', function (request) {
                    setTimeout(function () {
                        pipe.respond(Date.now());
                    }, 0);
                });
            })
            .build();

            pipe.create()
            .streamRequest('r1')
            .on('response', function (response, next) {
                var total = Date.now() - response;
                Assert.ok(total < 20, 'Actual time: ' + total);
                done();
            })
            .write('d1')
            .write('d2')
            .end();
        });

        it('should block response stream flow when request stream flow is paused', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('request:data', function (data, next) {
                    setTimeout(function delay() {
                        next();
                    }, 50);
                });
            })
            .use(function h2(pipe) {
                pipe.on('request', function (request) {
                    setTimeout(function () {
                        pipe.streamResponse(Date.now());
                    }, 0);
                });
            })
            .build();

            pipe.create()
            .streamRequest('r1')
            .on('response', function (response, next) {
                var total = Date.now() - response;
                Assert.ok(total > 100, 'Actual time: ' + total);
                done();
            })
            .write('d1')
            .write('d2')
            .end();
        });

        it('should get response', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('request:data', function (data, next) {
                    setTimeout(function delay() {
                        next();
                    }, 100);
                });
            })
            .use(function h2(pipe) {
                pipe.on('request', function (request) {
                    pipe.respond('r1');
                });
            })
            .build();

            pipe.create()
            .streamRequest('r1')
            .on('response', function (response, next) {
                Assert.equal('r1', response);
                done();
            })
            .write('d1')
            .write('d2')
            .end();
        });

        it('should block request flow when response fow is blocked', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('response:data', function (data, next) {
                    setTimeout(function delay() {
                        next();
                    }, 100);
                });
            })
            .use(function h2(pipe) {
                pipe.on('request', function (request) {
                    var stream = pipe.streamResponse('r1');
                    stream.end();
                });
                pipe.on('request:data', function (data) {
                    if (data) {
                        var total = Date.now() - data;
                        Assert.ok(total > 60, 'Actual time: ' + total);
                        done();
                    }
                });
            })
            .build();

            var stream = pipe.create()
            .streamRequest('r1');

            setTimeout(function () {
                stream
                .write(Date.now())
                .end();
            }, 20);
        });

        it('should not resume request flow when pipe.throw is called', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('request:data', function (data, next) {
                    setTimeout(function delay() {
                        next();
                    }, 20);
                });
            })
            .use(function h2(pipe) {
                pipe.on('request', function () {
                    pipe.throw(new Error('Test error'));
                });
                pipe.on('request:data', function (data, next) {
                    done(new Error('Should not happen'));
                });
            })
            .build();

            pipe.create()
            .streamRequest('r1')
            .on('response', function (response, next) {
                done(new Error('Should not happen'));
            })
            .on('error', function (err) {
                setTimeout(done, 40);
            })
            .write('d1')
            .write('d2')
            .end();
        });

        it('should resume request flow when next() is called', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                var count = 0;
                pipe.on('request:data', function (data, next) {
                    if (count++ > 0) {
                        return next();
                    }
                    setTimeout(function delay() {
                        next();
                    }, 20);
                });
            })
            .use(function h2(pipe) {
                var order = [];
                pipe.on('request:data', function (data, next) {
                    if (data) {
                        order.push(data);
                        next();
                        return;
                    }
                    Assert.deepEqual(['d1', 'd2'], order) ;
                    done();
                });
            })
            .build();

            pipe.create()
            .streamRequest('r1')
            .write('d1')
            .write('d2')
            .end();
        });

        it('should resume request flow when pipe.resume() is called', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                var count = 0;
                pipe.on('request:data', function (data, next) {
                    if (count++ > 0) {
                        return next();
                    }
                    setTimeout(function delay() {
                        pipe.resume();
                    }, 20);
                });
            })
            .use(function h2(pipe) {
                var order = [];
                pipe.on('request:data', function (data, next) {
                    if (data) {
                        order.push(data);
                        next();
                        return;
                    }
                    Assert.deepEqual(['d2'], order) ;
                    done();
                });
            })
            .build();

            pipe.create()
            .streamRequest('r1')
            .write('d1')
            .write('d2')
            .end();
        });

        it('should not resume response flow when pipe.throw is called', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('response:data', function (data, next) {
                    setTimeout(function delay() {
                        pipe.throw(new Error('Test error'));
                    }, 50);
                });
            })
            .use(function h2(pipe) {
                var stream;
                pipe.on('request', function (request) {
                    stream = pipe.streamResponse(request);
                });
                pipe.on('request:data', function (data, next) {
                    stream.write(data);
                });
            })
            .build();

            pipe.create()
            .on('error', function () {
                setTimeout(done, 100);
            })
            .on('response:data', function () {
                done(new Error('Should not happen'));
            })
            .streamRequest('r1')
            .write('d1')
            .write('d2')
            .end();
        });

        it('should replace response with pipe.response', function (done) {
            var pipe = new Trooba()
            .use(function (pipe) {
                pipe.on('response', function (response) {
                    pipe.respond('replaced');
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request) {
                    pipe.respond('pong');
                });
            })
            .build();

            pipe.create()
            .request('ping', function (err, response) {
                Assert.equal('replaced', response);
                setImmediate(done);
            });
        });

        it('should replace response and stop existing response stream', function (done) {
            var pipe = new Trooba()
            .use(function (pipe) {
                pipe.on('response', function (response, next) {
                    pipe.respond('replaced');
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request) {
                    var stream = pipe.streamResponse('pong');
                    stream.write('data');
                    stream.end();
                });
            })
            .build();

            var _response;

            pipe
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                Assert.equal('replaced', response);
                done();
            })
            .on('response:data', function (data, next) {
                done(new Error('Should never happen'));
            })
            .on('error', done);
        });

        it('should replace response and stop existing response stream with delayed write', function (done) {
            var pipe = new Trooba()
            .use(function (pipe) {
                pipe.on('response', function (response, next) {
                    pipe.respond('replaced');
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request) {
                    var stream = pipe.streamResponse('pong');
                    setImmediate(function () {
                        stream.write('data');
                        stream.end();
                    });
                });
            })
            .build();

            var _response;

            pipe
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                Assert.equal('replaced', response);
                done();
            })
            .on('response:data', function (data, next) {
                done(new Error('Should never happen'));
            })
            .on('error', done);
        });

        it('should replace request and stop existing request stream', function (done) {
            var pipe = new Trooba()
            .use(function (pipe) {
                pipe.on('request', function (response, next) {
                    pipe.request('replaced');
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request) {
                    Assert.equal('replaced', request);
                    pipe.respond('pong');
                });
                pipe.on('request:data', function (data) {
                    done(new Error('Should never happen'));
                });
            })
            .build();

            pipe
            .create()
            .streamRequest('ping')
            .on('error', done)
            .on('response', function (response) {
                Assert.equal('pong', response);
                done();
            })
            .write('data')
            .end();
        });

        it('should resume response flow when next() is called', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('response:data', function (data, next) {
                    setTimeout(function delay() {
                        next();
                    }, 10);
                });
            })
            .use(function h2(pipe) {
                var stream;
                pipe.on('request', function (request) {
                    stream = pipe.streamResponse(request);
                });
                pipe.on('request:data', function (data, next) {
                    stream.write(data);
                    next();
                });
            })
            .build();

            var order = [];
            pipe.create()
            .on('response:data', function (data, next) {
                if (data) {
                    order.push(data);
                    return next();
                }
                Assert.deepEqual(['d1', 'd2'], order);
                done();
            })
            .streamRequest('r1')
            .write('d1')
            .write('d2')
            .end();
        });

        it('should resume response flow when pipe.resume() is called', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                var count = 0;
                pipe.on('response:data', function (data, next) {
                    if (count++ > 0) {
                        return next();
                    }
                    setTimeout(function delay() {
                        pipe.resume();
                    }, 10);
                });
            })
            .use(function h2(pipe) {
                var stream;
                pipe.on('request', function (request) {
                    stream = pipe.streamResponse(request);
                });
                pipe.on('request:data', function (data, next) {
                    stream.write(data);
                    next();
                });
            })
            .build();

            var order = [];
            pipe.create()
            .on('response:data', function (data, next) {
                if (data) {
                    order.push(data);
                    return next();
                }
                Assert.deepEqual(['d2'], order);
                done();
            })
            .streamRequest('r1')
            .write('d1')
            .write('d2')
            .end();

        });

        it('should resume response flow when message is dropped', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                var count = 0;
                pipe.on('response:data', function (data, next) {
                    if (count++ === 1) {
                        return setTimeout(function delay() {
                            next();
                        }, 50);
                    }
                    next();
                });
            })
            .use(function h2(pipe) {
                var stream;
                pipe.on('request', function (request) {
                    stream = pipe.streamResponse(request);
                });
                pipe.on('request:data', function (data, next) {
                    if (data) {
                        stream.write(data);
                        next();
                    }
                    else {
                        setTimeout(function () {
                            stream.write(data);
                            next();
                        }, 60);
                    }
                });
            })
            .build({
                ttl: 30
            });

            var order = [];
            pipe.create()
            .on('response:data', function (data, next) {
                if (data) {
                    order.push(data);
                    return next();
                }
                Assert.deepEqual(['d1'], order);
                done();
            })
            .streamRequest('r1')
            .write('d1')
            .write('d2')
            .end();

        });

        it('should resume request flow when message in process is dropped', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                var count = 0;
                pipe.on('request:data', function (data, next) {
                    if (count++ === 1) {
                        return setTimeout(function delay() {
                            next();
                        }, 50);
                    }
                    next();
                });
            })
            .use(function h2(pipe) {
                var order = [];
                pipe.on('request:data', function (data, next) {
                    if (data) {
                        order.push(data);
                        next();
                    }
                    else {
                        Assert.deepEqual(['d1'], order);
                        done();
                    }
                });
            })
            .build({
                ttl: 30
            });

            var stream = pipe.create()
            .streamRequest('r1')
            .write('d1')
            .write('d2');
            setTimeout(function () {
                stream.end();
            }, 60);

        });

        it('should allow other messages when paused in request flow', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                var count = 0;
                pipe.on('request:data', function (data, next) {
                    if (count++ === 1) {
                        return setTimeout(function delay() {
                            next();
                        }, 50);
                    }
                    next();
                });
            })
            .use(function h2(pipe) {
                var order = [];
                pipe.on('foo', function (data) {
                    order.push(data);
                });

                pipe.on('request:data', function (data, next) {
                    if (data) {
                        order.push(data);
                        next();
                    }
                    else {
                        Assert.deepEqual(['d1', 'foo', 'bar', 'd2'], order);
                        done();
                    }
                });
            })
            .build();

            var client = pipe.create();
            var stream = client.streamRequest('r1')
            .write('d1')
            .write('d2');
            stream.end();
            setTimeout(function () {
                client.send({
                    type: 'foo',
                    ref: 'foo',
                    flow: 1
                });
            }, 10);
            setTimeout(function () {
                client.send({
                    type: 'foo',
                    ref: 'bar',
                    flow: 1
                });
            }, 15);

        });

        it('should allow other messages when paused in response flow', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                var count = 0;
                pipe.on('response:data', function (data, next) {
                    if (count++ === 1) {
                        return setTimeout(function delay() {
                            next();
                        }, 50);
                    }
                    next();
                });
            })
            .use(function h2(pipe) {
                var stream;
                pipe.on('request', function (request, next) {
                    stream = pipe.streamResponse(request);
                    next();

                    setTimeout(function () {
                        pipe.send({
                            type: 'foo',
                            ref: 'foo',
                            flow: 2
                        });
                    }, 10);
                    setTimeout(function () {
                        pipe.send({
                            type: 'foo',
                            ref: 'bar',
                            flow: 2
                        });
                    }, 15);
                });

                pipe.on('request:data', function (data, next) {
                    stream.write(data);
                    next();
                });
            })
            .build();

            var order = [];

            var client = pipe.create();
            client.streamRequest('r1')
            .write('d1')
            .write('d2')
            .end()
            .on('response:data', function (data, next) {
                if (data) {
                    order.push(data);
                    return next();
                }
                Assert.deepEqual(['d1', 'foo', 'bar', 'd2'], order);
                done();
            })
            .on('foo', function (data) {
                order.push(data);
            });

        });

        it('should call resume with empty queue', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('request', function (data, next) {
                    pipe.resume();
                    pipe.resume();
                    pipe.resume();
                    pipe.resume();
                    next();
                });
            })
            .use(function h2(pipe) {
                pipe.on('request', function (request) {
                    Assert.equal('r1', request);
                    done();
                });
            })
            .build();

            pipe.create()
            .request('r1');

        });

        it('should call resume with empty context', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.resume();
            })
            .use(function h2(pipe) {
                pipe.on('request', function (request) {
                    Assert.equal('r1', request);
                    done();
                });
            })
            .build();

            pipe.create()
            .request('r1');
        });

        it('should call resume with no context', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.context = null;
                pipe.resume();
            })
            .use(function h2(pipe) {
                pipe.on('request', function (request) {
                    Assert.equal('r1', request);
                    done();
                });
            })
            .build();

            pipe.create()
            .request('r1');

        });

        it('should trace pipe points, return state of each point with queue length in each', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.on('response:data', function (data, next) {
                    setTimeout(function delay() {
                        next();
                    }, 50);
                });
            })
            .use(function h2(pipe) {
                var stream;
                pipe.on('request', function (request, next) {
                    stream = pipe.streamResponse(request);
                    next();

                    setTimeout(function () {
                        pipe.send({
                            type: 'foo',
                            ref: 'foo',
                            flow: 2
                        });
                    }, 10);
                    setTimeout(function () {
                        pipe.send({
                            type: 'foo',
                            ref: 'bar',
                            flow: 2
                        });
                    }, 15);
                });

                pipe.on('request:data', function (data, next) {
                    stream.write(data);
                    next();
                });
            })
            .build();

            var order = [];

            var client = pipe.create();
            client.streamRequest('r1')
            .write('d1')
            .write('d2')
            .end()
            .on('response:data', function (data, next) {
                if (data) {
                    order.push(data);
                    return next();
                }
                Assert.deepEqual(['foo', 'bar', 'd1', 'd2'], order);

            })
            .on('foo', function (data) {
                order.push(data);
            });

            setTimeout(function () {
                client.trace(function (err, list) {

                    var route = list.map(function (item) {
                        var point = item.point;
                        return point.handler.name + '(' + point.queue().size() + ')';
                    });
                    Assert.deepEqual([
                        'pipeHead(0)', 'h1(3)', 'h2(0)', 'h2(0)', 'h1(3)', 'pipeHead(0)'
                    ], route);
                    done();
                });
            }, 20);
        });

        it('should detect broken pipe', function (done) {
            var pipe = new Trooba()
            .use(function h1(pipe) {
                pipe.once('request:data', function (data, next) {
                    // brake the pipe
                    pipe.queue().getQueue().pop();
                    Assert.throws(function () {
                        next();
                    }, /The queue for h1-\d+ is broken/);
                    done();
                });
            })
            .build();

            pipe.create()
            .streamRequest('r1')
            .write('d1')
            .write('d2')
            .end();
        });

        it('should get tail from head', function () {
            var pipe = new Trooba()
            .use(function h1(pipe) {})
            .build();

            Assert.ok(pipe !== pipe.tail);

            pipe = new Trooba()
            .build();

            Assert.ok(pipe === pipe.tail);

            // now without context
            pipe.context = undefined;
            Assert.ok(pipe === pipe.tail);
        });

    });

    it('should not find request API', function () {
        var pipe = new Trooba();
        Assert.throws(function () {
            pipe.build().create('unknown API');
        }, /Cannot find requested API: unknown API/);
    });

    it('should handle paused stream', function (done) {
        var pipe = new Trooba()
        .use(function echo(pipe) {
            var stream;
            pipe.on('request', function (request, next) {
                stream = pipe.streamResponse(request);
                next();
            });
            pipe.on('request:data', function (data, next) {
                stream.write(data);
                // should allow mistakes of using multiple action that do resume
                next();
                next();
            });
        })
        .build();

        var order = [];

        var stream = pipe.create().streamRequest('r1');

        stream
        .on('error', done);

        var MAX = 10;

        var count = 0;
        stream
        .on('response:data', function (data, next) {
            if (count++ > 0) {
                order.push(data);
                return next();
            }
            // simulate pause
            setTimeout(function () {
                order.push(data);
                next();
            }, 50);
        })
        .on('response:end', function () {
            Assert.equal(MAX + 1, order.length);
            done();
        });

        for (var i = 0; i < MAX; i++) {
            stream.write('foo' + i);
        }
        setImmediate(function () {
            stream.end();
        });

    });
});
