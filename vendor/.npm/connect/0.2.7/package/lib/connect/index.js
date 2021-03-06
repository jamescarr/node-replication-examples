/*!
 * Ext JS Connect
 * Copyright(c) 2010 Sencha Inc.
 * MIT Licensed
 */

/**
 * Framework version.
 */
exports.version = '0.2.7';

/**
 * Module dependencies.
 */
var sys = require('sys'),
    fs = require('fs'),
    Url = require('url'),
    Path = require('path'),
    http = require('http'),
    assert = require('assert');

// Temp patch to make connect work better in the v0.3.x branch of node
try {
  var CONSTANTS = require('constants');
  Object.keys(CONSTANTS).forEach(function (key) {
    process[key] = CONSTANTS[key];
  });
} catch (err) {

}

/**
 * Default env for those who do not use _bin/connect_.
 *
 * @type Object
 */

process.connectEnv = process.sparkEnv || {
    name: process.env.NODE_ENV || 'development',
    port: 3000,
    host: null
};

/**
 * Setup the given middleware layer callbacks.
 *
 * Examples:
 *
 *     connect.createServer(
 *        connect.log(),
 *        connect.staticProvider(__dirname + '/public')
 *     );
 *
 *     var server = connect.createServer();
 *     server.use('/', connect.log());
 *     server.use('/', connect.static(__dirname + '/public'));
 *
 * @params {Function} ...
 * @return {Server}
 * @api public
 */

var Server = exports.Server = function Server(layers) {
    this.stack = [];

    // Stack layers
    layers.forEach(function(layer){
        this.use("/", layer);
    }, this);

    // Set up the request handler using the parent's constructor
    http.Server.call(this, this.handle);
};

// Server is a subclass of http.Server
sys.inherits(Server, http.Server);

/**
 * Stack the given middleware `handle` to the given `route`.
 *
 * @param {String|Function} route or handle
 * @param {Function} handle
 * @return {Server}
 * @api public
 */

Server.prototype.use = function(route, handle){
    if (typeof route !== 'string') {
        handle = route;
        route = '/';
    }

    // Allow for more than one handle function to be added at a time
    if (arguments.length > 2) {
        Array.prototype.slice.call(arguments, 1).forEach(function (handle) {
            this.use(route, handle);
        }, this);
        return this;
    }

    // Wrap sub-apps
    if (handle instanceof Server) {
        var server = handle;
        server.route = route;
        handle = function(req, res, next) {
            server.handle(req, res, next);
        };
    }

    // Wrap vanilla http.Server instances too
    // Maybe later we'll handle 404 and 500 responses and pass them to next()
    // But for now, this is the end of the chain
    if (handle instanceof http.Server) {
        handle = handle.listeners('request')[0];
    }

    // Validate the input
    if (!(typeof route === 'string' && typeof handle === 'function')) {
        throw new Error("Each layer must have a route and a handle function");
    }

    // Normalize route to not trail with slash
    if (route[route.length - 1] === '/') {
        route = route.substr(0, route.length - 1);
    }

    // Add the route, handle pair to the stack
    this.stack.push({ route: route, handle: handle });

    // Allow chaining
    return this;
};


/**
 * Listen on the given `port` number,
 * defaults to the current environment's port,
 * or _3000_ when neither are present.
 *
 * @param  {Number} port
 * @param  {String} host
 * @return {Server}
 * @api public
 */

Server.prototype.listen = function(port, host) {
    arguments[0] = port || process.connectEnv.port || 3000;
    arguments[1] = host || process.connectEnv.host;
    http.Server.prototype.listen.apply(this, arguments);
    return this;
};


/**
 * Option to set "Server" and "X-Powered-By" headers
 */
Server.prototype.showVersion = true;


/**
 * Handle server requests, punting them down
 * the middleware stack.
 *
 * @api private
 */

Server.prototype.handle = function(req, res, outerNext) {
    var me = this,
        writeHead = res.writeHead,
        start = new Date,
        removed = "",
        stack = this.stack,
        index = 0;

    res.writeHead = function (code, headers) {
        var date = new Date;
        res.writeHead = writeHead;
        headers = headers || {};

        if (headers instanceof Array) {
            headers.push(['Date', date.toUTCString()]);
            headers.push(['X-Response-Time', (date - start) + "ms"]);
            if (me.showVersion) {
                headers.push(["X-Powered-By", "Connect " + exports.version]);
                headers.push(["Server",  "Node " + process.version]);
            }
        } else {
            headers["Date"] = date.toUTCString();
            headers['X-Response-Time'] = (date - start) + "ms";
            if (me.showVersion) {
                headers["X-Powered-By"] = "Connect " + exports.version;
                headers["Server"] = "Node " + process.version;
            }
        }
        res.writeHead(code, headers);
    };

    function next(err) {
        // Put the prefix back on if it was removed
        req.url = req.originalUrl = removed + req.url;
        removed = "";

        var layer = stack[index++];

        // If we reached the end of the chain...
        if (!layer) {
            // ... and we're part of a bigger chain then forward to it.
            if (outerNext) {
                outerNext(err);
                return;
            }
            // Otherwise send a proper error message to the browser.
            if (err) {
                var msg = process.connectEnv.name === 'production'
                    ? 'Internal Server Error'
                    : err.stack || err.toString();
                if (process.connectEnv.name !== 'test') {
                    sys.error(err.stack || err.toString());
                }
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(msg);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Cannot ' + req.method + ' ' + req.url);
            }
            return;
        }

        try {

            var pathname = Url.parse(req.url).pathname;
            if (pathname === undefined) pathname = '/';

            // Skip this layer if the route doesn't match.
            if (pathname.indexOf(layer.route) !== 0) {
                next(err);
                return;
            }

            var nextChar = pathname[layer.route.length];
            if (nextChar && nextChar !== '/' && nextChar !== '.') {
                next(err);
                return;
            }

            // Call the layer handler
            // Trim off the part of the url that matches the route
            removed = layer.route;
            req.url = req.url.substr(removed.length);

            // Ensure leading slash
            if (req.url[0] !== "/") {
                req.url = "/" + req.url;
            }

            var arity = layer.handle.length;
            if (err) {
                if (arity === 4) {
                    layer.handle(err, req, res, next);
                } else {
                    next(err);
                }
            } else if (arity < 4) {
                layer.handle(req, res, next);
            } else {
                next();
            }
        } catch (e) {
            if (e instanceof assert.AssertionError) {
                sys.error(e.stack, '\n');
                next(e);
            } else {
                next(e);
            }
        }
    }
    next();
};

/**
 * Shortcut for `new connect.Server([ ... ])`.
 *
 * @param  {Function} ...
 * @param  {Object} env
 * @return {Server}
 * @api public
 */

exports.createServer = function() {
    return new Server(Array.prototype.slice.call(arguments));
};


/**
 * Auto-load getters.
 */

exports.middleware = {};

/**
 * Auto-load bundled middleware with getters.
 */

fs.readdirSync(__dirname + '/middleware').forEach(function(filename){
    if (/\.js$/.test(filename)) {
        var name = filename.substr(0, filename.lastIndexOf('.'));
        Object.defineProperty(exports.middleware, name, { get: function(){
            return require('./middleware/' + name);
        }});
    }
});

/**
 * Expose getters as first-class exports.
 */

exports.__proto__ = exports.middleware;

/**
 * Expose utils.
 */

exports.utils = require('./utils');

