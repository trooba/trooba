# ChangeLog

## Next version

## v2.0.0
* Allow to link on-the-fly in message/request flow, not just at context init time.
* Removed context init from trooba.build() call. Now it should only happen at pipe.create(). Build will only construct the pipeline and cache it with generic context.
* Removed selecting custom API from trooba.build() call. Now one should only use pipe.create(ctx, 'custom-api-name');
* Increased default message TTL to Infinity and added option to configure ttl via config.
```js
pipe.build({
    ttl: 2000 // msec
})
```
* Request/response streaming preserves message order to avoid out-of-order conflicts.
* Changed tracing to use trace function as part of the context
```js
pipe.build()
.create({
    trace: function (point, message) {
        // collect points
        route.push(point.handler.name + '-' + (message.flow === 1 ? 'req' : 'res'))
    }
})
.request('request', function () {
    console.log(route.join('->'));
});
```

## v1.0.2
* link two pipes together on-the-fly, it is good to bootstrap the pipe from config file.
* trace function to trace the routes with simple trace message
* message time-to-live support, default is 1 second.

## v1.0.1
* Added building pipe from the first to the last handler, before it was reverse order.
* Added 'on' hooks to stream level

## v1.0.0
* Removed transport and interface to keep trooba more generic
  * Cutom API can be injected by the transport handler during init phase as part of context and requested as
  ```js
  pipe.build(customAPI)
  ```
  The customAPI is arbitrary string key that is bound to the API injected by the handler. For example:
  ```js
  var service = pipe.build('service:hello');
  service.hello('John');
  ```
* Converted a pipeline into a message bus
* Simplified trooba API
* Support for sync and async messages
* Support for custom messages, request/response, publish/subscribe or a mix

## v0.3
* Initial commit
