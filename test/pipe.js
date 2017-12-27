'use strict';

var Assert = require('assert');
var Trooba = require('../pipe');

describe(__filename, function () {
    it('should build simple pipe and send message', function (next) {
        var arr = [];
        var pipe = Trooba
        .use(function one(pipe) {
            arr.push('one');
        })
        .use(function two(pipe) {
            arr.push('two');
        })
        .use(function three(pipe) {
            arr.push('three');
        });

        Assert.ok(pipe.factories);
        var client = pipe.build().create();
        Assert.ok(client);

        // should create first pipe point
        Assert.deepEqual([], arr);
        client.send('request', 'request');
        setImmediate(function () {
            Assert.deepEqual(['one', 'two', 'three'], arr);
            next();
        });
    });

    it('should build simple pipe out of trooba constructor', function (next) {
        var arr = [];
        var pipe = new Trooba()
        .use(function one(pipe) {
            arr.push('one');
        })
        .use(function two(pipe) {
            arr.push('two');
        })
        .use(function three(pipe) {
            arr.push('three');
        });

        Assert.ok(pipe.factories);
        var client = pipe.build().create();
        Assert.ok(client);

        // should create first pipe point
        Assert.deepEqual([], arr);
        client.send('request', 'request');
        setImmediate(function () {
            Assert.deepEqual(['one', 'two', 'three'], arr);
            next();
        });
    });

    it('should send multiple messages in the same pipe', function (next) {
        var arr = [];
        var pipe = Trooba
        .use(function one(pipe) {
            arr.push('one');
        })
        .use(function two(pipe) {
            arr.push('two');
        })
        .use(function three(pipe) {
            arr.push('three');
        });

        Assert.ok(pipe.factories);
        var client = pipe.build().create();
        Assert.ok(client);

        // should create first pipe point
        Assert.deepEqual([], arr);
        client.send('request', 'request');
        setImmediate(function () {
            client.send('request', 'request');
            setImmediate(function () {
                Assert.deepEqual(['one', 'two', 'three'], arr);
                next();
            });
        });
    });

    it('should re-use built pipe with different contexts', function (next) {
        var arr = [];
        var pipe = Trooba
        .use(function one(pipe) {
            arr.push('one');
        })
        .use(function two(pipe) {
            arr.push('two');
        })
        .build();

        // should create first pipe point
        Assert.deepEqual([], arr);
        pipe.create().send('request');
        pipe.create().send('request');
        setImmediate(function () {
            Assert.deepEqual(['one', 'one', 'two', 'two'], arr);
            next();
        });
    });

    it('should link two pipes together', function (next) {
        var arr = [];
        var pipe = Trooba
        .use(function one() {
            arr.push('one');
        })
        .use(function two() {
            arr.push('two');
        })
        .use(function () {
            return Trooba
            .use(function three() {
                arr.push('three');
            })
            .use(function four() {
                arr.push('four');
            });
        })
        .use(function five() {
            arr.push('five');
        });

        Assert.ok(pipe.factories);
        var client = pipe.build().create();
        Assert.ok(client);

        // should create first pipe point
        Assert.deepEqual([], arr);
        client.send('request', 'request');
        setImmediate(function () {
            Assert.deepEqual(['one', 'two', 'three', 'four', 'five'], arr);
            next();
        });
    });

    it('should trace simple pipe', function (next) {
        var arr = [];
        var pipe = Trooba
        .use(function one() {
        })
        .use(function two() {
        })
        .use(function three() {
        });

        var client = pipe.build().create();
        client.trace(function (point) {
            arr.push(point.name);
        });
        setImmediate(function () {
            Assert.deepEqual(['one', 'two', 'three', 'two', 'one', 'head'], arr);
            next();
        });
    });

    it('should trace linked pipes', function (next) {
        var arr = [];
        var pipe = Trooba
        .use(function one() {
        })
        .use(function two() {
        })
        .use(function link() {
            return Trooba
            .use(function three() {
            })
            .use(function four() {
            });
        })
        .use(function five() {
        });

        var client = pipe.build().create();
        client.trace(function (point) {
            arr.push(point.name);
        });
        setImmediate(function () {
            Assert.deepEqual([
                'one',
                'two',
                'link',
                'head',
                'three',
                'four',
                'five',
                'four',
                'three',
                'head',
                'link',
                'two',
                'one',
                'head'
            ], arr);
            next();
        });
    });

    it('should propagate error through linked pipes', function (next) {
        var arr = [];
        var pipe = Trooba
        .use(function one(pipe) {
            pipe.on('error', function (err, next) {
                arr.push('one');
                next();
            });
        })
        .use(function two(pipe) {
            pipe.on('error', function (err, next) {
                arr.push('two');
                next();
            });
        })
        .use(function () {
            return Trooba
            .use(function three(pipe) {
                pipe.on('error', function (err, next) {
                    arr.push('three');
                    next();
                });
            })
            .use(function four(pipe) {
                pipe.on('error', function (err, next) {
                    arr.push('four');
                    next();
                });
            });
        })
        .use(function five(pipe) {
            pipe.on('request', function () {
                arr.push('five');
                pipe.throw(new Error('Boom'));
            });
        });

        pipe.build().create().send('request')
        .on('error', function (err) {
            Assert.deepEqual(['five', 'four', 'three', 'two', 'one'], arr);
            next();
        });
    });

    it('should decorate pipe instance', function (next) {
        var arr = [];
        Trooba
        .use(function one(pipe) {
            Assert.equal(undefined, pipe.one);
            Assert.equal(undefined, pipe.two);
            pipe.decorate('one', function () {
                return function () {
                    arr.push('one');
                };
            });
            Assert.equal('function', typeof pipe.one);
            pipe.decorate('two', function () {
                return function () {
                    arr.push('two');
                };
            });
            Assert.equal('function', typeof pipe.two);
        })
        .use(function two(pipe) {
            Assert.equal('function', typeof pipe.one);
            Assert.equal('function', typeof pipe.two);
            pipe.decorate('three', function () {
                return function () {
                    arr.push('three');
                };
            });
        })
        .use(function three(pipe) {
            pipe.one();
            pipe.two();
            pipe.three();
            Assert.deepEqual(['one', 'two', 'three'], arr);
            next();
        })
        .build()
        .create()
        .send('request');
    });

    it('should decorate already decorated method', function (next) {
        var arr = [];
        Trooba
        .use(function one(pipe) {
            Assert.equal(undefined, pipe.one);
            pipe.decorate('one', function (original) {
                return function () {
                    arr.push('one');
                };
            });
        })
        .use(function anotherOne(pipe) {
            Assert.equal('function', typeof pipe.one);
            pipe.one();
            pipe.decorate('one', function (original) {
                return function () {
                    arr.push('another one');
                };
            }, true);
        })
        .use(function three(pipe) {
            pipe.one();
            Assert.deepEqual(['one', 'another one'], arr);
            next();
        })
        .build()
        .create()
        .send('request');
    });

    it('should fail to decorate with duplicate method', function (next) {
        Trooba
        .use(function one(pipe) {
            pipe.decorate('one', function () {});
            Assert.throws(function () {
                pipe.decorate('one', function () {});
            }, /The method "one" is already present/);
            next();
        })
        .build()
        .create()
        .send('request');
    });

    it('should fail to decorate with duplicate from prototype', function (next) {
        Trooba
        .use(function one(pipe) {
            Assert.throws(function () {
                pipe.decorate('on', function () {});
            }, /The method "on" is already present/);
            next();
        })
        .build()
        .create()
        .send('request');
    });

    it('should define a custom interface', function (next) {
        var handler = function one(pipe) {
            next();
        };

        handler.interfaces = {
            customApi: function (pipe, callback) {
                return {
                    hello: function () {
                        return pipe.create().send('request');
                    }
                };
            }
        };

        var client = Trooba
        .use(handler)
        .build()
        .create('customApi');

        client.hello();
    });

    it('should define a custom interface with config', function (next) {
        var handler = function one(pipe) {
            next();
        };

        handler.interfaces = {
            customApi: function (pipe, callback) {
                return {
                    hello: function () {
                        return pipe.create().send('request');
                    }
                };
            }
        };

        var client = Trooba
        .use(handler, {

        })
        .build()
        .create('customApi');

        client.hello();
    });

    it('should complain when a duplicate interface is added', function () {
        Assert.throws(function () {
            Trooba
            .use({
                interfaces: {
                    customApi: function () {}
                }
            })
            .use({
                interfaces: {
                    customApi: function () {}
                }
            });
        }, /The implementation for "customApi" have already been registered/);
    });

    it('should allow to catch events via "on" interceptors', function (done) {
        var count = 0;
        var resCount = 0;
        var pipe = Trooba
        .use(function (pipe) {
            pipe.on('ping', function (request) {
                Assert.equal(1, request);
                resCount++;
                pipe.send('pong', 2, 2);
                pipe.resume();
            });
        })
        .build()
        .create();

        pipe.send('ping', 1)

        .on('error', done)
        .on('pong', function (response, next) {
            Assert.equal(2, response);
            Assert.equal(2, response);
            if (++count === 2) {
                Assert.equal(2, resCount);
                done();
            }
            next();
        });

        pipe.send('ping', 1);
    });

    it('should catch events only "once" in request flow', function (next) {
        var resCount = 0;
        var pipe = Trooba
        .use(function (pipe) {
            pipe.once('ping', function (request) {
                Assert.equal(1, request);
                resCount++;
                pipe.send('pong', 2, 2);
            });
        })
        .build()
        .create();

        pipe.send('ping', 1)
        .on('error', next)
        .on('pong', function (response) {
            Assert.equal(2, response);
            Assert.equal(2, response);
            setTimeout(function () {
                Assert.equal(1, resCount);
                next();
            });
        });

        pipe.send('ping', 1);
    });

    it('should catch events only "once" on way back', function (next) {
        var resCount = 0;
        var count = 0;
        var pipe = Trooba
        .use(function (pipe) {
            pipe.on('ping', function (request) {
                Assert.equal(1, request);
                resCount++;
                pipe.send('pong', 2, 2);
                pipe.resume();
            });
        })
        .build()
        .create();

        pipe.send('ping', 1)
        .on('error', next)
        .once('pong', function (response) {
            count++;
            Assert.equal(2, response);
            Assert.equal(2, response);
            setTimeout(function () {
                Assert.equal(2, resCount);
                Assert.equal(1, count);
                next();
            });
        });

        pipe.send('ping', 1);
    });

    it('should receive the whole message', function (next) {
        Trooba
        .use(function (pipe) {
            pipe.on('*', function (msg) {
                Assert.deepEqual({
                    origin: msg.origin,
                    data: undefined,
                    sync: false,
                    direction: 1,
                    position: 1,
                    session: undefined,
                    type: 'ping'
                }, msg);

                Assert.equal('function', typeof msg.next);
                next();
            });
        })
        .build()
        .create()
        .send('ping');
    });

    it('should receive message data', function (next) {
        Trooba
        .use(function (pipe) {
            pipe.on('ping', function (data) {
                Assert.equal('foo', data);
                next();
            });
        })
        .build()
        .create()
        .send('ping', 'foo');
    });

    it('should skip message', function (next) {
        Trooba
        .use(function (pipe) {
            pipe.on('pong', function () {
                next(new Error('Should not happen'));
            });
        })
        .use(function (pipe) {
            pipe.on('ping', function () {
                next();
            });
        })
        .build()
        .create()
        .send('ping');
    });

    it('should support mixed runtimes based on annotations', function (next) {
        var injectRuntimes = {
            decorate: function (pipe) {
                pipe.runtimes.r1 = function (fn) {
                    this.on('ping', function (data, next) {
                        fn({
                            runtime: 'r1',
                            data: data
                        }, next);
                    });
                };
                pipe.runtimes.r2 = function (fn) {
                    this.on('ping', function (data, next) {
                        fn({
                            runtime: 'r2',
                            data: data
                        }, next);
                    });
                };
            }
        };

        var events = [];

        var handlerR1 = Object.assign(function (ctx, next) {
            events.push(ctx.runtime);
            next();
        }, {
            attributes: {
                runtime: 'r1'
            }
        });

        var handlerR2 = Object.assign(function (ctx, next) {
            events.push(ctx.runtime);
            next();
        }, {
            attributes: {
                runtime: 'r2'
            }
        });

        Trooba
        .use(injectRuntimes)
        .use(handlerR1)
        .use(handlerR2)
        .use(function (pipe) {
            pipe.on('ping', function () {
                Assert.deepEqual(['r1', 'r2'], events);
                next();
            });
        })
        .build()
        .create()
        .send('ping');
    });

    it('should support mixed runtimes based on annotations with default runtime', function (next) {
        var injectRuntimes = {
            decorate: function (pipe) {
                pipe.runtimes.r1 = function (fn) {
                    this.on('ping', function (data, next) {
                        fn({
                            runtime: 'r1',
                            data: data
                        }, next);
                    });
                };
                pipe.runtimes.r2 = function (fn) {
                    this.on('ping', function (data, next) {
                        fn({
                            runtime: 'r2',
                            data: data
                        }, next);
                    });
                };
            }
        };

        var events = [];

        var handlerR1 = function (ctx, next) {
            events.push(ctx.runtime);
            next();
        };

        var handlerR2 = Object.assign(function (ctx, next) {
            events.push(ctx.runtime);
            next();
        }, {
            attributes: {
                runtime: 'r2'
            }
        });

        Trooba
        .use(injectRuntimes)
        .use(handlerR1)
        .use(handlerR2)
        .use(function () {
            Assert.deepEqual(['r1', 'r2'], events);
            next();
        })
        .build()
        .create({
            runtime: 'r1'
        })
        .send('ping');
    });

    it('should fail with runtime not found', function (next) {

        var handlerR2 = Object.assign(function () {}, {
            attributes: {
                runtime: 'r2'
            }
        });

        var pipe = Trooba
        .use(handlerR2)
        .build()
        .create();

        Assert.throws(function () {
            pipe.send('ping');
        }, /Cannot find runtime "r2"/);
        next();
    });

    it('should send a series of messages and preserve their order', function (done) {
        var MAX = 100;
        var events = [];
        var expected = [];
        var pipe = Trooba
        .use(function (pipe) {
            pipe.on('message', function (msg, next) {
                expected.push(msg);
                next();
            });
        })
        .use(function (pipe) {
            pipe.on('message', function (msg, next) {
                setTimeout(function () {
                    next();
                }, 10 * Math.random());
            });
        })
        .use(function (pipe) {
            pipe.on('message', function (msg, next) {
                events.push(msg);
                if (events.length === MAX) {
                    Assert.deepEqual(expected, events);
                    done();
                }
                next();
            });
        })
        .build()
        .create();

        for (var i = 0; i < MAX; i++) {
            pipe.send('message', 'm' + i);
        }
    });

    it('should send a series of sync messages and preserve their order', function (done) {
        var MAX = 100;
        var events = [];
        var expected = [];
        var pipe = Trooba
        .use(function (pipe) {
            pipe.on('message', function (msg, next) {
                expected.push(msg);
                next(); // will be ignored
                next(); // will be ignored
            });
        })
        .use(function (pipe) {
            pipe.on('cork', function (msg, next) {
                setTimeout(function () {
                    next();
                }, 10 * Math.random());
            });
        })
        .use(function (pipe) {
            pipe.on('cork', function (msg, next) {
                Assert.equal('cork', msg);
                next();
            });
            pipe.on('message', function (msg, next) {
                events.push(msg);
                if (events.length === MAX) {
                    Assert.deepEqual(expected, events);
                    done();
                }
            });
        })
        .build()
        .create();

        for (var i = 0; i < MAX; i++) {
            pipe.send({
                type: 'message',
                data: 'm' + i,
                sync: true
            });
            pipe.send('cork', 'cork');
        }
    });

    it('should receive a series of messages and preserve their order', function (done) {
        var MAX = 100;
        var events = [];
        var expected = [];
        var pipe = Trooba
        .use(function (pipe) {
            pipe.on('message', function (msg, next) {
                setTimeout(function () {
                    next();
                }, 10 * Math.random());
            });
        })
        .use(function (pipe) {
            pipe.on('message', function (msg, next) {
                expected.push(msg);
                next();
            });
        })
        .use(function (pipe) {
            pipe.on('start', function (msg, next) {
                for (var i = 0; i < MAX; i++) {
                    pipe.send({
                        type: 'message',
                        data: 'm' + i,
                        direction: 2
                    });
                }
            });
        })
        .build()
        .create();

        pipe.send('start');
        pipe.on('message', function (msg, next) {
            events.push(msg);
            if (events.length === MAX) {
                Assert.deepEqual(expected, events);
                done();
            }
            next();
        });
    });

    it('should receive a series of sync messages and preserve their order', function (done) {
        var MAX = 100;
        var events = [];
        var expected = [];
        var pipe = Trooba
        .use(function (pipe) {
            pipe.on('cork', function (msg, next) {
                setTimeout(function () {
                    next();
                }, 10 * Math.random());
            });
        })
        .use(function (pipe) {
            pipe.on('message', function (msg, next) {
                expected.push(msg);
            });
        })
        .use(function (pipe) {
            pipe.on('start', function (msg, next) {
                for (var i = 0; i < MAX; i++) {
                    pipe.send({
                        type: 'message',
                        data: 'm' + i,
                        direction: 2,
                        sync: true
                    });
                    pipe.send('cork', 'cork', 2);
                }
            });
        })
        .build()
        .create();

        pipe.send('start');
        pipe.on('message', function (msg, next) {
            events.push(msg);
            if (events.length === MAX) {
                Assert.deepEqual(expected, events);
                done();
            }
            next();
        });
    });

    it('should throw error if no handlers have been registered', function () {
        Assert.throws(function () {
            Trooba
            .use({})
            .build()
            .create({
                validate: {
                    request: true
                }
            });
        }, /No handlers have been registered/);
    });
});
