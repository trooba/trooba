'use strict';

function Trooba() {
    this.factories = [];
    this.interfaces = {};
    this.decorators = [];
    this.use(function head() {});
}

var Direction = {
    REQUEST: 1,
    RESPONSE: 2
};

var defer = process && process.nextTick && process.nextTick.bind(process) ||
    setImmediate || function (fn) {
        setTimeout(fn, 0); // this is much slower then setImmediate or nextTick
    };

module.exports = Trooba;

module.exports.use = function (createHandler, config) {
    return new Trooba()
    .use(createHandler, config);
};

Trooba.prototype.register = function (name, fn, config) {
    if (this.interfaces[name]) {
        throw new Error('The implementation for "' + name + '" have already been registered');
    }
    this.interfaces[name] = {
        fn: fn,
        config: config
    };
    return this;
};

Trooba.prototype.use = function (handler, config) {
    if (typeof handler === 'string') {
        handler = require(handler);
    }
    var attributes = handler.attributes || {};
    registerInterfaces(this, handler.interfaces, config);
    handler.decorate && this.decorators.push({
        decorate: handler.decorate,
        config: config
    });
    var name = attributes.name || handler.name;
    if (typeof handler === 'function') {
        var create = function (pipe) {
            if (name) {
                pipe.name = name;
            }
            var runtime;
            if (attributes.runtime !== 'generic') {
                if (attributes.runtime) {
                    runtime = resolveRuntime(pipe, attributes.runtime);
                }
                else {
                    runtime = resolveRuntime(pipe, pipe.context.runtime, true);
                }
            }
            if (runtime) {
                runtime.call(pipe, handler);
                return;
            }
            return handler(pipe, config);
        };
        this.factories.push(create);
    }
    return this;
};

Trooba.prototype.build = function () {
    var trooba = this;
    var factories = this.factories;
    var interfaces = this.interfaces;
    var store = {};

    if (factories.length <= 1) {
        throw new Error('No handlers have been registered');
    }

    return {
        create: function (contextOrApi) {
            if (typeof contextOrApi === 'string') {
                var api = interfaces[contextOrApi];
                if (!api) {
                    throw new Error('Cannot find requested API: ' + contextOrApi);
                }
                return api.fn(this, api.config);
            }
            var pointAt = createActuator(factories, contextOrApi, store);
            var head = pointAt(0);
            head.pointAt = pointAt;
            head.factories = factories;
            trooba.decorators.forEach(function (decor) {
                decor.decorate(head, decor.config);
            });
            return head;
        }
    };
};

function resolveRuntime(pipe, name, silent) {
    var runtime = pipe.runtimes[name];
    if (!silent && !runtime) {
        throw new Error('Cannot find runtime "'+name+'"');
    }
    return runtime;
}

function registerInterfaces(trooba, interfaces, config) {
    if (interfaces) {
        Object.keys(interfaces).forEach(function (name) {
            var fn = interfaces[name];
            if (!fn) {
                throw new Error('The interface "' +
                    name + '" is not a function (pipe, callback)');
            }
            trooba.register(name, fn, config);
        });
    }
}

/*
 * The method allows to create a special accessor that will lazily build
 * a chain of handlers into a pipe
*/
function createActuator(factories, context, store) {
    factories = factories.slice();
    var points = [];
    var runtimes = {};

    return function pointAt(position) {
        while (factories.length && position >= points.length) {
            var create = factories.shift();
            var point = new PipePoint(context);
            point.store = store[position] = store[position] || {};
            point.position = position;
            point.runtimes = runtimes;
            if (position) {
                // propagate values from previous point
                point.decorators = points[position - 1].decorators;
                point.context = points[position - 1].context;
            }
            // apply decorations to this instance
            decorate(point);
            var ret = create(point);
            if (ret instanceof Trooba) {
                factories = ret.factories.concat(factories);
            }
            points.push(point);
        }
        return points[position];
    };
}

function decorate(point) {
    if (point.decorators) {
        point.decorators.forEach(function (decorator) {
            point[decorator.name] = decorator.fn;
        });
    }
}

function PipePoint(context) {
    this.context = context || {};
    // point's position in the chain will be recorded
    // with the fixt message that comes
    // to the point as message has a current position
    // once it is recorded it will not be changed
    this.position = undefined;
    this.decorators = undefined;
    this.queue = [];
    this.handlers = {};
}

PipePoint.prototype = {
    Direction: Direction,
    decorate: function (name, fn, override) {
        if (name in this && !override) {
            throw new Error('The method "' + name + '" is already present');
        }
        fn = fn(this[name]);
        this[name] = fn;
        // remember decorators for the rest of points as we add them
        this.decorators = this.decorators || [];
        this.decorators.push({
            name: name,
            fn: fn
        });
        return this;
    },

    throw: function (err) {
        this.resume();
        this.send('error', err, Direction.RESPONSE);
    },

    trace: function (fn) {
        this.send('trace', fn, Direction.REQUEST);
    },

    send: function (type, data, direction) {
        var options = {};
        if (arguments[0] && typeof arguments[0] === 'object') {
            options = arguments[0];
        }
        else {
            options.type = type;
            options.data = data;
            options.direction = direction;
        }

        new Message({
            type: options.type,
            data: options.data,
            sync: options.sync,
            direction: options.direction || Direction.REQUEST,
            origin: this,
            position: this.position,
            session: options.session
        })
        .next();

        return this;
    },

    resume: function () {
        this.current = undefined;
        // next message
        this.throttleProcess();
    },

    add: function (msg) {
        // set position if not set
        this.position = this.position !== undefined ? this.position : msg.position;
        // set chain if not already set
        this.pointAt = this.pointAt || msg.origin.pointAt;
        // now check queue and decide
        this.queue.push(msg);

        var prevPoint = this.pointAt(msg.relativePos(-1));
        if (prevPoint.current === msg) {
            prevPoint.resume();
        }

        this.throttleProcess();
    },

    throttleProcess: function () {
        var self = this;
        if (this._throttleProcessOn) {
            return;
        }
        this._throttleProcessOn = true;
        defer(function () {
            self._throttleProcessOn = false;
            self.process();
        });
    },

    process: function () {
        if (this.current && this.current.position === this.position &&
            !(this.current.session && this.current.session.closed)) {
            return;
        }

        var msg = this.queue.length ? this.queue.shift() : undefined;
        if (!msg) {
            return;
        }

        this.current = msg;

        if (msg.type === 'trace') {
            msg.data(this, msg.direction);
            if (this.pointAt(this.position + 1) === undefined) {
                msg.direction = Direction.RESPONSE;
            }
            msg.next();
            return;
        }

        var fn = this.handlers[msg.type];
        var acceptMessage = fn && fn.attributes && fn.attributes.acceptMessage;
        if (!fn) {
            fn = this.handlers['*'];
            acceptMessage = true;
        }
        if (!fn) {
            return msg.next();
        }

        function skip() {}

        var next = function (newData) {
            msg.data = newData || msg.data;
            msg.next();
        };

        next = msg.sync ? skip : once(next);

        // some handlers would like to handle whole messages
        if (acceptMessage) {
            fn(msg);
        }
        else {
            fn(msg.data, next);
        }

        if (msg.sync) {
            msg.next();
        }
    },

    on: function (type, handler) {
        if (this.handlers[type]) {
            throw new Error('The hook has already been registered, you can use only one hook for specific event type: ' + type + ', point.id:' + (this._id || 'unknown'));
        }
        this.handlers[type] = handler;
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
        delete this.handlers[type];
    }
};

function Message(options) {
    this.origin = options.origin;
    this.type = options.type;
    this.data = options.data;
    this.position = options.position;
    this.direction = options.direction || Direction.RESPONSE;
    this.sync = options.sync || false;
    this.session = options.session;
}

Message.prototype = {
    /* position relative to current and message direction */
    relativePos: function (delta) {
        return this.direction === Direction.RESPONSE ? this.position - delta : this.position + delta;
    },

    next: function () {
        if (this.session && this.session.closed) {
            this.origin.pointAt(this.position).resume();
            return;
        }
        this.position = this.relativePos(+1);
        var point = this.origin.pointAt(this.position);
        if (!point) {
            if (this.type === 'error') {
                throw this.data;
            }
            point = this.origin.pointAt(this.relativePos(-1));
            if (this.origin.context.validate &&
            this.origin.context.validate[this.type]) {
                var err = new Error('No target consumer found for message ' +
                    this.type + ':' + JSON.stringify(this.data));
                // if this is a head of pipe, take 2 steps back
                if (this.position === -1) {
                    point = this.origin.pointAt(this.relativePos(-2));
                }
                point.throw(err);
                return;
            }
            point.resume();
            return;
        }

        point.add(this);
    }
};

function once(fn) {
    return function once() {
        fn.apply(null, arguments);
        fn = function noop() {};
    };
}
