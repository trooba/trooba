'use strict';

module.exports = function testFactory() {
    return function testHandler(requestContext, action) {
        requestContext.request.test = true;
        action.next();
    };
};
