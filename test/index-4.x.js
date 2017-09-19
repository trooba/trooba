/*jshint esversion:6 */
'use strict';

var Assert = require('assert');
var Trooba = require('..');

describe(__filename, function () {
    it('should not fail when arrow function is used in handlers', function (next) {
        Trooba
        .use(pipe => pipe.on('request', request => {
            pipe.respond('pong');
        }))
        .build()
        .create()
        .request('ping', (err, response) => {
            Assert.ok(!err);
            Assert.equal('pong', response);
            next();
        });
    });
});
