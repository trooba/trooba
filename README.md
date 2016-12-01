# trooba

"Trooba" [tru:ba'] means "Pipe" in Russian

The module may serve as a base to create a pipeline to handle request/response flow in a service or a service client.

![pipeline flow](./docs/images/architecture.png)

Trooba is a stateless generic pipeline that can be used to execute multiple requests or responses/chunks in parallel without any conflicts as the contextual information is passed along with a request and a response object.

Allows to:
* Hook a transport to a pipeline
* Define a client API
* Create a pipeline of handlers
    * The handlers are executed in order they were added.
    * The request object is passed from client through a set of handlers before getting to the transport
    * The response object is passed in the reverse order of handlers from transport to the client.

## Install

```
npm install trooba --save
```

## Usage

```js
var Trooba = require('trooba');

var client = Trooba.transport(myTransportFactory) // setting transport or you can use module reference
    .use(trace)  // adding handler to trace the calls
    .use(retry, 2); // retry 2 times

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

### Trooba API

* **transport**(transportFactory[, config]) is an optional method that hooks the pipeline to the specific transport
   * *transportFactory* defines a factory to instantiate a transport
   * *config* is a config object that contains configuration info for the transport
* **interface**(function implementation(pipe) {}) is an optional method to inject a custom client interface that would be returned by *create* method
* **use**(handlerFactory[, config]) adds a handler to the pipeline
   * *handlerFactory* is a factory to instantiate a handler
   * *config* is a config object for the handler
* **create**([context]) creates a generic request function or client defined by the transport or via *interface* method. It allows to inject context that would be merged into requestContext object.

### Transport

Transport should provide an actual call using specific protocol like http/grpc/soap/rest that should be implemented by the transport provider.
It can also provide a custom API that will be exposed as if it was client native.

#### Transport API

Transport accepts accepts two parameters:
* **requestContext** holds all contextual information as well as request object
* **reply** is a function([responseContext]|([err], [response])) used to initiate response flow.

#### Use-cases

```js
// response with error that would end up at responseContext.error
function transportFactory(config) {
    return function transport(requestContext, reply) {
        reply(new Error('Error'));
    };
}

// or with response that would end up at responseContext.response
function transportFactory(config) {
    return function transport(requestContext, reply) {
        reply(null, {
            statusCode: 200,
            body: 'ok'
        })
    };
}

// or using explicit responseContext context creation
function transportFactory(config) {
    return function transport(requestContext, reply) {
        var responseContext = {
            request: {
                statusCode: 200,
                body: 'ok'
            },
            foo: bar
        }
        reply(responseContext);
    };
}
```

#### Transport definition using http protocol as a base
```js
var Http = require('http');

function transportFactory(config) {
    return function transport(requestContext, reply) {
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
                reply(null, res);
            });
        });

        req.on('error', reply);

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
    function transport(requestContext, reply) {
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
                reply(null, res);
            });
        });

        req.on('error', reply);

        req.end();
    }

    // custom API
    transport.api = pipe => {
        return {
            search: (name, callback) => {
                var requestContext = {
                    request: {
                        q: name
                    }
                }
                pipe(requestContext, responseContext => {
                    callback(responseContext.error,
                        responseContext.response && responseContext.response.body);
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

### Interface

Allows to define a custom client API if the generic request function is not enough.

```js
Trooba.interface(function implementation(pipe) {});
```

The interface implementation should be a function that returns a new function or service client object.
The function is injected with a pipe function(*requestContext*, [function onResponse(*responseContext*)]) that runs the pipeline.
It allows to configure the requestContext with required information before passing control to the first handler in request flow.
* *requestContext* is a context object specific to the given request
* onResponse(*responseContext*) function is invoked for every chunk of data or a single response.
    * *responseContext* is a response context object that may hold data for a single response or a chunk of the response data in case of streaming response.
        * responseContext object is defined by a specific transport response flow.
        * It can be different between chunks or shared based on how the transport defines it.
        * The transport should define a method to signal the end of the stream, for example it can set a flag in the responseContext or pass undefined instead of responseContext.

```js
Trooba.transport(transportFactory, {
    protocol: 'https:',
    hostname: 'www.google.com',
    path: '/search'
})
.interface(function api(pipe) {
    return {
        search: (name, callback) => {
            requestContext = {
                request: {
                    q: name
                }
            };
            pipe(requestContext, function onResponse(responseContext) {
                callback(responseContext.error,
                    responseContext.response && responseContext.response.body);
            })
        }
    }
})
.create().search('nike', (err, response) => console.log);
```

#### Custom API via interface with configuration

```js
Trooba.transport(transportFactory, {
    protocol: 'https:',
    hostname: 'www.google.com',
    path: '/search'
})
.interface(config => {
    return function api(pipe) {
        return {
            search: (name, callback) => {
                requestContext = {
                    request: {
                        q: name
                    }
                };
                pipe(requestContext, function onResponse(responseContext) {
                    callback(responseContext.error,
                        responseContext.response && responseContext.response.body);
                })
            }
        }
    }
})
.create().search('nike', (err, response) => console.log);
```

### Handler definition

Each handler should perform a unique function within a pipeline, such as error handling, retry logic, tracing.

The handler accepts two parameters:

* **requestContext** holds all contextual information as well as request object
* **action** is an object that provides two actions:
    * action.**next**([requestContext], [function (responseContext)]) passes control to the next handler in the request pipeline
    * action.**reply**([responseContext]|([err], [response])) passes control to the next handler in the response pipeline.
        * **reply** can work in 2 ways
            * reply(error, response) as a standard callback that will implicitly create a requestContext if it has not already been created and assign error to responseContext.error and the response to responseContext.reponse field.
            * reply(responseContext) which can pass the existing responseContext received from action.**next** call or overwritten by a new one.


##### Request flow only handler

```js
function handlerFactory() {
    return function handler(requestContext, action) {
        // manipulate request context
        requestContext.request.fa1 = 'zx1';
        // pass control to the next handler in request pipeline
        action.next();
    };
}
```

##### Request/response flow handler

```js
function handlerFactory() {
    return function handler(requestContext, action) {
        // manipulate request context
        requestContext.request.fa1 = 'zx1';
        // pass control to the next handler in request pipeline
        requestContext.next(function onResponse(responseContext) {
            // do something with responseContext
            // transport can add any value to responseContext
            // err passed is also present as responseContext.error
            // pass control to next handler in response pipeline
            action.reply(responseContext);
            // but you can also pass a new one
            // action.reply(new Error('More important error'))
        });
    };
}
```

##### Reply with error

```js
function handlerFactory() {
    return function handler(requestContext, action) {
        // pass control to the response handler
        action.reply(new Error('Bad reponse'));
    };
}
```

##### Reply with response

```js
function handlerFactory() {
    return function handler(requestContext, action) {
        // pass control to the response handler
        action.reply(null, {
            statusCode: 200,
            body: 'Hello world'
        });
    };
}
```

##### Continue an existing response flow

```js
function handlerFactory() {
    return function handler(requestContext, action) {
        // pass control to the next handler in request pipeline
        requestContext.next(function onResponse(responseContext) {
            // update response context
            responseContext.foo = 'bar';
            // or response
            responseContext.response.body = JSON.parse(responseContext.response.body);
            // continue response flow
            action.reply();
        });
    };
}
```

##### Continue an existing request flow

```js
function handlerFactory() {
    return function handler(requestContext, action) {
        requestContext.foo = 'bar';
        requestContext.request.body = JSON.stringify(requestContext.request.body);
        // pass control to the next handler in request pipeline
        requestContext.next();
    };
}
```

#### Retry handler example

```js
var Assert = require('assert');
var Trooba = require('trooba');

function retryFactory(config) {
    return function handler(requestContext, action) {
        // init retry context
        if (requestContext.retry === undefined) {
            requestContext.retry = config.retry;
        }
        action.next(function onReply(responseContext) {
            if (responseContext.error && requestContext.retry-- > 0) {
                action.next(onResponse);
                return;
            }
            action.reply(responseContext);
        });
    };
}

// mock transport
function mockTransportFactory(config) {
    var count = 1;
    return function mock(requestContext, action) {
        // first generate error
        if (count-- > 0) {
            return action.reply(new Error('Test error'));
        }
        action.reply(null, 'some text');
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

Based on [trooba-xhr-transport](https://github.com/trooba/trooba-xhr-transport)

```js
var xhrTransportFactory = require('trooba-xhr-transport');
require('trooba')
    .transport(xhrTransportFactory, {
        protocol: 'http:',
        hostname: 'myapi.service.xyz'
        socketTimeout: 1000
    })
    .create()
    .get({
        q: 'nike'
    })
    .set('some', 'header')
    .end(function (err, response) {
        console.log(err, response && response.body)
    });
```

### RESTful client

Based on [trooba-http-transport](https://github.com/trooba/trooba-http-transport)

```js
require('trooba')
    .transport(httpTransportFactory, {
        protocol: 'http:',
        hostname: 'www.google.com',
        connectTimeout: 100,
        socketTimeout: 1000
    })
    .create()
    .get({
        q: 'nike'
    })
    .set('some', 'header')
    .end(function (err, response) {
        console.log(err, response && response.body)
    });
```

### gRPC client

Based on [trooba-grpc-transport](https://github.com/trooba/trooba-grpc-transport)

```js
var grpcTransportFactory = require('trooba-grpc-transport');

require('trooba')
    .transport(grpcTransportFactory, {
        protocol: 'http:',
        hostname: 'grpc.service.my',
        port: 50001,
        proto: require.resolve('path/to/hello.proto')
    })
    .create()
    .hello('Bob', function (err, response) {
        console.log(err, response)
    });
```

### Mocking

```js
var request = require('trooba')
    .transport(function mockFactory() {
        return mock(requestContext, reply) {
            reply(new Error('Simulate error'));
        }
    })
    .create();

request({foo:'bar'}, function (err, response) {
    console.log(err, response)
});
```
