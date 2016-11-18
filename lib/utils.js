'use strict';

module.exports.clone = function clone(src) {
    var dest = src;

    if (typeof src === 'object' && src !== null) {
        dest = Array.isArray(src) ? [] : Object.create(Object.getPrototypeOf(src));
        Object.getOwnPropertyNames(src).forEach(function (prop) {
            Object.defineProperty(dest, prop, Object.getOwnPropertyDescriptor(src, prop));
        });
    }

    return dest;
};

module.exports.selectArg = function selectArg(args, type) {
    for (var i = 0; i < args.length; i++) {
        if (args[i] !== undefined && typeof args[i] === type) {
            return args[i];
        }
    }
};
