# Trooba API

* **`use`**`(handler[, config])` - adds a handler to the pipeline
   * *`handler`* - a `function handler(pipe) {}` or another pipe to join into this pipe.
   * *`config`* is a config object for the handler
* **`build`**`([context])` - creates a pipe and returns a generic pipe object.
* **`set`**`(name, value)` - used set system value to the context. The name is prefixed with '$' that prevents it from being propagated beyond the current pipe context boundaries.
* **`get`**`(name)` - is used to get system value from the context.

### Pipe API

The pipe object is passed to all handlers and transport during initialization whenever new context is created via trooba.build(context) or pipe.create(context) call.

* **`create`**`([context], [customApiImpl])` - creates a pipeline with new context or clones from the existing one if any present. The method is mandatory to initiate a new flow, otherwise the subsequent call will fail.
     * **`context`** is a context object to be used in request/message flow.
     * **`customApiImpl`** is a name for a specific API implementation. It allows to inject custom API provided by one of the handlers that needs to be returned instead of the generic pipe interface.
* **`context`** - is an object available to all handlers/transport in the same request/response flow. One can use it to store data that needs to be shared between handlers if needed. The values in the context that have their names started with '$' will not be propagated beyond the pipe boundaries. To access context one can use pipe.context;
* **`link`**`(pipe)` - links passed pipeline to the current one. The link between pipes exists as long as the context where they were linked exists. Once pipe.create is used, it will lose the link. The linking can be useful to join pipes on the fly, for example to bootstrap pipe from config file and inline it into existing pipeline where bootstrap handler is registered.
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
* **`request`**`(requestObject)` - creates and sends an arbitrary request down the pipeline. If context was not used, it will implicitly call *create* method
* **`respond`**`(responseObject)` initiates a response flow and sends an arbitrary response object down the response pipeline. This can be called only after the request flow is initiated.
* **`resume`**`()` - resumes the processing in the given pipe point in ordered flow whenever the current message/response/request flow was paused due to processing of the ordered message and it was suppressed/swallowed, i.e. no throw/response/request/next action followed.
* **`streamRequest`**`(requestObject)` - creates and sends an arbitrary request down the pipeline. If context was not used. It returns write stream with methods:
    * **`write(data)`** - write a chunk to the stream as "request:data" message
    * **`end()`** - ends the stream and send "request:end" message
* **`streamResponse`**`(responseObject)` - initiates a response stream flow and sends an arbitrary response object down the response pipeline. This can be called only after the request flow is initiated. It returns write stream with methods:
    * **`write(data)`** - write a chunk to the stream as "response:data" message
    * **`end()`** - ends the stream and send "response:end" message
* **`send`**`(message)` - sends a message down the request or response flow depending on the message type. For more details see message structure below. The method can be used to send a custom message.
* **`throw`**`(Error)` sends the error down the response pipeline. If no error hooks defined in the pipeline, it will throw error. The method can be called only after the response flow is initiated.
* **`trace`**`([Function callback(err, listOfPoints)])` - used to trace the route that any message would travel, it uses `message.type = 'trace'` and returns a list of point it traveled in request/response flow.
* **`set`**`(name, value)` - sets arbitrary system key-value pair to the context which will not be explicitly propagated beyond transport boundaries as internally the name will be prefixed as $name. It is used to provide custom API by handlers.
* **`get`**`(name)` - reads system value from the context.

#### Message

The framework defines a message bus to send and receive messages within the pipeline.

The current message structure:

* **`type`** - a `String` that defines a message type which can be used in pipe.on() and .once()
* **`flow`** - a `Number` that defines flow type. It will define the direction of the message in the pipeline
    * `1` - request
    * `2` - response
* **`ref`** - a reference to the data being sent in the message
* **`sync`** - a `boolean`, if equals `true`, the message will be propagated to all pipe points at the same time, no callback is needed to control when to send it to the next handler in the pipeline.
* **`order`** - a `boolean` value that controls order, if set to true, the message will be queued at any pipe point if similar ordered message is already in process by the given point.
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
