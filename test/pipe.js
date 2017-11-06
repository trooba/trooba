'use strict';

var Assert = require('assert');
var Trooba = require('../pipe');

describe.only(__filename, function () {
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
        var client = pipe.create();
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
        var client = pipe.create();
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
        var client = pipe.create();
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

        var client = pipe.create();
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

        var client = pipe.create();
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

    it.skip('should receive message', function () {});

    it.skip('should skip message', function () {});
});
