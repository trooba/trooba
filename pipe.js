'use strict';

function Trooba() {
    this.factories = [];
    this.interfaces = {};
    this.decorators = [];
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
    .use(function head() {})
    .use(createHandler, config);
};

Trooba.prototype.register = function (name, fn) {
    if (this.interfaces[name]) {
        throw new Error('The implementation for "' + name + '" have already been registered');
    }
    this.interfaces[name] = fn;
};

Trooba.prototype.use = function (createHandler, config) {
    registerInterfaces(this, createHandler.interfaces);
    createHandler.decorate && this.decorators.push(createHandler.decorate);
    if (typeof createHandler === 'function') {
        var create = function (pipe) {
            if (createHandler.name) {
                pipe.name = createHandler.name;
            }
            return createHandler(pipe, config);
        };
        this.factories.push(create);
    }
    return this;
};

Trooba.prototype.build = function () {
    var trooba = this;
    var factories = this.factories;
    var interfaces = this.interfaces;
    return {
        create: function (contextOrApi) {
            if (typeof contextOrApi === 'string') {
                var api = interfaces[contextOrApi];
                if (!api) {
                    throw new Error('Cannot find requested API: ' + contextOrApi);
                }
                return api(this);
            }
            var pointAt = createActuator(factories, contextOrApi);
            var head = pointAt(0);
            head.pointAt = pointAt;
            head.factories = factories;
            trooba.decorators.forEach(function (decorate) {
                decorate(head);
            });
            return head;
        }
    };
};

function registerInterfaces(trooba, interfaces) {
    if (interfaces) {
        Object.keys(interfaces).forEach(function (name) {
            var fn = interfaces[name];
            if (!fn) {
                throw new Error('The interface "' +
                    name + '" is not a function (pipe, callback)');
            }
            trooba.register(name, fn);
        });
    }
}

function createActuator(factories, context) {
    factories = factories.slice();
    var points = [];

    return function pointAt(position) {
        while (factories.length && position >= points.length) {
            var create = factories.shift();
            var point = new PipePoint(context);
            point.position = position;
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
    this.store = {};
}

PipePoint.prototype = {
    Direction: Direction,
    decorate: function (name, fn) {
        if (name in this) {
            throw new Error('The method "' + name + '" is already present');
        }
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
            oneway: options.oneway,
            direction: options.direction || Direction.REQUEST,
            origin: this,
            position: this.position
        })
        .next();

        return this;
    },

    resume: function () {
        var self = this;
        // remove current from the queue
        this.queue.shift();
        // next message
        defer(function () {
            self.process();
        });
    },

    add: function (msg) {
        var self = this;
        // set position if not set
        this.position = this.position !== undefined ? this.position : msg.position;
        // set chain if not already set
        this.pointAt = this.pointAt || msg.origin.pointAt;
        // now check queue and decide
        this.queue.push(msg);
        // process backlog
        defer(function () {
            self.process();
        });
    },

    process: function () {
        var self = this;
        var msg = this.queue.length && this.queue.shift();
        if (!msg) {
            return;
        }

        if (msg.type === 'trace') {
            msg.data(this, msg.direction);
            if (this.pointAt(this.position + 1) === undefined) {
                msg.direction = Direction.RESPONSE;
            }
            msg.next();
            return;
        }

        var anyType = false;
        var fn = this.handlers[msg.type];
        if (!fn) {
            fn = this.handlers['*'];
            anyType = true;
        }
        if (!fn) {
            return msg.next();
        }

        var next = msg.oneway ?
        function skip() {} :
        function next(newData) {
            msg.data = newData || msg.data;

            msg.next();
            self.resume();
        };

        fn(msg.data, next);

        if (msg.oneway) {
            self.resume();
        }
    },

    on: function (type, handler) {
        if (this.handlers[type]) {
            throw new Error('The hook has already been registered, you can use only one hook for specific event type: ' + type + ', point.id:' + this._id);
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
    this.oneway = options.oneway || false;
}

Message.prototype = {
    next: function () {
        this.direction === Direction.RESPONSE ? this.position-- : this.position++;
        var point = this.origin.pointAt(this.position);
        if (!point) {
            if (this.type === 'error') {
                throw this.data;
            }
            if (this.origin.context.validate &&
            this.origin.context.validate[this.type]) {
                point = this.origin.pointAt(this.position - 1);
                var err = new Error('No target consumer found for message ' +
                    this.type + ', ' + JSON.stringify(this.data));

                point.throw(err);
            }
            return;
        }
        point.add(this);
    }
};
