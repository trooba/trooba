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
            createPipeHandler(function proxyTransport(pipeRequest) {
                var tr = pipeRequest.context.transport;
                if (!tr) {
                    throw new Error('Transport is not provided');
                }
                tr(pipeRequest);
            }
        ));

        if (this._api) {
            return this._api(function injectPipe(requestContext) {

                if (context) {
                    Object.keys(context).forEach(function forEach(key) {
                        requestContext[key] = context[key];
                    });
                }

                requestContext.transport = self._transport;

                var pipeRequest = pipe(requestContext);
                pipeRequest.reportError = true;
                return pipeRequest;
            });
        }

        return function generic(request, callback) {
            var requestContext = context ?
                Utils.clone(context) : {};

            requestContext.transport = self._transport;
            requestContext.request = request;

            var pipeRequest = pipe(requestContext);
            pipeRequest.reportError = true;

            if (callback) {
                pipeRequest
                    .on('response', callback.bind(null, null))
                    .on('error', function onErr(err) {
                        callback(err);
                    });
                return;
            }
            return pipeRequest;
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
    function pipe(requestPipe) {
        return requestPipe.next()
         .on(type, handler);
    }
*/
function buildPipe(handlers, target) {
    var pipe = handlers.reduce(function reduce(next, handler) {
        return createPipeHandler(handler, next);
    }, target);

    return createPipeHandler(function startPipe(requestPipe) {
        requestPipe.next();
    }, pipe);
}
module.exports.buildPipe = buildPipe;

function RequestPipe(requestContext, next, prev) {
    this.context = requestContext;
    this._next = next;
    // terminate with noop if no more previous handlers
    this._prev = prev || function noop() {};
    this._eventHandlers = {};
}

RequestPipe.prototype = {

    next: function next$() {
        var self = this;
        var pipeResponseHandler = createPipeResponseHandler(self);
        // defer a little to let a user use 'on' hooks
        setTimeout(function defer() {
            self._next(self.context,
                pipeResponseHandler);
        }, 0);

        return this;
    },

    throw: function throw$(err) {
        var ctx = this.responsePipe || this.createResponsePipe({});
        ctx.throw(err);
    },

    reply: function reply$(response) {
        var ctx = this.createResponsePipe({});
        // write response
        return ctx.reply(response);
    },

    createResponsePipe: function createResponsePipe$(ctx) {
        return new ResponsePipe(ctx || {}, this._prev);
    },

    on: function onEvent$(type, handler) {
        if (this._eventHandlers[type]) {
            throw new Error('The hook has already been registered, you can use only one hook for specific event type');
        }
        this._eventHandlers[type] = handler;
        return this;
    },

    once: function onceEvent$(type, handler) {
        var self = this;
        this.on(type, function onceFn() {
            handler.apply(null, arguments);
            delete self._eventHandlers[type];
        });
        return this;
    }

};

function createPipeResponseHandler(requestPipe) {
    var prev = requestPipe._prev;
    if (requestPipe.responsePipe) {
        // close now obsolete channel as we are going to setup a new one
        requestPipe.responsePipe._next = function noop() {};
    }
    // when we do next we wipe out the previous response if any
    requestPipe.responsePipe = undefined;

    return function handlePipeResponseMessage(pipeMessage) {
        var responsePipe = requestPipe.responsePipe;
        var handlers = requestPipe &&
            requestPipe._eventHandlers || {};
        var handler;

        switch(pipeMessage.type) {
            case 'response-context':
                if (requestPipe.responsePipe &&
                    requestPipe.responsePipe.context === pipeMessage.ref) {
                        throw new Error('The same context has been already received');
                    }
                // remember for further response events
                requestPipe.responsePipe =
                    new ResponsePipe(pipeMessage.ref, prev);

                if (handlers.responsePipe) {
                    handlers.responsePipe(requestPipe.responsePipe);
                }
                break;
            case 'response':
                if (responsePipe.responseReceived) {
                    throw new Error('response has already been received, make sure you do not make duplicated reply');
                }
                responsePipe.responseReceived = true;

                handler = handlers.response;
                if (handler) {
                    handler(pipeMessage.ref, function onComplete(response) {
                        prev({
                            type: pipeMessage.type,
                            ref: response || pipeMessage.ref
                        });
                    });

                    return;
                }
                break;
            case 'response-data':
                // handle data if any data present and handler exists
                handler = handlers['response-data'];

                var data = pipeMessage.ref;

                if (handler) {
                    // onReply may be called multiple times for single call,
                    // splitting chunk into many chunks
                    handler(data, function onReply() {
                        if (responsePipe.streamEnd) {
                            throw new Error('stream has already been closed');
                        }

                        if (arguments.length) {
                            data = arguments[0];
                            if (responsePipe.streamEnd) {
                                throw new Error('stream has already been closed');
                            }
                            responsePipe.streamEnd = true;
                        }

                        // handle end of stream if any handler present and end of stream is detected
                        handler = data === undefined &&
                            handlers.end;
                        if (handler) {
                            handler(function onComplete() {
                                prev({
                                    type: pipeMessage.type,
                                    ref: undefined // undefined data signal end of stream
                                });
                            });
                            return;
                        }

                        prev({
                            type: pipeMessage.type,
                            ref: data
                        });
                    });
                    return;
                }

                // handle end of stream if any handler present and end of stream is detected
                handler = data === undefined &&
                    handlers.end;
                if (handler) {
                    handler(function onComplete() {
                        prev({
                            type: pipeMessage.type,
                            ref: undefined // undefined data signal end of stream
                        });
                    });
                    return;
                }

                break;
            case 'error':
                handler = handlers.error;
                if (handler) {
                    handler(pipeMessage.ref, function onComplete(err) {
                        if (err) {
                            pipeMessage.ref = err;
                        }

                        prev(pipeMessage);
                    });
                    return;
                }
                else if (requestPipe.reportError) {
                    throw pipeMessage.ref;
                }
                break;
            default:
                // handle custom hooks
                handler = handlers[pipeMessage.type];
                if (handler) {
                    handler(pipeMessage.ref, function asyncProcessor(ref) {
                        if (arguments.length) {
                            pipeMessage.ref = ref;
                        }
                        prev(pipeMessage);
                    });
                    return;
                }
                break;
        }

        // propagate further down response pipe if no handlers
        prev(pipeMessage);
    };
}

function ResponsePipe(responseContext, next) {
    this.context = responseContext;
    this._next = next;
}

ResponsePipe.prototype = {

    next: function next$() {
        if (!this.context) {
            throw new Error('Make sure you created response by calling .reply(response) method');
        }
        this._next(this.context);
    },

    initContext: function initContext$(ctx) {
        if (!this.context.sent) {
            this.context = ctx || this.context || {};
            this.context.sent = true;
            this._next({
                type: 'response-context',
                ref: this.context
            });
        }
    },

    message: function message$(type, message) {
        this.initContext();

        this._next({
            type: type,
            ref: message
        });
    },

    throw: function throw$(err) {
        this.message('error', err);
    },

    reply: function reply$(response) {
        this.message('response', response);
        this.response = new ChunkPipe(this);
        return this.response;
    }
};

function ChunkPipe(proxy) {
    this.proxy = proxy;
}

ChunkPipe.prototype = {
    _write: function _write$(data) {
        var proxy = this.proxy;

        if (this._done) {
            throw new Error('The stream has been closed already');
        }

        proxy.message('response-data', data);
        return this;
    },

    write: function write$(data) {
        this._write(data);
        return this;
    },

    end: function end$() {
        this._write();
        this._done = true;
    }

};

function createPipeHandler(handler, next) {
    return function handleRequest(requestContext, callback) {
        var pipeRequestCtx = new RequestPipe(requestContext, next, callback);
        handler(pipeRequestCtx);
        return pipeRequestCtx;
    };
}
module.exports.createPipeHandler = createPipeHandler;
