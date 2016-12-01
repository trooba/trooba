'use strict';

var Utils = require('./lib/utils');
/**
 * This is a generic API free from any proprietery code. TODO: open-source
*/

/**
 * Assigns transport to the client pipeline
*/
function Trooba() {
    this._handlers = [];
}

Trooba.prototype = {
    transport: function transport(transportFactory, config) {
        if (typeof transportFactory === 'string') {
            transportFactory = require(transportFactory);
        }

        this._transport = transportFactory(config);
        if (this._transport.api) {
            this._api = this._transport.api;
        }
        return this;
    },

    use: function use(handlerFactory, config) {
        if (typeof handlerFactory === 'string') {
            handlerFactory = require(handlerFactory);
        }
        this._handlers.unshift(handlerFactory(config));
        return this;
    },

    /**
    * If config parameters is provided, then we assume api to be an API wrapper factory,
    * otherwise it is considered as an instance of API wrapper
    */
    interface: function exposeWithInterface(api, config) {
        this._api = config ? api(config) : api;
        return this;
    },

    create: function create(context) {
        var self = this;

        var pipe = buildPipe(
            this._handlers,
            // allow lazy transport binding via request context
            createPipeHandler(function proxyTransport(requestContext, reply) {
                var tr = requestContext.transport;
                if (!tr) {
                    throw new Error('Transport is not provided');
                }
                tr(requestContext, reply);
            }
        ));

        if (this._api) {
            return this._api(function injectPipe(requestContext, reply) {

                if (context) {
                    Object.keys(context).forEach(function forEach(key) {
                        requestContext[key] = context[key];
                    });
                }

                requestContext.transport = self._transport;

                pipe(requestContext, reply);

                return requestContext;
            });
        }

        return function generic(request, callback) {
            var requestContext = context ?
                Utils.clone(context) : {};

            requestContext.transport = self._transport;
            requestContext.request = request;
            pipe(requestContext, function onResponseContext(responseContext) {
                if (!responseContext) {
                    return callback();
                }
                callback(responseContext.error, responseContext.response);
            });
            return requestContext;
        };

    }
};

module.exports.transport = function createWithTransport(transportFactory, config) {
    var trooba = new Trooba();
    return trooba.transport(transportFactory, config);
};

module.exports.use = function createWithHandler(handlerFactory, config) {
    var trooba = new Trooba();
    return trooba.use(handlerFactory, config);
};

module.exports.interface = function createWithInterface(api, config) {
    var trooba = new Trooba();
    return trooba.interface(api, config);
};

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

                    next(rc, onResponseContext);

                    function onResponseContext(responseContext) {
                        if (callback) {
                            // override reply to allow implicit response context propagation
                            var reply = self.reply;
                            var implicitResponseContext = responseContext;
                            self.reply = function implicitReply(responseContext) {
                                // handle the case when error is passed with implicit context
                                if (arguments.length === 1 &&
                                    responseContext instanceof Error &&
                                    implicitResponseContext) {

                                    implicitResponseContext.error = responseContext;
                                    responseContext = implicitResponseContext;
                                }
                                reply(responseContext || implicitResponseContext);
                            };
                        }
                        else {
                            callback = self.reply;
                        }
                        callback(responseContext);
                    }
                }
            };
        }
    };
}
module.exports.createPipeHandler = createPipeHandler;
