# Tracing

The framework allows to trace any messages.

This is eseful when the complexity of the pipeline requires one to check the route the message travels along.

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

Or more informative option to trace the pipe

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
