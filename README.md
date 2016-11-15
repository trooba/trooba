# trooba

"Trooba" [tru:ba'] means "Pipe" in Russian

The module may serve as a base to crete pipeline to handle request/response flow in service or service client.

Features:
* Define transport with customizable API
* Define pipeline of handlers executed in request and response flow according to the order they are added.

## Install

```
npm install trooba --save
```

## Usage

```js
var Trooba = require('trooba');

var client = Trooba.transport(myTransportFactory) // setting transport or you can use module reference
    .use(traceFactory)  // adding handler to trace the calls
    .use(retryFactory); // retry logic

var request = client.create({  // injecting context
    foo: bar   
})

// Make service calls
request({   // request parameters
    qwe: 'asd'
}, function (err, response) {
    console.log(err || response);
})
```

### Transport definition

Transport should provide an actual call using specific protocol like http/grpc/soap/rest that should be implemented by the transport provider.
It can also provide a custom API that will be exposed as if it was client native.

#### Transport definition using http protocol as a base
```js
var Http = require('http');

function transportFactory(config) {
    return function transport(requestContext, responseContext) {
        var options = Object.create(config);
        options.path += '?' + Querystring.stringify(requestContext.request);
        // prepare request
        var req = Http.request(options, res => {
            var data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                res.body = data;
                responseContext.next(null, res);
            });
        });

        req.on('error', responseContext.next);

        req.end();
    };
}

var request = Trooba.transport(transportFactory, {
    protocol: 'https:',
    hostname: 'www.google.com',
    path: '/search?q=nike'
}).create();

request({
    q: 'nike'
}, (err, response) => console.log);
```

#### Transport definition using http protocol and custom API

```js
function transportFactory(config) {
    function transport(requestContext, responseContext) {
        const qs = '?' + Querystring.stringify(requestContext.request);
        var options = {
            protocol: config.protocol,
            hostname: config.hostname,
            path: config.path ?
                config.path += qs : qs
        };
        // prepare request
        var req = Http.request(options, res => {
            var data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                res.body = data;
                responseContext.next(null, res);
            });
        });

        req.on('error', responseContext.next);

        req.end();
    }

    transport.api = pipe => {
        return {
            search: (name, callback) => {
                pipe((requestContext, responseContext) => {
                    requestContext.request = {
                        q: name
                    };
                    requestContext.next((err, response) => {
                        callback(responseContext.error,
                            responseContext.response && responseContext.response.body);
                    });
                })
            }
        };
    };

    return transport;
}
// create a client
var client = Trooba.transport(transportFactory, {
    protocol: 'https:',
    hostname: 'www.google.com',
    path: '/search'
}).create();
// call the API
client.search('nike', (err, response) => console.log);
```

### Handler definition

Each handler should perform a unique function within pipeline, such as error handling, retry logic, tracing.

* Request flow only handler

```js
function handlerFactory() {
    return function handler(requestContext, responseContext) {
        // manipulate request context
        requestContext.request.fa1 = 'zx1';
        // pass control to the next handler in request pipeline
        requestContext.next();
    };
}
```

* Request/response flow handler

```js
function handlerFactory() {
    return function handler(requestContext, responseContext) {
        // manipulate request context
        requestContext.request.fa1 = 'zx1';
        // pass control to the next handler in request pipeline
        requestContext.next(function onResponseFlow(err) {
            // do something with responseContext
            // transport can add any value to responseContext
            // err passed is also present as responseContext.error
            // pass control to next handler in response pipeline
            responseContext.next();
            // but you can also pass a new one
            // responseContext.next(new Error('More important error'))
        });
    };
}
```

#### Retry handler example

```js
var Assert = require('assert');
var Trooba = require('trooba');
function retryFactory(config) {
    return function handler(requestContext, responseContext) {
        // init retry context
        if (requestContext.retry === undefined) {
            requestContext.retry = config.retry;
        }
        requestContext.next(function () {
            if (responseContext.error && requestContext.retry-- > 0) {
                requestContext.next();
                return;
            }
            responseContext.next();
        });
    };
}

// mock transport
function mockTransportFactory(config) {
    var count = 1;
    return function mock(requestContext, responseContext) {
        // first generate error
        if (count-- > 0) {
            return responseContext.next(new Error('Test error'));
        }
        responseContext.next(null, 'some text');
    };
}

var request = Trooba.transport(mockTransportFactory)
    .use(retryFactory, { retry: 1 })
    .create();

request({}, (err, response) => {
    Assert.ok(!err);
    Assert.equal('some text', response);
});
```

## Examples

### Ajax client

### RESTful client with custom API

### gRPC client

### Mocking
