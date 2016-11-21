'use strict';

var Assert = require('assert');
var NodeUtils = require('util');
var _ = require('lodash');
var Trooba = require('..');

describe(__filename, function () {
    it('should create transport from factory function', function () {
        var client = Trooba.transport(function () {
            return function tr(requestContext, reply) {
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
            return function inject(requestContext, action) {
                requestContext.transport = function tr(requestContext, reply) {
                    Assert.ok(requestContext);
                    Assert.ok(requestContext.request);
                    Assert.equal('function', typeof reply);
                    Assert.deepEqual({
                        foo: 'bar'
                    }, requestContext.request);

                    reply(null, {
                        qaz: 'qwe'
                    });
                };

                action.next();
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
        Trooba.transport(function () {
            return function tr(requestContext, reply) {
                Assert.ok(requestContext);
                Assert.ok(requestContext.request);
                Assert.equal('thy', requestContext.fer);
                Assert.deepEqual({
                    foo: 'bar'
                }, requestContext.request);

                reply({
                    response: {
                        qaz: 'qwe'
                    }
                });
            };
        }).create({
            fer: 'thy'
        })({
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

    it('should pass configuration to the transport', function (done) {
        Trooba.transport(function (config) {
            Assert.deepEqual({
                asd: 'zxc'
            }, config);
            return function tr(requestContext, reply) {
                reply(null, _.assign({
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
            return function tr(requestContext, reply) {
                reply(null, NodeUtils.format(requestContext.greeting,
                    requestContext.request));
            };
        })
        .interface(function apiFactory(config) {
            return function (pipe) {
                return {
                    hello: function (name, callback) {
                        pipe(function (requestContext, next) {
                            requestContext.greeting = config.greeting;
                            next(name, function (responseContext) {
                                callback(responseContext.error, responseContext.response);
                            });
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
            return function tr(requestContext, reply) {
                reply(new Error('Test Error'));
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
            return function tr(requestContext, reply) {
                reply({
                    error: new Error('Test Error')
                });
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

    it('should call handler', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, reply) {
                reply(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.rvb = 'zxc';
                action.next(requestContext);
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
            return function tr(requestContext, reply) {
                reply(null, requestContext.request);
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
            return function tr(requestContext, reply) {
                done(new Error('Should not happen'));
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.dfg = 'cvb';
                action.reply(null, requestContext.request);
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
            return function tr(requestContext, reply) {
                done(new Error('Should not happen'));
            };
        })
        .use(function factory(config) {
            return function handler(requestContext, action) {
                requestContext.request.dfg = config.cfg;
                action.reply(null, requestContext.request);
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

    it('should catch handle error', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, reply) {
                done(new Error('Should not happen'));
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                action.next(new Error('Test Error'));
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

    it('should execute a chain', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, reply) {
                requestContext.request.tra = 'asd';
                reply(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.fa1 = 'zx1';
                action.next(requestContext);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.fa2 = 'zx2';
                action.next(requestContext);
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
            return function tr(requestContext, reply) {
                requestContext.request.tra = 'asd';
                reply(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.fa1 = 'zx1';
                action.next();
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.fa2 = 'zx2';
                action.next();
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
            return function tr(requestContext, reply) {
                requestContext.request.chain.push('tr');
                reply(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.chain.push('i1');
                action.next(requestContext);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.chain.push('i2');
                action.next(requestContext);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.chain.push('i3');
                action.next(requestContext);
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

    it('should handle action.next(error) in transport by switching it to reply implicitly', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, reply) {
                done(new Error('should not happen'));
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                action.next(new Error('Test'));
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
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

    it('should handle double next (kind of streaming) as two chunks with action.next', function (done) {
        var count = 0;
        Trooba.transport(function (config) {
            return function tr(requestContext, reply) {
                requestContext.request.tra = 'asd';
                reply(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.fa2 = 'zx2';
                action.next(requestContext);
                action.next(requestContext);
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
            return function tr(requestContext, reply) {
                requestContext.order.push('tr');
                reply(null, requestContext.order);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.order.push('zx1');
                action.next(requestContext);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.order.push('zx2');
                action.next(requestContext);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.order.push('zx3');
                action.next(requestContext);
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

    it('should go full cycle', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, reply) {
                requestContext.request.order.push('tr');
                reply(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.order.push('zx1-req');
                action.next(requestContext, function (responseContext) {
                    responseContext.response.order.push('zx1-res');
                    action.reply(responseContext);
                });
            };
        })
        .use(function factoryRetry() {
            return function handler(requestContext, action) {
                requestContext.request.order.push('zx2-req');
                action.next(requestContext, function onResponse(responseContext) {
                    responseContext.response.order.push('zx2-res');
                    if (requestContext.retry-- > 0) {
                        requestContext.request.order = responseContext.response.order;
                        requestContext.request.order.push('retry');
                        action.next(requestContext, onResponse);
                        return;
                    }
                    action.reply(responseContext);
                });
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.order.push('zx3-req');
                action.next(requestContext, function (responseContext) {
                    responseContext.response.order.push('zx3-res');
                    action.reply(responseContext);
                });
            };
        })
        .create({
            retry: 1
        })({
            order: []
        }, function validateResponse(err, response) {
            Assert.equal([
                'zx1-req',
                'zx2-req',
                'zx3-req',
                'tr',
                'zx3-res',
                'zx2-res',
                'retry',
                'zx3-req',
                'tr',
                'zx3-res',
                'zx2-res',
                'zx1-res'
            ].toString(), response.order.toString());
            done();
        });
    });

    it('should keep handlers order with re-try plus implicit requestContext/responseContext propagation', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, reply) {
                requestContext.request.order.push('tr');
                reply(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.order.push('zx1');
                action.next();
            };
        })
        .use(function factoryRetry() {
            return function handler(requestContext, action) {
                requestContext.request.order.push('zx2');
                action.next(function onResponse(responseContext) {
                    if (requestContext.retry-- > 0) {
                        responseContext.response.order.push('retry');
                        requestContext.request.order = responseContext.response.order;
                        action.next(onResponse);
                        return;
                    }
                    action.reply();
                });
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                requestContext.request.order.push('zx3');
                action.next();
            };
        })
        .create({
            retry: 2
        })({
            order: []
        }, function validateResponse(err, response) {
            Assert.equal([
                'zx1',
                'zx2',
                'zx3',
                'tr',
                'retry',
                'zx3',
                'tr',
                'retry',
                'zx3',
                'tr'
            ].toString(), response.order.toString());
            done();
        });
    });

    it('should assign error to the implicit context if any', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, reply) {
                reply(null, 'bad content');
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                action.next(function () {
                    // simulate bad content decoding
                    action.reply(new Error('Test'));
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
            Assert.ok(response);
            done();
        });
    });

    it('should handle empty reply', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, reply) {
                reply();
            };
        })
        .use(function factory() {
            return function handler(requestContext, action) {
                action.next();
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
            function tr(requestContext, reply) {

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
            return function tr(requestContext, reply) {

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
            return function tr(requestContext, reply) {

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
            function tr(requestContext, reply) {
                reply(null,
                    requestContext.type + ' ' + requestContext.request);
            }

            tr.api = function (pipe) {
                return {
                    hello: function (name, callback) {
                        return pipe(function ctx(requestContext, next) {
                            requestContext.request = name;
                            requestContext.type = 'hello';

                            next(function onResponse(responseContext) {
                                callback(responseContext.error, responseContext.response);
                            });
                        });
                    },
                    bye: function (name, callback) {
                        return pipe(function ctx(requestContext, next) {
                            requestContext.request = name;
                            requestContext.type = 'bye';

                            next(function onResponse(responseContext) {
                                callback(responseContext.error, responseContext.response);
                            });
                        });
                    }
                };
            };

            return tr;
        }

        var client = Trooba.transport(factory).create();
        var ctx1 = client.hello('John', function (err, response) {
            Assert.equal('hello John', response);
        });
        Assert.ok(ctx1.request);

        var ctx2 = client.hello('Bob', function (err, response) {
            Assert.equal('hello Bob', response);
        });
        Assert.ok(ctx2.request);

        client.bye('John', function (err, response) {
            Assert.equal('bye John', response);
        });

        client.bye('Bob', function (err, response) {
            Assert.equal('bye Bob', response);
        });
    });

    it('should setup transport API via interface, do call and return runtime context', function () {
        function factory() {
            function tr(requestContext, reply) {
                reply(null,
                    requestContext.type + ' ' + requestContext.request);
            }

            return tr;
        }

        function api(pipe) {
            return {
                hello: function (name, callback) {
                    return pipe(function ctx(requestContext, next) {
                        requestContext.request = name;
                        requestContext.type = 'hello';

                        next(function onResponse(responseContext) {
                            callback(responseContext.error, responseContext.response);
                        });
                    });
                },
                bye: function (name, callback) {
                    return pipe(function ctx(requestContext, next) {
                        requestContext.request = name;
                        requestContext.type = 'bye';

                        next(function onResponse(responseContext) {
                            callback(responseContext.error, responseContext.response);
                        });
                    });
                }
            };
        }

        var client = Trooba.transport(factory).interface(api).create();
        var ctx1 = client.hello('John', function (err, response) {
            Assert.equal('hello John', response);
        });
        Assert.ok(ctx1.request);

        var ctx2 = client.hello('Bob', function (err, response) {
            Assert.equal('hello Bob', response);
        });
        Assert.ok(ctx2.request);

        client.bye('John', function (err, response) {
            Assert.equal('bye John', response);
        });

        client.bye('Bob', function (err, response) {
            Assert.equal('bye Bob', response);
        });


    });


    it('should handle mock trasport', function (done) {
        function factory() {
            var tra = function tra(requestContext, reply) {
                reply(null, {
                    qaz: 'wer'
                });
            };

            tra.api = function api(pipe) {
                return {
                    request: function (req, callback) {
                        return pipe(function ctx(requestContext, next) {
                            requestContext.request = req;
                            next(function onResponse(responseContext) {
                                callback(responseContext.error, responseContext.response);
                            });
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
