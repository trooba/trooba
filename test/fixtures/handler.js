'use strict';

module.exports = function testHandler(pipe) {
    pipe.on('request', function (request, next) {
        request.test = true;
        next();
    });
};
