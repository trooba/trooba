# Transports

Transports are a type of handler that allows to connect one pipe to the other via some kind of transmission protocol/transport, like http, tcp, gRPC, etc.

In the below example we are using Hapi Wreak module to make an actual call to the external service

_http_transport.js_
```js
module.exports = function transport(pipe, config) {
    pipe.on('request', request => {
        Wreck.request(request.method,
          config.url, request, (err, response) => {
            // handle error
            if (err) return pipe.throw(err);
            // read response
            Wreck.read(response, (err, body) => {
                // handle error
                if (err) return pipe.throw(err);
                // otherwise format the response
                response.body = body;
                pipe.respond(response);
            });
        });
    });
}
```

#### Transport example using http protocol as a base

_example.js_
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
