### Enforcing delivery

To make sure a specific message type or request/response reaches the destination, one can set validate options.

If the message does not reach the target, the error will be thrown back to the caller.

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
