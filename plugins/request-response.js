'use strict';

module.exports = {
    decorate: function (pipe) {
        pipe.decorate('request', function (request, callback) {
            this.send('request', request);

            if (callback) {
                this.once('error', callback)
                .once('response', function (response) {
                    callback(null, response);
                });
            }
            return createStream(this, pipe.Direction.REQUEST);
        });

        pipe.decorate('respond', function (response) {
            this.send('response',
                response, pipe.Direction.RESPONSE);
            return createStream(this, pipe.Direction.RESPONSE);
        });
    }
};


function createStream(pipe, direction) {
    var closed;
    var session = {};

    return {
        on: function () {
            pipe.on.apply(pipe, arguments);
            return this;
        },

        once: function () {
            pipe.once.apply(pipe, arguments);
            return this;
        },

        write: function (data) {
            if (session.closed) {
                // in case stream close somewhere else and
                // should be ignored
                return;
            }
            if (closed) {
                throw new Error('The stream has been closed already');
            }
            var type = direction === pipe.Direction.REQUEST ?
                'request:data' : 'response:data';

            pipe.send({
                type: type,
                data: data,
                direction: direction,
                session: session
            });

            if (data === undefined) {
                closed = true;
            }

            return this;
        },

        end: function (data) {
            data && this.write(data);
            // mark end of stream
            this.write(undefined);
            return this;
        }
    };
}
