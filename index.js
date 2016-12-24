'use strict';

var TTL = 1000;

/**
 * Assigns transport to the client pipeline
*/
function Trooba() {
    this._handlers = [];
}

Trooba.prototype = {

    use: function use(handler, config) {
        if (typeof handler === 'string') {
            handler = require(handler);
        }

        if (handler instanceof PipePoint) {
            var pipeTo = handler;
            handler = function pipeConnect(pipe) {
                pipe.link(pipeTo);
            };
        }

        this._handlers.push({
            handler: handler,
            config: config
        });

        this._pipe = undefined;
        return this;
    },

    build: function build$(context) {
        var pipe = this._pipe;
        if (!pipe || context) {
            var handlers = this._handlers.slice();
            handlers.unshift(function pipeHead() {});
            pipe = this._pipe = buildPipe(handlers);
        }

        // remove non-persistent context data if any
        context = Object.keys(context || {}).reduce(function reduce(memo, name) {
            if (name.charAt(0) !== '$') {
                memo[name] = context[name];
            }
            return memo;
        }, {
            validate: {
                request: false // always validate request by default, not now TODO: set to true
            }
        });

        pipe.context = context;
        return pipe;
    }
};

module.exports = Trooba;

module.exports.use = function createWithHandler(handler, config) {
    var trooba = new Trooba();
    return trooba.use(handler, config);
};

function buildPipe(handlers) {
    var head;
    var tail = handlers.reduce(function reduce(prev, handlerMeta) {
        var point = createPipePoint(handlerMeta, prev);
        head = head || point;
        return point;
    }, undefined);
    head._tail$ = tail;
    return head;
}
module.exports.buildPipe = buildPipe;

function createPipePoint(handler, prev) {
    var point = new PipePoint(handler);
    if (prev) {
        point._prev$ = prev;
        prev._next$ = point;
    }
    return point;
}

module.exports.createPipePoint = createPipePoint;

var Types = {
    REQUEST: 1,
    RESPONSE: 2
};
module.exports.Types = Types;

var Stages = {
    TRANSIT: 1,
    PROCESS: 2
};
module.exports.Stages = Stages;

/*
* Channel point forms a linked list node
*/
function PipePoint(handler) {
    this._messageHandlers = {};
    this.handler = handler;
    if (handler && typeof handler !== 'function') {
        this.handler = handler.handler;
        this.config = handler.config;
    }
    // build a unique identifer for every new instance of point
    // we do not anticipate creates of so many within one pipe to create conflicts
    PipePoint.instanceCounter = PipePoint.instanceCounter ? PipePoint.instanceCounter : 0;
    this._uid = PipePoint.instanceCounter++;
    this._id = (this.handler ? this.handler.name + '-' : '') + this._uid;
}

module.exports.PipePoint = PipePoint;
module.exports.onDrop = function onDrop(message) {
    console.log('The message has been dropped, ttl expired:', message.type, message.flow);
};

PipePoint.prototype = {
    send: function send$(message) {
        message.context = message.context || this.context;
        if (!message.context.$inited) {
            throw new Error('The context has not been initialized, make sure you use pipe.create()');
        }

        message.ttl = message.ttl !== undefined ? message.ttl :
            (Date.now() + (this.config && this.config.ttl || TTL));
        if (message.ttl < Date.now()) {
            // onDrop message and let user know
            (this.context && this.context.onDrop || module.exports.onDrop)(message);
            return;
        }

        // pick the direction
        var nextPoint;
        if (message.stage === Stages.PROCESS) {
            nextPoint = this; // stay in this point, needs more processing
        }
        else {
            nextPoint = message.flow === Types.REQUEST ? this._next$ : this._prev$;
            message.stage = Stages.TRANSIT;
        }

        if (nextPoint) {
            if (!message.context) {
                throw new Error('Context is missing, make sure context() is used first');
            }
            // forward message down the pipe
            nextPoint.process(message);
        }
        else if (message.type === 'error') {
            throw message.ref;
        }
        else if (message.context && (message.context.$strict &&
            message.context.$strict.indexOf(message.type) !== -1 ||
            message.context.validate && message.context.validate[message.type]
        )) {
            this.copy(message.context).throw(new Error('No target consumer found for the ' +
                message.type + ' ' + JSON.stringify(message.ref)));
        }
        else if (message.type === 'trace' && message.flow === Types.REQUEST) {
            message.flow = Types.RESPONSE;
            this.process(message);
        }

        return this;
    },

    copy: function copy$(context) {
        var ret = new PipePoint();
        ret._next$ = this._next$;
        ret._prev$ = this._prev$;
        ret._tail$ = this._tail$;
        ret._id = this._id;
        ret._messageHandlers = this._messageHandlers;
        ret.config = this.config;
        ret.handler = this.handler;
        ret.context = context;
        ret._pointCtx();
        return ret;
    },

    tracer: function tracer$(tracer) {
        this.context.trace = true;
        this.context.tracer$ = tracer;
        return this;
    },

    set: function set$(name, value) {
        this.context['$'+name] = value;
        return this;
    },

    get: function get$(name) {
        return this.context['$'+name];
    },

    link: function link$(pipe) {
        var self = this;
        if (this._pointCtx().$linked) {
            throw new Error('The pipe already has a link');
        }
        // allow detection of link action
        this._pointCtx().$linked = true;
        pipe = pipe.create(this.context);
        this.on('$link$', function onStart(message) {
            if (message.flow === Types.REQUEST) {
                return pipe.send(message); // will be processed first
            }
            message.stage = Stages.PROCESS;
            pipe.tail.send(message);
        });
        pipe.on('$link$', function onEnd(message) {
            if (message.flow === Types.RESPONSE) {
                // send back
                message.stage = Stages.PROCESS;
                return self.send(message);
            }
        });
        pipe.tail.on('$link$', function onEnd(message) {
            if (message.flow === Types.REQUEST) {
                // send forward
                return self.send(message);
            }
        });
    },

    trace: function trace$(callback) {
        var self = this;
        callback = callback || console.log;
        this.once('trace', function (list) {
            self.removeListener('error');
            callback(null, list);
        });
        this.once('error', callback);

        this.send({
            type: 'trace',
            flow: Types.REQUEST,
            ref: [{
                point: this,
                flow: Types.REQUEST
            }]
        });
    },

    process: function process$(message) {
        var point = this;
        var messageHandlers;

        // get the hooks
        messageHandlers = this.handlers(message.context);

        var processMessage = messageHandlers.$link$;
        if (processMessage) {
            // for request flow first process through regular hooks if any
            if (message.flow === Types.REQUEST) {
                if (message.stage === Stages.PROCESS) {
                    // after processing, go to the next point
                    message.stage = Stages.TRANSIT;
                    return processMessage(message);
                }
                // make sure the next cycle happens in this point
                message.stage = Stages.PROCESS;
            }
            else if (message.flow === Types.RESPONSE) {
                // in response flow it should first go throuh the linked pipe
                if (message.stage === Stages.TRANSIT) {
                    return processMessage(message);
                }
                // make sure it goes to the next point
                message.stage = Stages.TRANSIT;
            }
        }

        if (message.context && message.context.trace && message.context.tracer$) {
            message.context.tracer$(message, point);
        }

        if (message.type === 'trace') {
            message.ref.push({
                point: this,
                flow: message.flow,
                stage: message.stage
            });
        }

        var anyType;
        processMessage = messageHandlers[message.type];
        if (!processMessage) {
            processMessage = messageHandlers['*'];
            anyType = true;
        }
        // let's detect if link action occures in the hook handler
        // and use number of points added to the context;
        // which would change if linking happens
        if (processMessage) {
            // if sync delivery, than no callback needed before propagation further
            processMessage(anyType ? message : message.ref,
                    message.sync ? undefined : onComplete, message.context);
            if (!message.sync) {
                // onComplete would continued the flow
                return;
            }
        }
        else if (processEndEvent()) {
            return;
        }

        sendMessage(message);

        function sendMessage(message) {
            // if link action happend, route to a newly formed route
            if (message.flow === Types.REQUEST && point._pointCtx(message.context).$linked) {
                message.stage = message.stage === Stages.TRANSIT ? Stages.PROCESS : message.stage;
            }
            point.send(message);
        }

        function onComplete(ref) {
            if (arguments.length) {
                message.ref = ref;
            }
            // special case for stream
            if (processEndEvent()) {
                return;
            }

            sendMessage(message);
        }

        function processEndEvent() {
            if ((message.type === 'response:data' ||
                message.type === 'request:data') && message.ref === undefined) {

                var endHandler = messageHandlers[
                    message.flow === Types.REQUEST ? 'request:end' : 'response:end'];
                if (endHandler) {
                    endHandler(function onComplete() {
                        point.send(message);
                    });
                    return true;
                }
            }
        }
    },

    /*
    * Create contextual channel
    * context method is a sync method that runs through all handlers
    * to allow them to hook to events they are interested in
    * The context will be attached to every message and bound to pipe
    */
    create: function create$(context, interfaceName) {
        if (typeof arguments[0] === 'string') {
            interfaceName = arguments[0];
            context = undefined;
        }

        context = context || {};

        if (this.context) {
            // inherit from existing context if any
            var self = this;
            Object.keys(this.context).forEach(function forEach(name) {
                if (name.charAt(0) !== '$' && !context[name]) {
                    context[name] = self.context[name];
                }
            });
        }

        // bind context to the points
        var head = this.copy(context);

        var current = head;
        while(current) {
            current.handler(current, current.config);
            current = current._next$ ?
                current._next$.copy(context) : undefined;
        }
        context.$inited = true;

        if (!interfaceName) {
            return head;
        }

        var api = head.get(interfaceName);
        if (!api) {
            throw new Error('Cannot find requested API: ' + interfaceName);
        }
        return api(head);
    },

    throw: function throw$(err) {
        this.send({
            type: 'error',
            flow: Types.RESPONSE,
            ref: err
        });
    },

    streamRequest: function streamRequest$(request) {
        this.context.$requestStream = true;
        var point = this.request(request);
        var writeStream = createWriteStream({
            channel: point,
            flow: Types.REQUEST
        });
        writeStream.on = function onHook(type, handler) {
            point.on(type, handler);
            return writeStream;
        };
        writeStream.once = function onHook(type, handler) {
            point.once(type, handler);
            return writeStream;
        };
        point.context.$requestStream = writeStream;
        return writeStream;
    },

    request: function request$(request, callback) {
        var point = this;
        if (!point.context) {
            // create default context
            point = point.create({});
        }

        function sendRequest() {
            point.send({
                type: 'request',
                flow: Types.REQUEST,
                ref: request
            });
        }

        if (callback) {
            point
            .on('error', function (err) { callback(err); })
            .on('response', function (res) { callback(null, res); });

            sendRequest();
            return point;
        }

        this.context.$requestStream ? sendRequest() : setTimeout(sendRequest, 0);

        return point;
    },

    respond: function respond$(response) {
        this.send({
            type: 'response',
            flow: Types.RESPONSE,
            ref: response
        });

        return this;
    },

    streamResponse: function streamResponse$(response) {
        this.context.$responseStream = true;
        var point = this.respond(response);

        return this.context.$responseStream = createWriteStream({
            channel: point,
            flow: Types.RESPONSE
        });
    },

    /*
    * Message handlers will be attached to specific context and mapped to a specific point by its _id
    * This is need to avoid re-creating pipe for every new context
    */
    on: function onEvent$(type, handler) {
        var handlers = this.handlers();
        if (handlers[type]) {
            throw new Error('The hook has already been registered, you can use only one hook for specific event type: ' + type + ', point.id:' + this._id);
        }
        handlers[type] = handler;
        return this;
    },

    once: function onceEvent$(type, handler) {
        var self = this;
        this.on(type, function onceFn() {
            delete self.handlers()[type];
            handler.apply(null, arguments);
        });
        return this;
    },

    removeListener: function removeListener$(type) {
        delete this.handlers()[type];
    },

    _pointCtx: function _pointCtx$(ctx) {
        ctx = ctx || this.context;
        if (!ctx) {
            throw new Error('Context is missing, please make sure context() is used first');
        }
        ctx.$points = ctx.$points || {};
        return ctx.$points[this._id] = ctx.$points[this._id] || {
            ref: this
        };
    },

    handlers: function handlers$(ctx) {
        var pointCtx = this._pointCtx(ctx);
        pointCtx._messageHandlers = pointCtx._messageHandlers || {};
        return pointCtx._messageHandlers;
    }
};

Object.defineProperty(PipePoint.prototype, 'next', {
    get: function getNext() {
        if (this.context && this.context.$points && this._next$) {
            return this.context.$points[this._next$._id].ref;
        }
        return this._next$;
    }
});

Object.defineProperty(PipePoint.prototype, 'prev', {
    get: function getPrev() {
        if (this.context && this.context.$points && this._prev$) {
            return this.context.$points[this._prev$._id].ref;
        }
        return this._prev$;
    }
});

Object.defineProperty(PipePoint.prototype, 'tail', {
    get: function getTail() {
        if (this.context && this._tail$) {
            return this._tail$._pointCtx(this.context).ref;
        }
        return this._tail$;
    }
});

function createWriteStream(ctx) {
    var type = ctx.flow === Types.REQUEST ? 'request:data' : 'response:data';
    var channel = ctx.channel;

    function _write(data) {
        if (channel._streamClosed) {
            throw new Error('The stream has been closed already');
        }

        if (data === undefined) {
            ctx.channel._streamClosed = true;
        }

        channel.send({
            type: type,
            flow: ctx.flow,
            ref: data
        });
    }

    return {
        write: function write$(data) {
            _write(data);
            return this;
        },

        end: function end$() {
            _write();
            return channel;
        }
    };
}
