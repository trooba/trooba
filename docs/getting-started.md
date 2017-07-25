# Getting started

Trooba allows to structure any of your data flows into separate, independent, testable components.

## Hello World

_hello.js_
```js
const Trooba = require('trooba');

const pipe = Trooba
.use(pipe => {
    pipe.on('request', request => {
        pipe.respond(`Hello ${request}`);
    });
})
.build();

pipe.create().request('John', (err, response) => console.log(response)); // Hello John
```

Let's now add a handler that modifies the name

_hello-with-handler.js_
```js
const Trooba = require('trooba');

const pipe = Trooba
.use(pipe => {
    pipe.on('request', (request, next) => {
        next(`${request} and Bob`);
    });
})
.use(pipe => {
    pipe.on('request', request => {
        pipe.respond(`Hello ${request}`);
    });
})
.build();

pipe.create().request('John', (err, response) => console.log(response)); // Hello John and Bob
```
