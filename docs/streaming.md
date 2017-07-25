# Streaming support

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

## Streaming request

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

## Streaming response

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
