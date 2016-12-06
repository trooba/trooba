'use strict';

var Assert = require('assert');
var Domain = require('domain');
var NodeUtils = require('util');
var _ = require('lodash');
var Trooba = require('..');

describe(__filename, function () {
    it('should create transport from factory function', function () {
        var client = Trooba.transport(function () {
            return function tr(requestPipe) {
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
        Trooba.use(function injectTransport() {
            return function inject(requestPipe) {
                requestPipe.context.transport = function tr(requestPipe) {
                    Assert.ok(requestPipe);
                    Assert.ok(requestPipe.context.request);
                    Assert.deepEqual({
                        foo: 'bar'
                    }, requestPipe.context.request);

                    requestPipe.reply({
                        qaz: 'qwe'
                    });
                };

                requestPipe.next();
            };
        }).create()({
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
        var resCtx;
        Trooba.transport(function () {
            return function tr(requestPipe) {
                Assert.ok(requestPipe);
                Assert.ok(requestPipe.context.request);
                Assert.equal('thy', requestPipe.context.fer);
                Assert.deepEqual({
                    foo: 'bar'
                }, requestPipe.context.request);

                requestPipe.createResponsePipe({
                    qaz: 'wsx'
                }).reply({
                    qaz: 'qwe'
                });
            };
        }).create({
            fer: 'thy'
        })({
            foo: 'bar'
        })
        .on('responsePipe', function (responsePipe) {
            resCtx = responsePipe.context;
        })
        .on('error', done)
        .on('response', function validateResponse(response) {
            Assert.ok(response);
            Assert.equal('wsx', resCtx.qaz);
            Assert.deepEqual({
                qaz: 'qwe'
            }, response);
            done();
        });
    });

    it('should pass configuration to the transport', function (done) {
        Trooba.transport(function (config) {
            Assert.deepEqual({
                asd: 'zxc'
            }, config);
            return function tr(requestPipe) {
                requestPipe.reply(_.assign({
                    qaz: 'qwe'
                }, config));
            };
        }, {
            asd: 'zxc'
        }).create()({
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
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.reply(NodeUtils.format(requestPipe.context.greeting,
                    requestPipe.context.request));
            };
        })
        .interface(function apiFactory(config) {
            return function (pipe) {
                return {
                    hello: function (name, callback) {
                        var requestContext = {
                            greeting: config.greeting,
                            request: name
                        };

                        pipe(requestContext)
                            .on('error', function (err) {
                                callback(err);
                            })
                            .on('response', function (response) {
                                callback(undefined, response);
                            });
                    }
                };
            };
        }, {
            greeting: 'Hello %s'
        })
        .create().hello('John', function validateResponse(err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.ok(response);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should handle error', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.throw(new Error('Test Error'));
            };
        }).create()({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(err);
            Assert.equal('Test Error', err.message);
            Assert.ok(!response);
            done();
        });
    });

    it('should handle error from responseContext', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.createResponsePipe()
                    .throw(new Error('Test Error'));
            };
        }).create()({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.ok(err);
            Assert.equal('Test Error', err.message);
            done();
        });
    });

    it('should call handler', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.reply(requestPipe.context.request);
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.rvb = 'zxc';
                requestPipe.next();
            };
        })
        .create()({
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

    it('should resolve handler from module reference', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.reply(requestPipe.context.request);
            };
        })
        .use(require.resolve('./fixtures/handler'))
        .create()({
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
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                done(new Error('Should not happen'));
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.dfg = 'cvb';
                requestPipe.reply(requestPipe.context.request);
            };
        })
        .create()({
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
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                done(new Error('Should not happen'));
            };
        })
        .use(function factory(config) {
            return function handler(requestPipe) {
                requestPipe.context.request.dfg = config.cfg;
                requestPipe.reply(requestPipe.context.request);
            };
        }, {
            cfg: 'thy'
        })
        .create()({
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
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.context.request.tra = 'asd';
                requestPipe.reply(requestPipe.context.request);
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.fa1 = 'zx1';
                requestPipe.next();
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.fa2 = 'zx2';
                requestPipe.next();
            };
        })
        .create()({
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
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.context.request.tra = 'asd';
                requestPipe.reply(requestPipe.context.request);
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.fa1 = 'zx1';
                requestPipe.next();
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.fa2 = 'zx2';
                requestPipe.next();
            };
        })
        .create()({
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
        var request = Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.context.request.chain.push('tr');
                requestPipe.reply(requestPipe.context.request);
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.chain.push('i1');
                requestPipe.next();
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.chain.push('i2');
                requestPipe.next();
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.chain.push('i3');
                requestPipe.next();
            };
        })
        .create();

        request({
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

            request({
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
        Trooba.transport(function (config) {
            return function tr() {
                done(new Error('should not happen'));
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.throw(new Error('Test'));
            };
        })
        .use(function factory() {
            return function handler() {
                done(new Error('should not happen'));
            };
        })
        .create()({
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
                Trooba.transport(function (config) {
                    return function tr() {
                        done(new Error('should not happen'));
                    };
                })
                .use(function factory() {
                    return function handler(requestPipe) {
                        requestPipe.throw(new Error('Test'));
                    };
                })
                .use(function factory() {
                    return function handler() {
                        done(new Error('should not happen'));
                    };
                })
                .create()({
                    foo: 'bar'
                });
            });
            domain.once('error', function (err) {
                Assert.equal('Test', err.message);
                done();
            });
        });
    });

    it('should handle double next (kind of streaming) with action.next', function (done) {
        var count = 0;
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.context.request.tra = 'asd';
                requestPipe.reply(requestPipe.context.request);
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.request.fa2 = 'zx2';
                requestPipe.next();
                requestPipe.next();
            };
        })
        .create()({
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
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.context.order.push('tr');
                requestPipe.reply(requestPipe.context.order);
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.order.push('zx1');
                requestPipe.next();
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.order.push('zx2');
                requestPipe.next();
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.context.order.push('zx3');
                requestPipe.next();
            };
        })
        .create({
            order: []
        })({
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
        var pipeCtx = Trooba.transport(function (config) {
            return function tr(requestPipe) {
                order.push('tr');
                if (trCount++ < 1) {
                    requestPipe.throw(new Error('Timeout'));
                    return;
                }

                var response = requestPipe.reply(requestPipe.request);
                setImmediate(function () {
                    response.write('data1');
                    setImmediate(function () {
                        response.write('data2');
                        response.end();
                    });
                });
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                order.push('zx1-req');
                requestPipe.next()
                    .on('response', function (response, next) {
                        order.push('zx1-res');

                        requestPipe.on('response-data', function (data, next) {
                            order.push('zx1-' + (data || 'end'));
                            next();
                        });

                        next();
                    });
            };
        })
        .use(function factoryRetry() {
            return function handler(requestPipe) {
                order.push('zx2-req');
                requestPipe.next()
                    .on('responsePipe', function syncHandler(responsePipe) {
                        order.push('zx2-context');
                    })
                    .on('response', function asyncHandler(response, next) {
                        order.push('zx2-res');
                        next();
                    })
                    .on('error', function asyncHandler(err) {
                        if (requestPipe.context.retry-- > 0) {
                            order.push('retry');
                            requestPipe.next();
                        }
                    });
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                order.push('zx3-req');

                requestPipe.next()
                    .on('response', function (response, next) {
                        order.push('zx3-res');
                        next();
                    })
                    .on('response-data', function (data, next) {
                        order.push('zx3-' + (data || 'end'));
                        next();
                    })
                    .on('end', function (next) {
                        order.push('zx3-onEnd');
                        next();
                    });

            };
        })
        .create({
            retry: 1
        })({
            order: []
        });

        pipeCtx.on('end', function validateResponse(err, response) {

            Assert.equal([
                'zx1-req',
                'zx2-req',
                'zx3-req',
                'tr',
                'zx2-context',
                'retry',
                'zx3-req',
                'tr',
                'zx2-context',
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

    it.skip('should handle once error', function (done) {

    });

    it.skip('should handle once error and throw error when second one comes', function (done) {

    });

    it.skip('should handle once response', function (done) {

    });

    it.skip('should handle once responsePipe', function (done) {

    });

    it.skip('should send custom message for custom handler', function (done) {

    });

    it.skip('should catch only chunks', function (done) {

    });

    it.skip('should handle error after a few chunks', function (done) {

    });

    it.skip('should handle only errors', function (done) {

    });

    it.skip('should handle only responses', function (done) {

    });

    it.skip('should replace response', function (done) {

    });

    it.skip('should replace error', function (done) {

    });

    it('should throw errer on way back', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.reply('bad content');
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.next()
                    .on('response', function () {
                        requestPipe.throw(new Error('Test'));
                    });
            };
        })
        .create({
            retry: 2
        })({
            order: []
        }, function validateResponse(err, response) {
            Assert.ok(err);
            Assert.equal('Test', err.message);
            done();
        });
    });

    it('should handle empty reply', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestPipe) {
                requestPipe.reply();
            };
        })
        .use(function factory() {
            return function handler(requestPipe) {
                requestPipe.next();
            };
        })
        .create({
            retry: 2
        })({
            order: []
        }, function validateResponse(err, response) {
            Assert.ok(!err);
            Assert.ok(!response);
            done();
        });
    });

    it('should expose transport API', function (done) {
        function factory() {
            function tr(requestPipe) {

            }

            tr.api = function () {
                return {
                    hello: function () {},
                    bye: function () {}
                };
            };

            return tr;
        }

        var client = Trooba.transport(factory).create();
        Assert.ok(client.hello);
        Assert.ok(client.bye);
        done();
    });

    it('should expose transport API via interface', function (done) {
        function factory() {
            return function tr(requestPipe) {

            };
        }

        var client = Trooba.interface(function () {
            return {
                hello: function () {},
                bye: function () {}
            };
        }).transport(factory).create();
        Assert.ok(client.hello);
        Assert.ok(client.bye);
        done();
    });

    it('should expose transport API with config via interface', function (done) {
        function factory() {
            return function tr(requestPipe) {

            };
        }

        var client = Trooba.interface(function (config) {
            return function api(pipe) {
                Assert.equal('bar', config.foo);
                return {
                    hello: function () {},
                    bye: function () {}
                };
            };
        }, {
            foo: 'bar'
        }).transport(factory).create();
        Assert.ok(client.hello);
        Assert.ok(client.bye);
        done();
    });

    it('should call transport API and return runtime context', function () {
        function factory() {
            function tr(requestPipe) {
                requestPipe.reply(requestPipe.context.type +
                    ' ' + requestPipe.context.request);
            }

            tr.api = function (pipe) {
                return {
                    hello: function (name, callback) {
                        return pipe({
                            request: name,
                            type: 'hello'
                        })
                        .on('error', callback)
                        .on('response', callback.bind(null, null));
                    },
                    bye: function (name, callback) {
                        return pipe({
                            request: name,
                            type: 'bye'
                        })
                        .on('error', callback)
                        .on('response', callback.bind(null, null));
                    }
                };
            };

            return tr;
        }

        var client = Trooba.transport(factory).create();
        var ctx1 = client.hello('John', function (err, response) {
            Assert.equal('hello John', response);
        });
        Assert.ok(ctx1.context.request);

        var ctx2 = client.hello('Bob', function (err, response) {
            Assert.equal('hello Bob', response);
        });
        Assert.ok(ctx2.context.request);

        client.bye('John', function (err, response) {
            Assert.equal('bye John', response);
        });

        client.bye('Bob', function (err, response) {
            Assert.equal('bye Bob', response);
        });
    });

    it('should setup transport API via interface, do call and return runtime context', function (done) {
        function factory() {
            function tr(requestPipe) {
                requestPipe.reply(requestPipe.context.type +
                    ' ' + requestPipe.context.request);
            }

            return tr;
        }

        function api(pipe) {
            return {
                hello: function (name, callback) {
                    return pipe({
                        request: name,
                        type: 'hello'
                    }).on('response', function onResponse(response) {
                        callback(null, response);
                    });
                },
                bye: function (name, callback) {
                    return pipe({
                        request: name,
                        type: 'bye'
                    }).on('response', function onResponse(response) {
                        callback(null, response);
                    });
                }
            };
        }

        var client = Trooba.transport(factory).interface(api).create();
        var pipeRequest1 = client.hello('John', function (err, response) {
            Assert.equal('hello John', response);
        });
        Assert.ok(pipeRequest1.context.request);

        var pipeRequest2 = client.hello('Bob', function (err, response) {
            Assert.equal('hello Bob', response);
        });
        Assert.ok(pipeRequest2.context.request);

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
            var tra = function tra(requestPipe) {
                requestPipe.reply({
                    qaz: 'wer'
                });
            };

            tra.api = function api(pipe) {
                return {
                    request: function (req, callback) {
                        return pipe({
                            request: req
                        })
                        .on('response', function onResponse(response) {
                            callback(null, response);
                        });
                    }
                };
            };

            return tra;
        }

        var client = Trooba.transport(factory).create();

        client.request({
            foo: 'bar'
        }, function (err, res) {
            Assert.deepEqual({qaz: 'wer'}, res);
            done();
        });

    });

});
