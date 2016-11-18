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
            if (typeof handlerFactory === 'string') {
                handlerFactory = require(handlerFactory);
            }
            handlers.unshift(handlerFactory(config));
            return this;
        },

        create: function create(context) {

            var pipe = buildPipe(handlers, createPipeHandler(transport));

            if (transport.api) {
                return transport.api(function injectPipe(next) {
                    var requestContext = context ?
                        Utils.clone(context) : {};

                    next(requestContext, function onStartPipe(request, callback) {
                        var args = [].slice.call(arguments);
                        callback = args.pop();
                        requestContext.request = args.pop() || requestContext.request;
                        // run the pipe
                        pipe(requestContext, callback);
                    });

                    return requestContext;
                });
            }

            return function generic(request, callback) {
                var requestContext = context ?
                    Utils.clone(context) : {};

                requestContext.request = request;
                pipe(requestContext, function onResponseContext(responseContext) {
                    callback(responseContext.error, responseContext.response);
                });
                return requestContext;
            };

        }
    };
}
module.exports.transport = useTransport;

/**
   The pipe API signature is
    function pipe(requestContext, action) {
        // do something before
        action.next(function onResponse(responseContext) {
            // do something after
            action.reply(responseContext);
        });
    }
*/
function buildPipe(handlers, target) {
    return handlers.reduce(function reduce(next, handler) {
        return createPipeHandler(handler, next);
    }, target);
}
module.exports.buildPipe = buildPipe;

function createPipeHandler(handler, next, propagateCtx) {
    return function handleRequest(requestContext, callback) {
        requestContext = requestContext || propagateCtx && propagateCtx.requestContext;
        callback = callback || propagateCtx && propagateCtx.callback;

        handler(requestContext, next ? createAction(requestContext) : genericReply);

        /**
         * handle 3 cases of callbacks:
         * - callback(err) - initiate an error response
         * - callback(null, response) - initiate a response
         * - callback(responseContext) - propagating context
        */
        function genericReply() {
            if (arguments.length === 2 || arguments[0] instanceof Error) {
                callback({
                    error: arguments[0],
                    response: arguments[1]
                });
                return;
            }

            callback(arguments[0]);
        }

        function createAction(requestContext) {

            return {
                /**
                *  - reply(err, response) converted to responseContext
                *  - reply(responseContext) propagates responseContext back
                */
                reply: genericReply,
                /**
                *  - next([requestContext], [onReply])
                *  - next(requestContext) no reponse to handle
                *  - next() propagates implicit requestContext forward
                */
                next: function handleNext() {
                    var self = this;
                    var args = [].slice.call(arguments);
                    var callback = Utils.selectArg(args, 'function');
                    var rc = Utils.selectArg(args, 'object') || requestContext;
                    if (rc instanceof Error) {
                        (callback || this.reply)(rc);
                        return;
                    }

                    next(rc, function onResponseContext(responseContext) {
                        if (callback) {
                            // override reply to allow implicit response context propagation
                            var reply = self.reply;
                            var implicitResponseContext = responseContext;
                            self.reply = function implicitReply(responseContext) {
                                reply(responseContext || implicitResponseContext);
                            };
                        }
                        else {
                            callback = self.reply;
                        }
                        callback(responseContext);
                    });
                }
            };
        }
    };
}
module.exports.createPipeHandler = createPipeHandler;
