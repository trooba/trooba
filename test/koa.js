/*jslint esversion:6 */
'use strict';

var Assert = require('assert');
var Trooba = require('../pipe');

describe(__filename, () => {

    it('simple request', next => {
        Trooba
        .use(require('../plugins/request-response'))
        .use(require('../plugins/koa'))
        .use(context => {
            context.response = 'pong';
        })
        .build()
        .create({
            runtime: 'koa'
        })
        .request('ping', function (err, response) {
            Assert.equal('pong', response);
            next();
        });
    });

    it('complex request', next => {
        var path = [];
        Trooba
        .use(require('../plugins/request-response'))
        .use(require('../plugins/koa'))
        .use(async (context, next) => {
            path.push('b1');
            await next();
            path.push('a1');
            Assert.equal('pong', context.response);
        })
        .use(context => {
            path.push('b2');
            context.response = 'pong';
            path.push('a2');
        })
        .build()
        .create({
            runtime: 'koa'
        })
        .request('ping', function (err, response) {
            Assert.equal('pong', response);
            Assert.deepEqual(['b1', 'b2', 'a2', 'a1'], path);
            next();
        });
    });

    it('should retry request', next => {
        var path = [];
        Trooba
        .use(require('../plugins/request-response'))
        .use(require('../plugins/koa'))
        .use(async (context, next) => {
            path.push('b0');
            await next();
            await next();
            path.push('a0');
        })
        .use(async (context, next) => {
            path.push('b1');
            await next();
            path.push('a1');
            Assert.equal('pong', context.response);
        })
        .use(context => {
            path.push('b2');
            context.response = 'pong';
            path.push('a2');
        })
        .build()
        .create({
            runtime: 'koa'
        })
        .request('ping', function (err, response) {
            Assert.equal('pong', response);
            Assert.deepEqual(['b0', 'b1', 'b2', 'a2', 'a1', 'b1', 'b2', 'a2', 'a1', 'a0'], path);
            next();
        });
    });

    it('should retry after error', next => {
        var errorThrown = false;
        var path = [];
        Trooba
        .use(require('../plugins/request-response'))
        .use(require('../plugins/koa'))
        .use(async (context, next) => {
            path.push('b0');
            try {
                await next();
            }
            catch (err) {
                Assert.equal('Boom', err.message);
                await next();
            }
            path.push('a0');
        })
        .use(async (context, next) => {
            path.push('b1');
            await next();
            // when error happens this will be skipped
            path.push('a1');
            Assert.equal('pong', context.response);
        })
        .use(context => {
            path.push('b2');
            if (errorThrown) {
                context.response = 'pong';
            }
            else {
                errorThrown = true;
                throw new Error('Boom');
            }
            path.push('a2');
        })
        .build()
        .create({
            runtime: 'koa'
        })
        .request('ping', function (err, response) {
            Assert.equal('pong', response);
            Assert.deepEqual(['b0', 'b1', 'b2', 'b1', 'b2', 'a2', 'a1', 'a0'], path);
            next();
        });
    });

    it('should propagate an error', next => {
        Trooba
        .use(require('../plugins/request-response'))
        .use(require('../plugins/koa'))
        .use(async (context, next) => {
            await next();
        })
        .use(context => {
            throw new Error('Boom');
        })
        .build()
        .create({
            runtime: 'koa'
        })
        .request('ping', function (err, response) {
            Assert.ok(err);
            Assert.equal('Boom', err.message);
            next();
        });
    });

    it('should catch an error', next => {
        Trooba
        .use(require('../plugins/request-response'))
        .use(require('../plugins/koa'))
        .use(async (context, next) => {
            try {
                await next();
            }
            catch (err) {
                Assert.equal('Boom', err.message);
                throw new Error('Re-throw');
            }
        })
        .use(context => {
            throw new Error('Boom');
        })
        .build()
        .create({
            runtime: 'koa'
        })
        .request('ping', function (err, response) {
            Assert.ok(err);
            Assert.equal('Re-throw', err.message);
            next();
        });
    });

    it('should catch error thrown in async function', next => {
        Trooba
        .use(require('../plugins/request-response'))
        .use(require('../plugins/koa'))
        .use(async (context, next) => {
            await next();
            Assert.equal('pong', context.response);
        })
        .use(async context => {
            throw new Error('Boom');
        })
        .build()
        .create({
            runtime: 'koa'
        })
        .request('ping', function (err, response) {
            Assert.ok(err);
            Assert.equal('Boom', err.message);
            next();
        });
    });

    it('should handle mixed handlers, koa and generic based on annotation', next => {
        function annotate(an, fn) {
            Object.assign(fn, an);
            return fn;
        }

        var path = [];
        Trooba
        .use(require('../plugins/request-response'))
        .use(require('../plugins/koa'))
        .use(annotate({runtime:'generic'}, pipe => {
            pipe.on('request', (request, next) => {
                path.push('b0');
                pipe.once('response', (response, next) => {
                    // retry
                    pipe.once('response', (response, next) => {
                        // continue
                        path.push('a0');
                        next();
                    })
                    pipe.request(request);
                })
                next();
            })
        }))
        .use(async (context, next) => {
            path.push('b1');
            await next();
            path.push('a1');
            Assert.equal('pong', context.response);
        })
        .use(context => {
            path.push('b2');
            context.response = 'pong';
            path.push('a2');
        })
        .build()
        .create({
            runtime: 'koa'
        })
        .request('ping', function (err, response) {
            Assert.equal('pong', response);
            Assert.deepEqual(['b0', 'b1', 'b2', 'a2', 'a1', 'b1', 'b2', 'a2', 'a1', 'a0'], path);
            next();
        });

    });
});
