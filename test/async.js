/*jslint esversion:6 */
'use strict';

var Assert = require('assert');
var Trooba = require('../pipe');

describe(__filename, () => {
    it('should run request', next => {
        Trooba
        .use(require('../plugins/request-response'))
        .use(require('../plugins/koa'))
        .use(async (context, next) => {
            await next();
            Assert.equal('pong', context.response);
        })
        .use(context => {
            context.response = 'pong';
        })
        .build()
        .create()
        .request('ping', function (err, response) {
            Assert.equal('pong', response);
            next();
        });
    });

    it('should handle multiple get("request")', () => {

    });

    it('should handle errors with mutiple reads', () => {

    });

});
