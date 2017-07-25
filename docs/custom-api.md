# Custom API

Custom API is useful when one would like to abstract from a specific protocol and be able to replace transports while maintaining the same API.

For example, let's assume we want to use superagent API for our pipeline.

_superagent.js_
```js
module.exports = function (pipe) {
    pipe.set('superagent', function factory(pipe) {
        return new Superagent(pipe);
    });
};

class Superagent {
    constructor(pipe) {
        this.pipe = pipe;
        this.options = {
            method: 'GET'
        };
    }

    request(options) {
        this.options = options;
        return this;
    }

    post(body) {
        this.options.method = 'POST';
        this.options.body = body;
        return this;
    }

    get(path) {
        this.options.path = path;
        return this;
    }

    end(callback) {
        // here we should initiate an actual flow
        this.pipe.create().request(this.options, callback);
    }
}

```

_superagent-use.js_
```js
// Now let's use it
const pipe = require('trooba')
    .use(require('./superagent'))
    .use(function mockTransport(pipe) {
        pipe.on('request', request => {
            pipe.respond({
                statusCode: 200,
                body: {
                    greeting: 'Hello World'
                }
            })
        });
    })
    .build();

const agent = pipe.create('superagent');
agent.get('path/to/resource').end((err, response) => {
    console.log(response.body);
});
```
