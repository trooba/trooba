/*jslint esversion:6 */
'use strict';

module.exports = {
    decorate: function (pipe) {
        pipe.decorate('get', function (type) {
            pipe = this;
            pipe[type] = pipe[type] || new Promise((resolve, reject) => {
                if (type !== 'error') {
                    pipe.once(type, (data, next) => {
                        next = once(next);
                        var ret = {next};
                        ret[type] = data;
                        pipe.removeListener('error');
                        delete pipe[type];
                        resolve(ret);
                    });
                }
                pipe.once('error', err => {
                    pipe.removeListener(type);
                    delete pipe[type];
                    reject(err);
                });
            });
            return pipe[type];
        });

        // let some handlers use koa via koa annotation
        pipe.runtimes.asyncGeneric = function asyncGenericRuntime(fn) {
            var pipe = this;
            try {
                var ret = fn(pipe);
                if (ret instanceof Promise) {
                    ret.catch(function (err) {
                        pipe.throw(err);
                    });
                }
            }
            catch (err) {
                // if this happens, it would be sync function flow
                return pipe.throw(err);
            }
        };
    }
};

function once(fn) {
    return function () {
        var ret = fn.apply(null, arguments);
        fn = () => {};
        return ret;
    };
}
