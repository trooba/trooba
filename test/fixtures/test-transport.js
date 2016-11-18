'use strict';

module.exports = function () {
    return function tr(requestContext, reply) {
        requestContext.called = true;
        reply();
    };
};
