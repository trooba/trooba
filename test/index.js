'use strict';

var Assert = require('assert');
var _ = require('lodash');
var Trooba = require('..');

describe(__filename, function () {
    it('should create transport from factory function', function () {
        var client = Trooba.transport(function () {
            return function tr(requestContext, responseContext) {
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

    it('should call transport without context', function (done) {
        Trooba.transport(function () {
            return function tr(requestContext, responseContext) {
                Assert.ok(requestContext);
                Assert.ok(responseContext);
                Assert.ok(requestContext.request);
                Assert.deepEqual({
                    foo: 'bar'
                }, requestContext.request);
                responseContext.next(null, {
                    qaz: 'qwe'
                });
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
            return function tr(requestContext, responseContext) {
                Assert.ok(requestContext);
                Assert.ok(responseContext);
                Assert.ok(requestContext.request);
                Assert.equal('thy', requestContext.fer);
                Assert.deepEqual({
                    foo: 'bar'
                }, requestContext.request);
                responseContext.next(null, {
                    qaz: 'qwe'
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
            return function tr(requestContext, responseContext) {
                responseContext.next(null, _.assign({
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

    it('should handle error', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, responseContext) {
                responseContext.next(new Error('Test Error'));
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
            return function tr(requestContext, responseContext) {
                responseContext.error = new Error('Test Error');
                responseContext.next();
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
            return function tr(requestContext, responseContext) {
                responseContext.next(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.request.rvb = 'zxc';
                requestContext.next();
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

    it('should call handler and return response', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, responseContext) {
                requestContext.request.rvb = 'zxc';
                requestContext.next();
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.request.dfg = 'cvb';
                responseContext.next(null, requestContext.request);
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
            return function tr(requestContext, responseContext) {
                requestContext.request.rvb = 'zxc';
                requestContext.next();
            };
        })
        .use(function factory(config) {
            return function handler(requestContext, responseContext) {
                requestContext.request.dfg = config.cfg;
                responseContext.next(null, requestContext.request);
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
            return function tr(requestContext, responseContext) {
                done(new Error('Should not happen'));
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                responseContext.next(new Error('Test Error'));
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
            return function tr(requestContext, responseContext) {
                requestContext.request.tra = 'asd';
                responseContext.next(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.request.fa1 = 'zx1';
                requestContext.next();
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.request.fa2 = 'zx2';
                requestContext.next();
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

    it('should handle requestContext.next in transport by switching it to responseContext.next implicitly', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, responseContext) {
                requestContext.request.tra = 'asd';
                requestContext.next(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.request.fa1 = 'zx1';
                requestContext.next();
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.request.fa2 = 'zx2';
                requestContext.next();
            };
        })
        .create()({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.deepEqual({
                tra: 'asd',
                fa1: 'zx1',
                fa2: 'zx2',
                foo: 'bar'
            }, response);
            done();
        });

    });

    it('should run a chain and fail due to double of responseContext.next', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, responseContext) {
                requestContext.request.tra = 'asd';
                responseContext.next(null, requestContext.request);
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.request.fa2 = 'zx2';
                requestContext.next();
                requestContext.next();
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
            done();

        });
    });

    it('should keep handlers order', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, responseContext) {
                requestContext.order.push('tr');
                responseContext.next(null, requestContext.order);
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx1');
                requestContext.next();
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx2');
                requestContext.next();
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx3');
                requestContext.next();
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
            return function tr(requestContext, responseContext) {
                requestContext.order.push('tr');
                responseContext.next(null, requestContext.order);
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx1-req');
                requestContext.next(function () {
                    requestContext.order.push('zx1-res');
                    responseContext.next();
                });
            };
        })
        .use(function factoryRetry() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx2-req');
                requestContext.next(function () {
                    requestContext.order.push('zx2-res');
                    if (requestContext.retry-- > 0) {
                        requestContext.order.push('retry');
                        requestContext.next();
                        return;
                    }
                    responseContext.next();
                });
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx3-req');
                requestContext.next(function () {
                    requestContext.order.push('zx3-res');
                    responseContext.next();
                });
            };
        })
        .create({
            order: [],
            retry: 1
        })({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.equal([
                'zx1-req',
                'zx2-req',
                'zx3-req',
                'tr',
                'zx3-res',
                'zx2-res',
                'retry',
                'zx2-req',
                'zx3-req',
                'tr',
                'zx3-res',
                'zx2-res',
                'zx1-res'
            ].toString(), response.toString());
            done();
        });
    });

    it('should keep handlers order with re-try', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, responseContext) {
                requestContext.order.push('tr');
                responseContext.next(null, requestContext.order);
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx1');
                requestContext.next();
            };
        })
        .use(function factoryRetry() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx2');
                requestContext.next(function () {
                    if (requestContext.retry-- > 0) {
                        requestContext.order.push('retry');
                        requestContext.next();
                        return;
                    }
                    responseContext.next();
                });
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx3');
                requestContext.next();
            };
        })
        .create({
            order: [],
            retry: 2
        })({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.equal([
                'zx1',
                'zx2',
                'zx3',
                'tr',
                'retry',
                'zx2',
                'zx3',
                'tr',
                'retry',
                'zx2',
                'zx3',
                'tr'
            ].toString(), response.toString());
            done();
        });
    });

    it('should append handler to the pipe after context and keep the order', function (done) {
        Trooba.transport(function (config) {
            return function tr(requestContext, responseContext) {
                requestContext.order.push('tr');
                responseContext.next(null, requestContext.order);
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx1');
                requestContext.next();
            };
        })
        .use(function factoryAppend() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx2');

                requestContext.use(function factory() {
                    return function handler(requestContext, responseContext) {
                        requestContext.order.push('zx21');
                        requestContext.next();
                    };
                });
                requestContext.use(function factory() {
                    return function handler(requestContext, responseContext) {
                        requestContext.order.push('zx22');
                        requestContext.next();
                    };
                });

                requestContext.next();
            };
        })
        .use(function factory() {
            return function handler(requestContext, responseContext) {
                requestContext.order.push('zx3');
                requestContext.next();
            };
        })
        .create({
            order: []
        })({
            foo: 'bar'
        }, function validateResponse(err, response) {
            Assert.equal(['zx1', 'zx2', 'zx21', 'zx22', 'zx3', 'tr'].toString(),
                response.toString());
            done();
        });
    });

    it('should expose transport API', function (done) {
        function factory() {
            function tr(requestContext, responseContext) {

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

    it('should call transport API', function () {
        function factory() {
            function tr(requestContext, responseContext) {
                responseContext.next(null,
                    requestContext.type + ' ' + requestContext.request);
            }

            tr.api = function (requestContext, responseContext) {
                return {
                    hello: function (name, callback) {
                        requestContext.request = name;
                        requestContext.type = 'hello';
                        requestContext.next(function () {
                            callback(responseContext.error, responseContext.response);
                        });
                    },
                    bye: function (name, callback) {
                        requestContext.request = name;
                        requestContext.type = 'bye';
                        requestContext.next(function () {
                            callback(responseContext.error, responseContext.response);
                        });
                    }
                };
            };

            return tr;
        }

        var client = Trooba.transport(factory).create();
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
            var tra = function tra(requestContext, responseContext) {
                responseContext.next(null, {
                    qaz: 'wer'
                });
            };

            tra.api = function api(requestContext, responseContext) {
                return {
                    request: function (req, callback) {
                        requestContext.request = req;
                        requestContext.next(callback);
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
