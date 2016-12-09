'use strict';

var Assert = require('assert');
var Domain = require('domain');
var NodeUtils = require('util');
var _ = require('lodash');
var Async = require('async');
var Trooba = require('..');

describe(__filename, function () {
    it('should create transport from factory function', function () {
        var client = Trooba.transport(function () {
            return function tr(pipe) {
            };
        });
        Assert.ok(client);
        Assert.ok(client.use);
        Assert.ok(client.create);
    });

    it('should create transport from module reference', function () {
        var client = Trooba.transport(require.resolve('./fixtures/test-transport'));
        Assert.ok(client);
        Assert.ok(client.use);
        Assert.ok(client.create);
    });

    it('should bind transport later via handler', function (done) {
        // this would allow bootstraping pipeline and transport binding via handler
        Trooba.use(function inject(pipe) {
            pipe.context.transport = function tr(pipe) {
                Assert.ok(pipe);
                pipe.on('request', function onRequest(request) {
                    Assert.ok(request);
                    Assert.deepEqual({
                        foo: 'bar'
                    }, request);

                    pipe.respond({
                        qaz: 'qwe'
                    });
                });
            };
        })
        .create()
        .request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(!err);
            Assert.ok(response);
            Assert.deepEqual({
                qaz: 'qwe'
            }, response);
            done();
        });
    });

    it('should call transport with context', function (done) {
        var pipe = Trooba.transport(function tr(pipe) {
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
        .request({
            foo: 'bar'
        });
    });

    it('should pass configuration to the transport', function (done) {
        Trooba.transport(function tr(pipe, config) {
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
        .create()
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
        var client = Trooba.transport(function tr(pipe) {
            pipe.on('request', function (request) {
                pipe.respond(NodeUtils.format(pipe.context.greeting,
                    request));
            });
        })
        .interface(function (pipe, config) {
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
        }, {
            greeting: 'Hello %s'
        })
        .create();

        client.hello('John', function validateResponse(err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.ok(response);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should handle error from responseContext', function (done) {
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function () {
                pipe.throw(new Error('Test Error'));
            });
        }).create().request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(err);
            Assert.equal('Test Error', err.message);
            done();
        });
    });

    it('should call handler', function (done) {
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function (request) {
                pipe.respond(request);
            });
        })
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                next({
                    foo: request.foo,
                    rvb: 'zxc'
                });
            });
        })
        .create().request({
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
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function (request) {
                pipe.respond(request);
            });
        })
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                next({
                    rvb: 'zxc'
                });
            });
        })
        .create().request({
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
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function (request) {
                pipe.respond(request);
            });
        })
        .use(require.resolve('./fixtures/handler'))
        .create().request({
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
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function () {
                done(new Error('Should not happen'));
            });
        })
        .use(function handler(pipe) {
            pipe.on('request', function (request) {
                request.dfg = 'cvb';
                pipe.respond(request);
            });
        })
        .create().request({
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
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function () {
                done(new Error('Should not happen'));
            });
        })
        .use(function handler(pipe, config) {
            pipe.on('request', function (request) {
                request.dfg = config.cfg;
                pipe.respond(request);
            });
        }, {
            cfg: 'thy'
        })
        .create().request({
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
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function (request) {
                request.tra = 'asd';
                pipe.respond(request);
            });
        })
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
        .create().request({
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

        Trooba.transport(function tr(pipe) {
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
        .use(function handler(pipe) {
            pipe.context.fa1 = 'zx1';
        })
        .use(function handler(pipe) {
            pipe.context.fa2 = 'zx2';
        })
        .create().request({
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
        var client = Trooba.transport(function tr(pipe) {
            pipe.on('request', function(request) {
                request.chain.push('tr');
                pipe.respond(request);
            });
        })
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
        });

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

    it('should handle pipeRequest.throw(error) in transport by switching it to reply implicitly', function (done) {
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function () {
                done(new Error('should not happen'));
            });
        })
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
        .create().request({
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

        it('should throw error if no error handler is registered', function (done) {
            var domain = Domain.create();
            domain.run(function () {
                Trooba.transport(function tr(pipe) {
                    pipe.on('request', function () {
                        done(new Error('should not happen'));
                    });
                })
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
                .create().request({
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

            var pipe = Trooba.transport(transport)
                .use(domainInjector)
                .use(handlerCtxModifier)
                .use(handlerRequestCounter);

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
            var pipe = Trooba.transport(function (pipe) {
                pipe.once('request', function () {
                    pipe.throw(new Error('Bad'));
                    setTimeout(function () {
                        pipe.throw(new Error('Bad again'));
                    }, 10);
                });
            })
            .create();

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

    it('should handle double next (kind of streaming) with action.next', function (done) {
        var count = 0;
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function (request) {
                request.tra = 'asd';
                pipe.respond(request);
            });
        })
        .use(function handler(pipe) {
            pipe.on('request', function (request, next) {
                request.fa2 = 'zx2';
                next();
                next();
            });
        })
        .create().request({
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
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function () {
                pipe.context.order.push('tr');
                pipe.respond(pipe.context.order);
            });
        })
        .use(function handler(pipe) {
            pipe.context.order.push('zx1');
        })
        .use(function handler(pipe) {
            pipe.context.order.push('zx2');
        })
        .use(function handler(pipe) {
            pipe.context.order.push('zx3');
        })
        .create({
            order: []
        }).request({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.equal(['zx1', 'zx2', 'zx3', 'tr'].toString(),
                response.toString());
            done();
        });
    });

    it('should go full cycle with chunks', function (done) {
        var trCount = 0;
        var order = [];
        var pipeCtx = Trooba.transport(function transport(pipe) {
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
        .create({
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

    it('should catch on response:data', function (done) {
        var chunks = [];

        Trooba.transport(function tr(pipe) {
            Assert.ok(pipe);
            pipe.on('request', function onRequest(request) {
                pipe.streamResponse({}).write('data1').write('data2').end();
            });
        })
        .create()
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
        Trooba.transport(function tr(pipe) {
            Assert.ok(pipe);
            pipe.on('request', function onRequest(request) {
                pipe.streamResponse({}).end();
            });
        })
        .create()
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

        var pipe = Trooba.transport(transport)
            .use(handlerCtxModifier)
            .use(handlerRequestCounter);

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

        var client = Trooba.transport(transport)
            .use(handlerCtxModifier)
            .use(handlerRequestCounter)
            .interface(function (pipe) {
                return {
                    doRequest: function (index, callback) {
                        pipe.create().request({
                            foo: index
                        }, callback);
                    }
                };
            }).create();

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
        Trooba.transport(function (pipe) {
            pipe.on('request', function () {
                var response = pipe.streamResponse({});
                response.write('foo')
                    .end();

                Assert.throws(function () {
                    response.write();
                }, /The stream has been closed already/);
            });
        })
        .create()
        .on('response:end', function () {
            setTimeout(done, 10);
        })
        .request({});

    });

    it('should fail to write request after request is closed', function (done) {
        var request = Trooba.transport(function (pipe) {
            pipe.on('request', function () {
                pipe.respond({});
            });
        })
        .create()
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
        var client = Trooba.transport(function (pipe) {
            pipe.on('request', function () {
                pipe.respond(pipe.context.foo + (pipe.context.qaz || ''));
            });
        })
        .create({
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
        var client = Trooba.transport(function (pipe) {
            pipe.on('request', function () {
                pipe.respond({});
            });
        })
        .create();

        client.request({}, function () {
            Assert.throws(function () {
                client.request({}, function () {
                });
            }, /The hook has already been registered, you can use only one hook for specific event type: error/);
            done();
        });
    });

    it('should handle once error and once response', function (done) {
        var pipe = Trooba.transport(function (pipe) {
            pipe.once('request', function () {
                pipe.throw(new Error('Bad'));
            });
        })
        .create();
        pipe.request({})
        .once('error', function (err) {
            Object.keys(pipe.context.$points).forEach(function forEach(index) {
                Assert.deepEqual({}, pipe.context.$points[index]._messageHandlers);
            });
            done();
        });
    });

    it('should replace error', function (done) {
        Trooba.transport(function (pipe) {
            pipe.once('request', function () {
                pipe.throw(new Error('Bad'));
            });
        })
        .use(function replace(pipe) {
            pipe.on('error', function (err, next) {
                next(new Error('Another bad'));
            });
        })
        .create()
        .request({})
        .once('error', function (err) {
            Assert.equal('Another bad', err.message);
            done();
        });

    });

    it('should replace request', function (done) {
        Trooba.transport(function (pipe) {
            pipe.once('request', function (request) {
                pipe.respond(request);
            });
        })
        .use(function replace(pipe) {
            pipe.once('request', function (request, next) {
                next('replaced');
            });
        })
        .create()
        .request('original')
        .once('response', function (response) {
            Assert.equal('replaced', response);
            done();
        });

    });

    it('should replace response', function (done) {
        Trooba.transport(function (pipe) {
            pipe.once('request', function (request) {
                Assert.equal('original', request);
                pipe.respond(request);
            });
        })
        .use(function replace(pipe) {
            pipe.on('response', function (response, next) {
                next('replaced');
            });
        })
        .create()
        .request('original')
        .once('response', function (response) {
            Assert.equal('replaced', response);
            done();
        });

    });

    it('should handle once response', function (done) {
        var pipe = Trooba.transport(function (pipe) {
            pipe.once('request', function (request) {
                Assert.equal('original', request);
                pipe.respond(request);
            });
        })
        .create()
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
        Trooba.transport(function (pipe) {
            pipe.on('custom-request', function (data) {
                pipe.respond(data+pipe.context.data);
            });
        })
        .use(function replace(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                pipe.context.data = data;
                next();
            });
        })
        .create()
        .once('response', function (response) {
            Assert.equal('foobar', response);
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
        Trooba.transport(function (pipe) {
            pipe.on('custom-handle-message', function (data) {
                pipe.respond(data+pipe.context.data);
            });
        })
        .use(function replace(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                // since we get sync message we do not need to call any next method
                // one cannot prevent it from propagation down the pipeline
                Assert.ok(!next, 'Should not be provided');

                pipe.context.data = 'foo';
            });
        })
        .use(function shouldNotAffect(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                // since we get sync message we do not need to call any next method
                // one cannot prevent it from propagation down the pipeline
                Assert.ok(!next, 'Should not be provided');
                // symulate delayed context change that should not affect reponse
                setTimeout(function () {
                    pipe.context.data = 'boom';
                }, 10);
            });
        })
        .create()
        .once('response', function (response) {
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
        Trooba.transport(function (pipe) {
            pipe.on('custom-handle-message', function (data) {
                pipe.respond(data+pipe.context.data);
            });
        })
        .use(function replace(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                // this change will be overwritten by the next handler
                pipe.context.data = 'foo';
                next();
            });
        })
        .use(function shouldNotAffect(pipe) {
            pipe.on('custom-handle-message', function (data, next) {
                // since we get sync message we do not need to call any next method
                // one cannot prevent it from propagation down the pipeline

                // symulate delayed context change that should not affect reponse
                setTimeout(function () {
                    pipe.context.data = 'boom';
                    next();
                }, 10);
            });
        })
        .create()
        .once('response', function (response) {
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

    it('should catch only request chunks', function (done) {
        var pipe = Trooba.transport(function (pipe) {
            var reqData = [];
            pipe.on('request:data', function (data, next) {
                reqData.push(data);
                next();
            });
            pipe.once('request:end', function (data) {
                pipe.respond(reqData);
            });
        })
        .create()
        .on('response', function (response) {
            Assert.deepEqual(['foo', 'bar', undefined], response);
            done();
        });

        pipe.streamRequest('request')
            .write('foo')
            .write('bar')
            .end();

    });

    it('should catch only response chunks', function (done) {
        var pipe = Trooba.transport(function (pipe) {
            pipe.on('request', function () {
                pipe.streamResponse('response')
                    .write('foo')
                    .write('bar')
                    .end();
            });
        })
        .create()
        .on('response', function (response) {
            Assert.equal('response', response);
        });

        var reqData = [];
        pipe.request('request').on('response:data', function (data, next) {
            reqData.push(data);
            next();
        });
        pipe.once('response:end', function (data) {
            Assert.deepEqual(['foo', 'bar', undefined], reqData);
            done();
        });

    });

    it('should handle error after a few chunks', function (done) {
        var pipe = Trooba.transport(function (pipe) {
            pipe.on('request', function () {
                pipe.streamResponse('response')
                    .write('foo')
                    .write('bar');
                setTimeout(function () {
                    pipe.throw(new Error('Boom'));
                }, 10);
            });
        })
        .create()
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
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function () {
                pipe.respond('bad content');
            });
        })
        .use(function handler(pipe) {
            pipe.on('response', function () {
                pipe.throw(new Error('Test'));
            });
        })
        .create({
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
        Trooba.transport(function tr(pipe) {
            pipe.on('request', function () {
                pipe.respond();
            });
        })
        .use(function handler(pipe) {
        })
        .create({
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
        var pipe = Trooba.transport(function tr(pipe) {
            pipe.on('request', function (request) {
                pipe.respond(request);
            });
        })
        .use(function handler(pipe) {
            // noop
        })
        .create({
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

            }

            tr.api = function () {
                return {
                    hello: function () {},
                    bye: function () {}
                };
            };

            return tr;
        }

        var client = Trooba.transport(factory()).create();
        Assert.ok(client.hello);
        Assert.ok(client.bye);
        done();
    });

    it('should expose transport API via interface', function (done) {
        var client = Trooba.interface(function () {
            return {
                hello: function () {},
                bye: function () {}
            };
        }).transport(function tr(pipe) {

        }).create();
        Assert.ok(client.hello);
        Assert.ok(client.bye);
        done();
    });

    it('should expose transport API with config via interface', function (done) {
        var client = Trooba.interface(function api(pipe, config) {
            Assert.equal('bar', config.foo);
            return {
                hello: function () {},
                bye: function () {}
            };
        }, {
            foo: 'bar'
        }).transport(function tr(pipe) {
        }).create();
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
            }

            tr.api = function (pipe) {
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
            };

            return tr;
        }

        var client = Trooba.transport(factory()).create();
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

    it('should setup transport API via interface, do call and return runtime context', function (done) {
        function transport(pipe) {
            pipe.on('request', function (request) {
                pipe.respond(pipe.context.type +
                    ' ' + request);
            });
        }

        function api(pipe) {
            return {
                hello: function (name, callback) {
                    return pipe.create({
                        type: 'hello'
                    })
                    .on('response', function onResponse(response) {
                        callback(null, response);
                    })
                    .request(name);
                },
                bye: function (name, callback) {
                    return pipe.create({
                        type: 'bye'
                    })
                    .on('response', function onResponse(response) {
                        callback(null, response);
                    })
                    .request(name);
                }
            };
        }

        var client = Trooba.transport(transport).interface(api).create();
        client.hello('John', function (err, response) {
            Assert.equal('hello John', response);
        });

        client.hello('Bob', function (err, response) {
            Assert.equal('hello Bob', response);
        });

        client.bye('John', function (err, response) {
            Assert.equal('bye John', response);

            client.bye('Bob', function (err, response) {
                Assert.equal('bye Bob', response);
                done();
            });
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
            };

            tra.api = function api(pipe) {
                return {
                    request: function (req, callback) {
                        return pipe.create()
                        .on('response', function onResponse(response) {
                            callback(null, response);
                        })
                        .request(req);
                    }
                };
            };

            return tra;
        }

        var client = Trooba.transport(factory()).create();

        client.request({
            foo: 'bar'
        }, function (err, res) {
            Assert.deepEqual({qaz: 'wer'}, res);
            done();
        });

    });

});
