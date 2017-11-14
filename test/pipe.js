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

    it('should decorate pipe instance', function (next) {
        var arr = [];
        Trooba
        .use(function one(pipe) {
            Assert.equal(undefined, pipe.one);
            Assert.equal(undefined, pipe.two);
            pipe.decorate('one', function () {
                arr.push('one');
            });
            Assert.equal('function', typeof pipe.one);
            pipe.decorate('two', function () {
                arr.push('two');
            });
            Assert.equal('function', typeof pipe.two);
        })
        .use(function two(pipe) {
            Assert.equal('function', typeof pipe.one);
            Assert.equal('function', typeof pipe.two);
            pipe.decorate('three', function () {
                arr.push('three');
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

    it('should decorate with request/response', function (next) {
        Trooba
        .use(require('../plugins/request-response'))
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                pipe.respond('pong');
            });
        })
        .build()
        .create()
        .request('ping', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('pong', response);
            next();
        });
    });

    it('should do request/response with retry', function (next) {
        var reqCounter = 0;
        var resCounter = 0;

        Trooba
        .use(require('../plugins/request-response'))
        .use(function (pipe) {
            var retry = true;
            var _request;
            pipe.on('request', function (request, next) {
                _request = request;
                next();
            });
            pipe.on('response', function (response, next) {
                resCounter++;
                Assert.equal('ping', _request);
                Assert.equal('pong', response);
                if (retry) {
                    retry = false;
                    pipe.request(_request);
                    return;
                }
                next();
            });
        })
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                reqCounter++;
                pipe.respond('pong');
            });
        })
        .build()
        .create()
        .request('ping', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('pong', response);
            Assert.equal(2, reqCounter);
            Assert.equal(2, resCounter);
            next();
        });
    });

    it.skip('should do request/response and error during retry', function (next) {
        var reqCounter = 0;
        var resCounter = 0;

        Trooba
        .use(require('../plugins/request-response'))
        .use(function (pipe) {
            var retry = true;
            var _request;
            pipe.on('request', function (request, next) {
                _request = request;
                next();
            });
            pipe.on('response', function (response, next) {
                resCounter++;
                Assert.equal('ping', _request);
                Assert.equal('pong', response);
                if (retry) {
                    retry = false;
                    pipe.request(_request);
                }
                next();
            });
        })
        .use(function (pipe) {
            pipe.on('request', function (request) {
                Assert.equal('ping', request);
                reqCounter++;
                pipe.respond('pong');
            });
        })
        .build()
        .create()
        .request('ping', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('pong', response);
            Assert.equal(2, reqCounter);
            Assert.equal(2, resCounter);
            next();
        });
    });

    it('should allow to catch events via "on" interceptors', function (next) {
        var count = 0;
        var resCount = 0;
        var pipe = Trooba
        .use(function (pipe) {
            pipe.on('ping', function (request) {
                Assert.equal(1, request);
                resCount++;
                pipe.send('pong', 2, 2);
            });
        })
        .build()
        .create();

        pipe.send('ping', 1)
        .on(next)
        .on('pong', function (response) {
            Assert.equal(2, response);
            Assert.equal(2, response);
            if (++count === 2) {
                Assert.equal(2, resCount);
                next();
            }
        });

        pipe.send('ping', 1);
    });

    it('should catch events only "once"', function (next) {
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
        .on(next)
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
            });
        })
        .build()
        .create();

        pipe.send('ping', 1)
        .on(next)
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

    it('should decorate with complex path');

    it.skip('should receive the whole message', function () {});

    it.skip('should receive message', function () {});

    it.skip('should skip message', function () {});

    it.skip('should support mixed runtimes based on annotations', function () {});

    it.skip('should send a series of messages and preserve their order', function () {});

    it.skip('should send a series of oneway messages and preserve their order', function () {});

    it.skip('should receive oneway message sooner then the rest', function () {});

    describe('streaming', function () {
        it('should do empty request stream', function (next) {
            var events = [];

            Trooba
            .use(require('../plugins/request-response'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual([], buffer);
                        pipe.respond('pong');
                        return;
                    }
                    buffer.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('pong', response);
                next();
            })
            .end();
        });

        it('should request stream with data in the end', function (next) {
            var events = [];

            Trooba
            .use(require('../plugins/request-response'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual(['foo'], buffer);
                        pipe.respond('pong');
                        return;
                    }
                    buffer.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('pong', response);
                next();
            })
            .end('foo');
        });

        it('should do simple request stream', function (next) {
            var events = [];

            Trooba
            .use(require('../plugins/request-response'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual(['foo', 'bar'], buffer);
                        pipe.respond('pong');
                        return;
                    }
                    buffer.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('pong', response);
                next();
            })
            .write('foo')
            .write('bar')
            .end();
        });

        it('should do complex request stream', function (next) {
            var events = [];

            Trooba
            .use(require('../plugins/request-response'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('request:' + request);
                    next();
                });
                pipe.on('response', function (response, next) {
                    events.push('response:' + response);
                    next();
                });
            })
            .use(function (pipe) {
                pipe.on('request:data', function (data, next) {
                    events.push('request:data:' + data);
                    next();
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual([
                            'request:ping',
                            'request:data:foo',
                            'request:data:bar',
                            'request:data:undefined',
                            'transport:ping'
                        ], events);
                        Assert.deepEqual(['foo', 'bar'], buffer);
                        pipe.respond('pong');
                        return;
                    }
                    buffer.push(data);
                    next();
                });
            })
            .build()
            .create()
            .request('ping', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('pong', response);
                next();
            })
            .write('foo')
            .write('bar')
            .end();
        });

        it('should do empty response stream', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('../plugins/request-response'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.respond('pong')
                    .end();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual([], buffer);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should do response stream with data in the end', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('../plugins/request-response'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.respond('pong')
                    .end('foo');
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(['foo'], buffer);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should do simple response stream', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('../plugins/request-response'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.respond('pong')
                    .write('foo')
                    .write('bar')
                    .end();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(['foo', 'bar'], buffer);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should do complex response stream', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('../plugins/request-response'))
            .use(function (pipe) {
                pipe.on('response', function (response, next) {
                    events.push('response:' + response);
                    next();
                });
                pipe.on('response:data', function (data, next) {
                    events.push('response:data:' + data);
                    next();
                });
            })
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.respond('pong')
                    .write('foo')
                    .write('bar')
                    .end();
                });
            })
            .build()
            .create()
            .request('ping')
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(['foo', 'bar'], buffer);
                    Assert.deepEqual([
                        'transport:ping',
                        'response:pong',
                        'response:data:foo',
                        'response:data:bar',
                        'response:data:undefined'
                    ], events);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });
        });

        it('should do request and response streams', function (done) {
            var events = [];
            var buffer = [];
            var _response;

            Trooba
            .use(require('../plugins/request-response'))
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    events.push('transport:' + request);
                    pipe.resume();
                });

                var buffer = [];

                pipe.on('request:data', function (data, next) {
                    if (data === undefined) {
                        Assert.deepEqual(['foo', 'bar'], buffer);

                        respond();

                        return;
                    }
                    buffer.push(data);
                    next();
                });

                function respond() {
                    pipe.respond('pong')
                    .write('foo')
                    .write('bar')
                    .end();
                }
            })
            .build()
            .create()
            .request('ping')
            .write('foo')
            .write('bar')
            .end()
            .on('response', function (response, next) {
                _response = response;
                next();
            })
            .on('response:data', function (data, next) {
                if (data === undefined) {
                    Assert.deepEqual(['foo', 'bar'], buffer);
                    Assert.equal('pong', _response);
                    done();
                    return;
                }
                buffer.push(data);
                next();
            });

        });
    });
});
