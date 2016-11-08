'use strict';

module.exports = function () {
    return function tr(requestContext, responseContext) {
        requestContext.called = true;
        responseContext.next();
    };
};
