'use strict';

/**
 * This is a generic API free from any proprietery code. TODO: open-source
*/

/**
 * Assigns transport to the client pipeline
*/
function useTransport(transportFactory, config) {
    var handlers = [];
    var transport = transportFactory(config);

    return {
        use: function use(handlerFactory) {
            handlers.push(handlerFactory(config));
            return this;
        },

        context: function context(requestContext) {
            var requestHandlers = handlers.slice();
            var responseHandlers = [];

            requestContext = requestContext || {};
            var responseContext = {};

            requestContext.use = function use(handler) {
                requestHandlers.push(handler);
                return this;
            };

            responseContext.next = function next(err) {
                responseContext.error = err === undefined ? responseHandlers.error : err;
                var handler = responseHandlers.shift();
                handler();
            };

            requestContext.next = function next(callback) {
                var handler = handlers.shift() || transport;
                // add callback
                responseHandlers.unshift(callback || function noop(err) {
                    // when handler does not need a response flow, we simulate one
                    // for the given cycle
                    responseContext.next(err);
                });
                handler(requestContext, responseContext);
            };

            if (transport.api) {
                throw new Error('Transport API should be provided');
            }

            return transport.api(requestContext, responseContext);
        }
    };
}
module.exports.transport = useTransport;
