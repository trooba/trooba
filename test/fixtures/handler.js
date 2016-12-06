'use strict';

module.exports = function testFactory() {
    return function testHandler(requestPipe) {
        requestPipe.context.request.test = true;
        requestPipe
            .next();
    };
};
