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
            return this;
        });

        pipe.decorate('respond', function (response) {
            this
            .send('response', response, pipe.Direction.RESPONSE);
            return this;
        });
    }
};
