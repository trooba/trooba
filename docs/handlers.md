# Handlers

Handlers are the main building blocks of the pipeline and define the flow structure.

Each handler should perform a unique function within a pipeline, such as error handling, retry logic, tracing.

The handler has the same signature as the transport, the difference only in what one does with pipe and what events it listens to.

_oauth.js_
```js
module.exports = function (pipe, config) {
    // assume we pass key store via config
    const keyStore = config.keyStore;
    // wait for request
    pipe.on('request', (request, next) => {
        // assume we have user information in the context
        if (!pipe.context.user) {
            return pipe.throw(new Error('Cannot find user credentials'));
        }
        // get the token
        keyStore.getToken(pipe.context.user)
            .then(token => {
                pipe.context.token = token;
                // continue to the next handler
                next();
            })
            .catch(err => pipe.throw(err));
    });
};
```
