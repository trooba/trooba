# ChangeLog

## Next version

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
