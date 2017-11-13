/*jslint esversion:6 */
'use strict';

module.exports = {
    decorate: function (pipe) {
        // let some handlers use koa via koa annotation
        pipe.runtimes.koa = function koaRuntime(fn) {
            var pipe = this;
            pipe.on('request', function (request, next) {
                var context = pipe.context;
                var origResponse = context.response;
                context.request = request;
                context.throw = function (err) {
                    pipe.throw(err);
                };

                var callback = function () {
                    // callback will represent next call
                    // that must serve dual function
                    // continue original flow
                    // or initiate request retry if needed
                    pipe.removeListener('error');
                    pipe.removeListener('response');
                    return new Promise(function (resolve, reject) {
                        pipe.once('response', function (response, next) {
                            context.response = response || context.response;
                            resolve();
                        });

                        pipe.once('error', reject);
                        context.response = undefined;
                        next();
                        next = () => {
                            pipe.request(context.request);
                        };
                    });
                };

                var ret;
                try {
                    ret = fn(context, callback);
                }
                catch (err) {
                    // if this happens, it would be sync function flow
                    return pipe.throw(err);
                }

                if (ret instanceof Promise) {
                    ret
                    .then(function () {
                        pipe.respond(context.response);
                    })
                    .catch(function (err) {
                        pipe.throw(err);
                    });
                }
                else {
                    if (!origResponse) {
                        // first time response
                        pipe.respond(context.response);
                    }
                }
            });
        };
    }
};
