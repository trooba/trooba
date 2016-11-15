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

            if (transport.api) {
                return transport.api(pipe);
            }

            return function generic(request, callback) {
                return pipe(function ctx(requestContext, responseContext) {
                    requestContext.request = request;
                    requestContext.next(function onResponse(err, response) {
                        callback(responseContext.error, responseContext.response);
                    });
                });
            };

            function pipe(callback) {
                var requestNextHandlers = handlers.slice();
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

                    handler(responseContext.error, responseContext.response);
                };

                var transportPhase = false;

                requestContext.next = function next(callback) {
                    var handler = requestNextHandlers.shift();

                    if (!handler && !transportPhase) {
                        handler = transport;
                        transportPhase = true;
                    }

                    if (!handler && transportPhase) {
                        return responseContext.next.apply(responseContext, arguments);
                    }

                    if (!callback && responseHandlers.length) {
                        callback = responseContext.next;
                    }

                    if (callback) {
                        responseHandlers.unshift(function onCallback() {
                            // adjust current execution handler stack
                            // on return of the result
                            if (handler) {
                                requestNextHandlers.unshift(handler);
                            }
                            callback.apply(null, arguments);
                        });
                    }

                    handler(requestContext, responseContext);
                };

                callback(requestContext, responseContext);

                return {
                    requestContext: requestContext,
                    responseContext: responseContext
                };
            }

        }
    };
}
module.exports.transport = useTransport;
