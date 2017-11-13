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

async function (request) {
    var response = await request.continue();

    var reader = response.getReader();
    do {
        const data = reader.read();
        console.log(data);
    }
    while(data)
}

async function (request) {
    var reader = request.getReader();
    const body = '';
    while(true) {
        const data = await reader.read();
        if (!data) {
            break;
        }
        body += data;
    }
    request.body = body;

    var response = await request.continue();


}

function handler(context) {
    var request = context.request;
    await context.next();
    var response = context.response;

}
pipe.handle({
    request: function (request, next) {

    },

    response: function (response, next) {

    }
});
