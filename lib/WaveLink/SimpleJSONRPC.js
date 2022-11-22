(function (root) {
    'use strict';
    /*
     name: simple-jsonrpc-js
     version: 0.0.10
     */
    var _Promise = Promise;

    if (typeof _Promise === 'undefined') {
        _Promise = root.Promise;
    }

    if (_Promise === undefined) {
        throw 'Promise is not supported! Use latest version node/browser or promise-polyfill';
    }

    var isUndefined = function (value) {
        return value === undefined;
    };

    var isArray = Array.isArray;

    var isObject = function (value) {
        var type = typeof value;
        return value != null && (type == 'object' || type == 'function');
    };

    var isFunction = function (target) {
        return typeof target === 'function'
    };

    var isString = function (value) {
        return typeof value === 'string';
    };

    var isEmpty = function (value) {
        if (isObject(value)) {
            for (var idx in value) {
                if (value.hasOwnProperty(idx)) {
                    return false;
                }
            }
            return true;
        }
        if (isArray(value)) {
            return !value.length;
        }
        return !value;
    };

    var forEach = function (target, callback) {
        if (isArray(target)) {
            return target.map(callback);
        }
        else {
            for (var _key in target) {
                if (target.hasOwnProperty(_key)) {
                    callback(target[_key]);
                }
            }
        }
    };

    var clone = function (value) {
        return JSON.parse(JSON.stringify(value));
    };

    var ERRORS = {
        "PARSE_ERROR": {
            "code": -32700,
            "message": "Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text."
        },
        "INVALID_REQUEST": {
            "code": -32600,
            "message": "Invalid Request. The JSON sent is not a valid Request object."
        },
        "METHOD_NOT_FOUND": {
            "code": -32601,
            "message": "Method not found. The method does not exist / is not available."
        },
        "INVALID_PARAMS": {
            "code": -32602,
            "message": "Invalid params. Invalid method parameter(s)."
        },
        "INTERNAL_ERROR": {
            "code": -32603,
            "message": "Internal error. Internal JSON-RPC error."
        },
        "UNKNOWN_ERROR" :{
            "code": -31099,
            "message": "Unknown Error."
        },
        "NO_VERSION" :{
            "code": -31098,
            "message": "Can’t query application version."
        },
        "DEVICE_NOT_FOUND" :{
            "code": -31097,
            "message": " The specified device was not found in the list of available devices."
        }
    };

    function ServerError(code, message, data) {
        this.message = message || "";
        this.code = code || -31099;

        if (Boolean(data)) {
            this.data = data;
        }
    }

    ServerError.prototype = new Error();

    var simple_jsonrpc = function () {

        var self = this,
            waitingframe = {},
            id = 0,
            dispatcher = {};


        function setError(jsonrpcError, exception) {
            var error = clone(jsonrpcError);
            if (!!exception) {
                if (isObject(exception) && exception.hasOwnProperty("message")) {
                    error.data = exception.message;
                }
                else if (isString(exception)) {
                    error.data = exception;
                }

                if (exception instanceof ServerError) {
                    error = {
                        message: exception.message,
                        code: exception.code
                    };
                    if (exception.hasOwnProperty('data')) {
                        error.data = exception.data;
                    }
                }
            }
            return error;
        }

        function isPromise(thing) {
            return !!thing && 'function' === typeof thing.then;
        }

        function isError(message) {
            return !!message.error;
        }

        function isRequest(message) {
            return !!message.method;
        }

        function isResponse(message) {
            return message.hasOwnProperty('result') && message.hasOwnProperty('id');
        }

        function beforeResolve(message) {


            var promises = [];
            if (isArray(message)) {
                forEach(message, function (msg) {
                    promises.push(resolver(msg));
                });
            }
            else if (isObject(message)) {
                promises.push(resolver(message));
            }

            return _Promise.all(promises)
                .then(function (result) {

                    var toStream = [];
                    forEach(result, function (r) {
                        if (!isUndefined(r)) {
                            toStream.push(r);
                        }
                    });

                    if (toStream.length === 1) {
                        self.toStream(JSON.stringify(toStream[0]));
                    }
                    else if (toStream.length > 1) {
                        self.toStream(JSON.stringify(toStream));
                    }
                    return result;
                });
        }

        function resolver(message) {
            try {
                if (isError(message)) {
                    return rejectRequest(message);
                }
                else if (isResponse(message)) {
                    return resolveRequest(message);
                }
                else if (isRequest(message)) {
                    return handleRemoteRequest(message);
                }
                else {
                    return _Promise.resolve({
                        "id": null,
                        "jsonrpc": "2.0",
                        "error": setError(ERRORS.INVALID_REQUEST)
                    });
                }
            }
            catch (e) {
                console.error('Resolver error:' + e.message, e);
                return _Promise.reject(e);
            }
        }

        function rejectRequest(error) {
            if (waitingframe.hasOwnProperty(error.id)) {
                waitingframe[error.id].reject(error.error);
            }
            else {
                console.log('Unknown request', error);
            }
        }

        function resolveRequest(result) {
            if (waitingframe.hasOwnProperty(result.id)) {
                waitingframe[result.id].resolve(result.result);
                delete waitingframe[result.id];
            }
            else {
                console.log('unknown request', result);
            }
        }

        function handleRemoteRequest(request) {
            // console.log("handleRemoteRequest", request, dispatcher);
            if (dispatcher.hasOwnProperty(request.method)) {
                try {
                    var result;

                    if (request.hasOwnProperty('params')) {
                        if (dispatcher[request.method].params == "pass") {
                            result = dispatcher[request.method].fn.call(dispatcher, request.params);
                        }
                        else if (isArray(request.params)) {
                            result = dispatcher[request.method].fn.apply(dispatcher, request.params);
                        }
                        else if (isObject(request.params)) {
                           // console.log("handleRemoteRequest.params", dispatcher[request.method]);
                            if (dispatcher[request.method].params instanceof Array) {
                                var argsValues = [];
                                dispatcher[request.method].params.forEach(function (arg) {

                                    if (request.params.hasOwnProperty(arg)) {
                                        argsValues.push(request.params[arg]);
                                        delete request.params[arg];
                                    }
                                    else {
                                        argsValues.push(undefined);
                                    }
                                });

                                if (Object.keys(request.params).length > 0) {
                                    return _Promise.resolve({
                                        "jsonrpc": "2.0",
                                        "id": request.id,
                                        "error": setError(ERRORS.INVALID_PARAMS, {
                                            message: "Params: " + Object.keys(request.params).toString() + " not used"
                                        })
                                    });
                                }
                                else {
                                    result = dispatcher[request.method].fn.apply(dispatcher, argsValues);
                                }
                            }
                            else {
                                return _Promise.resolve({
                                    "jsonrpc": "2.0",
                                    "id": request.id,
                                    "error": setError(ERRORS.INVALID_PARAMS, "Undeclared arguments of the method " + request.method)
                                });
                            }
                        }
                    }
                    else {
                        result = dispatcher[request.method].fn();
                    }

                    if (request.hasOwnProperty('id')) {
                        if (isPromise(result)) {
                            return result.then(function (res) {
                                if (isUndefined(res)) {
                                    res = true;
                                }
                                return {
                                    "jsonrpc": "2.0",
                                    "id": request.id,
                                    "result": res
                                };
                            })
                                .catch(function (e) {
                                    return {
                                        "jsonrpc": "2.0",
                                        "id": request.id,
                                        "error": setError(ERRORS.INTERNAL_ERROR, e)
                                    };
                                });
                        }
                        else {

                            if (isUndefined(result)) {
                                result = true;
                            }

                            return _Promise.resolve({
                                "jsonrpc": "2.0",
                                "id": request.id,
                                "result": result
                            });
                        }
                    }
                    else {
                        return _Promise.resolve(); //nothing, it notification
                    }
                }
                catch (e) {
                    return _Promise.resolve({
                        "jsonrpc": "2.0",
                        "id": request.id,
                        "error": setError(ERRORS.INTERNAL_ERROR, e)
                    });
                }
            }
            else {
                return _Promise.resolve({
                    "jsonrpc": "2.0",
                    "id": request.id,
                    "error": setError(ERRORS.METHOD_NOT_FOUND, {
                        message: request.method
                    })
                });
            }
        }

        function notification(method, params) {
            var message = {
                "jsonrpc": "2.0",
                "method": method,
                "params": params
            };

            if (isObject(params) && !isEmpty(params)) {
                message.params = params;
            }

            return message;
        }

        function call(method, params) {
            id += 1;
            var message = {
                "jsonrpc": "2.0",
                "method": method,
                "id": id
            };

            if (isObject(params) && !isEmpty(params)) {
                message.params = params;
            }

            return {
                promise: new _Promise(function (resolve, reject) {
                    waitingframe[id.toString()] = {
                        resolve: resolve,
                        reject: reject
                    };
                }),
                message: message
            };
        }

        self.toStream = function (a) {
            console.log('Need define the toStream method before use');
            console.log(arguments);
        };

        self.dispatch = function (functionName, paramsNameFn, fn) {
            //console.log("%cTest", "color:blue");
            //console.log("%c%s",
            // "color: red; background: yellow; font-size: 24px;",
            //"dispatch",functionName, paramsNameFn, fn);

            if (isString(functionName) && paramsNameFn == "pass" && isFunction(fn)) {
                dispatcher[functionName] = {
                    fn: fn,
                    params: paramsNameFn
                };
            }
            else if (isString(functionName) && isArray(paramsNameFn) && isFunction(fn)) {
                dispatcher[functionName] = {
                    fn: fn,
                    params: paramsNameFn
                };
            }
            else if (isString(functionName) && isFunction(paramsNameFn) && isUndefined(fn)) {
                dispatcher[functionName] = {
                    fn: paramsNameFn,
                    params: null
                };
            }
            else {
                throw new Error('Missing required argument: functionName - string, paramsNameFn - string or function');
            }
        };

        self.on = self.dispatch;

        self.off = function (functionName) {
          delete dispatcher[functionName];
        };

        self.call = function (method, params) {
            var _call = call(method, params);
            self.toStream(JSON.stringify(_call.message));
            return _call.promise;
        };

        self.notification = function (method, params) {
            self.toStream(JSON.stringify(notification(method, params)));
        };

        self.batch = function (requests) {
            var promises = [];
            var message = [];

            forEach(requests, function (req) {
                if (req.hasOwnProperty('call')) {
                    var _call = call(req.call.method, req.call.params);
                    message.push(_call.message);
                    //TODO(jershell): batch reject if one promise reject, so catch reject and resolve error as result;
                    promises.push(_call.promise.then(function (res) {
                        return res;
                    }, function (err) {
                        return err;
                    }));
                }
                else if (req.hasOwnProperty('notification')) {
                    message.push(notification(req.notification.method, req.notification.params));
                }
            });

            self.toStream(JSON.stringify(message));
            return _Promise.all(promises);
        };

        self.messageHandler = function (rawMessage) {
            try {
                var message = JSON.parse(rawMessage);
                return beforeResolve(message);
            }
            catch (e) {
                console.log("Error in messageHandler(): ", e);
                self.toStream(JSON.stringify({
                    "id": null,
                    "jsonrpc": "2.0",
                    "error": ERRORS.PARSE_ERROR
                }));
                return _Promise.reject(e);
            }
        };

        self.customException = function (code, message, data) {
            return new ServerError(code, message, data);
        };
    };

    if (typeof define == 'function' && define.amd) {
        define('simple_jsonrpc', [], function () {
            return simple_jsonrpc;
        });
    }
    else if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
        module.exports = simple_jsonrpc;
    }
    else if (typeof root !== "undefined") {
        root.simple_jsonrpc = simple_jsonrpc;
    }
    else {
        return simple_jsonrpc;
    }
})(this);


/*
!function(e){"use strict";function r(e,r,n){this.message=r||"",this.code=e||-32e3,Boolean(n)&&(this.data=n)}var n=Promise;if("undefined"==typeof n&&(n=e.Promise),void 0===n)throw"Promise is not supported! Use latest version node/browser or promise-polyfill";var t=function(e){return void 0===e},o=Array.isArray,s=function(e){var r=typeof e;return null!=e&&("object"==r||"function"==r)},a=function(e){return"function"==typeof e},i=function(e){return"string"==typeof e},u=function(e){if(s(e)){for(var r in e)if(e.hasOwnProperty(r))return!1;return!0}return o(e)?!e.length:!e},c=function(e,r){if(o(e))return e.map(r);for(var n in e)e.hasOwnProperty(n)&&r(e[n])},f=function(e){return JSON.parse(JSON.stringify(e))},d={PARSE_ERROR:{code:-32700,message:"Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text."},INVALID_REQUEST:{code:-32600,message:"Invalid Request. The JSON sent is not a valid Request object."},METHOD_NOT_FOUND:{code:-32601,message:"Method not found. The method does not exist / is not available."},INVALID_PARAMS:{code:-32602,message:"Invalid params. Invalid method parameter(s)."},INTERNAL_ERROR:{code:-32603,message:"Internal error. Internal JSON-RPC error."}};r.prototype=new Error;var p=function(){function e(e,n){var t=f(e);return n&&(s(n)&&n.hasOwnProperty("message")?t.data=n.message:i(n)&&(t.data=n),n instanceof r&&(t={message:n.message,code:n.code},n.hasOwnProperty("data")&&(t.data=n.data))),t}function p(e){return!!e&&"function"==typeof e.then}function m(e){return!!e.error}function l(e){return!!e.method}function h(e){return e.hasOwnProperty("result")&&e.hasOwnProperty("id")}function g(e){var r=[];return o(e)?c(e,function(e){r.push(y(e))}):s(e)&&r.push(y(e)),n.all(r).then(function(e){var r=[];return c(e,function(e){t(e)||r.push(e)}),1===r.length?w.toStream(JSON.stringify(r[0])):r.length>1&&w.toStream(JSON.stringify(r)),e})}function y(r){try{return m(r)?v(r):h(r)?O(r):l(r)?N(r):n.resolve({id:null,jsonrpc:"2.0",error:e(d.INVALID_REQUEST)})}catch(e){return console.error("Resolver error:"+e.message,e),n.reject(e)}}function v(e){P.hasOwnProperty(e.id)?P[e.id].reject(e.error):console.log("Unknown request",e)}function O(e){P.hasOwnProperty(e.id)?(P[e.id].resolve(e.result),delete P[e.id]):console.log("unknown request",e)}function N(r){if(!E.hasOwnProperty(r.method))return n.resolve({jsonrpc:"2.0",id:r.id,error:e(d.METHOD_NOT_FOUND,{message:r.method})});try{var a;if(r.hasOwnProperty("params")){if("pass"==E[r.method].params)a=E[r.method].fn.call(E,r.params);else if(o(r.params))a=E[r.method].fn.apply(E,r.params);else if(s(r.params)){if(!(E[r.method].params instanceof Array))return n.resolve({jsonrpc:"2.0",id:r.id,error:e(d.INVALID_PARAMS,"Undeclared arguments of the method "+r.method)});var i=[];if(E[r.method].params.forEach(function(e){r.params.hasOwnProperty(e)?(i.push(r.params[e]),delete r.params[e]):i.push(void 0)}),Object.keys(r.params).length>0)return n.resolve({jsonrpc:"2.0",id:r.id,error:e(d.INVALID_PARAMS,{message:"Params: "+Object.keys(r.params).toString()+" not used"})});a=E[r.method].fn.apply(E,i)}}else a=E[r.method].fn();return r.hasOwnProperty("id")?p(a)?a.then(function(e){return t(e)&&(e=!0),{jsonrpc:"2.0",id:r.id,result:e}}).catch(function(n){return{jsonrpc:"2.0",id:r.id,error:e(d.INTERNAL_ERROR,n)}}):(t(a)&&(a=!0),n.resolve({jsonrpc:"2.0",id:r.id,result:a})):n.resolve()}catch(t){return n.resolve({jsonrpc:"2.0",id:r.id,error:e(d.INTERNAL_ERROR,t)})}}function S(e,r){var n={jsonrpc:"2.0",method:e,params:r};return s(r)&&!u(r)&&(n.params=r),n}function R(e,r){j+=1;var t={jsonrpc:"2.0",method:e,id:j};return s(r)&&!u(r)&&(t.params=r),{promise:new n(function(e,r){P[j.toString()]={resolve:e,reject:r}}),message:t}}var w=this,P={},j=0,E={};w.toStream=function(e){console.log("Need define the toStream method before use"),console.log(arguments)},w.dispatch=function(e,r,n){if(i(e)&&"pass"==r&&a(n))E[e]={fn:n,params:r};else if(i(e)&&o(r)&&a(n))E[e]={fn:n,params:r};else{if(!(i(e)&&a(r)&&t(n)))throw new Error("Missing required argument: functionName - string, paramsNameFn - string or function");E[e]={fn:r,params:null}}},w.on=w.dispatch,w.off=function(e){delete E[e]},w.call=function(e,r){var n=R(e,r);return w.toStream(JSON.stringify(n.message)),n.promise},w.notification=function(e,r){w.toStream(JSON.stringify(S(e,r)))},w.batch=function(e){var r=[],t=[];return c(e,function(e){if(e.hasOwnProperty("call")){var n=R(e.call.method,e.call.params);t.push(n.message),r.push(n.promise.then(function(e){return e},function(e){return e}))}else e.hasOwnProperty("notification")&&t.push(S(e.notification.method,e.notification.params))}),w.toStream(JSON.stringify(t)),n.all(r)},w.messageHandler=function(e){try{var r=JSON.parse(e);return g(r)}catch(e){return console.log("Error in messageHandler(): ",e),w.toStream(JSON.stringify({id:null,jsonrpc:"2.0",error:d.PARSE_ERROR})),n.reject(e)}},w.customException=function(e,n,t){return new r(e,n,t)}};if("function"==typeof define&&define.amd)define("simple_jsonrpc",[],function(){return p});else if("undefined"!=typeof module&&"undefined"!=typeof module.exports)module.exports=p;else{if("undefined"==typeof e)return p;e.simple_jsonrpc=p}}(this);

*/