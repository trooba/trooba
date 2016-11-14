'use strict';

var Utils = require('./lib/utils');
/**
 * This is a generic API free from any proprietery code. TODO: open-source
*/

/**
 * Assigns transport to the client pipeline
*/
function useTransport(transportFactory, config) {
    var handlers = [];

    if (typeof transportFactory === 'string') {
        transportFactory = require(transportFactory);
    }

    var transport = transportFactory(config);

    return {
        use: function use(handlerFactory, config) {
            handlers.push(handlerFactory(config));
            return this;
        },

        create: function create(context) {
            var requestNextHandlers = handlers.slice();
            var requestPrevHandlers = [];
            var responseHandlers = [];

            var requestContext = context ?
                Utils.clone(context) : {};

            var responseContext = {};
            var contextUse = 0;

            requestContext.use = function use(handlerFactory, config) {
                requestNextHandlers.splice(contextUse++, 0, handlerFactory(config));
                return this;
            };

            responseContext.next = function next(err, response) {
                responseContext.error = err === undefined ? responseContext.error : err;
                responseContext.response = response ? response : responseContext.response;
                transportPhase = false;

                var handler = responseHandlers.shift();
                if (!handler) {
                    console.trace('[WARN] Make sure requestContext.next or responseContext.next is not called multiple times in the same context by mistake');
                    return;
                }

                // adjust position of request handlers
                var nextHandler = requestPrevHandlers.pop();
                if (nextHandler) {
                    requestNextHandlers.unshift(nextHandler);
                }
                handler(responseContext.error, responseContext.response);
            };

            var transportPhase = false;

            requestContext.next = function next(callback) {
                var handler = requestNextHandlers.shift();
                if (handler) {
                    requestPrevHandlers.push(handler);
                }

                if (!handler && !transportPhase) {
                    handler = transport;
                    transportPhase = true;
                }

                if (!handler && transportPhase) {
                    return responseContext.next.apply(responseContext, arguments);
                }

                if (callback) {
                    responseHandlers.unshift(callback);
                }
                else if (responseHandlers.length) {
                    responseHandlers.unshift(responseContext.next);
                }

                handler(requestContext, responseContext);
            };

            if (transport.api) {
                return transport.api(requestContext, responseContext);
            }

            return function generic(request, callback) {
                requestContext.request = request;
                requestContext.next(function onResponse(err, response) {
                    callback(responseContext.error, responseContext.response);
                });
            };
        }
    };
}
module.exports.transport = useTransport;
