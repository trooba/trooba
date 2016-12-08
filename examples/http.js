/*jslint esversion:6 */
'use strict';

var Http = require('http');
var Querystring = require('querystring');
var Trooba = require('.');

function transportFactory() {
    function transport(pipe, config) {
        pipe.on('request', function (request) {
            var qs = '?' + Querystring.stringify(request);
            var options = {
                protocol: config.protocol,
                hostname: config.hostname,
                path: config.path ?
                    config.path += qs : qs
            };
            // prepare request
            var req = Http.request(options, function (res) {
                var data = '';
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    data += chunk;
                });
                res.on('end', function () {
                    res.body = data;
                    pipe.respond(res);
                });
            });

            req.on('error', function (err) {
                pipe.throw(err);
            });

            req.end();
        });
    }

    transport.api = pipe => {
        return {
            search: (name, callback) => {
                pipe.create()
                .on('error', err => {
                    callback(err);
                })
                .on('response', response => {
                    callback(null, response.body);
                })
                .request({
                    q: name
                });
            }
        };
    };

    return transport;
}

var client = Trooba.transport(transportFactory(), {
    protocol: 'http:',
    hostname: 'www.google.com',
    path: '/search'
}).create();

client.search('nike', console.log);
