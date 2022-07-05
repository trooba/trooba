'use strict';

var TTL = Infinity;

var defer = function defer(fn) {
    Promise.resolve().then(fn);
}

function createPipeConnector(to) {
    return function pipeConnect(pipe) {
        pipe.link(to);
    };
}

/**
 * Assigns transport to the client pipeline
*/
function Trooba() {
    this._handlers = [];
}

Trooba.prototype = {

    use: function (handler, config) {
        if (typeof handler === 'string' && typeof window === 'undefined') {
            handler = require(handler);
        }

        if (handler instanceof PipePoint) {
            handler = createPipeConnector(handler);
        }

        this._handlers.push({
            handler: handler,
            config: config
        });
        // TODO: create test for pipe caching
        this._pipe = undefined;
        return this;
    },

    build: function (context) {
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
    this.store = {};
}

module.exports.PipePoint = PipePoint;
module.exports.onDrop = function onDrop(message) {
    console.log('The message has been dropped, ttl expired:', message.type, message.flow);
};

PipePoint.prototype = {
    send: function (message) {
        if (shouldIgnore(message)) {
            return;
        }

        message.context = message.context || this.context;
        if (!message.context || !message.context.$inited) {
            throw new Error('The context has not been initialized, make sure you use pipe.create()');
        }

        // pick the direction
        var nextPoint;
        if (message.stage === Stages.PROCESS) {
            nextPoint = this; // stay in this point, needs more processing
        }
        else {
            nextPoint = message.flow === Types.REQUEST ? this._next$ : this._prev$;
            message.stage = Stages.TRANSIT;
            // unbound message from this point if any
            if (message.order && this._id === message.pointId) {
                this.queue().done(message);
            }
        }
        // drop message if needed
        message.ttl = message.ttl !== undefined ? message.ttl :
            (Date.now() + (this.context && this.context.ttl || TTL));
        if (message.ttl < Date.now()) {
            // onDrop message and let user know
            (this.context && this.context.onDrop || module.exports.onDrop)(message);
            return;
        }

        if (nextPoint) {
            // forward message down the pipe
            nextPoint.process(message);
        }
        else if (message.type === 'error') {
            throw message.ref;
        }
        else if (message.context &&
            message.context.validate &&
            message.context.validate[message.type]) {

            this.copy(message.context).throw(new Error('No target consumer found for the ' +
                message.type + ' ' + JSON.stringify(message.ref)));
        }
        else if (message.type === 'trace' && message.flow === Types.REQUEST) {
            message.flow = Types.RESPONSE; // reverse the route
            this.process(message);
        }

        return this;
    },

    copy: function (context) {
        var ret = new PipePoint();
        ret._next$ = this._next$;
        ret._prev$ = this._prev$;
        ret._tail$ = this._tail$;
        ret._id = this._id;
        ret._messageHandlers = this._messageHandlers;
        ret.config = this.config;
        ret.handler = this.handler;
        ret.store = this.store;
        ret.context = context;
        ret._pointCtx();
        return ret;
    },

    set: function (name, value) {
        this.context['$'+name] = value;
        return this;
    },

    get: function (name) {
        return this.context['$'+name];
    },

    link: function (pipe) {
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

    trace: function (callback) {
        var self = this;
        callback = callback || console.log;
        var route = [{
            point: this,
            flow: Types.REQUEST
        }];
        this.once('trace', function (list) {
            self.removeListener('error');
            callback(null, route);
        });
        this.once('error', callback);

        this.send({
            type: 'trace',
            flow: Types.REQUEST,
            trace: function trace(point, message) {
                route.push({
                    point: point,
                    flow: message.flow,
                    stage: message.stage
                });
            }
        });
    },

    resume: function resume() {
        var queue = this.queue();
        queue && queue.resume();
    },

    process: function (message) {
        var point = this;

        // get the hooks
        var messageHandlers = this.handlers(message.context);

        // handle linked pipes first
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

        if (message.context.trace || message.type === 'trace') {
            var traceFn = message.context.trace || message.trace;
            if (typeof traceFn === 'function') {
                traceFn(this._pointCtx(message.context).ref, message);
            }
        }

        if (point.queue().size(message.context) > 0 &&
                queueAndIfQueued(message)) {
            return;
        }

        var anyType;
        processMessage = messageHandlers[message.type];
        if (!processMessage) {
            processMessage = messageHandlers['*'];
            anyType = true;
        }

        if (processMessage) {
            queueAndIfQueued(message);
            // if sync delivery, than no callback needed before propagation further
            processMessage(anyType ? message : message.ref,
                    message.sync ? undefined : once(onComplete));
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
                    endHandler(once(function onComplete() {
                        point.send(message);
                    }));
                    return true;
                }
            }
        }

        function queueAndIfQueued(message) {
            // keep the order for ordered class of messages
            // if point is in process of similar message, the point is paused
            // for the given message till the processing is done
            return message.order && point.queue().add(message);
        }
    },

    /*
    * Create contextual channel
    * context method is a sync method that runs through all handlers
    * to allow them to hook to events they are interested in
    * The context will be attached to every message and bound to pipe
    */
    create: function (context, interfaceName) {
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
            var ret = current.handler(current, current.config);
            if (ret && !ret._handlersConfigured) {
                if (ret instanceof PipePoint) {
                    // if pipe is returned, let's attach it to the existing one
                    current.link(ret);
                }
                else {
                    current.handler = ret;
                    current.handler(current, current.config);
                }
            }
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

    throw: function (err) {
        var self = this;
        defer(function () {
            self.send({
                type: 'error',
                flow: Types.RESPONSE,
                ref: err
            });
        });
    },

    _exposePipeHooks: function exposePipeHooks(point, stream) {
        stream.on = function onHook(type, handler) {
            point.on(type, handler);
            return stream;
        };
        stream.once = function onHook(type, handler) {
            point.once(type, handler);
            return stream;
        };
    },

    streamRequest: function (request) {
        this.context.$requestStream = true;
        var point = this.request(request);
        var writeStream = createWriteStream({
            channel: point,
            flow: Types.REQUEST,
            session: this.context.$requestSession
        });

        this._exposePipeHooks(point, writeStream);
        point.context.$requestStream = writeStream;
        return writeStream;
    },

    request: function (request, callback) {
        var point = this;
        if (this.context.$requestSession) {
            this.context.$requestSession.closed = true;
        }
        this.context.$requestSession = {}; // new session
        this.resume();

        function sendRequest() {
            var msg = {
                type: 'request',
                flow: Types.REQUEST,
                ref: request
            };
            // order only streams
            msg.order = !!point.context.$requestStream;
            point.send(msg);
        }

        if (callback) {
            point
            .on('error', function (err) { callback(err); })
            .on('response', function (res) {
                point.resume();
                callback(null, res);
            });

            sendRequest();
            return point;
        }

        defer(sendRequest);

        return point;
    },

    respond: function (response) {
        var point = this;

        if (this.context.$responseSession) {
            this.context.$responseSession.closed = true;
        }
        this.context.$responseSession = {};

        this.resume();

        function sendResponse() {
            var msg = {
                type: 'response',
                flow: Types.RESPONSE,
                ref: response
            };
            // order only streams
            msg.order = !!point.context.$responseStream;
            point.send(msg);
        }

        defer(sendResponse);

        return this;
    },

    streamResponse: function (response) {
        this.context.$responseStream = true;
        var point = this.respond(response);

        var stream = this.context.$responseStream = createWriteStream({
            channel: point,
            flow: Types.RESPONSE,
            session: this.context.$responseSession
        });
        this._exposePipeHooks(point, stream);
        return stream;
    },

    /*
    * Message handlers will be attached to specific context and mapped to a specific point by its _id
    * This is need to avoid re-creating pipe for every new context
    */
    on: function (type, handler) {
        var handlers = this.handlers();
        if (handlers[type]) {
            throw new Error('The hook has already been registered, you can use only one hook for specific event type: ' + type + ', point.id:' + this._id);
        }
        handlers[type] = handler;
        this._handlersConfigured = true;
        return this;
    },

    once: function (type, handler) {
        var self = this;
        this.on(type, function onceFn() {
            self.removeListener(type);
            handler.apply(null, arguments);
        });
        return this;
    },

    removeListener: function (type) {
        delete this.handlers()[type];
    },

    _pointCtx: function (ctx) {
        ctx = ctx || this.context;
        if (!ctx) {
            throw new Error('Context is missing, please make sure context() is used first');
        }
        ctx.$points = ctx.$points || {};
        return ctx.$points[this._id] = ctx.$points[this._id] || {
            ref: this
        };
    },

    handlers: function (ctx) {
        var pointCtx = this._pointCtx(ctx);
        return pointCtx._messageHandlers = pointCtx._messageHandlers || {};
    },

    queue: function () {
        return this._queue = this._queue || new Queue(this);
    }
};

function once(fn) {
    return function once() {
        fn.apply(null, arguments);
        fn = function noop() {};
    };
}

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
        // session can be closed by initiating new request/response
        if (ctx.session.closed) {
            return;
        }

        if (channel._streamClosed) {
            throw new Error('The stream has been closed already');
        }

        if (data === undefined) {
            ctx.channel._streamClosed = true;
        }

        defer(function defer() {
            channel.send({
                type: type,
                flow: ctx.flow,
                ref: data,
                order: true,
                session: ctx.session
            });
        });
    }

    return {
        flow: ctx.flow,

        point: channel,

        write: function (data) {
            _write(data);
            return this;
        },

        end: function () {
            _write();
            return channel;
        }
    };
}

function shouldIgnore(message) {
    return message.session && message.session.closed;
}

function Queue(pipe) {
    this.pipe = pipe;
}

module.exports.Queue = Queue;

Queue.prototype = {
    size: function (context) {
        context = context || this.pipe.context;
        return context ? this.getQueue(context).length : 0;
    },

    getQueue: function getQueue(context) {
        context = context || this.pipe.context;
        if (context) {
            var pointCtx = this.pipe._pointCtx(context);
            return pointCtx.queue = pointCtx.queue || [];
        }
    },

    // return true, if message prcessing should be paused
    add: function add(message) {
        if (!message.order || // no keep order needed
                message.inProcess) {// or already in process
            return false; // should continue
        }

        var queue = this.getQueue(message.context);
        queue.unshift(message); // FIFO
        message.pointId = this.pipe._id;
        var moreInQueue = queue.length > 1;
        message.inProcess = !moreInQueue;

        return moreInQueue;
    },

    resume: function resume() {
        var self = this;
        var point = this.pipe;
        var queue = self.getQueue(point.context);
        if (!queue) {
            return;
        }
        var msg = queue[queue.length - 1];
        // only resume if it was paused
        if (msg && msg.inProcess) {
            self.done(msg);
        }
    },

    done: function done(message) {
        var point = this.pipe;
        var queue = this.getQueue(message.context);
        var msg = queue.pop();
        if (msg !== message) {
            throw new Error('The queue for ' + this.pipe._id + ' is broken');
        }
        // unbound message from this point
        message.pointId = undefined;
        delete message.inProcess;
        // handle next message
        msg = queue[queue.length - 1];
        if (msg) {
            msg.inProcess = true;
            defer(function () {
                point.process(msg);
            });
        }
    }
};
