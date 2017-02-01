<p align="center">
    <img src="https://github.com/trooba/branding/raw/master/images/trooba_trans_bg.png" alt="Trooba logo" width="332" /><br /><br />
</p>

[![codecov](https://codecov.io/gh/trooba/trooba/branch/master/graph/badge.svg)](https://codecov.io/gh/trooba/trooba)
[![Build Status](https://travis-ci.org/trooba/trooba.svg?branch=master)](https://travis-ci.org/trooba/trooba) [![NPM](https://img.shields.io/npm/v/trooba.svg)](https://www.npmjs.com/package/trooba)
[![Downloads](https://img.shields.io/npm/dm/trooba.svg)](http://npm-stat.com/charts.html?package=trooba)
[![Known Vulnerabilities](https://snyk.io/test/github/trooba/trooba/badge.svg)](https://snyk.io/test/github/trooba/trooba)

"Trooba" [tru:ba'] means "Pipe" in Russian and [it is not a pipe.](https://www.wikiart.org/en/rene-magritte/the-treachery-of-images-this-is-not-a-pipe-1948)

## What is it?

Trooba a fast isomorphic lightweight pipeline framework from eBay. Trooba can build pipelines for request/response, stream/response, request/response and stream/stream use-cases spanning from a browser to a front-end app and further to a backend services.

It uses a stateless generic pipeline/bus used to route multiple requests in "parallel" without any conflicts. The contextual information is passed along with the message.

Trooba does not dictate specific data structures that should be used for request/response/messages/stream objects. It assumes basic requirements and leaves everything else to the implementor of the transport.

## What is it not?

It is not another http based server framework like express, koa or hapi. It can be used to build a pipline for those as it is protocol independent and allows to specify any transport one needs. For example see [examples](#examples)

## What can it do for you?

* Define a pipeline of handlers and execute it
    * The handlers are executed in order they were added.
* Define a service client:
    * The request object is passed from client through a set of handlers before getting to the transport handler.
    * The response object is passed in the reverse order of handlers from transport handler to the client.
* Define a service:
    * The request object is passed from transport through a set of handlers before getting to the controller
    * The response object is passed in the reversed order from the controller defined by the user through a set of handlers to the transport of the service.
* Set transport handler or a set of them in the fallback order (http, soap, grpc, mock or custom) for a pipeline.
* Inject API that can be returned by pipe.build().create(customApiName) method, mostly useful to provide a protocol specific API, for example, gRPC can expose API defined in proto file as client and service API or soap API defined by wsdl.
* It supports request/response, pub/sub or a mix of these modes or you can use it as a one-way or bidirectional message bus.
* You can link different pipelines together in definition or on-the-fly.
* You can trace the route to troubleshoot any problems or learn some complex pipeline.

![pipeline flow](https://github.com/trooba/branding/raw/master/images/arch.png)

## Get Involved

- **Contributing**: Pull requests are welcome!
    - Read [`CONTRIBUTING.md`](.github/CONTRIBUTING.md) and check out our [bite-sized](https://github.com/trooba/trooba/issues?q=is%3Aissue+is%3Aopen+label%3Adifficulty%3Abite-sized) and [help-wanted](https://github.com/trooba/trooba/issues?q=is%3Aissue+is%3Aopen+label%3Astatus%3Ahelp-wanted) issues
    - Submit github issues for any feature enhancements, bugs or documentation problems
- **Support**: Join our [gitter chat](https://gitter.im/trooba) to ask questions to get support from the maintainers and other Trooba developers
    - Questions/comments can also be posted as [github issues](https://github.com/trooba/trooba/issues)

## Install

```
npm install trooba --save
```

## Usage

#### Client example

Example on how the pipe for http calls can be configured. The middleware used is for demonstration and is not provided out of the box except for the transport and need to be built. You can try simpler working examples mentioned down this page.

```js
require('trooba')
    .use('circuit')
    .use('retry')
    .use('logging')
    .use('tracing')
    .use('security')
    .use('tracking')
    .use('trooba-http-transport', {
        protocol: 'http:',
        hostname: 'www.google.com',
        connectTimeout: 100,
        socketTimeout: 1000
    })
    .build()                    // build the pipe
    .create('client:default')     // create client
    .request({                  // initiate a request
        q: 'nike',
        method: 'GET'
    }, function (err, response) {// get the results
        console.log(err || response.body.toString());
    });
```

#### Service example

Example on how one can configure a service endpoint. The middleware used is for demonstration and is not provided out of the box except for the transport and needs to be built. You can try simpler working examples mentioned down this page.

```js
require('trooba')
    .use('trooba-grpc-transport', {
        port: port,
        hostname: 'localhost',
        proto: Grpc.load(require.resolve('./path/to/hello.proto'))
    })
    .use('tracing')
    .use('rate-limiter')
    .use('security')
    .use('tracking')
    .use('router')
    .build()                    // build the pipe
    .create('service:default')     // create service
    .listen();
```

#### Building a pipe

```js
var pipe = require('trooba')
    // adding handler to collect metrics
    .use(function (pipe) {
        var start;
        pipe.on('request', function (request, next) {
            start = Date.now();
            next(); // continue with request
        })
        pipe.on('response', function (response, next) {
            console.log('call time is', Date.now() - start, 'ms');
            next(); // continue with reponse flow
        })
    })  
    .use(retry, 2); // retry 2 times, see example of retry handler below
```

#### Adding a transport

```js
// setting transport or you can use module reference
pipe.use(function transport(pipe) {
    // hook to request
    pipe.on('request', function (request) {
        // respond
        pipe.respond('Hello ' + request.name);
    })
})
```

#### Make a request

Injecting static context if any needed or this can be skipped.
```js
pipe = pipe.build()
```
At this point the pipe becomes re-usable between multiple "parallel" requests.

Make a request
```js
pipe.create()
    .request({
        name: 'John'
    })
    .on('error', console.error)
    .on('response', console.log);
```

Or you can do it with a callback style
```js
pipe.create()
    .request({
        name: 'John'
    }, console.log);
```

**Note:** Though pipe API to add hooks looks like event emitter, it does not allow multiple hooks and will throw error if one attempts to add a hook for the event that already has it.
If you really need to support multiple listeners, you can add an event dispatcher as a hook.

#### Creating custom pipeline protocols

The 'request' and 'response' hooks used above are just event names and a developer is not limited to them.
One can create different protocols using different names. Trooba framework just provides default protocol based on request/response pattern. One can mix custom events in the default pipeline or create completely new one if needed.

##### Adding custom event

Let's assume we want to update global config for some handlers.

```js
// setting transport or you can use module reference
let config;    

pipe.use(function config(pipe) {
    // hook to config message
    pipe.on('config', function (cfg) {
        config = cfg;
    });
})
```

##### Broadcast configuration
```js
pipe.create()
    .send({
        type: 'config',
        flow: Types.REQUEST,
        ref: {
            some: 'config'
        }
    });
```

### Trooba API

* **use**(handler[, config]) adds a handler to the pipeline
   * *handler* is a function handler(pipe) {} or another pipe to join into this pipe.
   * *config* is a config object for the handler
* **build**([context]) creates a pipe and returns a generic pipe object.
* **set**(name, value) used set system value to the context. The name is prefixed with '$' that prevents it from being propagated beyond the current pipe context boundaries.
* **get**(name) is used to get system value from the context.

### Pipe API

The pipe object is passed to all handlers and transport during initialization whenever new context is created via trooba.build(context) or pipe.create(context) call.

* **create**([context], [customApiImpl]) creates a pipeline with new context or clones from the existing one if any present. The method is mandatory to initiate a new flow, otherwise the subsequent call will fail.
     * **context** is a context object to be used in request/message flow.
     * **customApiImpl** is a name for a specific API implementation. It allows to inject custom API provided by one of the handlers that needs to be returned instead of the generic pipe interface.
* **context** is an object available to all handlers/transport in the same request/response flow. One can use it to store data that needs to be shared between handlers if needed. The values in the context that have their names started with '$' will not be propagated beyond the pipe boundaries. To access context one can use pipe.context;
* **link**(pipe) links passed pipeline to the current one. The link between pipes exists as long as the context where they were linked exists. Once pipe.create is used, it will lose the link. The linking can be useful to join pipes on the fly, for example to bootstrap pipe from config file and inline it into existing pipeline where bootstrap handler is registered.
```js
Trooba.use(function bootstrapPipe(pipe) {
    // load all the handlers from some json or config file
    var handlers = []; // assume it is loaded as an array
    // build the pipe or load from cache
    var bootstrappedPipe = handlers.reduce((trooba, handler) => {
        return trooba.use(handler);
    }, Trooba).build();
    // link it
    pipe.link(bootstrappedPipe);
});
```
* **request**(requestObject) creates and sends an arbitrary request down the pipeline. If context was not used, it will implicitly call *create* method
* **respond**(responseObject) initiates a response flow and sends an arbitrary response object down the response pipeline. This can be called only after the request flow is initiated.
* **resume**() resumes the processing in the given pipe point in ordered flow whenever the current message/response/request flow was paused due to processing of the ordered message and it was suppressed/swallowed, i.e. no throw/response/request/next action followed.
* **streamRequest**(requestObject) creates and sends an arbitrary request down the pipeline. If context was not used. It returns write stream with methods:
    * **write(data)** write a chunk to the stream as "request:data" message
    * **end()** ends the stream and send "request:end" message
* **streamResponse**(responseObject) - initiates a response stream flow and sends an arbitrary response object down the response pipeline. This can be called only after the request flow is initiated. It returns write stream with methods:
    * **write(data)** write a chunk to the stream as "response:data" message
    * **end()** ends the stream and send "response:end" message
* **send**(message) sends a message down the request or response flow depending on the message type. For more details see message structure below. The method can be used to send a custom message.
* **throw**(Error) sends the error down the response pipeline. If no error hooks defined in the pipeline, it will throw error. The method can be called only after the response flow is initiated.
* **trace**([Function callback(err, listOfPoints)]) is to trace the route that any message would travel, it uses message.type = 'trace' and returns a list of point it traveled in request/response flow.
* **set**(name, value) sets arbitrary system key-value pair to the context which will not be explicitly propagated beyond transport boundaries as internally the name will be prefixed as $name. It is used to provide custom API by handlers.
* **get**(name) reads system value from the context.

#### Message

The framework defines a message bus to send and receive messages within the pipeline.

The current message structure:

* **type** is a String that defines a message type which can be used in pipe.on() and .once()
* **flow** is a Number that defines flow type. It will define the direction of the message in the pipeline
    * 1 - request
    * 2 - response
* **ref** is a reference to the data being sent in the message
* **sync** is boolean, if equals true, the message will be propagated to all pipe points at the same time, no callback is needed to control when to send it to the next handler in the pipeline.
* **order** is boolean value that controls order, if set to true, the message will be queued at any pipe point if similar ordered message is already in process by the given point.
* The rest of the fields will be assigned by the framework and should not be changed

Example:
```json
{
    "type": "error",
    "flow": 1,
    "ref": "[Error: some error message]",
    "sync": true
}
```

**Note:** Since Trooba framework is based on message propagation through the pipeline, it uses time-to-live (TTL) parameter to limit the time the message can travel through the pipeline. By default it uses Infinity for TTL, but you can configure it using config.ttl parameter.

When a message is expired, it will be dropped through console.log by default or you can intercept it by registering your own onDrop handler to the context
```js
// set TTL to 2 seconds
pipe.build({
    ttl: 2000, // msec
    onDrop: function (message) {
        console.log('dropped message:', message);
    }
})
```

### Streaming support

Trooba provides streaming of messages using its own logic instead of using nodejs native streaming to provide isomorphism. Whenever one would like to use nodejs streams, one can do this by wrapping it into [trooba-streaming](https://github.com/trooba/trooba-streaming) adaptors that provide nodejs native streams. For example, one can look at [trooba-grpc-transport](https://github.com/trooba/trooba-grpc-transport).

The framework support two stream modes, ordered and un-ordered. By default only request and response streaming flow are ordered.

If one would like to enable ordering for other type of messages, one can use order attribute in the message object:
```js
pipe.send({
    type: 'custom',
    flow: Types.REQUEST,
    ref: 'some data',
    order: true
})
```

When pipe point accepts ordered message for processing, i.e. it has request/response/data handlers registered, it will pause the point for any other ordered message that comes afterwards. The point will be resumed whenever the given message is transferred further via next() call or new message is originated via pipe.request/pipe.respond. If none of the actions happens, in case one wants to suppress the current data, one can resume the point using pipe.resume() call. *Note:* pipe.throw() will not resume the pipe.

The method pipe.trace() can be used to get information about state of the points including if any of them has non-empty queue (pipe.queue.size() > 0), i.e. is in a paused state.

#### Streaming request

```js
var Trooba = require('.');
var pipe = new Trooba()
.use(function (pipe) {
    pipe.on('request:data', function (data, next) {
        console.log('data: ', data !== undefined ? data : 'end of stream');
        next();
    });
}).build();

pipe.create()
    .streamRequest()
    .write('foo')
    .write('bar')
    .end();
```

#### Streaming response

```js
var Trooba = require('.');
var pipe = new Trooba()
.use(function (pipe) {
    pipe.on('request', function (request) {
        pipe.streamResponse({
            statusCode: 200
        })
        .write('foo')
        .write('bar')
        .end();
    });
}).build();

pipe.create()
    .request()
    .on('response:data', function (data, next) {
        console.log('data:', data !== undefined ? data : 'end of stream');
        next();
    });
```

### Handler definition

Each handler should perform a unique function within a pipeline, such as error handling, retry logic, tracing.

The handler has the same signature as the transport, the difference only in what one does with pipe and what events it listens to.

##### Request flow only handler

```js
function handler(pipe, config) {
    // manipulate request context
    pipe.context.fa1 = 'zx1';
    // wait for request and pass control back to the pipeline via next()
    pipe.on('request', function (request, next) {
        request.foo = 'bar'; // modify request
        // pass control back to pipeline with the same request
        next();
        // or you can re-write the request completely
        /*
        next({
            qaz: 'frt'
        })
        */
    });
}
```

##### Response flow only handler

```js
function handler(pipe, config) {
    // wait for response and change it
    pipe.on('response', function (response, next) {
        // modifying the response
        response.wer = 'wer';
        // pass control back to the pipeline
        next();
        // of we can re-write response completely
        /*
        next({
            my: 'new response'
        })
        */
    })
}
```

##### Request/response flow handler

```js
function handler(pipe) {
    // manipulate request context
    pipe.fa1 = 'zx1';
    var requestObj;
    pipe.on('request', function (request, next) {
        // modify request object if needed
        request.foo = 'bar';
        // modify shared data
        requestObj = request;
        // pass control to the next handler in request pipeline
        next();
        /*

        // you can also stop the flow an respond if needed or throw error
        pipe.respond('Hi');

        // throw Error
        pipe.throw(new Error());

        */
    });

    pipe.on('response', function (response, next) {
        // modify response object if needed
        response.body = JSON.parse(response.body);
        // access context
        console.log(pipe.context);
        // pass control down the response flow
        next();

        /*

        // or replace the response
        next({
            my: 'new response'
        })

        // of you can re-initiate request flow with shared request object
        pipe.request(requestObj);

        // or throw error
        pipe.throw(new Error());

        */
    })
}
```

##### Streaming request flow handler

```js
function handler(pipe, config) {
    if (pipe.context.$requestStream) {
        pipe.on('request:data', function (data, next) {
            // undefined data means end of stream,
            data = data ? JSON.stringify(data) : data;
            next(data);
        });
    }
}
```

##### Streaming response flow handler

```js
function handler(pipe, config) {
    if (pipe.context.$responseStream) {
        pipe.on('response:data', function (data, next) {
            // undefined data means end of stream,
            data = JSON.parse(data);
            next(data);
        });
    }
}
```

##### Reply with error

```js
function handlerFactory() {
    return function handler(pipe) {
        pipe.on('request', function (request) {
            // pass control to the response handler
            pipe.throw(new Error('Bad response'));
        })
    };
}
```

##### Reply with response

```js
function handlerFactory() {
    return function handler(pipe) {
        pipe.on('request', function (request) {
            // pass control to the response handler
            pipe.respond({
                statusCode: 200,
                body: 'Hello world'
            });
        })
    };
}
```

##### Continue the existing response flow

```js
function handlerFactory() {
    return function handler(pipe) {
        pipe.on('response', function (response, next) {
            next();
        });
    };
}
```

##### Continue an existing request flow

```js
function handler(pipe) {
    pipe.on('request', function (request, next) {
        next();
    })
}
```

#### Retry handler example

```js
var Assert = require('assert');
var Trooba = require('trooba');

var retryCounter = 0;

function retry(pipe, config) {
    pipe.on('request', function (request, next) {
        var retry = config.retry;

        pipe.on('error', function (err) {
            if (retry-- > 0) {
                // re-try request
                retryCounter++;
                pipe.request(request);
                return;
            }
            pipe.throw(err);
        });

        // continue with request flow
        next();
    });
}

// mock transport
function createMockTransport() {
    var count = 1;
    return function mock(pipe) {
        pipe.on('request', function () {
            // first generate error
            if (count-- > 0) {
                return pipe.throw(new Error('Test error'));
            }
            pipe.respond('some text');
        });
    };
}

var pipe = Trooba
    .use(retry, { retry: 1 })
    .use(createMockTransport())
    .build();

pipe
.create()
.request({}, function (err, response) {
    Assert.ok(!err, err && err.stack);
    Assert.equal('some text', response);
    Assert.equal(1, retryCounter);
    done();
});
```

### Tracing

The framework allows to trace any and all messages.
Useful when the complexity of the pipeline requires one to check the route the message travels.

```js
Trooba
.use(function h1(pipe) {
})
.use(function h2(pipe) {
})
.use(function tr(pipe) {
    pipe.on('request', function () {
        pipe.respond('response')
    })
})
.build()
.create()
.trace(function onResult(err, listOfPoints) {
    var list = listOfPoints.reduce((list, point) => {
        list.push(point.handler.name + '(' + point.queue().size() + ')');
        return list;
    });
    console.log('The route is ', list.join('->'))
});
```

Or more flexible option to monitor the pipe

```js
var route = [];

Trooba
.use(function h1(pipe) {
})
.use(function h2(pipe) {
})
.use(function tr(pipe) {
    pipe.on('request', function () {
        pipe.respond('response');
    });
})
.build()
.create({
    trace: function (point, message) {
        route.push(point.handler.name + '-' + (message.flow === 1 ? 'req' : 'res'))

    }
})
.request('request', function () {
    console.log(route.join('->'));
});
```

### Enforcing delivery

To make sure a specific message type or request/response reach the destination, one can set validate options.

```js
Trooba
.use()
.build()
.create({
    validate: {
        request: true,
        response: true
    }
})
.request('request', function () {
    console.log(route);
});
```

### Transport

Transport is a handler that should provide an actual implementation of the corresponding protocol (http/grpc/soap/rest). Usually the request flow would be terminated at transport point and the response flow is initiated.

It can also provide a custom API that cab be injected into context using pipe.set() end accessed using get() method.

For example:
```js
var service = pipe.build().create('service:hello');
service.hello('John');
```

#### Transport usage

```js
// throw error
function transport(pipe, config) {
    pipe.on('request', function (request) {
        pipe.throw(new Error('Error'));
    })
}

// reply with http response
function transport(pipe, config) {
    pipe.on('request', function (request) {
        pipe.respond({
            statusCode: 200,
            body: 'ok'
        });
    })
}

// accessing context information
function transport(pipe) {
    // executed only once here for every request
    console.log('context info:', pipe.context);
    pipe.on('request', function () {
        // or here
        console.log('context info within request flow:', pipe.context);
        pipe.respond('ok');
    })
}
```

#### Transport definition using http protocol as a base

For a more advanced example, please see [trooba-http-transport](https://github.com/trooba/trooba-http-transport) module

```js
var Http = require('http');

function transport(pipe, config) {
    pipe.on('request', function (request) {
        var options = Object.create(config);
        options.path += '?' + Querystring.stringify(request);
        // prepare request
        var req = Http.request(options, function (res) {
            var data = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                data += chunk;
            });
            res.on('end', function () {
                res.body = data;
                pipe.respond(res);
            });
        });

        req.on('error', function (err) {
            pipe.throw(err);
        });

        req.end();
    });
}

var pipe = Trooba.use(transportFactory, {
    protocol: 'https:',
    hostname: 'www.google.com',
    path: '/search?q=nike'
}).build();

// REQUEST execution
pipe.create().request({
    q: 'nike'
}, (err, response) => console.log);

// or you can skip callback and listen to events
pipe.create().request({
    q: 'nike'
})
.on('error', console.error)
.on('response', console.log);
```

#### Transport definition using http protocol and custom API

```js
function transportFactory() {
    function transport(pipe, config) {
        pipe.on('request', function (request) {
            var qs = '?' + Querystring.stringify(request);
            var options = {
                protocol: config.protocol,
                hostname: config.hostname,
                path: config.path ?
                    config.path += qs : qs
            };
            // prepare request
            var req = Http.request(options, function (res) {
                var data = '';
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    data += chunk;
                });
                res.on('end', function () {
                    res.body = data;
                    pipe.respond(res);
                });
            });

            req.on('error', function (err) {
                pipe.throw(err);
            });

            req.end();
        });

        pipe.set('client', function clientFactory(pipe) {
            return {
                search: (name, callback) => {
                    pipe.create()
                    .on('error', err => {
                        callback(err);
                    })
                    .on('response', response => {
                        callback(null, response.body);
                    })
                    .request({
                        q: name
                    });
                }
            };
        });
    }


    return transport;
}

var client = Trooba.use(transportFactory(), {
    protocol: 'http:',
    hostname: 'www.google.com',
    path: '/search'
}).build().create('client');

client.search('nike', console.log);
```

## Examples

### Ajax client

Based on [trooba-xhr-transport](https://github.com/trooba/trooba-xhr-transport)

```js
var xhrTransport = require('trooba-xhr-transport');
require('trooba')
    .use(xhrTransport, {
        protocol: 'http:',
        hostname: 'myapi.service.xyz'
        socketTimeout: 1000
    })
    .build()
    .create('client:default')
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
    .use(httpTransport, {
        protocol: 'http:',
        hostname: 'www.google.com',
        connectTimeout: 100,
        socketTimeout: 1000
    })
    .build()
    .create('client:default')
    .get({
        q: 'nike'
    })
    .set('some', 'header')
    .end((err, response) => {
        console.log(err, response && response.body)
    });
```

### gRPC client

Based on [trooba-grpc-transport](https://github.com/trooba/trooba-grpc-transport)

```js
var grpcTransport = require('trooba-grpc-transport');

require('trooba')
    .use(grpcTransport, {
        protocol: 'http:',
        hostname: 'grpc.service.my',
        port: 50001,
        proto: require.resolve('path/to/hello.proto')
    })
    .build()
    .create('client:default')
    .hello('Bob', function (err, response) {
        console.log(err, response)
    });
```

### gRPC service

```js
var pipeServer = Trooba.use(transport, {
    port: port,
    hostname: 'localhost',
    proto: Grpc.load(require.resolve('./path/to/hello.proto'))
})
.use(function handler(pipe) {
    pipe.on('request', (request, next) => {
        // do something with request
        console.log('gRPC request metadata:', request.headers);
        next();
    });
    pipe.on('request:data', (data, next) => {
        // do something with request stream data chunk
        console.log('request chunk:', data);
        next();
    });
    pipe.on('request:end', (data, next) => {
        // do something with stream end
        console.log('end of request stream');
        next();
    });

    pipe.on('response', (response, next) => {
        // do something with response
        console.log('gRPC response metadata:', response.headers);
        next();
    });
    pipe.on('response:data', (data, next) => {
        // do something with response stream data chunk
        console.log('response chunk:', data);
        next();
    });
    pipe.on('response:end', (data, next) => {
        // do something with end of response stream
        console.log('end of response stream');
        next();
    });
})
.use(function controller(pipe) {
    // handle request/response here
    pipe.on('request', request => {
        pipe.respond({
            body: 'Hello ' + request.body.name
        });
    });
});

var app = pipeServer.build('server:default');

svr = app.listen();
console.log('toorba service is listening on port:', port);
```

### Mocking

```js
require('trooba')
    .use(return mock(pipe) {
        pipe.on('request', function(request) {
            pipe.throw(new Error('Simulate error'));
        });
    })
    .build()
    .create()
    .request({foo:'bar'}, console.log);
```
