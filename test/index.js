'use strict';

var Assert = require('assert');
var Domain = require('domain');
var NodeUtils = require('util');
var _ = require('lodash');
var Async = require('async');
var Trooba = require('..');

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
                    pipe.respond({
                        qaz: 'qwe'
                    });
                }, 10);
            });
        })
        .build({
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
        .request({
            foo: 'bar'
        });
    });

    it('should pass configuration to the transport', function (done) {
        Trooba.use(function tr(pipe, config) {
            Assert.deepEqual({
                asd: 'zxc'
            }, config);
            pipe.on('request', function () {
                pipe.respond(_.assign({
                    qaz: 'qwe'
                }, config));
            });
        }, {
            asd: 'zxc'
        })
        .build()
        .request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
            Assert.ok(response);
            Assert.deepEqual({
                qaz: 'qwe',
                asd: 'zxc'
            }, response);
            done();
        });
    });

    it('should pass configuration to the api impl', function (done) {
        var client = Trooba
        .use(function (pipe, config) {
            pipe.set('client', function factory(pipe) {
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
                        .request(name);
                    }
                };
            });
        }, {
            greeting: 'Hello %s'
        })
        .use(function tr(pipe) {
            pipe.on('request', function (request) {
                pipe.respond(NodeUtils.format(pipe.context.greeting,
                    request));
            });
        })
        .build('client');

        client.hello('John', function validateResponse(err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.ok(response);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should handle error from responseContext', function (done) {
        Trooba.use(function tr(pipe) {
            pipe.on('request', function () {
                pipe.throw(new Error('Test Error'));
            });
        }).build().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
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
                pipe.respond(request);
            });
        })
        .build()
        .request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
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
                pipe.respond(request);
            });
        })
        .build().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
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
                pipe.respond(request);
            });
        })
        .build().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
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
                pipe.respond(request);
            });
        })
        .use(function transport(pipe) {
            pipe.on('request', function () {
                done(new Error('Should not happen'));
            });
        })
        .build().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
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
                pipe.respond(request);
            });
        }, {
            cfg: 'thy'
        })
        .use(function transport(pipe) {
            pipe.on('request', function () {
                done(new Error('Should not happen'));
            });
        })
        .build().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
            Assert.deepEqual({
                foo: 'bar',
                dfg: 'thy'
            }, response);
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
                pipe.respond(request);
            });
        })
        .build().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
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
                pipe.respond(request);
            });
        })
        .build().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
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
                pipe.respond(request);
            });
        })
        .build();

        client.create().request({
            chain: ['q']
        }, function validateResponse(err, response) {
            Assert.ok(!err);
            Assert.deepEqual([
                'q',
                'i1',
                'i2',
                'i3',
                'tr'
            ], response.chain);

            client.create().request({
                chain: ['q']
            }, function validateResponse(err, response) {
                Assert.ok(!err);
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
        .build().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
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

        it('should throw error if context is not set', function (done) {
            var pipe;
            try {
                pipe = Trooba.use(function (handler) {}).build();
                pipe.context = undefined;
                pipe.trace();
                done(new Error('Should have failed'));
            }
            catch (err) {
                Assert.equal('Context is missing, please make sure context() is used first', err.message);
            }

            try {
                pipe._points();
                done(new Error('Should have failed'));
            }
            catch (err) {
                Assert.equal('Context is missing, please make sure context() is used first', err.message);
                done();
            }

        });

        it('should send error back if no target consumer found for the response', function (done) {
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
                            pipe.respond('ok');
                        });
                    });
                })
                .build()
                .set('strict', 'response')
                .request({
                    foo: 'bar'
                });
            });

            domain.once('error', function (err) {
                Assert.equal('No target consumer found for the response "ok"', err.message);
                Assert.deepEqual(['zx1', 'zx2'], order);
                done();
            });
        });

        it('should send error back if no target consumer found for the response and other types', function (done) {
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
                            pipe.respond('ok');
                        });
                    });
                })
                .build()
                .set('strict', ['response'])
                .request({
                    foo: 'bar'
                });
            });

            domain.once('error', function (err) {
                Assert.equal('No target consumer found for the response "ok"', err.message);
                Assert.deepEqual(['zx1', 'zx2'], order);
                done();
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
                .build().request({
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
                            pipe.respond({
                                foo: request.foo,
                            });

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
                pipe = pipe.create();
                var request = {
                    foo: index
                };
                pipe.request(request, function (err, response) {
                    Assert.ok(!err);
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
            var pipe = Trooba.use(function (pipe) {
                pipe.once('request', function () {
                    pipe.throw(new Error('Bad'));
                    setTimeout(function () {
                        pipe.throw(new Error('Bad again'));
                    }, 10);
                });
            })
            .build();

            var domain = Domain.create();
            domain.run(function () {
                pipe.request({})
                .once('error', function (err) {
                    Object.keys(pipe.context.$points).forEach(function forEach(index) {
                        Assert.deepEqual({}, pipe.context.$points[index]._messageHandlers);
                    });
                });
            });
            domain.once('error', function (err) {
                Assert.equal('Bad again', err.message);
                done();
            });

        });
    });

    it('should handle double next without error with next', function (done) {
        var count = 0;
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
                pipe.respond(request);
            });
        })
        .build().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.deepEqual({
                tra: 'asd',
                fa2: 'zx2',
                foo: 'bar'
            }, response);

            if (count++ > 0) {
                done();
            }

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
                pipe.respond(pipe.context.order);
            });
        })
        .build({
            order: []
        }).request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.equal(['zx1', 'zx2', 'zx3', 'tr'].toString(),
                response.toString());
            done();
        });
    });

    it('should send error back if no target consumer found for the request', function (done) {
        var order = [];
        Trooba
        .use(function handler(pipe) {
            order.push('zx1');
        })
        .use(function handler(pipe) {
            order.push('zx2');
        })
        .use(function handler(pipe) {
            order.push('zx3');
        })
        .build()
        .set('strict', 'request')
        .request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(err);
            Assert.equal('No target consumer found for the request {"foo":"bar"}', err.message);
            Assert.equal(['zx1', 'zx2', 'zx3'].toString(),
                order.toString());
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
                        pipe.request(request);
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
            })
            .on('response:end', function (next) {
                order.push('zx3-onEnd');
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

                var response = pipe.streamResponse(pipe.request);
                setImmediate(function () {
                    response.write('data1');
                    setImmediate(function () {
                        response.write('data2');
                        response.end();
                    });
                });
            });
        })
        .build({
            retry: 1
        })
        .request({});

        pipeCtx.on('response:end', function validateResponse(err, response) {

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
                'zx1-data2',
                'zx3-end',
                'zx3-onEnd',
                'zx1-end'
            ].toString(), order.toString());
            done();
        });

    });

    it('should link two pipes via "use", propagate request, response and do trace', function (done) {
        var order = [];
        var route = [];
        var pipe1 = Trooba
        .use(function h1_1(pipe) {
            pipe.on('request', function onRequest(request, next) {
                order.push('req-p1-h1');
                next();
            });
            pipe.on('response', function onRequest(request, next) {
                order.push('res-p1-h1');
                next();
            });
        }, {
            id: 'one'
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
        }, {
            id: 'two'
        })
        .use(function tr(pipe) {
            pipe.on('request', function onRequest(request) {
                order.push('tr1');
                pipe.respond({
                    p: pipe.context.p,
                    c: pipe.context.c,
                    foo: request.foo
                });
            });
        }, {
            id: 'three'
        })
        .build({
            p: 1,
            c: 1
        });

        var pipe = Trooba
        .use(function h2_1(pipe) {
            pipe.on('request', function onRequest(request, next) {
                order.push('req-p2-h1');
                next();
            });
            pipe.on('response', function onRequest(request, next) {
                order.push('res-p2-h1');
                next();
            });
        }, {
            id: 'four'
        })
        .use(pipe1, {
            id: 'five'
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
        }, {
            id: 'six'
        })
        .build({
            p: 2
        });

        pipe.tracer(function (message, pipePoint) {
            route.push(pipePoint.handler.name + (message.flow === 1 ? '-req' : '-res'));
        }).request({
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
            Assert.deepEqual([
                'h2_1-req',
                'pipeConnect-req',
                'h1_1-req',
                'h1_2-req',
                'tr-req',
                'h1_2-res',
                'h1_1-res',
                'pipeConnect-res',
                'h2_1-res',
                'pipeHead-res'
            ], route);
            done();
        });
    });

    it('should link two pipes and propagate error', function (done) {
        var order = [];
        var pipe1 = Trooba
        .use(function h1(pipe) {
            pipe.on('request', function onRequest(request, next) {
                order.push('req-p1-h1');
                next();
            });
            pipe.on('response', function onRequest(request, next) {
                order.push('res-p1-h1');
                next();
            });
        })
        .use(function h2(pipe) {
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
                pipe.throw(new Error('boom'));
            });
        })
        .build({
            p: 1,
            c: 1
        });

        Trooba
        .use(function h1(pipe) {
            pipe.on('request', function onRequest(request, next) {
                order.push('req-p2-h1');
                next();
            });
            pipe.on('response', function onRequest(request, next) {
                order.push('res-p2-h1');
                next();
            });
        })
        .use(pipe1)
        .use(function h2(pipe) {
            pipe.on('request', function onRequest(request, next) {
                order.push('req-p2-h2');
                next();
            });
            pipe.on('response', function onRequest(request, next) {
                order.push('res-p2-h2');
                next();
            });
        })
        .build({
            p: 2
        })
        .request({
            foo: 'bar'
        })
        .on('error', function (err) {
            Assert.equal('boom', err.message);
            Assert.deepEqual([
                'req-p2-h1',
                'req-p1-h1',
                'req-p1-h2',
                'tr1'
            ], order);

            done();
        });

    });

    it('should catch on response:data', function (done) {
        var chunks = [];

        Trooba.use(function tr(pipe) {
            Assert.ok(pipe);
            pipe.on('request', function onRequest(request) {
                pipe.streamResponse({}).write('data1').write('data2').end();
            });
        })
        .build()
        .on('response:data', function (data, next) {
            chunks.push(data);
            next();
        })
        .on('response:end', function validateResponse() {
            Assert.deepEqual(['data1', 'data2', undefined], chunks);
            done();
        })
        .request({});

    });

    it('should catch on response:end', function (done) {
        Trooba.use(function tr(pipe) {
            Assert.ok(pipe);
            pipe.on('request', function onRequest(request) {
                pipe.streamResponse({}).end();
            });
        })
        .build()
        .on('error', done)
        .on('response:end', function validateResponse() {
            done();
        })
        .request({});
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
                        pipe.respond({
                            foo: request.foo,
                        });

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
            pipe = pipe.create();
            var request = {
                foo: index
            };
            pipe.request(request, function (err, response) {
                Assert.ok(!err);
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
                        pipe.respond({
                            foo: request.foo,
                        });

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
            .use(function injectApi(pipe) {
                pipe.set('client', function clientFactory(pipe) {
                    return {
                        doRequest: function (index, callback) {
                            pipe.create().request({
                                foo: index
                            }, callback);
                        }
                    };
                });
            })
            .build('client');

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

    it('should fail to write response after response is closed', function (done) {
        Trooba.use(function (pipe) {
            pipe.on('request', function () {
                var response = pipe.streamResponse({});
                response.write('foo')
                    .end();

                Assert.throws(function () {
                    response.write();
                }, /The stream has been closed already/);
            });
        })
        .build()
        .on('response:end', function () {
            setTimeout(done, 10);
        })
        .request({});

    });

    it('should fail to write request after request is closed', function (done) {
        var request = Trooba.use(function (pipe) {
            pipe.on('request', function () {
                pipe.respond({});
            });
        })
        .build()
        .on('response', function () {
            setTimeout(done, 10);
        })
        .streamRequest({});

        request.write('foo')
            .end();

        Assert.throws(function () {
            request.write();
        }, /The stream has been closed already/);
    });

    it('should inherit context from progenitor point', function (done) {
        var client = Trooba.use(function (pipe) {
            pipe.on('request', function () {
                pipe.respond(pipe.context.foo + (pipe.context.qaz || ''));
            });
        })
        .build({
            foo: 'bar'
        });

        client.request({}, function (err, response) {
            Assert.equal('bar', response);

            client.create({
                qaz: 'wsx'
            }).request({}, function (err, response) {
                Assert.equal('barwsx', response);
                done();
            });
        });
    });

    it('should not allow hook to the same event in the same handler', function (done) {
        var client = Trooba.use(function (pipe) {
            pipe.on('request', function () {
                pipe.respond({});
            });
        })
        .build();

        client.request({}, function () {
            Assert.throws(function () {
                client.request({}, function () {
                });
            }, /The hook has already been registered, you can use only one hook for specific event type: error/);
            done();
        });
    });

    it('should handle once error and once response', function (done) {
        var pipe = Trooba.use(function (pipe) {
            pipe.once('request', function () {
                pipe.throw(new Error('Bad'));
            });
        })
        .build();

        pipe.request({})
        .once('error', function (err) {
            Object.keys(pipe.context.$points).forEach(function forEach(index) {
                Assert.deepEqual({}, pipe.context.$points[index]._messageHandlers);
            });
            done();
        });
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
        .request({})
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
                pipe.respond(request);
            });
        })
        .build()
        .request('original')
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
                pipe.respond(request);
            });
        })
        .build()
        .request('original')
        .once('response', function (response) {
            Assert.equal('replaced', response);
            done();
        });

    });

    it('should handle once response', function (done) {
        var pipe = Trooba.use(function (pipe) {
            pipe.once('request', function (request) {
                Assert.equal('original', request);
                pipe.respond(request);
            });
        })
        .build()
        .once('response', function (response) {
            Object.keys(pipe.context.$points).forEach(function forEach(index) {
                Assert.deepEqual({}, pipe.context.$points[index]._messageHandlers);
            });
            done();
        });
        Object.keys(pipe.context.$points).forEach(function forEach(index) {
            Assert.equal(1, Object.keys(pipe.context.$points[index]._messageHandlers).length);
        });

        pipe.request('original');
    });

    it('should send custom message for custom handler', function (done) {
        var order = [];
        Trooba
        .use(function replace(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                pipe.context.data = data;
                order.push('replace');
                next();
            });
        })
        .use(function transport(pipe) {
            pipe.on('custom-request', function (data) {
                order.push('tr');
                pipe.respond(data+pipe.context.data);
            });
        })
        .build()
        .once('response', function (response) {
            Assert.equal('foobar', response);
            Assert.equal(['replace', 'tr'].toString(), order.toString());
            done();
        })
        .send({
            type: 'custom-handle-message',
            flow: 1,
            ref: 'bar'
        })
        .send({
            type: 'custom-request',
            flow: 1,
            ref: 'foo'
        });

    });

    it('should send sync custom message for custom handler', function (done) {
        var order = [];
        Trooba
        .use(function replace(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                // since we get sync message we do not need to call any next method
                // one cannot prevent it from propagation down the pipeline
                Assert.ok(!next, 'Should not be provided');
                order.push('replace');

                pipe.context.data = 'foo';
            });
        })
        .use(function shouldNotAffect(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                // since we get sync message we do not need to call any next method
                // one cannot prevent it from propagation down the pipeline
                Assert.ok(!next, 'Should not be provided');
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
                pipe.respond(data+pipe.context.data);
            });
        })
        .build()
        .once('response', function (response) {
            Assert.deepEqual(['replace', 'shouldNotAffect', 'tr'], order);
            Assert.equal('barfoo', response);

            done();
        })
        .send({
            type: 'custom-handle-message',
            flow: 1,
            ref: 'bar',
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
                pipe.respond(data+pipe.context.data);
            });
        })
        .build()
        .once('response', function (response) {
            Assert.deepEqual(['replace', 'shouldNotAffect', 'tr'], order);

            Assert.equal('barboom', response);

            done();
        })
        .send({
            type: 'custom-handle-message',
            flow: 1,
            ref: 'bar',
            sync: false
        });
    });

    it('should catch only request chunks and provide hook at stream level', function (done) {
        var pipe = Trooba.use(function (pipe) {
            var reqData = [];
            Assert.ok(!pipe.context.$requestStream);
            pipe.on('request:data', function (data, next) {
                Assert.ok(pipe.context.$requestStream);
                reqData.push(data);
                next();
            });
            pipe.once('request:end', function (data) {
                setImmediate(function () {
                    pipe.respond(reqData);
                });
            });
        })
        .build()
        ;

        pipe.streamRequest('request')
            .write('foo')
            .write('bar')
            .end()
            .on('response', function (response) {
                Assert.deepEqual(['foo', 'bar', undefined], response);
                done();
            });
    });

    it('should catch only response chunks', function (done) {
        var pipe = Trooba.use(function (pipe) {
            pipe.on('request', function () {
                Assert.ok(!pipe.context.$responseStream);
                pipe.streamResponse('response')
                    .write('foo')
                    .write('bar')
                    .end();
            });
        })
        .build()
        .on('response', function (response) {
            Assert.equal('response', response);
        });

        var reqData = [];
        pipe.request('request').on('response:data', function (data, next) {
            Assert.ok(pipe.context.$responseStream);
            reqData.push(data);
            next();
        });
        pipe.once('response:end', function (data) {
            Assert.deepEqual(['foo', 'bar', undefined], reqData);
            done();
        });

    });

    it('should catch all response messages', function (done) {
        var pipe = Trooba.use(function (pipe) {
            pipe.on('request', function () {
                pipe.streamResponse('response')
                    .write('foo')
                    .write('bar')
                    .end();
            });
        })
        .build();

        var reqData = [];
        pipe.request('request')
        .on('*', function (message, next) {
            reqData.push(message.ref);
            next();
        })
        .once('response:end', function (data) {
            Assert.deepEqual(['response', 'foo', 'bar', undefined], reqData);
            done();
        });

    });

    it('should catch all messages', function (done) {
        var messages = [];
        var pipe = Trooba
        .use(function catchhAll(pipe) {
            pipe.on('*', function (message, next) {
                messages.push(message.ref);
                next && next();
            });
        })
        .use(function (pipe) {
            pipe.on('request', function () {
                pipe.streamResponse('response')
                    .write('foo')
                    .write('bar')
                    .end();
            });
        })
        .build().request('request');

        pipe.once('response:end', function (data) {
            Assert.deepEqual(['request', 'response', 'foo', 'bar', undefined], messages);
            done();
        });

    });

    it('should handle error after a few chunks', function (done) {
        var pipe = Trooba.use(function (pipe) {
            pipe.on('request', function () {
                pipe.streamResponse('response')
                    .write('foo')
                    .write('bar');
                setTimeout(function () {
                    pipe.throw(new Error('Boom'));
                }, 10);
            });
        })
        .build()
        .on('response', function (response) {
            Assert.equal('response', response);
        });

        var count = 0;
        pipe.request('request').on('response:data', function (data, next) {
            count++;
            next();
        });
        pipe.once('response:end', function (data) {
            done(new Error('Should never happen'));
        });
        pipe.once('error', function (err) {
            Assert.equal('Boom', err.message);
            Assert.equal(2, count);
            done();
        });

    });

    it('should throw errer on way back', function (done) {
        Trooba
        .use(function handler(pipe) {
            pipe.on('response', function () {
                pipe.throw(new Error('Test'));
            });
        })
        .use(function tr(pipe) {
            pipe.on('request', function () {
                pipe.respond('bad content');
            });
        })
        .build({
            retry: 2
        }).request({
            order: []
        }, function validateResponse(err, response) {
            Assert.ok(err);
            Assert.equal('Test', err.message);
            done();
        });
    });

    it('should handle empty reply', function (done) {
        Trooba
        .use(function handler(pipe) {
        })
        .use(function tr(pipe) {
            pipe.on('request', function () {
                pipe.respond();
            });
        })
        .build({
            retry: 2
        })
        .request({
            order: []
        }, function validateResponse(err, response) {
            Assert.ok(!err);
            Assert.ok(!response);
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
                pipe.respond(request);
            });
        })
        .build({
            retry: 2
        });

        pipe.create().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
            Assert.deepEqual({foo:'bar'}, response);

            pipe.create().request({
                foo: 'qaz'
            }, function validateResponse(err, response) {
                Assert.ok(!err);
                Assert.deepEqual({foo:'qaz'}, response);
                done();
            });
        });
    });

    it('should expose transport API', function (done) {
        function factory() {
            function tr(pipe) {
                pipe.set('api', function (pipe) {
                    return {
                        hello: function () {},
                        bye: function () {}
                    };
                });
            }

            return tr;
        }

        var client = Trooba.use(factory()).build('api');
        Assert.ok(client.hello);
        Assert.ok(client.bye);
        done();
    });

    it('should call transport API and return runtime context', function () {
        function factory() {
            function tr(pipe) {
                pipe.on('request', function (request) {
                    setTimeout(function () {
                        pipe.respond(pipe.context.type +
                            ' ' + request);
                    }, 10);
                });

                pipe.set('api', function (pipe) {
                    return {
                        hello: function (name, callback) {
                            return pipe
                            .create({
                                type: 'hello'
                            })
                            .on('error', callback)
                            .on('response', callback.bind(null, null))
                            .request(name);
                        },
                        bye: function (name, callback) {
                            return pipe

                            .create({
                                type: 'bye'
                            })
                            .on('error', callback)
                            .on('response', callback.bind(null, null))
                            .request(name)
                            ;
                        }
                    };
                });
            }

            return tr;
        }

        var client = Trooba.use(factory()).build('api');
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

    it('should handle mock trasport', function (done) {
        function factory() {
            var tra = function tra(pipe) {
                pipe.on('request', function () {
                    pipe.respond({
                        qaz: 'wer'
                    });
                });

                pipe.set('api', function api(pipe) {
                    return {
                        request: function (req, callback) {
                            return pipe.create()
                            .on('response', function onResponse(response) {
                                callback(null, response);
                            })
                            .request(req);
                        }
                    };
                });
            };

            return tra;
        }

        var client = Trooba.use(factory()).build('api');

        client.request({
            foo: 'bar'
        }, function (err, res) {
            Assert.deepEqual({qaz: 'wer'}, res);
            done();
        });

    });

    describe('links', function () {
        var pipeFoo;
        var pipeBar;
        var order;

        it('should create and trace pipeFoo', function (next) {
            order = [];

            pipeFoo = Trooba
            .use(function foo1(pipe) {
                order.push('foo1');
            })
            .build();

            Assert.deepEqual([
                'foo1'
            ], order);

            pipeFoo.trace(function (err, list) {
                Assert.deepEqual([
                    'pipeHead-req',
                    'foo1-req',
                    'foo1-res',
                    'pipeHead-res'
                ], list.map(function (p) {return p.point.handler.name + (p.flow === 1 ? '-req' : '-res');}));
                next();
            });
        });

        it('should insert one-point pipe to one-point pipe and trace it', function (next) {
            order = [];

            pipeBar = Trooba
            .use(function bar1(pipe) {
                order.push('bar1');
            })
            .build();

            Assert.deepEqual([
                'bar1',
            ], order);

            pipeFoo = pipeFoo.create();
            pipeFoo.next.link(pipeBar);

            pipeFoo.trace(function (err, list) {
                Assert.deepEqual([
                    'pipeHead-req',
                    'foo1-req',
                    'bar1-req',
                    'bar1-res',
                    'foo1-res',
                    'pipeHead-res'
                ], list.map(function (p) {
                    return p.point.handler.name + (p.flow === 1 ? '-req' : '-res');
                }));
                next();
            });

        });

        it('should trace pipeBar', function (next) {
            pipeBar.trace(function (err, list) {
                Assert.deepEqual([
                    'pipeHead-req',
                    'bar1-req',
                    'bar1-res',
                    'pipeHead-res'
                ], list.map(function (p) {
                    return p.point.handler.name + (p.flow === 1 ? '-req' : '-res');
                }));
                next();
            });

        });

        it('should fail to re-insert pipe where it is already added', function (next) {
            Assert.throws(function () {
                pipeFoo.next.link(pipeBar);
            }, /The hook has already been registered, you can use only one hook for specific event type: */);
            next();
        });

        it('should create new context with pipeFoo and trace it', function (next) {
            order = [];
            pipeFoo = pipeFoo.create();
            Assert.deepEqual([
                'foo1'
            ], order);

            pipeFoo.trace(function (err, list) {
                Assert.deepEqual([
                    'pipeHead-req',
                    'foo1-req',
                    'foo1-res',
                    'pipeHead-res'
                ], list.map(function (p) {
                    return p.point.handler.name + (p.flow === 1 ? '-req' : '-res');
                }));
                next();
            });
        });

        it('should insert long pipe to one-element pipe, context flow', function (next) {
            // link to other pipe
            var pipeQaz = Trooba
            .use(function qaz1(pipe) {
                order.push('qaz1');
            })
            .use(function qaz2(pipe) {
                order.push('qaz2');
            })
            .use(function qaz3(pipe) {
                order.push('qaz3');
            })
            .build();

            pipeFoo = pipeFoo.create();
            pipeFoo.next.link(pipeQaz);

            pipeFoo.trace(function (err, list) {
                Assert.deepEqual([
                    'pipeHead-req',
                    'foo1-req',
                    'qaz1-req',
                    'qaz2-req',
                    'qaz3-req',
                    'qaz3-res',
                    'qaz2-res',
                    'qaz1-res',
                    'foo1-res',
                    'pipeHead-res'
                ], list.map(function (p) {
                    return p.point.handler.name + (p.flow === 1 ? '-req' : '-res');
                }));
                next();
            });
        });

        it('should insert long pipe to other long pipe, context flow', function (next) {
            pipeFoo = Trooba
            .use(function foo1(pipe) {
                order.push('foo1');
            })
            .use(function foo2(pipe) {
                order.push('foo2');
            })
            .use(function foo3(pipe) {
                order.push('foo3');
            })
            .build();

            // link to other pipe
            var pipeQaz = Trooba
            .use(function qaz1(pipe) {
                order.push('qaz1');
            })
            .use(function qaz2(pipe) {
                order.push('qaz2');
            })
            .use(function qaz3(pipe) {
                order.push('qaz3');
            })
            .build();

            pipeFoo.next.link(pipeQaz);

            pipeFoo.trace(function (err, list) {
                Assert.deepEqual([
                    'pipeHead-req',
                    'foo1-req',
                    'qaz1-req',
                    'qaz2-req',
                    'qaz3-req',
                    'foo2-req',
                    'foo3-req',
                    'foo3-res',
                    'foo2-res',
                    'qaz3-res',
                    'qaz2-res',
                    'qaz1-res',
                    'foo1-res',
                    'pipeHead-res'
                ], list.map(function (p) {
                    return p.point.handler.name + (p.flow === 1 ? '-req' : '-res');
                }));
                next();
            });
        });

        it('should propagate request in pipeFoo', function (next) {
            order = [];

            pipeFoo = Trooba
            .use(function foo1(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('foo1');
                    next();
                });
            })
            .use(function foo2(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('foo2');
                    next();
                });
            })
            .use(function foo3(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('foo3');
                    next();
                });
            })
            .use(function fooTr(pipe) {
                pipe.on('request', function () {
                    order.push('foo-tr');
                    pipe.respond();
                });
            })
            .build();

            pipeFoo.request({}, function () {
                Assert.deepEqual([
                    'foo1',
                    'foo2',
                    'foo3',
                    'foo-tr'
                ], order);
                next();
            });
        });

        it('should propagate request in bar', function (next) {
            pipeBar = Trooba
            .use(function bar1(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('bar1');
                    next();
                });
            })
            .use(function bar2(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('bar2');
                    next();
                });
            })
            .use(function bar3(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('bar3');
                    next();
                });
            })
            .use(function barTr(pipe) {
                pipe.on('request', function () {
                    order.push('bar-tr');
                    pipe.respond();
                });
            })
            .build();

            order = [];
            pipeBar.request({}, function () {
                Assert.deepEqual([
                    'bar1',
                    'bar2',
                    'bar3',
                    'bar-tr'
                ], order);

                next();
            });
        });

        it('should propagate request in linked pipe', function (next) {
            pipeFoo = pipeFoo.create();
            pipeBar = pipeBar.create();
            pipeFoo.next.link(pipeBar);
            order = [];

            pipeFoo.request({}, function () {
                Assert.deepEqual([
                    'foo1',
                    'bar1',
                    'bar2',
                    'bar3',
                    'bar-tr'
                ], order);
                next();
            });
        });

        it('should propagate response in foo', function (next) {
            order = [];

            pipeFoo = Trooba
            .use(function foo1(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('foo1');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-foo1');
                    next();
                });
            })
            .use(function foo2(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('foo2');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-foo2');
                    next();
                });
            })
            .use(function foo3(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('foo3');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-foo3');
                    next();
                });
            })
            .use(function fooTr(pipe) {
                pipe.on('request', function () {
                    order.push('foo-tr');
                    pipe.respond();
                });
            })
            .build();

            pipeFoo.request({}, function () {
                Assert.deepEqual([
                    'foo1',
                    'foo2',
                    'foo3',
                    'foo-tr',
                    'res-foo3',
                    'res-foo2',
                    'res-foo1'
                ], order);
                next();
            });
        });

        it('should propagate request in linked pipe', function (next) {
            pipeFoo = pipeFoo.create();
            pipeBar = Trooba
            .use(function bar1(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('bar1');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-bar1');
                    next();
                });
            })
            .use(function bar2(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('bar2');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-bar2');
                    next();
                });
            })
            .use(function bar3(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('bar3');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-bar3');
                    next();
                });
            })
            .use(function barTr(pipe) {
                pipe.on('request', function () {
                    order.push('bar-tr');
                    pipe.respond();
                });
            })
            .build();

            pipeFoo.next.link(pipeBar);
            order = [];

            pipeFoo.request({}, function () {
                Assert.deepEqual([
                    'foo1',
                    'bar1',
                    'bar2',
                    'bar3',
                    'bar-tr',
                    'res-bar3',
                    'res-bar2',
                    'res-bar1',
                    'res-foo1'
                ], order);
                next();
            });
        });

        it('should propagate response in extended pipe', function (next) {
            pipeFoo = Trooba
            .use(function foo1(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('foo1');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-foo1');
                    next();
                });
            })
            .use(function foo2(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('foo2');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-foo2');
                    next();
                });
            })
            .use(function foo3(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('foo3');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-foo3');
                    next();
                });
            })
            .use(function fooTr(pipe) {
                pipe.on('request', function () {
                    order.push('foo-tr');
                    pipe.respond();
                });
            })
            .build();

            pipeBar = Trooba
            .use(function bar1(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('bar1');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-bar1');
                    next();
                });
            })
            .use(function bar2(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('bar2');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-bar2');
                    next();
                });
            })
            .use(function bar3(pipe) {
                pipe.on('request', function (r, next) {
                    order.push('bar3');
                    next();
                });
                pipe.on('response', function (r, next) {
                    order.push('res-bar3');
                    next();
                });
            })
            .build();

            pipeFoo.next.link(pipeBar);
            order = [];

            pipeFoo.request({}, function () {
                Assert.deepEqual([
                    'foo1',
                    'bar1',
                    'bar2',
                    'bar3',
                    'foo2',
                    'foo3',
                    'foo-tr',
                    'res-foo3',
                    'res-foo2',
                    'res-bar3',
                    'res-bar2',
                    'res-bar1',
                    'res-foo1'
                ], order);
                next();
            });
        });

        describe('propagation through extended pipe', function () {
            it('should prepare two pipes', function (next) {
                pipeBar = Trooba
                .use(function bar1(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('bar1');
                        next();
                    });
                })
                .use(function bar2(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('bar2');
                        next();
                    });
                })
                .use(function bar3(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('bar3');
                        next();
                    });
                })
                .build();

                pipeFoo = Trooba
                .use(function foo1(pipe) {
                    pipe.link(pipeBar);
                    pipe.on('request', function (r, next) {
                        order.push('foo1');
                        next();
                    });
                })
                .use(function foo2(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('foo2');
                        next();
                    });
                })
                .use(function foo3(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('foo3');
                        next();
                    });
                })
                .use(function fooTr(pipe) {
                    pipe.on('request', function () {
                        order.push('foo-tr');
                        pipe.respond();
                    });
                })
                .build();
                next();
            });

            it('should trace the modified pipe', function (next) {
                order = [];

                pipeFoo.trace(function (err, list) {
                    Assert.deepEqual([
                        'pipeHead-req',
                        'foo1-req',
                        'bar1-req',
                        'bar2-req',
                        'bar3-req',
                        'foo2-req',
                        'foo3-req',
                        'fooTr-req',
                        'fooTr-res',
                        'foo3-res',
                        'foo2-res',
                        'bar3-res',
                        'bar2-res',
                        'bar1-res',
                        'foo1-res',
                        'pipeHead-res'
                    ], list.map(function (p) {
                        return p.point.handler.name + (p.flow === 1 ? '-req' : '-res');
                    }));
                    next();
                });
            });

            it('should propagate request in the modified pipe', function (next) {
                order = [];

                pipeFoo
                .request({}, function () {
                    Assert.deepEqual([
                        'foo1',
                        'bar1',
                        'bar2',
                        'bar3',
                        'foo2',
                        'foo3',
                        'foo-tr'
                    ], order);
                    next();
                });
            });

            it('should propagate response in modified pipe', function (next) {
                pipeFoo = Trooba
                .use(function foo1(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('foo1');
                        next();
                    });
                    pipe.on('response', function (r, next) {
                        order.push('res-foo1');
                        next();
                    });
                })
                .use(function foo2(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('foo2');
                        next();
                    });
                    pipe.on('response', function (r, next) {
                        order.push('res-foo2');
                        next();
                    });
                })
                .use(function foo3(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('foo3');
                        next();
                    });
                    pipe.on('response', function (r, next) {
                        order.push('res-foo3');
                        next();
                    });
                })
                .use(function fooTr(pipe) {
                    pipe.on('request', function () {
                        order.push('foo-tr');
                        pipe.respond();
                    });
                })
                .build();

                pipeBar = Trooba
                .use(function bar1(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('bar1');
                        next();
                    });
                    pipe.on('response', function (r, next) {
                        order.push('res-bar1');
                        next();
                    });
                })
                .use(function bar2(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('bar2');
                        next();
                    });
                    pipe.on('response', function (r, next) {
                        order.push('res-bar2');
                        next();
                    });
                })
                .use(function bar3(pipe) {
                    pipe.on('request', function (r, next) {
                        order.push('bar3');
                        next();
                    });
                    pipe.on('response', function (r, next) {
                        order.push('res-bar3');
                        next();
                    });
                })
                .build();

                pipeFoo.next.link(pipeBar);
                order = [];

                pipeFoo.request({}, function () {
                    Assert.deepEqual([
                        'foo1',
                        'bar1',
                        'bar2',
                        'bar3',
                        'foo2',
                        'foo3',
                        'foo-tr',
                        'res-foo3',
                        'res-foo2',
                        'res-bar3',
                        'res-bar2',
                        'res-bar1',
                        'res-foo1'
                    ], order);
                    next();
                });
            });
        });

    });

    describe('TTL', function () {

        describe('drop', function () {
            var _log = console.log;
            afterEach(function () {
                console.log = _log;
            });

            it('should drop message int console', function (done) {
                console.log = function intercept(msg, type, flow) {
                    _log.apply(console, arguments);
                    if (msg === 'The message has been dropped, ttl expired:') {
                        done();
                    }
                };
                Trooba
                .use(function (pipe) {
                    pipe.on('*', function loopBack(message) {
                        setImmediate(function () {
                            if (message.type === 'trace') {
                                message.flow = 1;
                                pipe.send(message);
                            }
                        });
                    });
                })
                .use(function (pipe) {
                    pipe.on('*', function loopBack(message) {
                        setImmediate(function () {
                            if (message.type === 'trace') {
                                message.flow = 2;
                                pipe.send(message);
                            }
                        });
                    });
                })
                .build()
                .trace();
            });

            it('should drop message into custom handler', function (done) {

                Trooba
                .use(function (pipe) {
                    pipe.on('*', function loopBack(message) {
                        setImmediate(function () {
                            if (message.type === 'trace') {
                                message.flow = 1;
                                pipe.send(message);
                            }
                        });
                    });
                })
                .use(function (pipe) {
                    pipe.on('*', function loopBack(message) {
                        setImmediate(function () {
                            if (message.type === 'trace') {
                                message.flow = 2;
                                pipe.send(message);
                            }
                        });
                    });
                })
                .build({
                    onDrop: function onDrop(message) {
                        Assert.equal('trace', message.type);
                        done();
                    }
                })
                .trace();
            });
        });

    });

    it('should access default next and prev without context', function () {
        var pipe = Trooba.use(function (pipe) {}).build();
        var nextPoint = pipe.next;
        Assert.ok(pipe.next);
        Assert.ok(nextPoint === pipe.next);
        Assert.ok(!pipe.prev);

        pipe.context = undefined;
        Assert.ok(pipe.next);
        Assert.ok(nextPoint !== pipe.next);

        // build a pipe with prev
        pipe = Trooba.use(function prev(pipe) {
        }).use(function (pipe) {
        }).build();

        nextPoint = pipe.next;
        var prevPoint = pipe.next.prev;
        Assert.ok(pipe.next);
        Assert.ok(nextPoint === pipe.next);
        Assert.ok(pipe.next === pipe.next);
        Assert.ok(pipe.next === pipe.next.next.prev);
        Assert.ok(pipe.next.prev);
        Assert.ok(prevPoint === pipe.next.prev);

        pipe.context = undefined;
        Assert.ok(pipe.next);
        Assert.ok(nextPoint !== pipe.next);
        Assert.ok(pipe.next === pipe.next.next.prev);
        Assert.ok(pipe.next.prev);
        Assert.ok(prevPoint !== pipe.next.prev);
    });
});
