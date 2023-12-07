var jDrupal = typeof jDrupal === "undefined" ? {} : jDrupal;

jDrupal.init = function() {
    jDrupal.csrf_token = false;
    jDrupal.sessid = null;
    jDrupal.modules = {};
    jDrupal.connected = false;
    jDrupal.settings = {
        sitePath: null,
        basePath: "/"
    };
};

jDrupal.init();

jDrupal.config = function(name) {
    var value = typeof arguments[1] !== "undefined" ? arguments[1] : null;
    if (value) {
        jDrupal.settings[name] = value;
        return;
    }
    return jDrupal.settings[name];
};

jDrupal.sitePath = function() {
    return jDrupal.settings.sitePath;
};

jDrupal.basePath = function() {
    return jDrupal.settings.basePath;
};

jDrupal.restPath = function() {
    return this.sitePath() + this.basePath();
};

jDrupal.path = function() {
    return this.restPath().substr(this.restPath().indexOf("://") + 3).replace("localhost", "");
};

jDrupal.isReady = function() {
    try {
        var ready = !jDrupal.isEmpty(jDrupal.sitePath());
        if (!ready) {
            console.log("sitePath not set in jdrupal.settings.js");
        }
        return ready;
    } catch (error) {
        console.log("jDrupal.isReady - " + error);
    }
};

jDrupal.isEmpty = function(value) {
    if (value !== null && typeof value === "object") {
        return Object.keys(value).length === 0;
    }
    return typeof value === "undefined" || value === null || value == "";
};

jDrupal.functionExists = function(name) {
    return eval("typeof " + name) == "function";
};

jDrupal.inArray = function(needle, haystack) {
    try {
        if (typeof haystack === "undefined") {
            return false;
        }
        if (typeof needle === "string") {
            return haystack.indexOf(needle) > -1;
        } else {
            var found = false;
            for (var i = 0; i < haystack.length; i++) {
                if (haystack[i] == needle) {
                    found = true;
                    break;
                }
            }
            return found;
        }
    } catch (error) {
        console.log("jDrupal.inArray - " + error);
    }
};

jDrupal.isArray = function(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
};

jDrupal.isInt = function(n) {
    if (typeof n === "string") {
        n = parseInt(n);
    }
    return typeof n === "number" && n % 1 == 0;
};

jDrupal.isPromise = function(obj) {
    return Promise.resolve(obj) == obj;
};

jDrupal.shuffle = function(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
};

jDrupal.time = function() {
    var d = new Date();
    return Math.floor(d / 1e3);
};

jDrupal.lcfirst = function(str) {
    str += "";
    var f = str.charAt(0).toLowerCase();
    return f + str.substr(1);
};

jDrupal.ucfirst = function(str) {
    str += "";
    var f = str.charAt(0).toUpperCase();
    return f + str.substr(1);
};

jDrupal.Module = function() {
    this.name = null;
};

jDrupal.moduleExists = function(name) {
    try {
        return typeof jDrupal.modules[name] !== "undefined";
    } catch (error) {
        console.log("jDrupal.moduleExists - " + error);
    }
};

jDrupal.moduleImplements = function(hook) {
    try {
        var modules_that_implement = [];
        if (hook) {
            for (var module in jDrupal.modules) {
                if (jDrupal.modules.hasOwnProperty(module)) {
                    if (jDrupal.functionExists(module + "_" + hook)) {
                        modules_that_implement.push(module);
                    }
                }
            }
        }
        if (modules_that_implement.length == 0) {
            return false;
        }
        return modules_that_implement;
    } catch (error) {
        console.log("jDrupal.moduleImplements - " + error);
    }
};

jDrupal.moduleInvoke = function(module, hook) {
    if (!jDrupal.moduleLoad(module)) {
        return;
    }
    var name = module + "_" + hook;
    if (!jDrupal.functionExists(name)) {
        return;
    }
    var fn = window[name];
    var module_arguments = Array.prototype.slice.call(arguments);
    module_arguments.splice(0, 2);
    if (Object.getOwnPropertyNames(module_arguments).length == 0) {
        return fn();
    } else {
        return fn.apply(null, module_arguments);
    }
};

jDrupal.moduleInvokeAll = function(hook) {
    var promises = [];
    var module_arguments = Array.prototype.slice.call(arguments);
    module_arguments.splice(0, 1);
    var modules = [];
    for (var module in jDrupal.modules) {
        if (!jDrupal.modules.hasOwnProperty(module)) {
            continue;
        }
        if (!jDrupal.functionExists(module + "_" + hook)) {
            continue;
        }
        modules.push(module);
    }
    if (jDrupal.isEmpty(modules)) {
        return Promise.resolve();
    }
    for (var i = 0; i < modules.length; i++) {
        if (module_arguments.length == 0) {
            promises.push(jDrupal.moduleInvoke(modules[i], hook));
        } else {
            module_arguments.unshift(modules[i], hook);
            promises.push(jDrupal.moduleInvoke.apply(null, module_arguments));
            module_arguments.splice(0, 2);
        }
    }
    return Promise.all(promises);
};

jDrupal.moduleLoad = function(name) {
    try {
        return jDrupal.modules[name] ? jDrupal.modules[name] : false;
    } catch (error) {
        console.log("jDrupal.moduleLoad - " + error);
    }
};

jDrupal.modulesLoad = function() {
    return jDrupal.modules;
};

(function(send) {
    XMLHttpRequest.prototype.send = function(data) {
        var self = this;
        var alters = jDrupal.moduleInvokeAll("rest_pre_process", this, data);
        if (!alters) {
            send.call(this, data);
        } else {
            alters.then(function() {
                send.call(self, data);
            });
        }
    };
})(XMLHttpRequest.prototype.send);

jDrupal.getResultFromRequest = function(req) {
    return JSON.parse(typeof req.responseText !== "undefined" ? req.responseText : req.response);
};

jDrupal.token = function() {
    return new Promise(function(resolve, reject) {
        var req = new XMLHttpRequest();
        req.dg = {
            service: "system",
            resource: "token"
        };
        req.open("GET", jDrupal.restPath() + "rest/session/token");
        req.onload = function() {
            if (req.status == 200) {
                var invoke = jDrupal.moduleInvokeAll("rest_post_process", req);
                if (!invoke) {
                    resolve(req.response);
                } else {
                    invoke.then(resolve(req.response));
                }
            } else {
                reject(req);
            }
        };
        req.onerror = function() {
            reject(Error("Network Error"));
        };
        req.send();
    });
};

jDrupal.connect = function() {
    return new Promise(function(resolve, reject) {
        var req = new XMLHttpRequest();
        req.dg = {
            service: "system",
            resource: "connect"
        };
        req.open("GET", jDrupal.restPath() + "jdrupal/connect?_format=json");
        var connected = function() {
            jDrupal.connected = true;
            var result = JSON.parse(typeof req.responseText !== "undefined" ? req.responseText : req.response);
            if (result.uid == 0) {
                jDrupal.setCurrentUser(jDrupal.userDefaults());
                resolve(result);
            } else {
                jDrupal.userLoad(result.uid).then(function(account) {
                    jDrupal.setCurrentUser(account);
                    resolve(result);
                });
            }
        };
        req.onload = function() {
            if (req.status != 200) {
                reject(req);
                return;
            }
            var invoke = jDrupal.moduleInvokeAll("rest_post_process", req);
            if (!invoke) {
                connected();
            } else {
                invoke.then(connected);
            }
        };
        req.onerror = function() {
            reject(Error("Network Error"));
        };
        req.send();
    });
};

jDrupal.userLogin = function(name, pass) {
    return new Promise(function(resolve, reject) {
        var req = new XMLHttpRequest();
        req.dg = {
            service: "user",
            resource: "login"
        };
        req.open("POST", jDrupal.restPath() + "user/login?_format=json");
        req.setRequestHeader("Content-type", "application/json");
        var connected = function() {
            jDrupal.connect().then(resolve);
        };
        req.onload = function() {
            if (req.status == 200) {
                var invoke = jDrupal.moduleInvokeAll("rest_post_process", req);
                if (!invoke) {
                    connected();
                } else {
                    invoke.then(connected);
                }
            } else {
                reject(req);
            }
        };
        req.onerror = function() {
            reject(Error("Network Error"));
        };
        req.send(JSON.stringify({
            name: name,
            pass: pass
        }));
    });
};

jDrupal.userLogout = function() {
    return new Promise(function(resolve, reject) {
        var req = new XMLHttpRequest();
        req.dg = {
            service: "user",
            resource: "logout"
        };
        req.open("GET", jDrupal.restPath() + "user/logout");
        req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        var connected = function() {
            jDrupal.setCurrentUser(jDrupal.userDefaults());
            jDrupal.connect().then(resolve);
        };
        req.onload = function() {
            if (req.status == 200 || req.status == 303) {
                var invoke = jDrupal.moduleInvokeAll("rest_post_process", req);
                if (!invoke) {
                    connected();
                } else {
                    invoke.then(connected);
                }
            } else {
                reject(req);
            }
        };
        req.onerror = function() {
            reject(Error("Network Error"));
        };
        req.send();
    });
};

jDrupal.entityLoad = function(entityType, entityID) {
    var entity = new this[this.ucfirst(entityType)](entityID);
    return entity.load();
};

jDrupal.commentLoad = function(cid) {
    return this.entityLoad("comment", cid);
};

jDrupal.nodeLoad = function(nid) {
    return this.entityLoad("node", nid);
};

jDrupal.userLoad = function(uid) {
    return this.entityLoad("user", uid);
};

jDrupal.userRegister = function(name, pass, mail, lang, timezone) {
    return new Promise(function(resolve, reject) {
        var req = new XMLHttpRequest();
        req.dg = {
            service: "user",
            resource: "register"
        };
        req.open("POST", jDrupal.restPath() + "user/register?_format=json");
        req.setRequestHeader("Content-type", "application/json");
        var connected = function() {
            jDrupal.connect().then(resolve);
        };
        req.onload = function() {
            if (req.status == 200) {
                var invoke = jDrupal.moduleInvokeAll("rest_post_process", req);
                if (!invoke) {
                    connected();
                } else {
                    invoke.then(connected);
                }
            } else {
                reject(req);
            }
        };
        req.onerror = function() {
            reject(Error("Network Error"));
        };
        req.send(JSON.stringify({
            name: {
                value: name
            },
            pass: {
                value: pass
            },
            mail: {
                value: mail
            },
            preferred_langcode: {
                value: lang
            },
            timezone: {
                value: timezone
            }
        }));
    });
};

jDrupal.Views = function(path) {
    this.path = path;
    this.results = null;
};

jDrupal.Views.prototype.getPath = function() {
    return this.path;
};

jDrupal.Views.prototype.getResults = function() {
    return this.results;
};

jDrupal.Views.prototype.getView = function() {
    var self = this;
    return new Promise(function(resolve, reject) {
        var req = new XMLHttpRequest();
        req.dg = {
            service: "views",
            resource: null
        };
        req.open("GET", jDrupal.restPath() + self.getPath());
        var loaded = function() {
            self.results = JSON.parse(req.response);
            resolve();
        };
        req.onload = function() {
            if (req.status == 200) {
                var invoke = jDrupal.moduleInvokeAll("rest_post_process", req);
                if (!invoke) {
                    loaded();
                } else {
                    invoke.then(loaded);
                }
            } else {
                reject(req);
            }
        };
        req.onerror = function() {
            reject(Error("Network Error"));
        };
        req.send();
    });
};

jDrupal.viewsLoad = function(path) {
    return new Promise(function(resolve, reject) {
        var view = new jDrupal.Views(path);
        view.getView().then(function() {
            resolve(view);
        });
    });
};

jDrupal.Entity = function(entityType, bundle, id) {
    this.entity = null;
    this.bundle = bundle;
    this.entityID = id;
    this.entityKeys = {};
};

jDrupal.Entity.prototype.get = function(prop, delta) {
    if (!this.entity || typeof this.entity[prop] === "undefined") {
        return null;
    }
    return typeof delta !== "undefined" ? this.entity[prop][delta] : this.entity[prop];
};

jDrupal.Entity.prototype.set = function(prop, delta, val) {
    if (this.entity) {
        if (typeof delta !== "undefined" && typeof this.entity[prop] !== "undefined") {
            this.entity[prop][delta] = val;
        } else {
            this.entity[prop] = val;
        }
    }
};

jDrupal.Entity.prototype.getEntityKey = function(key) {
    return typeof this.entityKeys[key] !== "undefined" ? this.entityKeys[key] : null;
};

jDrupal.Entity.prototype.getEntityType = function() {
    return this.entityKeys["type"];
};

jDrupal.Entity.prototype.getBundle = function() {
    var bundle = this.getEntityKey("bundle");
    return typeof this.entity[bundle] !== "undefined" ? this.entity[bundle][0].target_id : null;
};

jDrupal.Entity.prototype.id = function() {
    var id = this.getEntityKey("id");
    return typeof this.entity[id] !== "undefined" ? this.entity[id][0].value : null;
};

jDrupal.Entity.prototype.language = function() {
    return this.entity.langcode[0].value;
};

jDrupal.Entity.prototype.isNew = function() {
    return !this.id();
};

jDrupal.Entity.prototype.label = function() {
    var label = this.getEntityKey("label");
    return typeof this.entity[label] !== "undefined" ? this.entity[label][0].value : null;
};

jDrupal.Entity.prototype.stringify = function() {
    return JSON.stringify(this.entity);
};

jDrupal.Entity.prototype.preLoad = function(options) {
    return new Promise(function(resolve, reject) {
        resolve();
    });
};

jDrupal.Entity.prototype.load = function() {
    try {
        var _entity = this;
        var entityType = _entity.getEntityType();
        return new Promise(function(resolve, reject) {
            _entity.preLoad().then(function() {
                var path = jDrupal.restPath() + entityType + "/" + _entity.id() + "?_format=json";
                var req = new XMLHttpRequest();
                req.dg = {
                    service: entityType,
                    resource: "retrieve"
                };
                req.open("GET", path);
                var loaded = function() {
                    _entity.entity = JSON.parse(req.response);
                    _entity.postLoad(req).then(function() {
                        resolve(_entity);
                    });
                };
                req.onload = function() {
                    if (req.status == 200) {
                        var invoke = jDrupal.moduleInvokeAll("rest_post_process", req);
                        if (!invoke) {
                            loaded();
                        } else {
                            invoke.then(loaded);
                        }
                    } else {
                        reject(req);
                    }
                };
                req.onerror = function() {
                    reject(Error("Network Error"));
                };
                req.send();
            });
        });
    } catch (error) {
        console.log("jDrupal.Entity.load - " + error);
    }
};

jDrupal.Entity.prototype.postLoad = function(options) {
    return new Promise(function(resolve, reject) {
        resolve();
    });
};

jDrupal.Entity.prototype.preSave = function(options) {
    return new Promise(function(resolve, reject) {
        resolve();
    });
};

jDrupal.Entity.prototype.save = function() {
    var _entity = this;
    return new Promise(function(resolve, reject) {
        _entity.preSave().then(function() {
            jDrupal.token().then(function(token) {
                var entityType = _entity.getEntityType();
                var method = null;
                var resource = null;
                var path = null;
                var isNew = _entity.isNew();
                if (isNew) {
                    method = "POST";
                    resource = "create";
                    path = entityType;
                } else {
                    method = "PATCH";
                    resource = "update";
                    path = entityType + "/" + _entity.id();
                }
                path += "?_format=json";
                var req = new XMLHttpRequest();
                req.dg = {
                    service: entityType,
                    resource: resource
                };
                req.open(method, jDrupal.restPath() + path);
                req.setRequestHeader("Content-type", "application/json");
                req.setRequestHeader("X-CSRF-Token", token);
                req.onload = function() {
                    _entity.postSave(req).then(function() {
                        if (method == "POST" && req.status == 201 || method == "PATCH" && req.status == 204 || req.status == 200) {
                            var invoke = jDrupal.moduleInvokeAll("rest_post_process", req);
                            if (!invoke) {
                                resolve(req);
                            } else {
                                invoke.then(resolve(req));
                            }
                        } else {
                            reject(req);
                        }
                    });
                };
                req.onerror = function() {
                    reject(Error("Network Error"));
                };
                req.send(_entity.stringify());
            });
        });
    });
};

jDrupal.Entity.prototype.postSave = function(xhr) {
    var self = this;
    return new Promise(function(resolve, reject) {
        if (self.isNew() && xhr.getResponseHeader("Location")) {
            var parts = xhr.getResponseHeader("Location").split("/");
            var entityID = self.entity[self.getEntityKey("id")] = [ {
                value: parts[parts.length - 1]
            } ];
        }
        resolve();
    });
};

jDrupal.Entity.prototype.preDelete = function(options) {
    return new Promise(function(resolve, reject) {
        resolve();
    });
};

jDrupal.Entity.prototype.delete = function(options) {
    var _entity = this;
    return new Promise(function(resolve, reject) {
        _entity.preDelete().then(function() {
            jDrupal.token().then(function(token) {
                var entityType = _entity.getEntityType();
                var path = jDrupal.restPath() + entityType + "/" + _entity.id();
                var data = {};
                data[_entity.getEntityKey("bundle")] = [ {
                    target_id: _entity.getBundle()
                } ];
                var req = new XMLHttpRequest();
                req.dg = {
                    service: entityType,
                    resource: "delete"
                };
                req.open("DELETE", path);
                req.setRequestHeader("Content-type", "application/json");
                req.setRequestHeader("X-CSRF-Token", token);
                req.onload = function() {
                    _entity.postDelete(req).then(function() {
                        if (req.status == 204) {
                            var invoke = jDrupal.moduleInvokeAll("rest_post_process", req);
                            if (!invoke) {
                                resolve(req);
                            } else {
                                invoke.then(resolve(req));
                            }
                        } else {
                            reject(req);
                        }
                    });
                };
                req.onerror = function() {
                    reject(Error("Network Error"));
                };
                req.send(JSON.stringify(data));
            });
        });
    });
};

jDrupal.Entity.prototype.postDelete = function(options) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.entity = null;
        resolve();
    });
};

jDrupal.entityConstructorPrep = function(obj, entityID_or_entity) {
    if (!entityID_or_entity) {} else if (typeof entityID_or_entity === "object") {
        obj.entity = entityID_or_entity;
    } else {
        var id = obj.getEntityKey("id");
        var entity = {};
        entity[id] = [ {
            value: entityID_or_entity
        } ];
        obj.entity = entity;
    }
};

jDrupal.Comment = function(cid_or_comment) {
    this.entityKeys["type"] = "comment";
    this.entityKeys["bundle"] = "comment_type";
    this.entityKeys["id"] = "cid";
    this.entityKeys["label"] = "subject";
    jDrupal.entityConstructorPrep(this, cid_or_comment);
};

jDrupal.Comment.prototype = new jDrupal.Entity();

jDrupal.Comment.prototype.constructor = jDrupal.Comment;

jDrupal.Comment.prototype.getSubject = function() {
    return this.entity.subject[0].value;
};

jDrupal.Comment.prototype.setSubject = function(subject) {
    try {
        this.entity.subject[0].value = subject;
    } catch (e) {
        console.log("jDrupal.Comment.setSubject - " + e);
    }
};

jDrupal.Comment.prototype.preSave = function(options) {
    return new Promise(function(resolve, reject) {
        resolve();
    });
};

jDrupal.Comment.prototype.stringify = function() {
    try {
        if (!this.isNew()) {
            var entityClone = JSON.parse(JSON.stringify(this.entity));
            var protected_fields = [ "hostname", "changed", "cid", "thread", "uuid", "entity_id", "entity_type", "pid", "field_name", "created", "name", "mail", "homepage" ];
            for (var i = 0; i < protected_fields.length; i++) {
                if (typeof entityClone[protected_fields[i]] !== "undefined") {
                    delete entityClone[protected_fields[i]];
                }
            }
            return JSON.stringify(entityClone);
        }
        return JSON.stringify(this.entity);
    } catch (error) {
        console.log("jDrupal.Comment.stringify - " + error);
    }
};

jDrupal.Node = function(nid_or_node) {
    this.entityKeys["type"] = "node";
    this.entityKeys["bundle"] = "type";
    this.entityKeys["id"] = "nid";
    this.entityKeys["label"] = "title";
    jDrupal.entityConstructorPrep(this, nid_or_node);
    if (this.entity) {
        if (!this.entity.title) {
            this.entity.title = [ {
                value: ""
            } ];
        }
    }
};

jDrupal.Node.prototype = new jDrupal.Entity();

jDrupal.Node.prototype.constructor = jDrupal.Node;

jDrupal.Node.prototype.getTitle = function() {
    return this.label();
};

jDrupal.Node.prototype.setTitle = function(title) {
    try {
        this.entity.title[0].value = title;
    } catch (e) {
        console.log("jDrupal.Node.setTitle - " + e);
    }
};

jDrupal.Node.prototype.getType = function() {
    return this.getBundle();
};

jDrupal.Node.prototype.getCreatedTime = function() {
    return this.entity.created[0].value;
};

jDrupal.Node.prototype.isPromoted = function() {
    return this.entity.promote[0].value;
};

jDrupal.Node.prototype.isPublished = function() {
    return this.entity.status[0].value;
};

jDrupal.Node.prototype.isSticky = function() {
    return this.entity.sticky[0].value;
};

jDrupal.Node.prototype.preSave = function(options) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var protected_fields = [ "changed", "revision_timestamp", "revision_uid" ];
        for (var i = 0; i < protected_fields.length; i++) {
            delete self.entity[protected_fields[i]];
        }
        resolve();
    });
};

jDrupal.User = function(uid_or_account) {
    this.entityKeys["type"] = "user";
    this.entityKeys["bundle"] = "user";
    this.entityKeys["id"] = "uid";
    this.entityKeys["label"] = "name";
    jDrupal.entityConstructorPrep(this, uid_or_account);
};

jDrupal.User.prototype = new jDrupal.Entity();

jDrupal.User.prototype.constructor = jDrupal.User;

jDrupal.User.prototype.getAccountName = function() {
    return this.label();
};

jDrupal.User.prototype.getRoles = function() {
    var _roles = this.entity.roles;
    var roles = [];
    for (var i = 0; i < this.entity.roles.length; i++) {
        roles.push(this.entity.roles[i].target_id);
    }
    return roles;
};

jDrupal.User.prototype.hasRole = function(role) {
    return jDrupal.inArray(role, this.getRoles());
};

jDrupal.User.prototype.isAnonymous = function() {
    return this.id() == 0;
};

jDrupal.User.prototype.isAuthenticated = function() {
    return !this.isAnonymous();
};

jDrupal.User.prototype.getEmail = function() {
    return this.get("mail")[0].value;
};

jDrupal.currentUser = function() {
    return jDrupal._currentUser;
};

jDrupal.User.prototype.postLoad = function(options) {
    var self = this;
    return new Promise(function(ok, err) {
        if (!self.entity.roles) {
            self.entity.roles = [ {
                target_id: "authenticated"
            } ];
        }
        ok();
    });
};

jDrupal.userDefaults = function() {
    return new jDrupal.User({
        uid: [ {
            value: 0
        } ],
        roles: [ {
            target_id: "anonymous"
        } ]
    });
};

jDrupal.setCurrentUser = function(account) {
    if (account.isAuthenticated() && !jDrupal.inArray("authenticated", account.getRoles())) {
        account.entity.roles.push({
            target_id: "authenticated"
        });
    }
    jDrupal._currentUser = account;
};

jDrupal.userPassword = function() {
    var length = 10;
    if (arguments[0]) {
        length = arguments[0];
    }
    var password = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz23456789";
    for (var i = 0; i < length; i++) {
        password += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return password;
};

jDrupal.settings = {
    sitePath: "https://app.vintuoso.com",
    basePath: "/"
};

const OPEN = true;

const SEALED = false;

const NEW = true;

const OLD = false;

var OPAQUE = "#FFFFFF";

var TRANSPARENT = OPAQUE + "00";

var MILKY = OPAQUE + "e0";

var PASTEL = "#FCF6E8";

const MIDTONE = "#f1d38a";

const VIVID = "#e5ab1e";

const VIVID10 = VIVID + "1A";

const VIVID20 = VIVID + "33";

const VIVID67 = VIVID + "AA";

var VLocal = {};

class VMain {
    constructor(reset) {
        if (!VMain.instance) {
            this._data = [];
            VMain.instance = this;
            this.splashLogo = null;
            this.needReset = reset;
            this.preInitApp();
        }
        return VMain.instance;
    }
    static version = "1";
    preInitApp() {
        if (_isDebug()) try {
            navigator.splashscreen.hide();
        } catch (e) {}
        try {
            StatusBar.backgroundColorByHexString(VIVID);
            StatusBar.overlaysWebView(false);
            StatusBar.styleLightContent();
        } catch (err) {
            _debug_toast("StatusBar Error: <br>" + err, "ERROR");
        }
        this.darkMode = false;
        this.appReady = false;
        this.injectScriptIndex = 1;
        this.userSettingsCached = _localInterface.user_reset ? null : JSON.parse(localStorage.getItem("user_settings_cached"));
        this.is_showHints = true;
        this.aromaburstInstance = null;
        this.foodPairingInstance = null;
        try {
            VMain.version = _builVersion + "." + _localInterface.minor_version;
            console.log("Version:" + VMain.version);
            var langcode = null == this.userSettingsCached ? _deviceLangcode : this.userSettingsCached.langcode;
            this.localize(langcode).then(langcode => {
                this.initApp();
            });
        } catch (e) {
            _release_toast(e);
        }
    }
    initApp() {
        if (this.injectScriptIndex == 1) {
            _deviceType() == "apple" ? ons.platform.select("ios") : ons.platform.select("android");
            ons.platform.select("ios");
            if (null != this.userSettingsCached) {
                vUserSingleton.settings = this.userSettingsCached;
            }
        }
        _injectScript(_localInterface.scripts[this.injectScriptIndex]).then(script_name => {
            var Mb = Math.round(this.byteLength(localStorage.getItem(script_name)) / 1024) / 1e3;
            _debug_toast("inserting " + script_name + " success (" + Mb + " Mb)", "DEBUG");
            this.injectScriptIndex++;
            if (this.injectScriptIndex < _localInterface.scripts.length) {
                this.initApp();
            } else {
                vUserSingleton.updateDebugging();
                if (this.needReset) vDataSingleton.clearCache();
                if (false && !_isDebug()) {
                    _release_toast(vUserSingleton.settings.uid, 3e4);
                    _exitApp();
                } else {
                    this.startApp();
                }
            }
        }, script_name => {
            _debug_toast("inserting " + script_name + " fail", "ERROR");
        });
    }
    localize(langcode) {
        return new Promise((resolve, reject) => {
            var VLocal_cached = localStorage.getItem("VLocal_cache");
            if (null !== VLocal_cached && langcode == VLocal_cached.langcode) {
                VLocal = VLocal_cached;
                _debug_toast("lang is " + VLocal.langcode, "DEBUG");
                resolve();
            } else {
                _injectConfig(_localInterface.scriptsDir + "/" + langcode + ".json").then(result => {
                    VLocal = JSON.parse(result);
                    VMain.localizeRangeNames();
                    localStorage.setItem("VLocal_cache", VLocal);
                    _debug_toast("lang became " + VLocal.langcode, "DEBUG");
                    resolve();
                }, () => {
                    _release_toast(vUserSingleton.settings.uid, 3e4);
                    _exitApp();
                });
            }
        });
    }
    static signIn() {
        let userEditor = new VUserEditor();
        userEditor.prompt("signin");
    }
    static signOut() {
        let userEditor = new VUserEditor();
        userEditor.prompt("signout");
    }
    static signUp() {
        let userEditor = new VUserEditor();
        userEditor.prompt("signup");
    }
    static editUser() {
        let userEditor = new VUserEditor();
        userEditor.prompt("edit");
    }
    static editPic() {
        let userEditor = new VUserEditor();
        userEditor.editUserPicture();
    }
    static modal_target = "";
    static modalShow(target = "modal-custom") {
        return new Promise((resolve, reject) => {
            try {
                this.modal_target = target;
                document.getElementById(target).show().then(resolve);
            } catch (e) {
                console.log(e);
                reject();
            }
        });
    }
    static modalHide() {
        try {
            let modal = document.getElementById(this.modal_target);
            if (null != modal && modal.visible) modal.hide();
        } catch (err) {
            _debug_toast_err(err);
        }
    }
    static pushPage(page, anim = "lift", background = "transparent") {
        return new Promise((resolve, reject) => {
            if (page.id === undefined) reject();
            let onsenNavigator = document.getElementById("appNavigator");
            onsenNavigator.setAttribute("animation", anim);
            onsenNavigator.pushPage(page.id, {
                data: {
                    title: page.title,
                    id: page.id,
                    nid: page.id
                },
                options: {
                    animation: anim
                }
            }).then(() => {
                this.setBackground(background);
                resolve();
            });
        });
    }
    static popPage(background = "transparent") {
        return new Promise((resolve, reject) => {
            let onsenNavigator = document.getElementById("appNavigator");
            onsenNavigator.popPage().then(() => {
                this.setBackground(background);
                resolve();
            });
        });
    }
    static pushMainPage(page) {
        let loadMainPage = () => {
            return new Promise((resolve, reject) => {
                document.getElementById("splitter-content").load(page.id).then(() => {
                    this.setBackground(OPAQUE);
                    try {
                        this.createMapToast();
                    } catch (err) {
                        _debug_toast_err(err);
                    }
                    resolve();
                });
            });
        };
        if (page.prev == "edit-food-page.html" || page.prev == "edit-wine-page.html" || page.prev == "edit-user-page.html") {
            vCameraSingleton.hide();
            this.popPage().then(() => {
                loadMainPage().then(() => {
                    this.searchWines();
                });
            });
        } else if (page.prev == "edit-cellar-page.html") {
            vCameraSingleton.hide();
            this.popPage().then(() => {
                loadMainPage().then(() => {
                    this.searchWines();
                });
            });
        } else if (page.prev == "wine-card-page.html") {
            this.popPage().then(() => {
                this.setBackground(OPAQUE);
                this.searchWines();
            });
        } else if (page.prev == "my-cellar-page.html") {
            this.setBackground(OPAQUE);
            this.popPage();
        } else if (page.prev == "camera-wine-page.html" || page.prev == "camera-food-page.html" || page.prev == "camera-user-page.html" || page.prev == "camera-map-page.html") {
            vCameraSingleton.hide();
            this.setBackground(OPAQUE);
            loadMainPage().then(() => {
                this.searchWines();
            });
        } else {
            loadMainPage();
        }
    }
    static initLanguages() {
        if (!_isDebug()) return;
        var selector = document.getElementById("choose-language");
        if (selector.length > 0) return;
        addOption("English", "en");
        addOption("Français", "fr");
        addOption("Español", "es");
        addOption("Русский", "ru");
        function addOption(txt, val) {
            const option = document.createElement("option");
            option.innerText = txt;
            option.value = val;
            selector.firstChild.appendChild(option);
            var langCode = 0;
            switch (vUserSingleton.settings.langcode) {
              case "fr":
                langCode = 1;
                break;

              case "es":
                langCode = 2;
                break;

              case "ru":
                langCode = 3;
                break;

              default:
                break;
            }
            setTimeout(function() {
                selector.selectedIndex = langCode;
            }, 500);
        }
    }
    byteLength(str) {
        if (null === str) return 0;
        var s = str.length;
        for (var i = str.length - 1; i >= 0; i--) {
            var code = str.charCodeAt(i);
            if (code > 127 && code <= 2047) s++; else if (code > 2047 && code <= 65535) s += 2;
            if (code >= 56320 && code <= 57343) i--;
        }
        return s;
    }
    startApp() {
        if (null == localStorage.getItem("wineColors_cached")) {
            this.splashLogo = new VSplashLogo("modal-splash");
            try {
                navigator.splashscreen.hide();
            } catch (e) {}
        }
        _debug_toast(vUserSingleton.settings.name + " is debug : " + _isDebugUser());
        try {
            cordova.plugins.osTheme.getTheme().then(theme => {
                _debug_toast("iosTheme: the current theme is: " + (theme.isDark ? "Dark" : "Light"), "DEBUG");
                this.darkMode = theme.isDark;
                VMain.switchDarkMode(this.darkMode);
            }).catch(message => {
                _debug_toast("iosTheme err: " + message, "ERROR");
            });
        } catch (e) {
            _debug_toast("iosTheme exc: " + e, "ERROR");
        }
        vDataSingleton.loadCache();
        this.createWinesPage();
        document.getElementById("splitter-content").load("selected-wines.html", {
            id: "selected-wines.html",
            title: "Vintuoso",
            prev: ""
        }).then(() => {
            document.getElementById("page-toolbar-title").innerHTML = '<img style="height: -webkit-fill-available;" src="css/title_yellow.png "/>';
            this.createFiltersPage();
            VMain.createMapToast();
            jDrupal.connect().then(() => {
                if (!VMain.appReady) {
                    vDrupalSingleton.getSessionToken().then(csrfToken => {
                        vUserSingleton.settings.csrfToken = csrfToken;
                        VMain.createLeftSideMenu();
                        VMain.appReady = true;
                    });
                }
                VMain.showFabs();
                vDrupalSingleton.getServerData().then(() => {
                    vDrupalSingleton.getWines(vSearchSingleton.createPerfectWineFilter()).then(() => {
                        vSearchSingleton.showWines();
                        try {
                            navigator.splashscreen.hide();
                        } catch (e) {
                            _debug_toast_err(e);
                        }
                    });
                    if (this.splashLogo) this.splashLogo.destroy();
                });
            });
        });
    }
    createWinesPage() {
        if (null !== document.getElementById("selected-wines.html")) return;
        let displayFilter = _isDebug() ? "" : "none";
        var mainPage = document.createElement("template");
        mainPage.id = "selected-wines.html";
        let html = '<ons-page id="selected-wines-page">' + "<ons-toolbar  >" + '<div class="left" style="width:10%;">' + '<ons-toolbar-button id="show-menu-button"  ontouchend="VMain.toggleLeftMenu()">' + '<ons-icon icon="fa-bars"></ons-icon>' + "</ons-toolbar-button>" + "</div>" + '<div class="center" id="page-toolbar-title" style="width:80%;">' + VLocal.Vintuoso + "</div>" + '<div class="right" style="width:10%;">' + '<ons-toolbar-button style="display:' + displayFilter + ';" id="filters-toggle-button" class="hint-filters"  ontouchend="VMain.showFiltersPage()">' + '<ons-icon icon="fa-filter"></ons-icon>' + "</ons-toolbar-button>" + "</div>" + "</ons-toolbar>" + '<ons-fab id="describe-wine-button" class="hint-describe-wine" style="top:50px" modifier="mini" position="top right" ontouchend="VMain.createNewWine();">' + '<ons-icon icon="fa-edit" style="transform: scale(.7)"></ons-icon>' + "</ons-fab>" + '<ons-fab id="cellar-button"  modifier="mini" position="top right" style="top:100px" class="hint-describe-wine" ontouchend="VMain.openCellar();">' + '<img style="transform: scale(.7); width: 1.28571429em; filter: invert(1);" class="list-item__icon cellar" src="css/wine-bottle-solid.svg">' + '<img style="transform: scale(.7); width: 1.28571429em; margin-left: -2.3em; margin-top: 0.2em; filter: invert(1);" class="list-item__icon cellar" src="css/wine-bottle-solid.svg">' + "</ons-fab>" + '<ons-fab id="toggle-my-wines" class="hint-describe-wine" style="top:150px" modifier="mini" position="top right" ontouchend="VMain.toggleMyWines();">' + '<ons-icon icon="fa-user" style="transform: scale(.7)"></ons-icon>' + "</ons-fab>";
        if (!_isInReview()) html += '<ons-fab id="toggle-map-button" style="right:0;" class="fab-toggle hint-describe-wine" modifier="mini" position="bottom right" >' + '<ons-icon icon="fa-map"></ons-icon>&nbsp;<ons-switch style="margin-top: 3px;" onchange="VMain.toggleMapToast();"></ons-switch>' + "</ons-fab>";
        html += '<ons-progress-bar id="wine-list-progressbar" style="width:100%; height:5px;" secondary-value="100" class="progressStyle" indeterminate></ons-progress-bar>' + '<div class="page__content" style="overflow-y:scroll">' + '<ons-list style="margin-top: -5px;" >' + '<ons-lazy-repeat id="wines-infinite-list" style="background-color: transparent;"></ons-lazy-repeat>' + "</ons-list>" + "</div>" + "</ons-page>";
        mainPage.innerHTML = html;
        $("#app-body")[0].appendChild(mainPage);
        var sankeyCard = document.createElement("template");
        sankeyCard.id = "wine-details-sankey.html";
        sankeyCard.innerHTML = '<ons-alert-dialog id="sankey-card" mask-color = "rgba(0, 0, 0, 0.0)"  cancelable >' + '<div class="alert-dialog-title">' + '<ons-alert-dialog-button style="position: fixed; text-align: left; z-index: 1;" ontouchend="document.getElementById(\'sankey-card\').hide()"><ons-icon icon="fa-close"></ons-icon></ons-alert-dialog-button>' + "</div>" + '<div id="wine-sankey" style="height: ' + .9 * window.innerHeight + "px; width: " + .9 * window.innerWidth + 'px"></div>' + "</ons-alert-dialog>";
        $("#app-body")[0].appendChild(sankeyCard);
        var mapCard = document.createElement("template");
        mapCard.id = "wine-details-map.html";
        mapCard.innerHTML = '<ons-alert-dialog id="map-card" mask-color = "rgba(0, 0, 0, 0.0)"  cancelable >' + '<div class="alert-dialog-title">' + '<ons-alert-dialog-button style="position: fixed; text-align: left; z-index: 1;" ontouchend="document.getElementById(\'map-card\').hide()"><ons-icon icon="fa-close"></ons-icon></ons-alert-dialog-button>' + "</div>" + '<div id="appellation-map-canvas" style="height: ' + .9 * window.innerHeight + 'px; width:100%; "></div>' + '<div id="map-legend" style="background-color:' + TRANSPARENT + ' height:300px; width:100px;position:absolute;top:40px;left:-100px"></div>' + "</ons-alert-dialog>";
        $("#app-body")[0].appendChild(mapCard);
    }
    winesListProgressBar = null;
    static toggleMyWines() {
        let fab = document.getElementById("toggle-my-wines");
        if ("fa-user" == fab.querySelector("ons-icon").getAttribute("icon")) {
            fab.innerHTML = '<ons-icon icon="fa-globe" style="transform: scale(.7)"></ons-icon>';
            vDataSingleton.selectedWines = vUserSingleton.wines;
            vSearchSingleton.showWines();
        } else {
            fab.innerHTML = '<ons-icon icon="fa-user" style="transform: scale(.7)"></ons-icon>';
            this.searchWines();
        }
    }
    static toggleLeftMenu() {
        document.getElementById("appSplitter").left.toggle();
    }
    static createLeftSideMenu() {
        var leftSideMenu = document.getElementById("sidemenu_left");
        let parentNode = document.getElementById("sidemenu_left-page");
        parentNode.style.overflowY = "scroll";
        if (leftSideMenu) VMain.removeElement(leftSideMenu);
        leftSideMenu = document.createElement("div");
        leftSideMenu.style = "height: " + window.innerHeight + "px";
        leftSideMenu.id = "sidemenu_left";
        var html = "<ons-list> " + '<ons-list-item modifier="nodivider">' + '<div class="left">' + '<img id="logo-img" style="margin-right: 10px; width:70%" src="css/title_yellow.png">' + '<canvas id="canvas-logo-img"  >' + "</canvas>" + "</div>" + "</ons-list-item>" + '<ons-list-header id="access-title">' + VLocal.Access + "</ons-list-header>";
        if (jDrupal.currentUser().isAuthenticated()) {
            html += '<ons-list-item modifier="nodivider">' + '<div class="left left-30">' + '<img id="user-img" ontouchend="VMain.editPic()" style="border-radius:50px; border:3px solid ' + VIVID + "; background-color: " + OPAQUE + '; margin-right: 10px; height:80px; max-width:60px" src="' + vUserSingleton.settings.image + '">' + "</div>" + '<div class="center"  ontouchend="VMain.editUser()" >' + VLocal.Hello + " " + jDrupal.currentUser().getAccountName() + "</div>" + "</ons-list-item>" + '<ons-list-item modifier="nodivider" id="sign-out" ontouchend="VMain.signOut()">' + '<div class="left left-30">' + '<ons-icon icon="fa-user-times" class="list-item__icon"></ons-icon>' + "</div>" + '<div class="center" id="sign-out-message">' + VLocal.SignOut + "</div>" + "</ons-list-item>";
        } else if (!_localInterface.app_in_review) {
            html += '<ons-list-item modifier="nodivider" id="sign-up" ontouchend="VMain.signUp()">' + '<div class="left left-30">' + '<ons-icon icon="fa-user-plus" class="list-item__icon"></ons-icon>' + "</div>" + '<div class="center" id="sign-up-message">' + VLocal.SignUp + "</div>" + "</ons-list-item>" + '<ons-list-item modifier="nodivider" id="sign-in" ontouchend="VMain.signIn()">' + '<div class="left left-30">' + '<ons-icon icon="fa-sign-in" class="list-item__icon"></ons-icon>' + "</div>" + '<div class="center" id="sign-in-message">' + VLocal.SignIn + "</div>" + "</ons-list-item>";
        }
        html += '<ons-list-header style="margin-top: 10px" id="navigation-title">' + VLocal.Profile + "</ons-list-header>";
        var checked = vUserSingleton.settings.organic == "" ? "" : "checked";
        html += '<ons-list-item modifier="nodivider">' + '<div class="left left-30">' + '<ons-icon fixed-width class="list-item__icon" icon="fa-leaf"></ons-icon>' + "</div>" + '<div class="center" id="bio-message">' + VLocal.OnlyBioWines + "</div>" + '<div class="right"><ons-switch  id="bio-switch" ' + checked + ' onchange="vUserSingleton.switchBio(this);"></ons-switch></div>' + "</ons-list-item>";
        checked = vUserSingleton.settings.organic == "" ? "disabled" : "";
        checked = vUserSingleton.settings.organic == "natural" ? "checked" : "";
        html += '<ons-list-item modifier="nodivider" >' + '<div class="left left-30">' + '<ons-icon fixed-width class="list-item__icon" icon="fa-heartbeat"></ons-icon>' + "</div>" + '<div class="center" id="natural-message">' + VLocal.OnlyNaturalWines + "</div>" + '<div class="right"><ons-switch  id="natural-switch"  onchange="vUserSingleton.switchNatural(this);" ' + checked + "></ons-switch></div>" + "</ons-list-item>";
        checked = vUserSingleton.settings.vegan ? "checked" : "";
        html += '<ons-list-item modifier="nodivider" >' + '<div class="left left-30">' + '<ons-icon fixed-width class="list-item__icon" icon="md-flower"></ons-icon>' + '<ion-icon name="flower-sharp"></ion-icon>' + "</div>" + '<div class="center" id="vegan-message">' + VLocal.OnlyVeganWines + "</div>" + '<div class="right"><ons-switch  id="vegan-switch"  onchange="vUserSingleton.switchVegan(this);" ' + checked + "></ons-switch></div>" + "</ons-list-item>";
        html += '<ons-list-header style="margin-top: 10px" id="navigation-title">' + VLocal.Navigation + "</ons-list-header>";
        if (_isDebugUser()) {
            html += '<ons-list-item modifier="nodivider">' + '<div class="left left-30">' + '<i class="fa fa-language list-item__icon"></i>' + "</div>" + '<div class="center">' + '<ons-select id="choose-language" onchange="VMain.selectLanguage(event)">' + "</ons-select>" + "</div>" + "</ons-list-item>";
            html += '<ons-list-item modifier="nodivider" id="create-AOP-button" ontouchend="VMain.mapEdit();">' + '<div class="left left-30">' + '<ons-icon fixed-width class="list-item__icon" icon="fa-map-o"></ons-icon>' + "</div>" + '<div class="center" id="create-AOP">Add AOP</div>' + "</ons-list-item>";
            html += '<ons-list-item modifier="nodivider" id="clear-cache-button" ontouchend="VMain.resetApp(false); ">' + '<div class="left left-30">' + '<ons-icon fixed-width class="list-item__icon" icon="fa-sign-out"></ons-icon>' + "</div>" + '<div class="center" id="clear-cache-message">Clean restart</div>' + "</ons-list-item>";
        }
        checked = this.darkMode ? "checked" : "";
        html += '<ons-list-item modifier="nodivider" >' + '<div class="left left-30">' + '<ons-icon fixed-width class="list-item__icon" icon="md-contrast"></ons-icon>' + "</div>" + '<div class="center" id="darkmode-message">' + VLocal.DarkMode + "</div>" + '<div class="right"><ons-switch  id="darkmode-switch"  onchange="VMain.switchDarkMode();" ' + checked + "></ons-switch></div>" + "</ons-list-item>" + '<ons-list-item modifier="nodivider" id="about-button" onclick="VMain.promptInfo()">' + '<div class="left left-30">' + '<ons-icon fixed-width class="list-item__icon" icon="fa-info"></ons-icon>' + "</div>" + '<div class="center" id="about-message">' + VLocal.About + " Vintuoso</div>" + '<div class="right" id="about-version">' + this.version + "</div>" + "</ons-list-item>" + "</ons-list>";
        leftSideMenu.innerHTML = html;
        parentNode.appendChild(leftSideMenu);
        setTimeout(() => {
            document.getElementById("appSplitter").left.addEventListener("postopen", () => {
                if (jDrupal.currentUser().isAuthenticated()) document.getElementById("user-img").src = vUserSingleton.settings.image + "?v=" + new Date().getTime();
            });
            this.initLanguages();
        }, 200);
    }
    static isDarkMode() {
        return this.darkMode;
    }
    static switchDarkMode(isDarkMode) {
        let darkModeSwitchElement = document.getElementById("darkmode-switch");
        let boutique = document.getElementById("boutiques-map-canvas");
        if (null != isDarkMode) {
            this.darkMode = isDarkMode;
            if (null != darkModeSwitchElement) darkModeSwitchElement.checked = isDarkMode;
        } else if (null != darkModeSwitchElement) this.darkMode = darkModeSwitchElement.checked;
        if (this.darkMode) {
            document.getElementById("onsen-theme-css").setAttribute("href", "css/dark-onsen-css-components.min.css");
            OPAQUE = "#0D0D0D";
            PASTEL = "#030917";
            MILKY = OPAQUE + "e0";
            if (null != boutique) boutique.style.filter = "invert(0.9)";
            {
                try {
                    StatusBar.backgroundColorByHexString(OPAQUE);
                } catch (e) {}
            }
        } else {
            document.getElementById("onsen-theme-css").setAttribute("href", "css/onsen-css-components.min.css");
            OPAQUE = "#FFFFFF";
            PASTEL = "#FCF6E8";
            MILKY = OPAQUE + "e0";
            if (null != boutique) boutique.style.filter = "";
            {
                try {
                    StatusBar.backgroundColorByHexString(VIVID);
                } catch (e) {}
            }
        }
        VMain.setBackground(OPAQUE);
    }
    static promptInfo() {
        ons.notification.alert({
            title: VLocal.About + " " + VLocal.Vintuoso,
            messageHTML: VLocal.PleaseRateUsContent,
            cancelable: true
        });
    }
    createFiltersPage() {
        var tabIndex = 0;
        let mainPage = document.getElementById("selected-wines-page");
        if (null == document.getElementById("hint-sunburst-chart")) {
            var headerHeight = document.querySelector("ons-toolbar").offsetHeight + (ons.platform.isIPhoneX() ? 15 : 0);
            var hintSpan = document.createElement("span");
            hintSpan.id = "hint-sunburst-chart";
            hintSpan.classList.add("hint-sunburst-chart");
            hintSpan.style = "position: absolute;  width:90%;  border-radius:50%; margin-left: 5%; margin-top: " + headerHeight + "px; top: 35%;";
            mainPage.appendChild(hintSpan);
        }
        if (null == document.getElementById("toast-filters")) {
            var foodPairingPage = document.createElement("template");
            foodPairingPage.id = "food-pairing-page.html";
            foodPairingPage.innerHTML = "<ons-page>" + '<div id="foodpairing" style="width: 100%;">' + "</div>" + "</ons-page>";
            $("#app-body")[0].appendChild(foodPairingPage);
            var aromaBurstPage = document.createElement("template");
            aromaBurstPage.id = "aromaburst-page.html";
            aromaBurstPage.innerHTML = "<ons-page>" + '<div id="sunburstchart0" style=" width: 100%; height:' + window.innerWidth + 'px; ;">' + "</div>" + "</ons-page>";
            mainPage.appendChild(aromaBurstPage);
            $("#app-body")[0].appendChild(aromaBurstPage);
            var toastFilters = document.createElement("template");
            toastFilters.id = "filters-page.html";
            toastFilters.addEventListener("preshow", this.toggleFabs);
            toastFilters.addEventListener("posthide", this.toggleFabs);
            toastFilters.innerHTML = '<ons-page id="filters-page">' + "<ons-toolbar>" + '<div class="left" style="width:10%">' + "<ons-back-button>" + "</ons-back-button>" + "</div>" + '<div class="center" style="width:80%">' + '<ons-segment tabbar-id="filters-tabbar"  active-index=' + tabIndex + ' onchange="" style="width:100%">' + '<button id="food-title">' + VLocal.FoodPairing + "</button>" + '<button id="aromaburst-title" class="hint-aromaburst">' + VLocal.Aromas + "</button>" + "</ons-segment>" + "</div>" + '<div class="right" style="width:10%">' + "</div>" + "</ons-toolbar>" + '<ons-tabbar id="filters-tabbar">' + '<ons-tab page="food-pairing-page.html" active></ons-tab>' + '<ons-tab page="aromaburst-page.html"></ons-tab>' + "</ons-tabbar>" + '<ons-fab id="show-wines-button" position="bottom right" class="hint-show-wines" ontouchend="VMain.searchWines()">' + '   <ons-icon icon="fa-search"></ons-icon>' + "</ons-fab>" + "</ons-page>";
            $("#app-body")[0].appendChild(toastFilters);
        }
    }
    static toggleFabs() {
        if (jDrupal.currentUser().isAuthenticated()) {
            document.getElementById("describe-wine-button").toggle();
            document.getElementById("cellar-button").toggle();
            document.getElementById("toggle-my-wines").toggle();
        }
        if (!_isInReview()) document.getElementById("toggle-map-button").toggle();
    }
    static showFabs() {
        if (jDrupal.currentUser().isAuthenticated()) {
            document.getElementById("describe-wine-button").show();
            document.getElementById("cellar-button").show();
            document.getElementById("toggle-my-wines").show();
        } else {
            document.getElementById("describe-wine-button").hide();
            document.getElementById("cellar-button").hide();
            document.getElementById("toggle-my-wines").hide();
        }
        if (!_isInReview()) document.getElementById("toggle-map-button").show();
    }
    static hideFabs() {
        document.getElementById("toggle-map-button").hide();
        document.getElementById("describe-wine-button").hide();
        document.getElementById("cellar-button").hide();
        document.getElementById("toggle-my-wines").hide();
    }
    static createMapToast() {
        let mainPage = document.getElementById("selected-wines-page");
        if (null === document.getElementById("toast-map")) {
            var toastMap = document.createElement("ons-toast");
            toastMap.id = "toast-map";
            toastMap.style = "bottom:-10px; border-radius: 10px 10px 0 0; width:100%";
            toastMap.innerHTML = '<ons-gesture-detector style="padding:0; height:20px">' + '<ons-button style="line-height: 20px; background-color:' + VIVID20 + '; width:100%; padding: 0"  id="map-view-button" ripple>' + '<ons-icon color:#fff; icon="md-unfold-more" style="margin-left: 50%;"></ons-icon>' + "</ons-button>" + "</ons-gesture-detector>" + '<div id="map-view" class="hint-aromas" style="width: 100%; ">' + '<ons-search-input id="address-search" style="width:100%; " placeholder="Chez moi" float>' + "</ons-search-input>" + '<div id="boutiques-map-canvas" style="width:100%; height:200px; max-height:500px; background-color:inherit">' + "</div>" + "</div";
            mainPage.appendChild(toastMap);
        }
        document.addEventListener("drag", function(event) {
            if (event.target.matches("#map-view-button")) {
                var rect = event.target.getBoundingClientRect();
                document.getElementById("boutiques-map-canvas").style.height = window.innerHeight - 44 - event.gesture.center.clientY + "px";
            }
        });
        document.getElementById("show-menu-button").classList.add("hint-show-menu");
    }
    static toggleMapToast() {
        let toastMap = document.getElementById("toast-map");
        toastMap.toggle().then(() => {
            vMapSingleton.setGoogleMap("boutiques-map-canvas").then(() => {
                vSearchSingleton.showBoutiques();
            });
        });
    }
    static showFiltersPage() {
        this.pushPage({
            id: "filters-page.html"
        }, "fade", OPAQUE).then(() => {
            try {
                this.foodPairingInstance = new VFoodSearch("foodpairing");
                document.getElementById("filters-tabbar").addEventListener("prechange", e => {
                    this.aromaburstInstance = new VBurst("sunburstchart0", "wine");
                });
            } catch (e) {
                _release_toast(e, 1e4);
            }
        });
    }
    static openCellar() {
        var vCellar = new VCellar();
        vCellar.open();
    }
    static addBottle() {
        this.popPage().then(() => {
            new VBottleEditor(null);
        });
    }
    static mapEdit() {
        new VMapEditor(null);
    }
    static editBottle(vWine) {
        new VBottleEditor(vWine);
    }
    static editWine(vWine) {
        new VWineEditor(vWine);
    }
    static createNewWine() {
        new VWineEditor();
    }
    static createNewFood() {
        new VWineEditor();
    }
    static editFood(vFood) {
        new VFoodEditor(vFood);
    }
    static searchWines() {
        this.winesListProgressBar = document.getElementById("wine-list-progressbar");
        this.winesListProgressBar.style = "display:block";
        vDrupalSingleton.getWines(vSearchSingleton.createPerfectWineFilter()).then(() => {
            this.winesListProgressBar.style = "display:none";
            vSearchSingleton.showWines();
        });
    }
    static setBackground(background) {
        var x, i;
        x = document.querySelectorAll(".page__background");
        for (i = 0; i < x.length; i++) {
            x[i].style.backgroundColor = background;
        }
    }
    static removeElementById(target) {
        this.removeElement(document.getElementById(target));
    }
    static removeElement(element) {
        if (null !== element) {
            element.parentElement.removeChild(element);
        }
    }
    static showHints() {
        if (!VMain.is_showHints || !vUserSingleton.settings.is_showHints) return;
        this.is_showHints = false;
        var enjoyhint_instance = new EnjoyHint({
            onEnd: function() {
                vUserSingleton.settings.is_showHints = false;
                vUserSingleton.saveUserCache();
            }
        });
        var enjoyhint_script_steps = [ {
            "touchend .hint-sunburst-chart": "Wellcome to Aromaburst! <br> Start navigating in the circle. Click on the segments to burst aromas, click on the inner circle to go back",
            shape: "circle",
            showNext: true
        }, {
            "touchend .hint-aromas": "Available individual aromas and their families will be shown here",
            showNext: true
        }, {
            "click .hint-filters": "Tell where to look for wines.",
            showNext: true
        }, {
            "touchend .hint-aromas-food-pairing": "Switch between aromas and food pairing",
            showNext: true
        }, {
            "touchend .hint-show-wines": "After selecting aromas or food pairing click here to show corresponding wines",
            shape: "circle",
            showNext: true
        }, {
            "touchend .hint-show-menu": "Main menu where you can log in or register to be able to add your wines!",
            showNext: true
        }, {
            "click .hint-end": 'Your are all set! Click "Done" to not show these hints next time, or "Hide" if you want to review the steps',
            showNext: true,
            skipButton: {
                className: "mySkip",
                text: "Hide"
            },
            nextButton: {
                className: "mySkip",
                text: "Done"
            }
        } ];
        enjoyhint_instance.set(enjoyhint_script_steps);
        enjoyhint_instance.run();
    }
    static resetApp(is_reloadApp) {
        vDataSingleton.clearCache();
        if (is_reloadApp) {
            location.reload();
        } else {
            vDrupalSingleton.getServerData();
        }
    }
    static selectLanguage(e) {
        vUserSingleton.setUserLangcode(e.target.value);
        VMain.localize(e.target.value).then(() => {
            VMain.resetApp(true);
        });
    }
    static localizeRangeNames() {
        let food = {
            foodAcidityRangeNames: [ VLocal["AcidityNone"], VLocal["AcidityLow"], VLocal["AcidityMedium"], VLocal["AcidityHigh"], VLocal["AcidityAcid"] ],
            foodSpicinessRangeNames: [ VLocal["SpicinessNone"], VLocal["SpicinessLow"], VLocal["SpicinessSpicy"], VLocal["SpicinessHot"] ],
            foodSugarRangeNames: [ VLocal["SugarNone"], VLocal["SugarLow"], VLocal["SugarSweet"], VLocal["SugarVerySweet"] ],
            foodSaltRangeNames: [ VLocal["SaltNone"], VLocal["SaltSalty"], VLocal["SaltVerySalty"] ],
            foodFatRangeNames: [ VLocal["FatNone"], VLocal["FatLow"], VLocal["FatMedium"], VLocal["FatFat"] ],
            foodBitternessRangeNames: [ VLocal["BitternessNone"], VLocal["BitternessBitterish"], VLocal["BitternessBitter"] ]
        };
        Object.assign(VLocal, food);
        VLocal.wineAcidityRangeNames = [ VLocal.AcidityFlat, VLocal.AcidityLow, VLocal.AcidityMedium, VLocal.AcidityFresh, VLocal.AcidityAcid ];
        VLocal.wineAstringencyRangeNames = [ VLocal.AstringencyNone, VLocal.AstringencyLow, VLocal.AstringencyMedium, VLocal.AstringencyTannic, VLocal.AstringencyRough ];
        VLocal.wineBodyRangeNames = [ VLocal.BodyFluid, VLocal.BodyLight, VLocal.BodyMedium, VLocal.BodyFull, VLocal.BodyHeavy ];
        VLocal.winePersistenceRangeNames = [ VLocal.PersistenceNone, VLocal.PersistenceShort, VLocal.PersistenceMedium, VLocal.PersistenceLong, VLocal.PersistenceExtra ];
        VLocal.wineTanninsRangeNames = [ VLocal.TanninsNone, VLocal.TanninsLight, VLocal.TanninsSmooth, VLocal.TanninsDry, VLocal.TanninsHarsh ];
        VLocal.wineTransparencyRangeNames = [ VLocal.TransparencyTransparent, VLocal.TransparencyTinted, VLocal.TransparencyMedium, VLocal.TransparencyHue, VLocal.TransparencyOpaque ];
        VLocal.wineIntensityRangeNames = [ VLocal.IntensityLow, VLocal.IntensityMediumLow, VLocal.IntensityMedium, VLocal.IntensityMediumHigh, VLocal.IntensityHigh ];
        VLocal.wineSugarRangeNames = [ VLocal.SugarExtraBrut, VLocal.SugarBrut, VLocal.SugarDry, VLocal.SugarSemiDry, VLocal.SugarSweet, VLocal.SugarLiquor ];
        VLocal.wineSaltRangeNames = [ VLocal.SaltNone, VLocal.SaltMineral, VLocal.SaltSaline ];
        VLocal.wineParticlesRangeNames = [ VLocal.ParticlesLimpid, VLocal.ParticlesPresent, VLocal.ParticlesCloudy ];
        VLocal.wineGasRangeNames = [ VLocal.GasStill, VLocal.GasBeady, VLocal.GasSemiSparkling, VLocal.GasSparkling ];
        VLocal.wineBitternessRangeNames = [ VLocal.BitternessNone, VLocal.BitternessBitterish, VLocal.BitternessBitter ];
        VLocal.wineBioRangeNames = [ VLocal.BioNo, VLocal.BioOrganic, VLocal.BioBiodynamic ];
        VLocal.wineSulfitesRangeNames = [ VLocal.SulfitesYes, VLocal.SulfitesNo ];
        VLocal.wineVeganRangeNames = [ VLocal.VeganNo, VLocal.VeganYes ];
    }
    handleOpenURL(url) {
        var waiter = setInterval(timer, 100);
        function timer() {
            if (VMain && VMain.appReady) {
                clearInterval(waiter);
                VMain.openUrl(url);
            }
        }
    }
    openUrl(url) {
        console.log(url);
    }
}

window._isDebug = () => {
    return _isDebugUser() && DEBUG_MODE == "DEBUG";
};

window._isInReview = () => {
    return !_isDebug() && _localInterface.app_in_review;
};

if (!String.prototype.trim) {
    String.prototype.trim = function() {
        return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
    };
}

String.prototype.removeDiacritics = function() {
    var diacritics = [ [ /[\300-\306]/g, "A" ], [ /[\340-\346]/g, "a" ], [ /[\310-\313]/g, "E" ], [ /[\350-\353]/g, "e" ], [ /[\314-\317]/g, "I" ], [ /[\354-\357]/g, "i" ], [ /[\322-\330]/g, "O" ], [ /[\362-\370]/g, "o" ], [ /[\331-\334]/g, "U" ], [ /[\371-\374]/g, "u" ], [ /[\321]/g, "N" ], [ /[\361]/g, "n" ], [ /[\307]/g, "C" ], [ /[\347]/g, "c" ] ];
    var s = this;
    for (var i = 0; i < diacritics.length; i++) {
        s = s.replace(diacritics[i][0], diacritics[i][1]);
    }
    return s;
};

window.handleOpenURL = function(url) {
    setTimeout(function() {
        _release_toast(url);
    }, 10);
};

class VSplashLogo {
    constructor(target) {
        if (!VSplashLogo.instance) {
            this._data = [];
            VSplashLogo.instance = this;
            this.timer = 0;
            VMain.modalShow("modal-splash").then(() => {
                this.init(target);
            });
        }
        return VSplashLogo.instance;
    }
    static getTimer() {
        return this.timer;
    }
    init(target) {
        var targetDiv = document.getElementById(target);
        this.target = target + "-draw";
        var canvas = document.getElementById(this.target);
        if (null !== canvas) {
            targetDiv.removeChild(canvas);
        }
        canvas = document.createElement("div");
        canvas.id = this.target;
        canvas.style = "position:absolute; width:" + window.innerWidth + "px; height: " + (window.innerHeight + 44) + "px; top:0px; left:0px; background:white";
        targetDiv.insertBefore(canvas, targetDiv.firstChild);
        this.timer = Date.now();
        var width = window.innerWidth;
        var height = window.innerHeight + 44;
        console.log("draw: " + width + " : " + height);
        var draw = SVG(canvas).size(width, height);
        var ray = [];
        ray[1] = draw.path("M511.47,404.44c0-0.93,0-1.87,0-2.8c-1.05-1.5-1.96-3.16-1.79-4.97c0.31-3.18-1.01-5.97-1.68-8.92 c-0.12-0.54-0.4-0.96-1.09-0.95c-0.56,0.01-0.82-0.35-0.84-0.9c-0.01-0.4-0.12-0.83-0.01-1.19c0.41-1.36-0.39-2.11-1.32-2.81 c-0.21-0.16-0.42-0.33-0.63-0.49c-1.2-0.84-1.92-1.99-2.3-3.39c-0.32-1.18-0.68-2.35-1.04-3.56c-0.19,0.01-0.35,0.02-0.52,0.03 c-1.39,0.06-1.86-0.31-1.77-1.68c0.05-0.72,0.27-1.49,0.62-2.12c1.31-2.34,2.06-4.71,0.82-7.33c-0.22-0.47-0.38-1-0.69-1.4 c-0.6-0.78-1.48-1.4-1.11-2.59c0.04-0.12-0.13-0.29-0.19-0.44c-1.57-3.62-3.26-7.2-4.67-10.88c-1.16-3.02-1.79-6.22-3.18-9.18 c-1.22-2.6-2.07-5.38-3.12-8.06c-0.34-0.88-0.73-1.7-1.55-2.35c-0.76-0.6-1.41-1.43-1.87-2.29c-0.94-1.78-1.7-3.65-2.54-5.48 c-0.23-0.5-0.39-1.06-0.73-1.47c-0.73-0.9-1.66-1.66-2.31-2.61c-0.61-0.89-1.37-0.89-2.14-0.62c-1.88,0.66-3.76,1.32-5.56,2.17 c-2.4,1.13-4.72,2.45-7.08,3.67c-4.38,2.25-8.71,4.57-12.67,7.54c-0.44,0.33-1.08,0.51-1.64,0.54c-1.32,0.07-1.85,0.54-1.98,1.89 c-0.04,0.43-0.27,0.85-0.41,1.27c0,0.2,0,0.4,0,0.6c0.08,0.25,0.18,0.49,0.23,0.75c0.21,1.13,0.24,2.32,0.64,3.38 c0.79,2.11,1.78,4.14,2.7,6.2c1.54,3.46,2.97,6.94,3.9,10.64c0.66,2.62,1.74,5.16,2.83,7.64c0.45,1.01,0.7,2.02,0.97,3.07 c0.41,1.62,0.85,3.28,1.59,4.77c0.84,1.69,2.01,3.21,2.25,5.16c0.03,0.25,0.17,0.52,0.33,0.72c0.75,0.91,0.97,2,1.14,3.13 c0.09,0.55,0.25,1.1,0.47,1.62c2.18,5.19,4.44,10.36,6.57,15.57c1.45,3.56,2.75,7.18,4.1,10.78c0.13,0.34,0.21,0.7,0.33,1.04 c1.18,3.51,2.37,7.02,3.55,10.53c0.47,0,0.93,0,1.4,0c1.12-0.28,2.22-0.62,3.35-0.83c1.2-0.22,2.51-0.08,3.64-0.48 c4.34-1.52,8.94-2.17,13.09-4.3c1.51-0.77,3.03-1.47,4.38-2.51c0.44-0.34,0.95-0.63,1.46-0.84c1.82-0.75,3.67-1.45,5.61-2.21 C511.14,406.59,511.3,405.51,511.47,404.44z");
        ray[2] = draw.path("M441.23,327.32c-0.73,0-1.47,0-2.2,0c-2.39-0.86-3.69-2.73-4.8-4.9c-1.71-3.36-3.57-6.64-5.7-9.78 c-2.28-3.35-4.26-6.91-6.27-10.44c-1.56-2.74-2.93-5.59-4.43-8.36c-0.65-1.2-1.5-2.29-2.11-3.5c-1.08-2.15-2.44-4.02-4.44-5.42 c-0.94-0.67-1.42-1.54-0.97-2.84c0.8-2.33,1.39-4.72,2.14-7.06c0.4-1.25,1.07-2.35,2.14-3.17c1.49-1.16,3.06-2.24,4.42-3.54 c4.66-4.45,10.37-6.31,16.61-6.93c0.46-0.05,1.01,0.09,1.42,0.32c1.25,0.67,2.29,1.56,2.93,2.9c0.22,0.47,0.74,0.83,1.18,1.15 c0.83,0.6,1.93,0.97,2.53,1.74c1.45,1.87,3.34,3.36,4.39,5.61c1.02,2.18,2.6,4.09,3.81,6.19c2.99,5.19,5.85,10.45,8.89,15.61 c1.78,3.02,3.26,6.21,5.31,9.11c0.95,1.35,0.9,3.4,1.26,5.14c0.05,0.26-0.13,0.58-0.22,0.86c-0.84,2.56-2.79,4.29-4.71,5.94 c-1.75,1.51-3.77,2.71-5.71,3.99c-1.26,0.83-2.55,1.62-3.9,2.29C449.02,324.09,445.33,326.16,441.23,327.32z");
        ray[3] = draw.path("M400.75,283.85c-0.07,0-0.13,0-0.2,0c-0.21-0.08-0.42-0.2-0.65-0.23c-1.45-0.22-2.9-0.37-4.34-0.64 c-1.33-0.25-2.62-0.81-3.95-0.91c-2.04-0.15-4.11,0.01-6.16-0.04c-2.32-0.06-4.65-0.12-6.97-0.32c-4.93-0.42-9.81-1.39-14.79-1.37 c-2.31,0.01-4.63-0.33-6.94-0.62c-2.23-0.27-4.45-0.66-6.67-1.02c-1.18-0.2-2.33-0.62-3.51-0.67c-2.58-0.1-5.17,0.01-7.76-0.04 c-2.83-0.06-5.65-0.35-8.47-0.28c-2.2,0.05-4.26-0.71-6.5-0.55c-3.21,0.23-6.47,0.1-9.68-0.17c-3.17-0.26-5.56-1.86-6.64-5.05 c-0.24-0.72-0.56-1.43-0.91-2.11c-1.27-2.5-1.37-5.18-1.1-7.87c0.16-1.61,0.6-3.2,0.87-4.8c0.62-3.73,1.12-7.49,1.86-11.2 c0.32-1.6,1.37-3.07,1.64-4.67c0.27-1.64,1.33-2.05,2.55-2.33c2.65-0.61,5.29-0.15,7.94,0.2c2.05,0.27,4.05,0.83,6.16,0.67 c1.41-0.1,2.85,0.15,4.27,0.3c2.84,0.29,5.69,0.61,8.53,0.94c3.04,0.35,6.07,0.73,9.1,1.08c0.71,0.08,1.22,0.32,1.64,0.95 c0.26,0.39,0.8,0.79,1.24,0.83c1.42,0.12,2.88,0.26,4.27,0.05c2.56-0.4,5.08-0.3,7.62,0.08c1.17,0.17,2.41,0.29,3.56,0.11 c1.67-0.28,2.95-0.22,3.89,1.5c0.48,0.89,1.55,1.43,2.26,2.22c0.69,0.77,1.2,0.92,2,0.28c0.44-0.35,0.75-0.87,1.19-1.2 c0.87-0.65,1.72-1.46,2.71-1.77c2.8-0.87,5.67-0.95,8.53-0.15c1.69,0.47,3.4,0.92,5.12,1.27c2.47,0.5,4.99,0.79,7.44,1.37 c2.03,0.47,4.01,1.2,5.99,1.87c0.97,0.33,1.9,0.76,2.82,1.21c0.25,0.12,0.5,0.46,0.56,0.74c0.9,3.99,1.2,7.96,0.44,12.05 c-0.72,3.91-1.02,7.89-1.41,11.86c-0.23,2.39-1.26,4.46-2.29,6.54c-0.13,0.25-0.37,0.54-0.62,0.62c-0.97,0.34-1.95,0.61-2.94,0.89 C401.9,283.59,401.32,283.71,400.75,283.85z");
        ray[4] = draw.path("M299.21,260.73c0,1.27,0,2.53,0,3.8c-0.06,0.19-0.15,0.37-0.18,0.56c-0.36,2.66-0.76,5.32-1.04,7.98 c-0.19,1.78-0.88,3.08-2.74,3.41c-1.56,0.27-3.16,0.3-4.71,0.63c-1.64,0.34-3.25,0.33-4.91,0.27c-1.4-0.04-2.81,0.47-4.22,0.74 c-0.67,0-1.33,0-2,0c-0.98-0.14-1.96-0.33-2.94-0.43c-3.02-0.31-6.03-0.31-9.06-0.04c-1.08,0.1-2.2-0.33-3.31-0.36 c-5.82-0.16-11.65-0.27-17.47-0.39c-0.37-0.01-0.76-0.09-1.09,0.02c-2.14,0.75-4.37,0.73-6.59,0.74c-3.1,0.02-6.2,0.01-9.3,0.01 c-2.23,0-4.45,0.04-6.68,0c-0.95-0.01-1.89-0.24-2.83-0.25c-4.09-0.06-8.18-0.08-12.26-0.09c-0.46,0-0.93,0.08-1.38,0.19 c-3.23,0.79-4.95-0.43-5.23-3.72c-0.01-0.1,0-0.2-0.02-0.3c-0.26-1.6-0.48-3.21-0.78-4.8c-0.37-1.99-1.16-3.97-1.14-5.95 c0.06-5.63-1.4-11.06-1.87-16.61c-0.1-1.14,0.02-2.31-0.06-3.45c-0.02-0.34-0.38-0.65-0.58-0.98c0-0.6,0-1.2,0-1.8 c0.07-0.25,0.19-0.51,0.2-0.76c0.02-0.8,0.3-1.18,1.2-1.33c2.38-0.41,4.72-1.05,7.11-1.47c1.99-0.35,4-0.64,6.01-0.75 c3.63-0.2,7.11,0.58,10.51,1.89c1.41,0.54,2.9,0.9,4.3-0.38c0.68-0.62,1.63-0.96,2.48-1.36c0.7-0.33,1.45-0.56,2.18-0.84 c0.8,0,1.6,0,2.4,0c1.46,0.21,2.92,0.54,4.39,0.6c1.82,0.07,3.65-0.14,5.48-0.14c3.89-0.01,7.8-0.15,11.68,0.09 c4.27,0.26,8.53,0.93,12.81,0.67c3.07-0.19,6.08,0.03,9.05,0.79c0.93,0.24,1.87,0.59,2.8,0.58c1.65-0.01,3.3-0.2,4.94-0.4 c4.6-0.54,8.86,0.38,12.74,2.9c0.33,0.21,0.67,0.68,0.69,1.05c0.13,1.85,0.62,3.59,1.4,5.25c0,0.07,0,0.13,0,0.2 c-0.15,0.83-0.4,1.66-0.42,2.49c-0.05,2.86-0.06,5.72-0.01,8.57C298.81,258.65,299.07,259.69,299.21,260.73z");
        ray[5] = draw.path("M195.97,277.16c0,0.13,0,0.27,0,0.4c-0.09,0.08-0.23,0.15-0.26,0.25c-0.49,1.6-1.54,2.76-2.8,3.8 c-0.87,0.72-1.64,1.57-2.54,2.25c-0.83,0.63-1.75,1.19-2.69,1.65c-1.31,0.64-2.72,1.08-4.02,1.75c-2.63,1.36-5.17,2.9-7.81,4.22 c-2.04,1.02-4.17,1.87-6.3,2.7c-0.55,0.22-1.25,0.15-1.87,0.11c-1.77-0.11-3.02-0.88-3.34-2.79c-0.07-0.38-0.35-0.84-0.68-1.05 c-1-0.65-2.1-1.15-3.09-1.81c-0.93-0.61-1.91-1.24-2.64-2.06c-1.1-1.24-2.03-2.63-2.99-3.99c-2.27-3.2-4.43-6.48-6.81-9.59 c-1.11-1.45-1.98-2.97-2.71-4.61c-0.29-0.66-0.19-1.06,0.57-1.37c0.88-0.36,1.75-0.83,2.51-1.41c2.43-1.86,4.79-3.81,7.22-5.67 c1.89-1.45,3.86-2.8,5.79-4.19c0.27-0.19,0.52-0.4,0.76-0.63c1.65-1.61,3.47-2.97,5.52-4.07c2.13-1.14,4.13-2.53,6.22-3.77 c0.52-0.31,1.14-0.67,1.7-0.63c1.62,0.1,3.23,0.37,4.84,0.62c0.33,0.05,0.75,0.24,0.91,0.5c1.21,2.02,2.44,4.03,3.54,6.11 c1.86,3.52,3.65,7.08,5.43,10.64c1.38,2.75,2.97,5.4,3.93,8.36C194.81,274.34,195.43,275.74,195.97,277.16z");
        ray[6] = draw.path("M98.23,372.48c0-0.93,0-1.87,0-2.8c1.05-1.5,1.96-3.16,1.79-4.97c-0.31-3.18,1.01-5.97,1.68-8.92 c0.12-0.54,0.4-0.96,1.09-0.95c0.56,0.01,0.82-0.35,0.84-0.9c0.01-0.4,0.12-0.83,0.01-1.19c-0.41-1.36,0.39-2.11,1.32-2.81 c0.21-0.16,0.42-0.33,0.63-0.49c1.2-0.84,1.92-1.99,2.3-3.39c0.32-1.18,0.68-2.35,1.04-3.56c0.19,0.01,0.35,0.02,0.52,0.03 c1.39,0.06,1.86-0.31,1.77-1.68c-0.05-0.72-0.27-1.49-0.62-2.12c-1.31-2.34-2.06-4.71-0.82-7.33c0.22-0.47,0.38-1,0.69-1.4 c0.6-0.78,1.48-1.4,1.11-2.59c-0.04-0.12,0.13-0.29,0.19-0.44c1.57-3.62,3.26-7.2,4.67-10.88c1.16-3.02,1.79-6.22,3.18-9.18 c1.22-2.6,2.07-5.38,3.12-8.06c0.34-0.88,0.73-1.7,1.55-2.35c0.76-0.6,1.41-1.43,1.87-2.29c0.94-1.78,1.7-3.65,2.54-5.48 c0.23-0.5,0.39-1.06,0.73-1.47c0.73-0.9,1.66-1.66,2.31-2.61c0.61-0.89,1.37-0.89,2.14-0.62c1.88,0.66,3.76,1.32,5.56,2.17 c2.4,1.13,4.72,2.45,7.08,3.67c4.38,2.25,8.71,4.57,12.67,7.54c0.44,0.33,1.08,0.51,1.64,0.54c1.32,0.07,1.85,0.54,1.98,1.89 c0.04,0.43,0.27,0.85,0.41,1.27c0,0.2,0,0.4,0,0.6c-0.08,0.25-0.18,0.49-0.23,0.75c-0.21,1.13-0.24,2.32-0.64,3.38 c-0.79,2.11-1.78,4.14-2.7,6.2c-1.54,3.46-2.97,6.94-3.9,10.64c-0.66,2.62-1.74,5.16-2.83,7.64c-0.45,1.01-0.7,2.02-0.97,3.07 c-0.41,1.62-0.85,3.28-1.59,4.77c-0.84,1.69-2.01,3.21-2.25,5.16c-0.03,0.25-0.17,0.52-0.33,0.72c-0.75,0.91-0.97,2-1.14,3.13 c-0.09,0.55-0.25,1.1-0.47,1.62c-2.18,5.19-4.44,10.36-6.57,15.57c-1.45,3.56-2.75,7.18-4.1,10.78c-0.13,0.34-0.21,0.7-0.33,1.04 c-1.18,3.51-2.37,7.02-3.55,10.53c-0.47,0-0.93,0-1.4,0c-1.12-0.28-2.22-0.62-3.35-0.83c-1.2-0.22-2.51-0.08-3.64-0.48 c-4.34-1.52-8.94-2.17-13.09-4.3c-1.51-0.77-3.03-1.47-4.38-2.51c-0.44-0.34-0.95-0.63-1.46-0.84c-1.82-0.75-3.67-1.45-5.61-2.21 C98.55,374.63,98.39,373.55,98.23,372.48z");
        ray[7] = draw.path("M104.21,484.66c-0.64,0-1.28,0-1.92,0c-0.53-0.14-1.05-0.37-1.6-0.42c-3.79-0.31-5.66-2.23-4.8-4.87 c0.32-0.99,0.53-2.03,0.51-3.04c-0.05-3.39-0.24-6.79-0.32-10.18c-0.02-0.84,0.21-1.69,0.25-2.53c0.02-0.53-0.13-1.05-0.16-1.58 c-0.13-1.85-0.29-3.71-0.34-5.57c-0.06-2.12-0.04-4.25-0.02-6.37c0.01-1.51,0.91-2.95,0.39-4.53c-0.38-1.14-0.26-2.37-0.26-3.57 c0-1.36,0.13-2.72,0.19-4.08c0.12-2.85-1.08-5.68-0.18-8.54c0.03-0.09-0.01-0.2-0.02-0.3c-0.13-1.94-0.34-3.89-0.37-5.83 c-0.05-2.72,0.05-5.44,0.03-8.16c-0.03-3.81-0.1-7.62-0.16-11.43c-0.01-0.36-0.05-0.73-0.09-1.09c-0.12-1.05-0.61-2.16-0.31-3.15 c0.55-1.79-0.62-3.47-0.25-5.21c0.07-0.31,0.28-0.63,0.55-0.88c0.82-0.8,1.7-1.57,2.54-2.35c0.62-0.58,1.32-0.89,2.35-0.51 c0.43,0.16,1.11,0.4,1.36,0.27c1.51-0.76,3.09-0.33,4.66-0.29c1.24,0.03,2.48,0.11,3.7,0.05c4.15-0.2,8.28-0.71,12.44-0.12 c0.18,0.03,0.37-0.02,0.55,0.01c1.64,0.22,3.32,0.35,4.89,0.71c1.9,0.44,2.35,1.66,2.4,2.96c0.09,2.15,0.1,4.3,0.24,6.45 c0.21,3.19,0.66,6.37,0.73,9.56c0.1,4.43-0.11,8.86-0.07,13.29c0.01,0.89,0.54,1.77,0.78,2.66c0.16,0.59,0.23,1.18,0.36,1.89 c-0.73-0.1-1.12-0.14-1.59-0.21c0,0.55,0,1.02,0,1.48c0.49-0.23,0.85-0.4,1.21-0.58c0.06,0.33,0.12,0.66,0.17,0.99 c0.04,0.25,0.11,0.5,0.11,0.75c-0.02,0.88-0.07,1.76-0.11,2.63c-0.01,0.22-0.08,0.45-0.03,0.66c0.15,0.61,0.46,1.2,0.5,1.81 c0.13,1.66,0.11,3.33,0.22,4.99c0.33,4.78,0.73,9.56,1.02,14.34c0.13,2.09-0.07,4.2,0.12,6.29c0.38,4.14,1.24,8.27,0.46,12.44 c-0.48,2.56-0.9,5.14-1.39,7.7c-0.03,0.18-0.38,0.39-0.65,0.47c-1.21,0.38-2.41,0.79-3.67,1.05c-5.98,1.24-12.08,1.8-18.3,1.77 C108.31,484.49,106.26,484.61,104.21,484.66z");
        ray[8] = draw.path("M134.28,488c0.33,0,0.67,0,1,0c0.6,0.27,1.21,0.52,1.8,0.81c0.2,0.1,0.45,0.23,0.53,0.41 c1.06,2.32,2.24,4.59,3.09,6.98c1.29,3.68,3.03,7.13,4.9,10.53c0.75,1.37,1.65,2.67,2.25,4.09c1.35,3.24,2.56,6.55,3.82,9.83 c0.07,0.18,0.17,0.37,0.17,0.55c0.02,0.82,0.01,1.65,0.01,2.55c-0.15,0.07-0.41,0.22-0.68,0.34c-0.21,0.09-0.43,0.2-0.66,0.22 c-3.41,0.43-6.18,2.28-9.06,3.94c-3.2,1.84-6.47,3.55-9.68,5.38c-2.52,1.44-5.27,2.47-7.45,4.56c-1.19,1.14-2.95,1.05-4.55,0.87 c-0.46-0.05-1.03-0.33-1.29-0.69c-1.12-1.51-2.19-3.07-3.2-4.66c-0.53-0.84-0.88-1.79-1.37-2.65c-0.73-1.29-0.7-1.93,0.26-3.01 c0.51-0.57,1.01-1.14,1.49-1.69c-0.32-0.28-0.6-0.5-0.85-0.74c-0.65-0.6-1.24-1.3-1.96-1.81c-1.77-1.26-3.51-2.45-4.4-4.62 c-0.75-1.8-1.94-3.41-2.8-5.17c-2.11-4.33-4.93-8.38-5.39-13.4c-0.14-1.54,0.46-2.86,1.9-3.39c2-0.73,3.99-1.45,5.99-2.18 c0.27-0.1,0.71-0.25,0.73-0.42c0.07-0.68,0.48-0.55,0.91-0.52c0.33,0.02,0.67,0.04,0.99-0.04c2.71-0.65,5.42-1.31,8.12-2 c1.48-0.38,2.93-1.15,4.4-1.19C127.2,490.8,130.6,488.9,134.28,488z");
        ray[9] = draw.path("M188.67,597.32c-3.37-1.19-6.76-2.34-10.11-3.6c-2.08-0.78-3.67-2.24-5.03-3.98c-0.9-1.15-1.82-2.3-2.79-3.39 c-0.28-0.31-0.81-0.65-1.17-0.6c-1.3,0.18-1.98-0.7-2.8-1.39c-0.45-0.37-0.95-0.7-1.42-1.05c-1.19-0.89-2.43-1.73-3.57-2.68 c-2.38-1.98-4.72-4.01-7.07-6.02c-0.83-0.72-1.59-1.52-2.47-2.17c-1.72-1.28-2.13-3.18-2.32-5.08c-0.15-1.43-0.91-2.33-1.92-3.08 c-0.37-0.28-1-0.24-1.51-0.32c-0.9-0.13-1.86-0.09-2.7-0.39c-3-1.05-5.25-3.21-7.52-5.32c-0.23-0.22-0.35-0.56-0.52-0.84 c-0.44-0.72-0.79-1.53-1.35-2.15c-1.71-1.89-2.31-4.25-2.62-6.63c-0.25-1.95,1.17-3.32,2.45-4.59c1.08-1.07,2.38-1.94,3.4-3.05 c1.91-2.07,4.17-3.75,6.15-5.74c1.35-1.36,2.74-2.69,4.17-3.97c0.63-0.57,1.41-0.98,2.1-1.49c0.45-0.33,0.9-0.67,1.29-1.07 c1.11-1.1,2.55-1.24,3.96-1.27c0.64-0.01,1.32,0.33,1.91,0.65c1.25,0.68,2.44,1.45,3.66,2.18c0.45,0.27,0.95,0.49,1.35,0.82 c2.02,1.67,4.04,3.34,6.01,5.07c1.99,1.75,3.92,3.56,5.84,5.38c0.37,0.35,0.54,0.92,0.9,1.29c1.13,1.16,2.2,2.41,3.48,3.38 c1.87,1.42,3.95,2.54,5.84,3.94c1.43,1.05,2.68,2.34,4.04,3.5c1.36,1.16,2.78,2.25,4.1,3.46c2.15,1.97,4.23,4.01,6.37,5.99 c0.42,0.39,0.94,0.8,1.47,0.92c1.37,0.31,2.42,1,3.32,2.06c0.3,0.36,0.89,0.47,1.23,0.81c0.74,0.76,1.37,1.62,2.11,2.38 c0.57,0.58,1.17,1.17,1.87,1.56c0.67,0.38,0.9,0.76,0.52,1.41c-0.69,1.2-1.36,2.43-2.14,3.58c-1.43,2.12-2.84,4.25-4.83,5.94 c-0.52,0.44-0.59,1.38-0.95,2.04c-0.23,0.42-0.61,0.77-0.95,1.13c-0.17,0.18-0.41,0.31-0.62,0.46c0.25,0.13,0.5,0.25,0.82,0.41 c0.04,1.05-0.47,1.97-1.34,2.84c-2.49,2.46-4.87,5.02-7.37,7.46c-0.59,0.58-1.52,0.82-2.29,1.22 C189.33,597.32,189,597.32,188.67,597.32z");
        ray[10] = draw.path("M252.68,588.92c0,0.53,0,1.07,0,1.6c-0.06,0.15-0.17,0.31-0.17,0.46c-0.09,2.07-0.56,4.03-1.55,5.86 c-0.11,0.21-0.06,0.51-0.07,0.77c-0.02,0.46,0.1,0.98-0.06,1.38c-0.63,1.5-1.39,2.94-2.02,4.44c-1.39,3.3-2.72,6.61-4.08,9.92 c-0.83,2.02-1.87,3.86-3.89,4.95c-0.1,0.05-0.11,0.27-0.17,0.42c-0.13,0-0.27,0-0.4,0c-1.14-0.34-2.26-0.89-3.42-0.99 c-3.68-0.3-7.33-0.74-10.93-1.63c-1.21-0.3-2.15-0.87-2.88-1.81c-0.52-0.68-1.06-1.41-1.33-2.21c-0.31-0.94-0.8-0.84-1.5-0.64 c-1.6,0.47-3.21,0.58-4.75-0.23c-2.31-1.21-4.98-1.64-7.11-3.27c-0.43-0.33-1.03-0.45-1.55-0.67c-1.9-0.81-3.78-1.64-5.07-3.38 c-0.35-0.47-0.8-0.98-1.31-1.2c-0.81-0.35-0.86-0.93-0.74-1.59c0.09-0.51,0.28-1.02,0.52-1.48c0.86-1.61,1.81-3.17,2.63-4.8 c0.3-0.6,0.35-1.33,0.49-2.01c0.2-0.97,0.19-2.03,0.59-2.91c0.79-1.75,1.79-3.4,2.72-5.08c1.19-2.17,2.71-4.22,2.34-6.92 c-0.06-0.45,0.07-0.93,0.16-1.39c0.11-0.54,0.32-0.84,0.99-1.02c0.97-0.26,1.84-0.9,2.75-1.37c0.13,0,0.27,0,0.4,0 c0.37,0.08,0.74,0.22,1.11,0.23c1.96,0.09,3.93,0.02,5.87,0.24c2.26,0.26,4.47,0.94,6.79,0.78c0.23-0.02,0.48-0.03,0.69,0.05 c0.27,0.1,0.69,0.24,0.73,0.43c0.49,2.07,2.82,2.21,3.82,3.72c1.45-0.02,2.52,0.87,3.72,1.49c2.35,1.22,4.79,2.25,7.17,3.4 c2.93,1.42,5.83,2.88,8.75,4.31C252.15,588.9,252.43,588.88,252.68,588.92z");
        ray[11] = draw.path("M258.34,592.52c0-0.67,0-1.33,0-2c0.23-0.98,0.46-1.97,0.69-2.98c1-0.14,2-0.21,2.98-0.42 c1.47-0.31,3.05,0.04,4.43-0.92c0.64-0.45,1.52-0.71,2.31-0.77c2.52-0.21,5.02-0.49,7.4-1.4c0.34-0.13,0.71-0.16,1.07-0.24 c3.14-0.7,6.27-1.45,9.42-2.08c2.34-0.47,4.71-0.79,7.07-1.17c0.68-0.11,1.37-0.21,2.05-0.33c2.38-0.42,4.75-0.85,7.13-1.26 c3.03-0.53,6.19-0.21,9.11-1.42c0.61-0.25,1.26-0.45,1.9-0.58c3.42-0.69,6.84-1.34,10.26-2.01c1.39-0.27,2.77-0.55,4.16-0.83 c0.13,0,0.27,0,0.4,0c0.39,0.84,0.85,1.64,1.15,2.51c0.48,1.44,0.83,2.92,1.28,4.37c1,3.19,1.46,6.46,1.77,9.78 c0.15,1.67,0.45,3.4,2.29,4.24c0.15,0.07,0.24,0.37,0.27,0.58c0.32,1.79,0.62,3.59,0.93,5.38c0.17,0.98,0.34,1.95,0.51,2.93 c0,0.2,0,0.4,0,0.6c-0.07,0.49-0.07,1-0.24,1.45c-0.36,0.95-0.72,1.93-1.28,2.77c-0.25,0.37-0.98,0.39-1.49,0.6 c-0.86,0.35-1.69,0.8-2.57,1.07c-1.8,0.54-3.6,1.1-5.45,1.44c-1.04,0.19-2.2-0.23-3.22-0.01c-3.53,0.75-7.03,1.65-10.54,2.52 c-1.69,0.42-3.38,0.78-5.11,0.33c-1.26-0.33-2.41-0.03-3.55,0.49c-1.07,0.48-2.17,0.64-3.37,0.37c-1.22-0.27-2.57-0.64-3.72-0.36 c-2.53,0.61-4.96,1.64-7.45,2.43c-0.91,0.29-1.41,0.87-1.82,1.67c-0.13,0.26-0.49,0.56-0.77,0.58c-3.25,0.18-6.5,0.3-9.75,0.45 c-0.82,0.04-1.64,0.12-2.46,0.19c-1.8,0-3.6,0-5.4,0c-0.45-0.07-0.91-0.2-1.36-0.22c-2.1-0.09-3.64-1.58-3.83-3.69 c-0.06-0.71-0.27-1.41-0.4-2.12c-0.53-2.83-1.07-5.65-1.56-8.48c-0.26-1.5-0.22-3.07-0.64-4.51c-0.74-2.49-1.54-4.94-1.17-7.59 c0.01-0.05-0.06-0.1-0.1-0.16c-0.3,0.05-0.6,0.1-0.91,0.15C258.61,593.4,258.48,592.96,258.34,592.52z");
        ray[12] = draw.path("M355.03,610.49c-0.4,0-0.8,0-1.2,0c-0.81-0.81-1.8-1.5-2.4-2.44c-1.36-2.12-2.49-4.39-3.8-6.55 c-0.77-1.27-1.64-2.5-2.56-3.67c-0.59-0.74-0.92-1.41-0.34-2.28c0.39-0.59,0.3-1.08-0.2-1.58c-0.6-0.61-1.24-1.22-1.67-1.95 c-1.7-2.89-3.27-5.86-4.99-8.75c-0.91-1.52-2.02-2.92-3.04-4.38c0-0.27,0-0.53,0-0.8c1.93-1.44,3.69-3.13,6.2-3.64 c0.77-0.16,1.57-0.56,2.19-1.06c1.87-1.47,3.88-2.59,6.18-3.33c4.45-1.44,8.34-4.07,12.43-6.27c2.02-1.08,3.84-2.48,6.15-3.08 c1.47-0.38,2.81-1.31,4.17-2.07c1.32-0.74,2.59-1.56,3.88-2.35c0.07,0,0.13,0,0.2,0c0.19,0.14,0.37,0.39,0.57,0.42 c1.16,0.13,2.34,0.21,3.39,0.3c0.58,0.8,1.12,1.68,1.79,2.43c1.51,1.68,3.19,3.23,4.63,4.97c1.38,1.66,2.29,3.78,3.88,5.16 c1.45,1.26,1.18,2.22,0.6,3.55c-0.31,0.71-0.03,1.27,0.7,1.49c0.76,0.23,1.54,0.44,2.33,0.5c1.68,0.13,1.74,0.08,2.08,1.8 c0.5,2.51,1.47,4.81,3.38,6.53c1.19,1.08,1.52,2.27,1.44,3.78c-0.09,1.56-0.09,1.64-1.56,2.27c-0.49,0.21-0.97,0.45-1.41,0.74 c-1.74,1.13-3.57,1.99-5.61,2.47c-0.72,0.17-1.32,0.78-2,1.14c-1.18,0.62-2.34,1.35-3.59,1.78c-2.62,0.92-5.33,1.59-7.94,2.53 c-1.29,0.47-2.38,1.5-3.68,1.95c-1.96,0.68-3.92,1.11-5.48,2.76c-1.03,1.09-2.61,1.69-4,2.39 C362.2,607.01,358.61,608.74,355.03,610.49z");
        ray[13] = draw.path("M405.8,581.39c-0.13,0-0.27,0-0.4,0c-0.77-1.04-1.57-2.05-2.29-3.13c-0.85-1.28-2-2.41-2.18-4.05 c-0.19-1.7-1.01-2.74-2.68-3.41c-1.24-0.5-2.87-0.99-2.82-2.91c0-0.03,0-0.08-0.02-0.09c-0.71-0.48-0.25-0.93,0.02-1.41 c0.47-0.84,0.26-1.74-0.41-2.39c-1.48-1.44-2.94-2.9-4.39-4.36c-0.31-0.32-0.56-0.7-0.86-1.07c0.29-0.16,0.47-0.26,0.64-0.36 c1.29-0.75,2.82-1.27,3.81-2.3c0.96-1,2.07-1.49,3.22-2.02c1.27-0.58,2.54-1.15,3.85-1.64c0.77-0.29,1.16-0.76,1.34-1.55 c0.12-0.55,0.29-1.27,0.69-1.56c1.86-1.34,3.83-2.53,5.71-3.84c0.96-0.67,1.95-1.37,2.67-2.26c0.52-0.64,0.99-0.71,1.59-0.52 c0.49,0.16,1.01,0.4,1.39,0.75c1.22,1.12,2.42,2.27,3.55,3.48c1.65,1.77,3.24,3.6,4.86,5.41c0.6,0.67,1.26,1.29,1.8,2.01 c1.28,1.73,2.41,3.57,3.77,5.23c1.45,1.78,2.21,3.84,2.94,5.94c0.1,0.3,0.28,0.57,0.43,0.86c0,0.07,0,0.13,0,0.2 c-0.4,0.44-0.78,0.89-1.2,1.31c-2.9,2.83-5.77,5.7-8.76,8.43c-0.84,0.77-2.08,1.09-3.12,1.65c-0.98,0.53-2.16,0.9-2.87,1.69 c-1.2,1.32-2.61,1.44-4.09,1.17C409.79,580.25,407.81,580.84,405.8,581.39z");
        ray[14] = draw.path("M443.67,558.95c-0.2,0-0.4,0-0.6,0c-1.09-0.8-2.19-1.6-3.28-2.39c-0.5-0.36-0.99-0.76-1.53-1.07 c-1.66-0.96-3.42-1.78-4.99-2.87c-1.66-1.15-3.12-2.59-4.7-3.85c-2.07-1.66-4.08-3.44-6.32-4.84c-1.95-1.21-2.66-3.2-4.01-4.77 c0.98-0.63,1.83-1.27,1.85-2.35c0.06-3.07,0.26-6.13,0.53-9.19c0.25-2.81,0.74-5.52,1.53-8.19c0.58-1.98,1.4-3.87,3.39-4.92 c0.37-0.2,0.77-0.5,0.95-0.86c0.26-0.52,0.47-1.14,0.44-1.71c-0.1-1.64,0.01-3.23,0.59-4.79c1.2-3.2,2.43-6.39,3.47-9.64 c0.34-1.06,0.78-1.92,1.58-2.65c1.13-1.03,1.77-2.36,1.9-3.85c0.28-3.14,0.47-6.29,0.63-9.44c0.12-2.39,0.12-4.79,0.23-7.18 c0.02-0.44,0.32-0.88,0.53-1.31c0.4-0.83,1.01-1.61,1.19-2.48c0.84-4.12,1.48-8.28,2.35-12.39c0.66-3.1,1.57-6.14,2.27-8.87 c2.47-0.81,4.54-1.48,6.6-2.15c0.07,0,0.13,0,0.2,0c1.45,1.02,3.09,1.05,4.68,0.66c2.01-0.5,4.04-0.53,6.04-0.33 c4.12,0.42,8.23,0.96,12.34,1.53c3.19,0.43,6.38,0.86,9.52,1.51c1.42,0.29,2.71,1.15,4.07,1.73c1.26,0.54,1.34,0.88,0.86,2.22 c-0.42,1.18-0.83,2.4-0.93,3.63c-0.19,2.45-0.17,4.92-0.24,7.38c-0.01,0.3,0.05,0.64-0.08,0.88c-0.88,1.67-0.48,3.37-0.23,5.08 c0.09,0.58,0.23,1.26,0.03,1.77c-0.61,1.62-0.36,3.13,0.2,4.45c-0.33,0.45-0.64,0.75-0.79,1.12c-0.78,1.83-1.48,3.7-2.26,5.53 c-3.55,8.23-7.17,16.43-10.67,24.68c-0.69,1.62-1.08,3.39-1.43,5.12c-0.18,0.91-0.53,1.55-1.22,2.15c-0.59,0.5-1.27,1.1-1.49,1.79 c-0.73,2.34-1.2,4.75-1.89,7.1c-0.69,2.32-1.63,4.56-2.28,6.89c-0.54,1.95-1.97,2.88-3.56,3.77c-1.39,0.78-1.69,1.91-1.04,3.38 c0.19,0.44,0.3,0.93,0.35,1.41c0.19,1.86-0.67,3.38-1.79,4.71c-1.94,2.32-4.04,4.5-5.58,7.14c-0.87,1.5-2.15,2.7-3.85,3.36 c-0.27,0.11-0.45,0.49-0.64,0.77c-0.31,0.44-0.51,1.02-0.92,1.32C445.08,558.36,444.34,558.61,443.67,558.95z");
        ray[15] = draw.path("M474.77,425.46c0,0.2,0,0.4,0,0.6c-0.28,0.74-0.41,1.59-0.87,2.19c-1.36,1.79-2.63,3.76-4.34,5.14 c-5.01,4.04-10.5,7.21-17.05,8.08c-1.4,0.19-2.76,0.65-4.14,0.99c-0.13,0-0.27,0-0.4,0c-1.26-0.41-1.99-1.32-2.53-2.48 c-0.55-1.16-1.38-2.1-2.72-2.26c-1.3-0.16-1.99-0.91-2.48-2.02c-1.46-3.31-3.02-6.58-4.37-9.94c-1.23-3.04-2.32-6.14-3.31-9.27 c-0.34-1.07-0.54-2.07-1.4-2.94c-2.81-2.85-4.78-6.29-6.43-9.89c-1.36-2.97-2.88-5.81-4.83-8.44c-0.59-0.79-1.03-1.71-1.46-2.61 c-2.31-4.79-4.57-9.6-6.9-14.38c-0.81-1.67-1-3.29-0.12-4.96c0.52-0.99,1.1-1.96,1.65-2.94c0.55-0.97,1.09-1.94,1.62-2.9 c0.51-0.31,1.09-0.61,1.62-0.99c0.9-0.63,1.73-1.35,2.65-1.93c1.27-0.79,2.6-1.47,3.92-2.19c3.78-2.08,7.51-4.25,11.87-4.94 c1.03-0.16,2.03-0.47,3.04-0.71c0.13,0,0.27,0,0.4,0c0.11,0.07,0.21,0.19,0.32,0.2c2.37,0.21,3.95,1.7,5.5,3.42 c-0.82,1.06-0.32,1.84,0.54,2.68c0.73,0.71,1.28,1.61,1.84,2.48c1.39,2.15,2.8,4.28,4.09,6.49c2.01,3.47,3.95,6.99,5.87,10.51 c0.55,1.01,0.87,2.14,1.4,3.16c2.68,5.19,5.37,10.36,8.1,15.53c0.45,0.86,0.4,1.4-0.54,1.78c-1.04,0.42-1.68,1.01-1.69,2.34 c-0.02,1.44-0.12,1.68,1.21,2.21c1.96,0.78,3.9,1.56,4.67,3.79c0.15,0.43,0.22,0.91,0.45,1.29c1.17,2,2.44,3.93,3.53,5.97 c0.47,0.87,0.66,1.92,0.84,2.91C474.53,422.76,474.62,424.12,474.77,425.46z");
        ray[16] = draw.path("M396.08,294.34c0.27,0,0.53,0,0.8,0c1.78,0.69,3.25,1.85,4.44,3.29c1.65,2,3.21,4.07,4.74,6.17 c0.76,1.04,1.47,2.15,2.01,3.32c1.07,2.32,2.58,4.32,4.06,6.38c1.75,2.41,3.42,4.86,5.29,7.18c0.59,0.73,0.88,1.92,0.84,2.88 c-0.09,1.92-0.5,3.82-0.77,5.66c1.37,1.18,2.67,1.65,3.93,1.44c0.21,0.39,0.45,0.78,0.64,1.2c1.77,3.86,3.56,7.72,5.3,11.59 c1.17,2.6,2.16,5.24,1.46,8.18c-0.09,0.36-0.02,0.85-0.24,1.09c-1.67,1.85-3.36,3.67-5.75,4.68c-2.35,1-4.67,2.09-6.96,3.21 c-3.02,1.48-5.85,3.36-9.39,3.62c-1.74,0.13-3.28-0.14-4.36-1.36c-2.93-3.32-5.71-6.76-8.52-10.18c-0.41-0.5-0.83-1.08-0.2-1.78 c0.11-0.12,0.02-0.52-0.09-0.73c-0.3-0.55-0.61-1.12-1.03-1.58c-1.2-1.34-2.52-2.56-3.67-3.94c-1.76-2.13-3.43-4.33-5.08-6.55 c-0.29-0.4-0.28-1.02-0.43-1.53c-0.11-0.39-0.14-0.96-0.41-1.14c-2.24-1.52-3.25-3.83-4.43-6.13c-1.46-2.85-3.3-5.51-4.98-8.25 c-0.03-0.06-0.08-0.11-0.13-0.15c-1.7-1.74-2.24-4.08-3.24-6.12c0.77-0.55,1.53-0.94,2.1-1.52c3.8-3.88,8.13-7.09,12.8-9.82 c1.02-0.6,1.84-1.33,2.72-2.06c1.92-1.59,3.92-3.09,5.85-4.66C394.33,295.96,395.19,295.13,396.08,294.34z");
        ray[17] = draw.path("M352.03,280.1c0.13,0,0.27,0,0.4,0c0.82,1.12,1.97,2.12,2.4,3.37c1.27,3.68,2.24,7.47,3.38,11.21 c0.37,1.23,0.92,2.4,1.34,3.61c0.75,2.23,1.46,4.48,2.19,6.71c0.04,0.12,0.07,0.32,0.16,0.35c1.07,0.43,1.11,1.44,1.33,2.34 c0,2.07,0,4.13,0,6.2c-0.88,0.08-1.82-0.02-2.64,0.25c-4.69,1.56-9.32,3.29-14.02,4.81c-4.03,1.3-7.9,3.1-12.11,3.92 c-2.19,0.43-4.31,1.26-6.45,1.91c-0.73,0.22-1.46,0.44-2.18,0.67c-0.27,0.09-0.63,0.13-0.77,0.32c-0.75,1.02-1.74,1.5-2.99,1.5 c-0.43,0-0.87,0.01-1.28,0.11c-5.6,1.41-11.2,2.81-16.78,4.28c-3.07,0.81-6.11,1.74-9.17,2.62c-0.47,0-0.93,0-1.4,0 c-1.6-0.93-2.06-2.63-2.83-4.13c-0.24-0.47-0.72-0.91-1.2-1.15c-1.27-0.66-1.45-0.74-0.73-2c0.77-1.35,0.43-2.53,0-3.81 c-0.73-2.16-1.47-4.33-2.07-6.53c-0.88-3.19-2.41-6.19-2.42-9.65c-0.01-1.38-0.87-2.75-1.35-4.12c0-0.47,0-0.93,0-1.4 c0.67-0.65,1.26-1.45,2.04-1.92c1.45-0.86,3.03-1.51,4.53-2.3c0.42-0.22,0.89-0.57,1.06-0.98c0.37-0.86,0.98-1.08,1.81-1.04 c0.5,0.02,1,0.03,1.5,0.03c1.99,0,3.97,0,5.96,0c0.09-0.48,0.25-0.82,0.51-0.94c2.51-1.13,5.05-2.15,7.75-2.8 c4.41-1.06,8.79-2.28,13.18-3.44c0.8-0.21,1.57-0.68,2.37-0.72c2.84-0.12,5.35-1.82,8.28-1.57c0.56,0.05,0.98-0.06,1.26,0.48 c0.4,0.74,1.1,0.84,1.7,0.54c1.03-0.52,2.25-0.83,2.84-2.04c0.15-0.3,0.59-0.48,0.93-0.65c0.4-0.2,0.9-0.25,1.26-0.5 c1.03-0.73,2-1.54,3.01-2.31c0.2-0.16,0.43-0.36,0.67-0.39c2.16-0.23,4.32-0.42,6.48-0.62C350.67,280.27,351.35,280.18,352.03,280.1 z");
        ray[18] = draw.path("M260.62,305.2c0.07,0,0.13,0,0.2,0c0.13,0.09,0.26,0.21,0.4,0.25c1.29,0.4,2.6,0.74,3.86,1.2 c0.77,0.29,1.43,0.78,1.68,1.68c0.26,0.93,0.56,1.84,0.92,2.73c1,2.49,2.06,4.96,3.04,7.45c0.99,2.53,1.86,5.12,2.88,7.64 c0.72,1.78,1.58,3.5,2.43,5.22c0.31,0.62,0.85,1.12,1.16,1.73c0.82,1.62,0.56,2.66-1,3.51c-1.83,1.01-3.73,1.9-5.62,2.8 c-2.99,1.41-5.93,2.97-9.01,4.14c-5.24,2-10.58,3.72-15.85,5.62c-0.87,0.31-1.62,0.97-2.45,1.42c-0.45,0.24-0.95,0.44-1.45,0.54 c-1.01,0.19-2.1,0.12-3.03,0.48c-2.12,0.81-4.45,1.12-6.25,2.77c-0.67,0.61-1.79,0.7-2.61,1.19c-3.29,1.93-6.87,3.17-10.35,4.64 c-2.31,0.98-4.5,2.25-6.77,3.33c-3.56,1.7-6.9,3.84-10.73,4.99c-1.41,0.42-2.66,1.36-4.04,1.95c-4.06,1.73-8.14,3.4-12.21,5.1 c-0.13,0-0.27,0-0.4,0c-0.25-0.64-0.37-1.38-0.76-1.91c-2.08-2.76-4.04-5.61-5.37-8.82c-1.13-2.71-3.23-5.08-3.05-8.28 c0.01-0.17-0.19-0.35-0.25-0.53c-1.27-4.03-2.13-8.06-0.24-12.15c0.12-0.26,0.17-0.61,0.09-0.87c-0.16-0.51,0-0.79,0.4-1.07 c0.32-0.23,0.61-0.52,0.88-0.81c1.26-1.36,2.81-1.97,4.66-2.18c1.42-0.16,2.9-0.59,4.13-1.3c2.01-1.15,3.91-2.49,6.2-3.11 c1.11-0.3,2.18-0.75,3.24-1.2c0.85-0.36,1.63-0.92,2.5-1.2c1.61-0.52,2.86-1.5,3.99-2.7c0.38-0.4,0.8-0.79,1.27-1.09 c4.94-3.19,10.5-4.96,16-6.85c1.05-0.36,2.28-0.34,3.42-0.29c1.22,0.05,2.43,0.35,3.65,0.52c0.32,0.04,0.78,0.15,0.97-0.01 c0.83-0.7,1.59-1.48,2.35-2.26c0.37-0.38,0.61-0.92,1.02-1.21c2-1.43,3.79-3.27,6.41-3.59c0.1-0.01,0.19-0.06,0.28-0.11 c2.62-1.24,5.17-2.71,7.89-3.66c3.09-1.08,6.34-1.68,9.52-2.5c0.38-0.1,0.77-0.21,1.11-0.4c1.05-0.58,2.09-1.2,3.13-1.8 C259.45,305.87,260.04,305.53,260.62,305.2z");
        ray[19] = draw.path("M173.64,410.78c-0.73,0-1.47,0-2.2,0c-1.09-0.61-2.18-1.11-3.45-0.49c-0.22,0.11-0.53,0.08-0.79,0.07 c-2.42-0.13-4.86-0.18-7.26-0.44c-1.84-0.2-3.68-0.51-5.35-1.44c-0.6-0.34-1.03-0.67-0.98-1.42c0.07-1.02,0.09-2.05,0.18-3.08 c0.09-0.92,0.18-1.76-0.44-2.63c-0.64-0.89-1.02-1.97-1.51-2.96c0-0.2,0-0.4,0-0.6c0.28-1.35,0.74-2.69,0.8-4.04 c0.13-2.79-0.05-5.6,0.06-8.39c0.12-2.98,0.42-5.96,0.64-8.9c0.87,0.07,1.54,0.21,2.18,0.14c1.39-0.14,2.77-0.36,4.14-0.59 c0.34-0.06,0.65-0.27,0.97-0.42c0.07,0,0.13,0,0.2,0c0.5,0.08,1.01,0.25,1.51,0.23c2.27-0.1,4.46-0.03,6.11,1.88 c0.03,0.04,0.12,0.04,0.27,0.07c0.44-0.46,0.91-0.95,1.28-1.35c1.04,0.48,1.93,1.03,2.9,1.33c3.49,1.07,7.12,1.23,10.74,1.47 c1.72,0.11,3.22,0.74,4.51,1.78c0.53,0.43,1,1.24,1.04,1.91c0.17,2.48,0.19,4.97,0.21,7.45c0.03,5.19,0.01,10.37,0.01,15.44 c-1.13,0.77-2.2,1.5-3.27,2.22c-0.21,0.14-0.51,0.38-0.69,0.32c-1.12-0.34-2.12-0.3-2.93,0.68c-0.07,0.09-0.25,0.09-0.36,0.15 c-1.23,0.69-2.6,0.63-3.94,0.8C176.67,410.15,175.16,410.5,173.64,410.78z");
        ray[20] = draw.path("M157.03,426.38c0-0.27,0-0.53,0-0.8c0.21-1.84,1.53-2.46,3.08-2.87c4.01-1.07,7.99-2.22,12.01-3.23 c1.04-0.26,1.49-0.86,1.83-1.67c1.43-0.13,2.82-0.24,4.2-0.4c2.23-0.25,4.47-0.51,6.7-0.79c0.67-0.09,4.57-0.03,5.24,0.14 c0.13,0.03,0.26,0.06,0.39,0.07c0.73,0.07,1.07,0.49,1.25,1.18c1.21,4.72,2.45,9.43,3.68,14.15c1.29,4.94,2.58,9.87,3.86,14.81 c0.66,2.57,1.31,5.15,1.94,7.73c0.66,2.71,1.31,5.42,1.94,8.14c0.47,2.04,0.96,4.07,1.36,6.12c0.59,3.03,1,6.1,1.7,9.11 c1.11,4.81,2.36,9.58,3.62,14.36c0.23,0.88,0.61,1.81,1.19,2.48c0.55,0.64,0.95,1.32,0.78,2.04c-0.34,1.46,0.13,2.74,0.59,4.05 c0.08,0.24,0.06,0.51,0.09,0.77c0.23,2.7,0.14,5.49,2.24,7.64c0.13,0.13,0.19,0.33,0.31,0.54c-0.28,0.2-0.51,0.41-0.77,0.53 c-1.97,0.88-3.97,1.69-5.91,2.63c-2.15,1.05-4.34,1.83-6.79,1.63c-0.38-0.03-0.78,0.12-1.16,0.22c-1.85,0.51-3.67,1.13-5.54,1.53 c-4.12,0.88-8.26,1.71-12.41,2.45c-3.61,0.64-3.68,0.56-5.43-2.85c-2.01-3.92-2.85-8.2-3.96-12.4c-0.22-0.83-0.35-1.69-0.63-2.5 c-0.55-1.59-1.27-3.13-1.76-4.74c-0.75-2.44-1.36-4.92-2.06-7.37c-0.72-2.52-1.41-5.06-2.26-7.54c-0.54-1.58-0.7-3,0.56-4.3 c0.14-0.14,0.21-0.34,0.31-0.51c0.8-1.48,0.59-2.93-0.61-4.09c-0.48-0.46-0.96-0.93-1.5-1.32c-1.48-1.06-2.03-2.59-2.24-4.29 c-0.13-1.02-0.11-2.06-0.2-3.09c-0.08-0.99-0.05-2.03-0.35-2.96c-0.64-2-0.5-3.99,0.03-5.9c0.42-1.5-0.1-2.45-1.03-3.47 c-0.43-0.47-0.79-1.15-0.88-1.78c-0.57-3.84-1.07-7.69-1.55-11.54c-0.37-3-0.64-6.01-1.04-9 C157.72,428.3,157.31,427.35,157.03,426.38z");
        ray[21] = draw.path("M221.95,555.26c-0.07,0-0.13,0-0.2,0c-0.69-0.33-1.56-1.1-2.05-0.91c-1.73,0.66-2.92-0.11-4.22-0.97 c-4.53-2.97-9.05-5.96-13.65-8.82c-1.91-1.19-3.51-2.58-4.75-4.46c-1.06-1.6-2.29-3.09-3.4-4.66c-0.24-0.34-0.39-0.84-0.37-1.25 c0.09-2.08,1.12-3.77,2.53-5.17c2.13-2.1,4.35-4.12,6.61-6.08c2.08-1.81,4.32-3.43,6.37-5.27c1.54-1.38,2.89-2.97,4.32-4.47 c0.13-0.14,0.34-0.39,0.3-0.48c-0.57-1.05,0.43-1.54,0.82-2.21c0.13-0.22,0.61-0.35,0.91-0.32c0.99,0.07,1.97,0.28,2.96,0.35 c1.65,0.13,3.33,0.12,4.71,1.24c2.68,2.18,5.37,4.34,8,6.57c0.67,0.57,1.24,1.3,1.69,2.06c0.52,0.88,0.87,1.84,2.41,1.19 c-0.31,0.45-0.46,0.66-0.64,0.94c0.69,0.67,1.33,1.31,2.11,2.07c0,0-0.12,0.37,0.02,0.56c0.72,0.99,0.19,1.82-0.25,2.66 c-0.98,1.84-2.07,3.62-2.96,5.5c-0.68,1.43-1.04,3.01-1.7,4.46c-2.18,4.82-4.4,9.62-7.43,13.99 C223.3,552.9,222.65,554.1,221.95,555.26z");
        ray[22] = draw.path("M297.25,503.05c-0.07,0-0.13,0-0.2,0c-0.2-0.1-0.38-0.26-0.59-0.3c-2.02-0.37-3.83-1.21-5.61-2.25 c-1.36-0.8-2.86-1.53-4.39-1.82c-1.6-0.3-2.93-0.88-4.17-1.85c-0.5-0.39-1.09-0.64-1.61-1.01c-0.98-0.69-1.99-1.34-2.88-2.12 c-1.72-1.51-3.45-2.86-5.85-3.18c-1.07-0.14-2.08-0.76-3.13-1.11c-1.66-0.55-3.33-1.05-5-1.6c-0.61-0.2-1.3-0.34-1.79-0.73 c-2.65-2.11-5.24-4.31-7.88-6.43c-0.85-0.68-1.76-1.35-2.75-1.78c-2.67-1.14-3.9-3.41-3.17-6.22c0.16-0.61,0.39-1.2,0.65-1.77 c0.42-0.94,1.01-1.82,1.33-2.79c1.43-4.33,3.65-8.25,5.88-12.19c0.66-1.16,1.02-2.51,1.35-3.81c0.18-0.7,0.35-1.24,1.09-1.49 c0.3-0.1,0.76-0.32,0.79-0.54c0.22-1.42,1.45-1.89,2.35-2.67c0.2-0.17,0.26-0.49,0.39-0.74c0.07,0,0.13,0,0.2,0 c0.28,0.15,0.55,0.33,0.84,0.44c1.98,0.77,4.06,1.36,5.93,2.33c3.92,2.04,7.73,4.27,11.58,6.44c1.39,0.79,2.68,1.75,4.11,2.45 c2.8,1.38,5.76,2.45,8.48,3.96c3.95,2.19,7.77,4.63,11.6,7.02c2.31,1.44,4.53,3.01,6.82,4.49c0.85,0.55,1.77,0.98,2.66,1.46 c-0.01,0.1-0.02,0.21-0.03,0.31c-0.5,0.11-0.99,0.27-1.49,0.3c-1.15,0.07-1.64,0.56-1.66,1.73c-0.02,1-0.07,2-0.16,2.99 c-0.02,0.25-0.19,0.6-0.39,0.69c-2.37,1.02-3.48,3.04-4.41,5.28c-0.94,2.26-2.06,4.45-3.11,6.67c-0.93,1.98-3.06,3.25-3.35,5.62 c-0.01,0.08-0.15,0.13-0.2,0.21C298.73,500.4,297.99,501.73,297.25,503.05z");
        ray[23] = draw.path("M361.06,417.99c0,0.2,0,0.4,0,0.6c-0.6,1.62-1.73,2.76-3.15,3.73c-5.03,3.45-9.69,7.36-14.09,11.6 c-0.25,0.24-0.53,0.45-0.65,0.55c-1.08-1-2.03-1.94-3.05-2.79c-1.72-1.44-3.44-2.88-5.24-4.22c-2.06-1.55-4.35-2.83-6.28-4.52 c-3.02-2.66-5.78-5.61-8.71-8.38c-1.92-1.82-3.76-3.71-5.09-5.99c-1.6-2.75-3.9-4.58-6.7-6.01c-2.14-1.1-4.24-2.19-6.63-2.6 c-0.19-0.03-0.36-0.14-0.53-0.2c0.1-0.94,0.15-1.83,0.29-2.71c0.56-3.53,1.35-6.99,3.21-10.1c0.48-0.8,0.94-1.62,1.28-2.48 c0.75-1.87,1.88-3.41,3.48-4.65c0.64-0.5,1.2-1.17,1.64-1.86c1.58-2.52,3.57-4.6,6.22-6c0.46-0.24,0.92-0.5,1.38-0.75 c0.27,0,0.53,0,0.8,0c0.63,0.36,1.27,0.7,1.89,1.08c0.39,0.24,0.8,0.49,1.12,0.81c2.32,2.37,4.6,4.79,6.93,7.15 c4.6,4.67,9.22,9.32,13.85,13.97c1.24,1.25,2.75,2.29,3.74,3.71c1.19,1.71,2.35,2.95,4.64,2.76c0.56-0.05,1.19,0.8,1.94,1.35 c-0.55,0.24-0.81,0.35-1.21,0.52c1.04,2.11,1.81,4.33,3.11,6.16C357.4,411.7,359.27,414.81,361.06,417.99z");
        ray[24] = draw.path("M281.15,417.89c0-0.27,0-0.53,0-0.8c0.28-0.46,0.54-0.93,0.85-1.37c1.6-2.25,3.57-4.02,6.27-4.86 c0.47-0.15,0.9-0.43,1.33-0.67c1.56-0.88,3.07-1.84,4.67-2.63c2.86-1.42,5.76-2.75,8.65-4.1c1.38-0.64,2.78-1.23,4.13-1.82 c0.24,0.48,0.37,0.81,0.55,1.11c4.14,6.95,8.29,13.89,13.05,20.44c0.29,0.4,0.58,0.83,0.73,1.29c2.83,8.29,5.96,16.47,8.17,24.96 c0.19,0.74,0.03,1.06-0.58,1.42c-1.73,1-3.41,2.08-5.13,3.08c-3.36,1.94-6.73,3.87-10.13,5.76c-1.39,0.77-2.85,1.42-4.28,2.13 c-0.21,0.1-0.41,0.28-0.62,0.3c-1.47,0.09-2.93,0.15-4.27,0.21c-0.46,0.57-0.93,1.17-1.4,1.76c-0.27,0-0.53,0-0.8,0 c-0.26-0.5-0.54-0.99-0.78-1.51c-0.12-0.27-0.1-0.6-0.24-0.86c-1.07-2.02-2.2-4.01-3.25-6.05c-1.42-2.77-2.82-5.55-4.15-8.36 c-1.72-3.63-3.31-7.32-5.07-10.93c-0.66-1.36-0.93-2.74-1.12-4.2c-0.09-0.71-0.36-1.5-0.81-2.05c-1.83-2.24-3.31-4.65-4.19-7.43 C282.24,421.09,281.69,419.49,281.15,417.89z");
        ray[25] = draw.path("M254.1,446.66c-0.6,0-1.2,0-1.8,0c-0.32-0.07-0.65-0.13-0.97-0.21c-1.92-0.5-3.89-0.87-5.76-1.54 c-4.28-1.53-8.14-3.9-11.99-6.27c-0.14-0.08-0.3-0.17-0.38-0.3c-0.84-1.29-1.67-2.59-2.5-3.89c0-0.13,0-0.27,0-0.4 c0.53-2.65,1.07-5.31,1.59-7.96c0.7-3.59,1.77-6.98,5.1-9.08c0.65-0.41,0.96-0.98,0.85-1.66c-0.28-1.76-0.53-3.54-1.05-5.23 c-0.46-1.53-0.41-3-0.16-4.5c0.58-3.61,2.05-6.79,4.67-9.39c0.21-0.21,0.46-0.56,0.43-0.81c-0.16-1.56-0.42-3.12-0.6-4.68 c-0.03-0.26,0.08-0.62,0.26-0.81c0.82-0.91,1.2-2.01,1.66-3.13c0.92-2.28,1.99-4.49,3.05-6.71c3.14-6.56,6.28-13.13,9.46-19.67 c1.11-2.27,2.39-4.46,4.54-5.96c0.07,0,0.13,0,0.2,0c0.34,0.07,0.67,0.16,1.02,0.2c1.18,0.15,2.41,0.13,3.54,0.46 c1.92,0.57,3.84,1.25,5.66,2.09c5.14,2.39,10.23,4.92,15.35,7.34c1.33,0.63,2.31,1.52,2.83,2.9c0,0.47,0,0.93,0,1.4 c-0.64,1.7-1.22,3.42-1.92,5.1c-1.27,3.03-2.66,6.02-3.91,9.07c-1.11,2.71-2.04,5.48-3.15,8.19c-2.65,6.46-5.37,12.89-8.02,19.34 c-1.07,2.61-1.97,5.29-3.04,7.91c-1.06,2.58-2.27,5.1-3.35,7.68c-1.54,3.67-2.8,7.46-4.77,10.94c-0.49,0.87-0.87,1.79-1.31,2.69 c-0.58,1.2-1.2,2.38-1.73,3.6C257.16,445.1,255.64,445.88,254.1,446.66z");
        ray[26] = draw.path("M340.43,434.01c0.33,0,0.67,0,1,0c0.32,0.08,0.63,0.16,0.95,0.24c1.46,0.39,2.95,0.55,3.77,2.23 c0.52,1.06,1.45,2.02,2.4,2.75c3.73,2.86,7.39,5.77,10.29,9.5c1.18,1.52,2.95,2.62,3.39,4.68c0,0.2,0,0.4,0,0.6 c-0.38,0.36-0.83,0.67-1.14,1.08c-3.4,4.4-6.69,8.88-10.18,13.19c-4.67,5.77-9.38,11.53-14.33,17.06c-2.3,2.57-4.69,5.05-6.73,7.83 c-0.25,0.34-0.52,0.66-0.77,0.99c0.05-0.1,0.1-0.21,0.15-0.31c-1.9-1.77-4.04-3.34-5.66-5.34c-3.77-4.62-7.28-9.44-10.93-14.15 c-0.45-0.58-0.62-1.14-0.54-1.82c0.19-1.75,0.36-3.51,0.59-5.25c0.04-0.33,0.29-0.73,0.57-0.91c1.71-1.15,3.51-2.18,5.19-3.38 c1.45-1.04,2.88-2.15,4.15-3.39c2.62-2.57,5.12-5.24,7.67-7.88c0.23-0.24,0.48-0.48,0.63-0.76c2.07-3.95,4.16-7.88,6.16-11.86 C337.98,437.26,338.77,435.35,340.43,434.01z");
        ray[27] = draw.path("M395.59,514.89c0,0.07,0,0.13,0,0.2c-0.11,0.16-0.24,0.32-0.33,0.49c-1.34,2.52-2.64,5.07-4.04,7.55 c-0.7,1.24-1.73,2.29-2.37,3.56c-1.26,2.49-2.34,5.07-3.53,7.59c-0.41,0.87-0.89,1.71-1.34,2.56c-0.23,0.44-0.52,0.53-0.97,0.24 c-0.58-0.36-1.2-0.66-1.79-0.98c-1.3,2.07-2.52,4.08-3.82,6.04c-0.81,1.22-1.64,2.44-2.62,3.52c-2.03,2.24-4.21,4.35-6.23,6.61 c-0.91,1.02-2.22,1.11-3.23,1.83c-1.41,1.01-3.04,1.22-4.72,1.14c-0.25-0.01-0.55-0.05-0.75-0.19c-1.58-1.1-3.3-2.05-4.66-3.38 c-2.79-2.72-5.41-5.6-8.01-8.5c-0.89-0.99-1.72-1.56-3.05-1.05c-0.76,0.29-0.96-0.23-1.1-0.85c-0.08-0.37-0.2-0.81-0.45-1.05 c-2.66-2.56-4.57-5.55-5.39-9.17c-0.1-0.44,0.02-1.08,0.28-1.44c3.28-4.41,6.62-8.77,9.9-13.18c0.55-0.74,0.78-1.72,1.35-2.43 c0.59-0.74,1.49-1.22,2.12-1.93c1.61-1.83,3.16-3.69,4.69-5.59c2.32-2.88,4.77-5.67,6.84-8.72c1.75-2.59,4.09-4.5,6.16-6.63 c0.8,0.4,1.49,0.66,2.09,1.05c1.61,1.05,3.16,2.18,4.77,3.23c2,1.32,4.05,2.56,6.04,3.9c0.62,0.42,1.25,0.96,1.62,1.59 c0.29,0.5,0.56,0.66,1.07,0.64c0.94-0.04,1.62,0.29,2.02,1.24c0.26,0.63,0.71,1.21,1.17,1.73c2.11,2.35,4.25,4.68,6.41,7.01 c0.84,0.91,1.98,1.63,1.75,3.13C395.42,514.72,395.54,514.81,395.59,514.89z");
        ray[28] = draw.path("M243.77,525.16c0.87,0,1.73,0,2.6,0c0.9,0.22,1.78,0.5,2.69,0.64c2.52,0.38,5.05,0.7,7.58,1.05 c3.8,0.52,7.55,1.48,11.4,1.64c0.93,0.04,1.86,0.13,2.79,0.22c2.91,0.29,5.82,0.61,8.73,0.88c2.91,0.27,5.84,0.39,8.74,0.75 c4.68,0.58,9.35,1.28,14.02,1.95c2,0.29,3.99,0.69,5.99,0.91c1.55,0.17,3.14-0.03,4.67,0.23c3.99,0.66,7.95,1.5,11.93,2.24 c2.7,0.5,5.17,2.02,8.12,1.59c1.29-0.19,2.68,0.27,4.13,0.45c-0.05,0.68-0.1,1.3-0.13,1.92c-0.12,3.03-1.07,6.03-0.35,9.09 c0.06,0.25,0.03,0.54-0.03,0.79c-0.63,2.75-1.31,5.48-1.9,8.24c-0.63,2.95-1.2,5.92-1.75,8.89c-0.04,0.23,0.29,0.53,0.6,1.05 c-1.58,1.2-3.29,2.51-5.01,3.79c-1.17,0.87-2.48,1.13-3.94,1.06c-4.22-0.2-8.44-0.29-12.67-0.45c-0.59-0.02-1.2-0.11-1.76-0.3 c-0.37-0.12-0.82-0.4-0.96-0.72c-0.46-1.01-1.22-1.07-2.13-0.89c-0.32,0.06-0.68,0.15-0.98,0.08c-2.09-0.5-4.21-0.27-6.31-0.38 c-1.4-0.07-2.89-0.24-4.16-0.79c-1.2-0.52-2.34-0.79-3.63-0.81c-3.06-0.04-6.13-0.09-9.05-1.2c-0.16-0.06-0.42,0.02-0.59,0.11 c-1.96,1.07-2.47,1.02-4.1-0.42c-0.35-0.31-0.69-0.62-1.06-0.92c-0.17-0.14-0.38-0.3-0.59-0.33c-1.44-0.23-2.87-0.44-4.32-0.62 c-1.32-0.16-2.65-0.25-3.97-0.41c-2.27-0.28-4.05-1.42-5.44-3.2c-0.71-0.92-1.38-0.89-2.06-0.18c-0.21,0.22-0.41,0.46-0.66,0.6 c-0.43,0.24-0.91,0.59-1.36,0.57c-1.96-0.09-3.91-0.26-5.86-0.48c-2.94-0.33-5.87-0.7-8.8-1.12c-3.92-0.56-7.48-1.83-9.81-5.34 c0-1.13,0-2.27,0-3.4c0.06-0.19,0.14-0.37,0.17-0.57c0.42-2.68,0.89-5.36,1.22-8.05c0.33-2.69,0.53-5.4,0.79-8.1 c0.02-0.16,0.03-0.34,0.12-0.46c1.28-1.85,1.51-4,1.72-6.15c0.18-1.85,1.58-3.2,3.42-3.25 C242.47,525.37,243.12,525.24,243.77,525.16");
        ray[29] = draw.path("M403.33,396.27c0.07,0,0.13,0,0.2,0c0.13,0.13,0.25,0.32,0.41,0.37c1.65,0.49,3.29,0.98,4.96,1.41 c3.55,0.91,6.55,2.7,8.93,5.51c0.18,0.21,0.28,0.55,0.27,0.83c-0.05,2.39-0.17,4.78-0.18,7.16c-0.01,0.85,0.37,1.71,0.32,2.55 c-0.17,2.84-0.59,5.63-2.21,8.08c-1.02,1.55-1.02,3.15-0.14,4.78c0.27,0.5,0.56,1.01,0.66,1.55c0.18,0.92,0.34,1.87,0.28,2.8 c-0.18,2.62-0.55,5.22-0.7,7.84c-0.05,0.99,0.22,2.03,0.5,3.01c0.31,1.11,0.48,2.13,0.03,3.27c-0.41,1.03-0.55,2.18-0.77,3.28 c-0.42,2.15-0.44,4.47-1.31,6.42c-1.34,2.99-1.61,6.08-1.88,9.22c-0.19,2.25-0.12,4.54-0.46,6.76c-0.66,4.43-1.51,8.84-2.32,13.25 c-0.29,1.6-0.35,3.16,0.17,4.72c0.05,0.15,0.06,0.36,0,0.51c-0.17,0.46-0.44,0.89-0.57,1.36c-0.49,1.79-0.91,3.6-1.42,5.39 c-0.08,0.27-0.42,0.6-0.68,0.65c-0.54,0.1-1.11,0.06-1.66,0.01c-1.91-0.18-3.83-0.37-5.73-0.61c-1.76-0.22-3.62-0.2-5.24-0.82 c-2.19-0.83-4.42-1.35-6.68-1.9c-3.35-0.82-6.62-1.96-9.94-2.92c-1.11-0.32-2.26-0.5-3.38-0.75c-0.21-0.05-0.55-0.06-0.61-0.19 c-0.44-1.01-1.37-1.81-1.23-3.08c0.29-2.77,0.34-5.58,0.82-8.32c0.79-4.52,1.83-8.99,2.78-13.48c0.95-4.51,1.59-9.04,1.07-13.67 c-0.13-1.18-0.12-2.41,0.02-3.59c0.39-3.06,0.93-6.11,1.34-9.17c0.57-4.28,1.14-8.55,1.57-12.85c0.31-3.1,0.41-6.23,0.58-9.35 c0.05-0.96-0.06-1.94,0.05-2.89c0.08-0.62,0.37-1.24,0.69-1.79c0.32-0.57,0.6-1.04,0.55-1.79c-0.17-2.46-0.14-4.92,1.21-7.16 c0.36-0.6,0.48-1.35,0.81-2.31c1.57-0.68,3.39-1.77,5.36-2.26c3.7-0.92,7.49-1.49,11.34-1.43 C401.86,396.69,402.6,396.41,403.33,396.27z");
        ray[30] = draw.path("M289.1,348.59c0-1.67,0-3.33,0-5c0.26-1.35,0.52-2.7,0.8-4.13c1.33-0.14,2.75-0.29,4.16-0.43 c3.67-0.37,7.35-0.73,11.02-1.09c4-0.39,8-0.88,12.02-1.11c4.65-0.28,9.32-0.26,13.98-0.5c2.94-0.16,5.85-0.02,8.75,0.43 c0.65,0.1,1.34,0.24,1.97,0.13c1.57-0.27,3.09-0.12,4.42,0.69c1.57,0.95,3.08,1.93,4.9,2.33c0.97,0.21,1.91,0.56,2.85,0.87 c0.2,0.06,0.39,0.19,0.57,0.31c0.55,0.36,1.04,0.89,1.64,1.08c2.12,0.69,3.98,1.79,5.67,3.23c0.49,0.42,1.17,0.59,1.27,1.38 c0.1,0.77,0.65,1.05,1.35,1.24c4.35,1.19,8.69,2.44,13.04,3.63c3.07,0.84,5.97,1.94,8.47,4.01c1.46,1.21,3.08,2.21,4.64,3.3 c0.77,0.53,1.5,1.16,2.35,1.5c1.01,0.4,1.87,0.84,2.43,1.84c0.22,0.4,0.7,0.73,1.14,0.94c1.63,0.81,2.83,2.07,3.91,3.49 c0.33,0.43,0.39,0.75,0.17,1.24c-0.46,1.05-0.28,2.01,0.56,2.83c0.57,0.56,1.19,1.08,1.69,1.7c0.6,0.76,1.24,1.56,1.61,2.45 c0.57,1.37,0.2,2.8-0.55,3.98c-0.72,1.14-1.74,2.09-2.64,3.11c-0.28,0.32-0.59,0.79-0.94,0.85c-0.86,0.14-1.18,0.76-1.57,1.37 c-0.22,0.34-0.45,0.67-0.72,0.96c-4.41,4.73-8.68,9.62-14.44,12.83c-0.06,0.03-0.09,0.09-0.14,0.14c-0.07,0-0.13,0-0.2,0 c-0.25-0.19-0.49-0.4-0.76-0.56c-2.21-1.28-4.42-2.55-6.65-3.8c-1.47-0.83-2.98-1.59-4.45-2.42c-0.95-0.54-1.81-1.26-2.79-1.75 c-2.24-1.11-4.56-2.07-6.8-3.19c-3.21-1.61-6.4-3.25-9.55-4.97c-2.1-1.15-4.14-2.41-6.15-3.7c-1.29-0.82-2.14-2.35-4.01-2.2 c-0.46,0.04-1.02-0.45-1.45-0.79c-0.71-0.55-1.35-1.19-2.02-1.79c-0.17-0.15-0.35-0.32-0.55-0.4c-0.9-0.37-1.84-0.65-2.7-1.08 c-1.23-0.62-2.45-0.79-3.84-0.7c-2.2,0.15-4.41,0.41-6.61-0.29c-0.98-0.31-2.13-0.4-3.13-0.21c-3.93,0.76-7.88,0.71-11.84,0.52 c-3.95-0.2-7.9-0.46-11.85-0.7c-1.38-0.09-2.78-0.09-4.13-0.36c-0.84-0.17-1.62-0.52-2.48-0.18c-0.6,0.24-0.91-0.02-1.14-0.56 c-0.49-1.16-0.94-2.29-0.83-3.61c0.19-2.35,0.37-4.71,0.36-7.07c-0.01-2.62-0.2-5.25-0.36-7.87 C289.48,349.85,289.24,349.22,289.1,348.59z");
        var i = 0;
        var rays = draw.group();
        while (i < 30) {
            i++;
            ray[i].fill("#EF7000");
            rays.add(ray[i]);
        }
        var sky = draw.path("M177.16,173.36c0-0.13,0-0.27,0-0.4c0.22-0.39,0.41-0.81,0.68-1.17c0.18-0.24,0.45-0.55,0.7-0.58 c1.69-0.17,3.38-0.42,5.07-0.38c4.92,0.13,9.84,0.43,14.77,0.58c3.89,0.12,7.79,0.1,11.68,0.17c6.89,0.13,13.79,0.29,20.68,0.41 c1.19,0.02,2.38-0.22,3.56-0.17c1.79,0.08,3.57,0.43,5.36,0.47c4.62,0.09,9.25,0.08,13.88,0.11c0.37,0,0.73,0.04,1.1,0.05 c3.55,0.17,7.07,0.83,10.65,0.45c0.86-0.09,1.74-0.13,2.59-0.05c2.78,0.27,5.53,0.54,8.35,0.43c2.81-0.12,5.64,0.37,8.46,0.51 c4.65,0.23,9.31,0.38,13.96,0.6c7.01,0.33,14.03,0.73,21.04,1c4.66,0.18,9.33,0.16,13.99,0.22c1.59,0.02,3.18,0,4.91,0 c0.03,0.35,0.09,0.83,0.11,1.31c0.09,2.13,0.16,4.26,0.26,6.39c0.02,0.42,0.15,0.83,0.27,1.24c0.08,0.3,0.33,0.58,0.32,0.86 c-0.13,3.93-0.32,7.85-0.43,11.77c-0.07,2.53,0.03,5.07-0.08,7.6c-0.19,4.35-0.52,8.7-0.72,13.05c-0.2,4.42-0.3,8.85-0.46,13.28 c-0.03,0.77-0.1,1.53-0.16,2.29c-0.05,0.66-0.17,1.26-1.07,1.18c0.23,0.71,0.54,1.33,0.61,1.97c0.26,2.31,0.56,4.63,0.61,6.94 c0.1,4.63,0.1,9.26,0.03,13.9c-0.08,5.62-0.27,11.25-0.42,16.87c-0.01,0.27-0.05,0.53-0.07,0.8c-0.23,4.09-0.52,8.17-0.68,12.26 c-0.1,2.62,0.2,5.23,0.47,7.85c0.35,3.39,0.09,6.85,0.07,10.27c-0.02,2.65-0.12,5.31-0.14,7.96c-0.03,4.43,0.45,8.84-0.43,13.3 c-0.62,3.16-0.37,6.51-0.46,9.75c-0.16,6.17-0.42,12.35,0.24,18.55c0.38,3.52,0.42,7.15-0.26,10.78c-0.46,2.41,0.01,4.98,0.24,7.49 c0.35,3.93,0.12,7.92,0.14,11.89c0,0.75-0.31,1.62,0.66,2.08c0.1,0.05,0.12,0.3,0.13,0.46c0.16,2.48,0.07,4.94-0.8,7.29 c-0.27,0.73-0.18,1.25,0.24,1.83c0.22,0.3,0.46,0.69,0.46,1.04c-0.01,1.31-0.11,2.63-0.18,3.94c-0.35,6.56-0.27,13.11,0.24,19.66 c0.07,0.86,0.36,1.8,0.12,2.56c-0.55,1.74-0.1,3.43-0.12,5.14c-0.01,1.23,0.05,2.46-0.01,3.69c-0.1,2.27-0.31,4.55-0.4,6.82 c-0.08,1.86-0.09,3.73-0.09,5.59c0.01,3.56,0.11,7.13,0.06,10.69c-0.03,2.79-0.27,5.58-0.33,8.37c-0.04,1.86,0.08,3.73,0.08,5.59 c0,1.43-0.13,2.85-0.1,4.28c0.07,3.95,0.2,7.91,0.3,11.75c-0.87,0.51-1.5,1.07-2.23,1.25c-1.6,0.4-3.18,1.45-4.93,0.45 c-0.16-0.09-0.39-0.07-0.59-0.07c-4.7,0.02-9.4,0.05-14.09,0.07c-0.33,0-0.81-0.1-0.97,0.08c-0.82,0.92-1.83,0.54-2.79,0.54 c-0.23,0-0.49-0.03-0.68,0.06c-2.05,1.04-4.26,1.17-6.5,1.11c-1.66-0.04-3.32-0.14-4.98-0.21c-3.06-0.13-6.12-0.33-9.18-0.35 c-2.03-0.01-4.05,0.32-6.08,0.35c-4.23,0.06-8.45,0.01-12.68,0.03c-0.66,0-1.33,0.11-1.99,0.11c-2.22,0-4.44-0.02-6.66-0.05 c-3.06-0.03-6.11-0.08-9.17-0.09c-2.49-0.01-4.99,0.05-7.48,0.05c-2.09,0-4.18-0.06-6.27-0.03c-2.62,0.04-5.23,0.16-7.85,0.22 c-2.93,0.07-5.86,0.11-8.79,0.18c-2.15,0.05-4.31,0.13-6.46,0.2c-0.47,0.01-0.93,0.03-1.4,0.05c-3.31,0.15-6.56,0.83-9.91,0.63 c-2.97-0.17-5.98,0.19-8.97,0.36c-1.01,0.06-2.02,0.26-3.03,0.4c-2.6,0-5.2,0-7.8,0c-0.39-0.7-1.01-1.36-1.1-2.1 c-0.13-0.96,0.23-1.97,0.26-2.97c0.06-2.25,0.09-4.51,0.05-6.76c-0.02-0.88-0.38-1.76-0.38-2.65c0-1.79,0.2-3.58,0.21-5.38 c0.03-4.86,0-9.73,0.01-14.59c0.01-5.8,0.09-11.59,0.03-17.39c-0.03-3.36-0.4-6.72-0.38-10.08c0.02-5.22,0.33-10.44,0.32-15.66 c0-6.62-0.21-13.24-0.31-19.86c-0.05-3.75-0.07-7.51-0.09-11.26c-0.02-3.86-0.01-7.72-0.06-11.58c-0.01-0.78-0.24-1.57-0.41-2.35 c-0.15-0.68-0.53-1.33-0.54-2.01c-0.05-2.53,0.05-5.05,0.01-7.58c-0.03-1.96-0.17-3.92-0.29-5.87c-0.26-4.28-0.89-8.55-0.54-12.86 c0.19-2.29,0.47-4.58,0.42-6.87c-0.06-3.19-0.34-6.38-0.61-9.56c-0.53-6.24-0.87-12.49-0.74-18.76c0.04-2,0.06-4,0.19-5.99 c0.14-2.11,0.64-4.2,0.07-6.34c-0.23-0.87,0.42-1.28,1.41-1.27c-0.63-4.36-1.36-8.63-1.84-12.93c-0.47-4.23-0.82-8.48-0.98-12.73 c-0.17-4.33-0.01-8.66-0.08-12.99c-0.03-1.76,0.04-3.49,0.17-5.24c0.31-4.4,0.69-8.8-0.25-13.23c-0.63-2.97-0.76-6.08-0.86-9.13 c-0.18-5.67-0.19-11.36-0.22-17.03c-0.01-2.6,0.12-5.19,0.19-7.79c0.01-0.55,0.09-1.11,0.01-1.65c-0.24-1.57-0.54-3.14-0.82-4.71 c-0.59-3.31,0.19-6.65-0.34-9.99c-0.41-2.58-0.17-5.25-0.28-7.88C177.52,175.31,177.3,174.34,177.16,173.36z");
        var earth = draw.path("M443.73,716.1c0,0.13,0,0.27,0,0.4c-1.41,0.95-3.01,1.17-4.66,1.17c-1.73,0-3.46,0-5.19,0.06 c-2.36,0.08-4.72,0.23-7.08,0.32c-1.86,0.07-3.73,0.13-5.59,0.17c-2.09,0.03-4.2,0.15-6.28,0.01c-1.7-0.12-3.38-0.67-5.08-0.83 c-2.24-0.21-4.56-0.71-6.73,0.15c-1.94,0.76-3.91,0.62-5.88,0.7c-1.59,0.06-3.19,0.1-4.78,0.18c-0.93,0.04-1.86,0.23-2.78,0.18 c-1.78-0.09-3.54-0.41-5.32-0.42c-4.43-0.04-8.86,0.04-13.29,0.08c-2.5,0.02-4.99,0.09-7.49,0.06c-1.35-0.02-2.69-0.27-4.03-0.28 c-0.88,0-1.77,0.33-2.65,0.35c-3.09,0.08-6.19,0.13-9.28,0.09c-1.41-0.02-2.81-0.42-4.22-0.42c-4.68,0.02-9.34,0.64-14.04,0.41 c-4.22-0.21-8.44-0.15-12.66-0.25c-4.23-0.1-8.45-0.27-12.68-0.35c-0.7-0.01-1.05-0.24-1.18-0.88c-0.24-1.23-0.46-2.47-0.69-3.7 c0-1.47,0-2.93,0-4.4c0.1-0.92,0.25-1.84,0.3-2.77c0.21-3.79,0.39-7.57,0.57-11.36c0.04-0.82-0.03-1.65,0.03-2.46 c0.08-1.02,0.31-2.03,0.37-3.05c0.12-1.89,0.17-3.79,0.23-5.68c0.03-0.83,0.06-1.66,0.03-2.49c-0.09-2.12-0.23-4.23-0.33-6.35 c-0.22-4.49-0.4-8.98-0.66-13.46c-0.04-0.73-0.36-1.45-0.54-2.17c0-0.8,0-1.6,0-2.4c0.07-0.39,0.2-0.78,0.21-1.17 c0.09-2.96,0.15-5.92,0.22-8.88c0.03-1.36,0.07-2.72,0.11-4.09c0.01-0.59-0.02-1.19,0.05-1.78c0.17-1.42,0.53-2.82,0.56-4.24 c0.24-11.42,0.4-22.85,0.64-34.28c0.19-9.11,0.46-18.22,0.71-27.33c0.08-2.76,0.28-5.52,0.3-8.28c0.01-1.39-0.37-2.77-0.35-4.16 c0.09-7.39,0.23-14.78,0.4-22.17c0.08-3.32,0.27-6.65,0.39-9.97c0.03-0.79-0.01-1.59-0.05-2.38c-0.06-1.38-0.21-2.76-0.21-4.14 c-0.02-2.92,0.06-5.85,0.05-8.77c-0.01-2.3-0.12-4.59-0.11-6.89c0.02-3.4,0.14-6.79,0.15-10.19c0.01-2.83-0.07-5.66-0.11-8.49 c-0.01-0.75,0.53-1.63-0.5-2.16c-0.08-0.04-0.04-0.31-0.04-0.48c0.03-4.5,0.03-8.99,0.09-13.49c0.09-6.75,0.28-13.5,0.3-20.24 c0.01-3.52-0.26-7.04-0.42-10.56c-0.11-2.49-0.25-4.99-0.37-7.48c-0.08-1.82-0.09-3.65-0.24-5.46c-0.27-3.19-0.63-6.37-0.07-9.57 c0.12-0.67,0.31-0.97,1.07-0.94c2.43,0.12,4.86,0.23,7.29,0.22c5.16-0.02,10.32-0.19,15.49-0.16c4.49,0.02,8.98,0.27,13.48,0.34 c1.31,0.02,2.63-0.26,3.95-0.38c0.79-0.08,1.59-0.17,2.38-0.17c2.43,0,4.86,0.01,7.28,0.07c0.69,0.02,1.37,0.23,1.78,0.31 c1.02-0.06,1.82-0.12,2.62-0.14c4.55-0.11,9.11-0.18,13.66-0.38c1.85-0.08,3.71-0.21,5.59-0.14c5.05,0.18,10.12-0.06,15.18-0.11 c1.06-0.01,2.13,0.11,3.19,0.08c2.33-0.07,4.66-0.17,6.98-0.32c0.71-0.04,1.41-0.27,2.12-0.41c0.13,0,0.27,0,0.4,0 c0.51,0.52,1,1.07,1.54,1.55c0.25,0.22,0.62,0.42,0.93,0.4c0.91-0.04,1.82-0.25,2.74-0.27c3.51-0.07,7.01-0.05,10.5-0.56 c0.77-0.11,1.58,0.13,2.37,0.09c1.84-0.08,3.79,0.72,5.48-0.66c0.11-0.09,0.31-0.11,0.47-0.11c2.07-0.01,4.13-0.07,6.2,0.01 c1.57,0.07,2.32,1,2.35,2.54c0.02,0.86,0.18,1.72,0.2,2.58c0.17,5.82,0.32,11.64,0.44,17.45c0,0.19-0.3,0.44-0.52,0.58 c-0.2,0.13-0.46,0.16-0.5,0.17c0.12,0.58,0.3,1.02,0.3,1.46c-0.01,2.16-0.1,4.32-0.1,6.49c-0.01,5.29,0.01,10.58,0.03,15.88 c0,0.6-0.23,0.95-0.72,1.3c-0.3,0.21-0.56,0.73-0.55,1.11c0.02,1.96,0.14,3.92,0.22,5.88c0.21,5.63,0.42,11.25,0.63,16.88 c0.02,0.66,0.01,1.31,0.76,1.27c0,4.87,0.16,9.67-0.09,14.45c-0.08,1.55-0.35,3.13-0.35,4.7c0.05,11.36,0.11,22.72,0.18,34.08 c0.01,1.65,0.28,3.3,0.18,4.94c-0.15,2.51-0.22,4.98,0.54,7.42c0.32,1.04,0.18,2.03-0.37,2.98c-0.11,0.19-0.23,0.4-0.24,0.6 c-0.03,1.52-0.03,3.05-0.05,4.57c-0.09,6.42-0.16,12.83,0.89,19.22c0.44,2.66,0.27,5.43,0.35,8.15c0.07,2.21-0.48,4.5,0.65,6.57 c0.62,1.14,0.3,2.01-0.35,2.93c-0.16,0.23-0.34,0.52-0.34,0.78c0.02,1.93,0.1,3.85,0.12,5.78c0.01,1.26,0.1,2.54-0.1,3.78 c-0.62,3.74-0.54,7.5-0.3,11.25c0.22,3.38,0.65,6.74,0.84,10.11c0.1,1.75-0.18,3.52-0.19,5.27c-0.04,5.14-0.09,10.28,0.19,15.43 c0.35,6.61,0.47,13.24,0.57,19.87c0.05,3.16-0.34,6.33-0.25,9.48c0.1,3.78,0.5,7.55,0.77,11.33c0.12,1.72-0.01,3.51,0.41,5.15 c0.63,2.49,0.76,4.98,0.72,7.51c-0.02,1.3-0.09,2.61,0.05,3.9C443.09,713.53,443.46,714.81,443.73,716.1z");
        var grape = draw.path("M264.16,553.72c-0.07,0-0.13,0-0.2,0c-0.23-0.3-0.54-0.56-0.69-0.89c-3.11-6.5-6.03-13.09-9.35-19.49 c-3.42-6.59-6.4-13.37-9.33-20.18c-1.85-4.31-3.67-8.63-6.33-12.53c-0.69-1.01-1.28-2.11-1.79-3.22 c-3.48-7.51-6.81-15.08-10.81-22.34c-3.94-7.13-7.68-14.37-11.46-21.58c-2.15-4.09-4.24-8.22-6.29-12.36 c-2.81-5.68-5.55-11.39-8.35-17.08c-1.01-2.06-2.16-4.05-3.17-6.11c-1.2-2.45-2.27-4.96-3.46-7.41c-1.16-2.41-2.97-4.48-3.72-7.11 c-0.05-0.19-0.19-0.35-0.29-0.53c-1.6-2.95-3.21-5.89-4.78-8.86c-1.03-1.94-2.02-3.9-3.01-5.85c-1.04-2.05-2.13-4.07-3.09-6.15 c-2.56-5.55-4.6-11.31-7.74-16.62c-3.23-5.46-6.01-11.19-8.96-16.81c-2.29-4.36-4.54-8.73-6.8-13.1c-1.76-3.39-3.46-6.82-5.3-10.17 c-2.29-4.17-4.72-8.25-7.03-12.41c-0.61-1.09-0.88-2.37-1.46-3.48c-2-3.87-4.06-7.7-6.1-11.55c-0.31-0.59-0.66-1.16-0.98-1.74 c-1.5-2.71-3.23-5.31-4.45-8.14c-2.28-5.32-5.19-10.27-8.17-15.19c-1.03-1.7-2.18-3.32-3.28-4.97c0.66,0.1,1.31,0.28,1.97,0.28 c0.72,0,1.22,0.27,1.76,0.74c0.44,0.38,1.11,0.67,1.7,0.7c2.68,0.13,5.37,0.16,8.06,0.23c5.09,0.13,10.19,0.28,15.28,0.37 c1.56,0.03,3.14-0.21,4.68-0.09c3.17,0.25,6.32,0.64,9.52,0.53c3.36-0.12,6.72,0,10.08-0.05c2.16-0.03,4.31-0.29,6.46-0.26 c2.33,0.04,4.65,0.4,6.98,0.43c5.29,0.06,10.59,0.03,15.88-0.02c3.16-0.03,6.31-0.24,9.47-0.29c1.93-0.03,3.86,0.11,5.79,0.16 c0.33,0.01,0.65-0.06,0.98-0.1c1.37-0.19,2.75-0.58,4.12-0.56c15.32,0.25,30.64,0.57,45.97,0.86c3.6,0.07,7.21-0.01,10.79,0.25 c3.51,0.25,7.09-0.52,10.53,0.76c0.69,0.26,1.52,0.13,2.28,0.17c7.35,0.39,14.7,0.78,22.06,1.14c1.14,0.06,2.28,0.01,3.46,0.01 c-0.1-0.45-0.2-0.86-0.3-1.27c0.94,0,1.84-0.06,2.72,0.02c1,0.09,2,0.52,2.96,0.41c2.43-0.27,4.84-0.24,7.27,0.01 c1.65,0.17,3.32,0.28,4.98,0.27c1.18-0.01,2.36-0.37,3.54-0.4c2.23-0.05,4.46-0.06,6.68,0.09c3.04,0.22,6.08,0.47,9.14,0.33 c2.33-0.11,4.66-0.01,6.99-0.07c2.32-0.06,4.65-0.3,6.97-0.28c3.92,0.04,7.83,0.34,11.75,0.32c4.73-0.02,9.45-0.25,14.18-0.42 c1.92-0.07,3.84-0.19,5.8-0.29c0.22,0.68,0.46,1.4,0.69,2.12c0,0.33,0,0.67,0,1c-0.25,0.41-0.59,0.8-0.74,1.25 c-1.57,4.84-4.48,9.08-6.18,13.88c-1.3,3.68-3.21,7.15-4.86,10.71c-0.29,0.63-0.6,1.25-0.93,1.95c-0.23-0.31-0.41-0.54-0.63-0.84 c-0.26,0.54-0.48,0.99-0.7,1.44c-5.04,10.54-10.08,21.07-15.13,31.6c-0.33,0.7-0.82,1.32-1.16,2.02c-0.27,0.56-0.38,1.2-0.65,1.77 c-1.32,2.8-2.63,5.6-4,8.37c-2.64,5.36-5.34,10.69-7.98,16.05c-1.25,2.53-2.48,5.07-3.61,7.65c-0.71,1.6-1.21,3.29-1.86,4.93 c-0.12,0.29-0.44,0.69-0.7,0.71c-1.03,0.09-1.19,0.75-1.27,1.57c-0.1,0.99-0.29,1.97-0.44,2.95c-0.12,0.83-0.59,1.22-1.44,1.33 c-0.39,0.05-0.94,0.33-1.09,0.65c-1.33,2.93-2.61,5.89-3.87,8.86c-1.85,4.37-3.65,8.77-5.54,13.12c-0.4,0.93-1.12,1.72-1.67,2.58 c-0.2,0.3-0.38,0.62-0.53,0.94c-0.42,0.9-0.79,1.82-1.22,2.72c-0.66,1.38-1.35,2.74-2.02,4.11c-0.47,0.95-0.91,1.92-1.42,2.85 c-0.48,0.89-1.13,1.71-1.53,2.63c-0.7,1.64-1.13,3.41-1.93,5c-1.58,3.14-3.35,6.18-5.02,9.28c-0.47,0.88-0.79,1.84-1.25,2.72 c-1.65,3.15-3.33,6.28-4.99,9.43c-0.17,0.32-0.32,0.65-0.5,1.02c-0.18-0.27-0.32-0.48-0.56-0.83c-0.47,1.33-0.83,2.54-1.32,3.68 c-1.2,2.82-2.47,5.62-3.71,8.42c-5.35,12.13-10.7,24.26-16.02,36.4c-0.34,0.77-0.28,1.71-0.66,2.45c-1.62,3.14-3.13,6.3-3.98,9.75 c-0.19,0.79-0.63,1.54-1.04,2.25c-0.67,1.19-1.5,2.29-2.11,3.5c-3.25,6.45-6.5,12.89-9.65,19.39c-2.05,4.23-4.06,8.45-6.9,12.23 c-0.59,0.79-1.01,1.78-1.27,2.74C266.34,550.25,265.33,552.02,264.16,553.72z");
        var vine_str = "M373.58,621.93c0.37-1.69,0.37-3.37-0.44-5.01c-0.22-0.44-0.15-1.04-0.18-1.56 c-0.26-5.51-0.56-11.02-0.73-16.53c-0.04-1.48,0.34-2.98,0.52-4.47c0.08-0.72,0.16-1.45,0.17-2.17c0.05-3.19-0.01-6.39,0.18-9.57 c0.05-0.9,0.68-1.87,1.28-2.62c0.87-1.09,1.18-2.17,0.79-3.51c-0.48-1.65-0.2-3.32,0.37-4.87c0.99-2.68,2.16-5.28,3.24-7.93 c2.15-5.27,5.38-9.93,8.31-14.77c2.83-4.67,6.78-8.34,10.49-12.25c5.68-5.98,12.35-10.71,18.96-15.54c3.28-2.4,6.54-4.83,10.13-6.73 c2.94-1.55,6.02-2.84,9.03-4.26c1.26-0.59,2.49-1.28,3.78-1.8c1.46-0.6,2.97-1.11,4.48-1.57c2.99-0.91,5.99-1.78,9-2.63 c2.62-0.75,5.3-1.33,7.88-2.21c2.9-0.98,5.29-2.78,6.99-5.37c0.27-0.41,0.39-0.99,0.37-1.49c-0.08-2.66-0.23-5.32-0.35-7.67 c-0.85-0.77-1.53-1.28-2.06-1.91c-0.77-0.92-1.46-1.9-2.12-2.91c-1.25-1.92-2.86-2.78-5.24-2.38c-2.26,0.38-4.43,0.93-6.37,2.15 c-2.75,1.73-5.46,3.53-8.19,5.29c-0.56,0.36-1.11,0.86-1.72,0.98c-1.86,0.36-3.22,1.54-4.69,2.55c-2.41,1.66-4.88,3.24-7.16,5.06 c-4.01,3.19-8.5,5.66-12.65,8.63c-1.03,0.73-2.09,1.42-3.15,2.1c-1.87,1.19-3.43,2.68-4.84,4.39c-0.65,0.78-1.46,1.57-2.73,1.32 c-0.27-0.05-0.63,0.18-0.9,0.36c-1.84,1.3-3.67,2.63-5.51,3.95c-0.43,0.31-0.85,0.71-1.34,0.84c-1.64,0.43-2.81,1.47-3.83,2.73 c-0.54,0.66-1.06,1.11-2.03,0.88c-0.45-0.11-1.04,0.14-1.5,0.37c-0.71,0.35-1.38,0.81-2.04,1.26c-2.3,1.58-4.65,3.03-7.24,4.18 c-2.59,1.16-4.9,2.94-7.36,4.39c-2.92,1.72-5.88,3.37-8.81,5.07c-1.15,0.67-2.24,1.45-3.41,2.08c-3.81,2.04-7.66,4.02-11.47,6.06 c-2.28,1.22-4.49,2.55-6.78,3.75c-0.67,0.35-1.49,0.52-2.25,0.56c-0.43,0.02-1.03-0.28-1.29-0.63c-1.31-1.75-2.72-3.46-3.74-5.38 c-2.06-3.87-3.87-7.87-5.84-11.79c-0.92-1.84-1.83-3.7-2.98-5.39c-1.51-2.24-2.16-4.83-3.26-7.22c-1.41-3.08-3.14-6.01-4.74-9 c-1.89-0.91-1.63-2.84-2.21-4.41c-1.12-3.05-2.53-6-3.81-9c-1.01-2.38-1.95-4.79-3.05-7.13c-0.33-0.7-1.08-1.2-1.76-1.93 c0.06-0.28,0.4-0.9,0.24-1.36c-0.57-1.62-1.31-3.19-1.98-4.78c-1.72-4.03-4.01-7.82-4.87-12.2c-0.18-0.89-0.69-1.73-1.16-2.53 c-1.09-1.85-1.84-3.8-2.34-5.9c-0.49-2.06-1.34-4.03-2.04-6.04c-0.28-0.82-0.64-1.61-0.85-2.45c-0.73-2.96-1.4-5.93-2.11-8.9 c-0.18-0.77-0.42-1.53-0.62-2.3c-0.25-0.96-0.58-1.92-0.73-2.9c-0.48-3.09-0.94-6.17-1.3-9.27c-0.3-2.57-0.64-5.17-0.58-7.75 c0.06-2.63,0.58-5.25,0.9-7.87c0.03-0.26,0.17-0.53,0.14-0.78c-0.36-3.16,1.01-5.95,2.03-8.77c1.35-3.74,2.55-7.61,4.97-10.85 c2.66-3.55,4.92-7.44,8.7-10.08c1.45-1.01,2.58-2.47,3.91-3.67c0.63-0.58,1.36-1.06,2.06-1.55c1.25-0.88,2.54-1.7,3.75-2.61 c3.52-2.64,7.22-4.9,11.32-6.59c3.49-1.43,6.8-3.31,10.2-4.95c4.31-2.08,8.65-4.11,12.97-6.17c1.49-0.71,2.97-1.47,4.45-2.2 c0.18-0.09,0.36-0.23,0.54-0.24c3.46-0.28,6.17-2.33,9.11-3.86c0.87-0.46,1.84-0.73,2.75-1.12c2.02-0.85,4.04-1.7,6.06-2.56 c0.37-0.16,0.71-0.37,1.09-0.5c2.61-0.89,4.42-2.75,6.32-4.66c1.99-2,2.61-4.45,3.12-6.95c0.84-4.16-1.27-8.64-5.26-10.98 c-0.86-0.5-1.71-1.02-2.6-1.47c-1.32-0.66-2.7-1.16-4.22-1.01c-0.33,0.03-0.68,0.08-1,0.02c-4.04-0.76-6.51,1.67-8.57,4.49 c-1.75,2.4-3.08,5.1-4.64,7.65c-0.45,0.74-1.05,1.38-1.52,2.1c-0.97,1.5-2.06,2.96-2.81,4.57c-1.15,2.47-2.93,4.28-5.19,5.64 c-2.45,1.47-4.9,3.01-7.5,4.16c-5.17,2.29-10.59,3.86-16.21,4.67c-2.24,0.33-4.43,0.96-6.67,1.22c-2.84,0.32-5.7,0.48-8.56,0.56 c-5.05,0.14-10.1,0.22-15.16,0.24c-3.52,0.01-7.05-0.13-10.57-0.2c-0.26-0.01-0.53-0.05-0.79-0.02c-4.64,0.41-9.25-0.38-13.88-0.4 c-1.93-0.01-3.87-0.35-5.77-0.19c-4.76,0.38-9.42-0.41-14.25-0.87c-0.17-0.59-0.42-1.14-0.47-1.7c-0.26-2.69-0.34-5.35,0.16-8.07 c0.51-2.8,0.67-5.69,0.63-8.54c-0.03-3.15,0.46-6.23,0.77-9.34c0.3-2.98,0.53-5.96,0.86-8.93c0.33-2.95,0.74-5.9,1.1-8.84 c0.39-3.17,0.75-6.33,1.15-9.5c0.19-1.5,0.06-3.03,0.79-4.48c0.59-1.18-0.11-2.18-1.23-2.89c2.55-2.36,2.39-5.54,2.69-8.38 c0.27-2.62,1.17-5.04,1.6-7.59c0.5-2.92,1.51-5.74,2.19-8.63c1.17-4.99,2.52-9.9,4.68-14.59c1.44-3.13,2.33-6.5,3.5-9.76 c0.65-1.82,1.29-3.64,2.04-5.42c1.41-3.37,3.02-6.66,4.31-10.07c1.83-4.83,4.86-8.99,7.29-13.48c1.33-2.45,2.77-4.83,4.17-7.24 c0.19-0.33,0.4-0.83,0.68-0.89c1.14-0.27,1.46-1.21,2.01-2.04c0.64-0.97,1.61-1.72,2.26-2.68c3.99-5.95,9.25-10.77,14.26-15.78 c3.08-3.08,6.81-5.5,10.23-8.22c0.75-0.6,1.46-1.25,2.02-2.18c0.52-0.03,1.04-0.08,1.56-0.08c4.87,0,9.73,0.03,14.6,0.02 c3.85,0,5.7,1.59,6.4,5.64c-0.26,0.24-0.52,0.63-0.86,0.74c-2.26,0.75-3.82,2.57-5.79,3.75c-3.43,2.06-6.29,4.86-9.18,7.61 c-2.94,2.8-5.96,5.51-8.48,8.74c-2.16,2.78-4.56,5.38-6.72,8.16c-2.76,3.56-5.41,7.21-8.07,10.85c-2.3,3.16-4.78,6.22-6.75,9.57 c-2.04,3.47-4.81,6.56-5.9,10.58c-0.28,1.01-0.86,1.94-1.36,2.88c-3.33,6.34-5.3,13.17-7.34,19.98c-0.78,2.61-1.49,5.25-2.16,7.89 c-1.31,5.08-2.6,10.17-3.84,15.27c-0.49,2-1.14,4.03-1.15,6.05c-0.01,2.61-0.66,4.98-1.59,7.33c-0.07,0.18-0.13,0.39-0.11,0.58 c0.31,2.92-0.89,5.63-1.17,8.47c-0.61,6.14-1.21,12.28-1.75,18.43c-0.28,3.18-0.42,6.37-0.61,9.56c-0.02,0.39,0,0.79,0,1.27 c0.65,0.12,1.22,0.32,1.79,0.33c2.57,0.05,5.15,0,7.72,0.08c0.87,0.03,1.73,0.44,2.59,0.45c4.53,0.04,9.06-0.05,13.59,0.02 c3.32,0.05,6.64,0.44,9.95,0.35c4.83-0.13,9.65-0.54,14.47-0.88c1.71-0.12,3.41-0.37,5.11-0.61c3.23-0.46,6.44-1.11,9.38-2.53 c4.7-2.27,8.8-5.32,11.21-10.17c0.74-1.48,1.47-2.97,2.24-4.44c0.21-0.4,0.55-0.74,0.85-1.09c0.3-0.35,0.73-0.64,0.92-1.04 c1.63-3.33,4.22-5.87,6.65-8.6c2.39-2.69,5.13-4.63,8.41-5.83c1.85-0.68,3.84-1.06,5.8-1.37c5.12-0.81,10.16-0.53,15.04,1.43 c1.83,0.74,3.7,1.38,5.53,2.13c2.98,1.22,5.3,3.32,7.26,5.79c1.56,1.97,3.08,4.02,4.33,6.19c0.85,1.47,1.3,3.2,1.77,4.86 c1.41,4.99,1.81,10.13,1.36,15.25c-0.51,5.79-3.38,10.47-8.11,13.82c-5.58,3.96-11.38,7.62-17.68,10.37 c-2.55,1.11-5.19,2.04-7.74,3.16c-2.81,1.23-5.55,2.58-8.34,3.85c-3.57,1.63-7.15,3.24-10.72,4.85c-1.63,0.74-3.28,1.45-4.91,2.21 c-4.4,2.06-8.83,4.05-13.16,6.24c-2.72,1.37-5.37,2.92-7.88,4.63c-1.91,1.29-3.99,2.43-5.44,4.32c-0.72,0.94-1.4,1.91-2.13,2.83 c-0.45,0.57-0.88,1.25-1.48,1.6c-1.74,1.01-2.51,2.69-3.31,4.38c-0.4,0.84-0.76,1.71-1.25,2.5c-2.44,3.96-3.17,8.43-3.94,12.9 c-0.29,1.69-0.74,3.35-0.91,5.05c-0.12,1.17,0.09,2.38,0.19,3.57c0.53,6.18,1.82,12.19,3.33,18.23c2.19,8.76,5.52,17.07,8.97,25.34 c1.53,3.67,3.5,7.16,5.28,10.73c0.15,0.3,0.33,0.58,0.47,0.88c2.61,5.89,5.6,11.6,8.47,17.36c1.42,2.85,3.1,5.58,4.63,8.37 c0.7,1.28,1.3,2.62,2,3.9c1.09,1.98,2.24,3.92,3.34,5.89c1.51,2.73,2.96,5.49,4.5,8.21c0.45,0.8,1.02,1.56,1.67,2.2 c0.89,0.86,1.88,0.37,2.75-0.15c1.08-0.65,2.09-1.43,3.18-2.07c3.56-2.09,7.14-4.14,10.7-6.22c2.34-1.37,4.66-2.79,7.02-4.13 c1.96-1.11,4.01-2.09,5.95-3.24c0.76-0.45,1.35-1.2,1.91-1.72c1.11-0.59,2.16-1.09,3.15-1.69c5.8-3.53,11.61-7.05,17.37-10.66 c2.01-1.26,3.88-2.75,5.81-4.14c1.83-1.32,3.65-2.68,5.5-3.98c1.9-1.34,3.85-2.61,5.75-3.95c1.29-0.91,2.34-2.09,4-2.51 c0.81-0.2,1.43-1.13,2.14-1.72c1.17-0.97,2.32-1.96,3.54-2.87c2.07-1.55,4.16-3.07,6.27-4.56c1.03-0.73,2.13-1.34,3.17-2.05 c0.7-0.48,1.42-0.97,2-1.58c0.92-0.97,1.72-2.01,3.25-2.05c0.41-0.01,0.82-0.4,1.21-0.65c2.39-1.57,4.64-3.41,7.18-4.66 c3.56-1.74,7.36-2.6,11.41-1.62c3.83,0.92,6.95,2.95,9.73,5.62c0.96,0.92,2,1.76,2.94,2.71c0.65,0.66,1.29,1.37,1.73,2.17 c1.6,2.92,3.11,5.88,4.65,8.83c0.15,0.29,0.46,0.64,0.4,0.88c-0.51,1.96,0.87,3.28,1.7,4.69c0.57,0.97,0.9,1.83,0.88,2.93 c-0.04,3.73-0.17,7.47,0.05,11.19c0.13,2.14-0.42,4.13-1.13,5.93c-1.8,4.61-4.88,8.17-9.94,9.55c-0.89,0.24-1.71,0.77-2.6,1.03 c-4.07,1.2-8.14,2.39-12.23,3.51c-5.39,1.48-10.79,2.94-15.93,5.22c-1.19,0.53-2.45,0.92-3.69,1.34c-5.99,2.03-11.3,5.32-16.45,8.89 c-2.84,1.97-5.62,4.05-8.37,6.15c-0.71,0.55-1.23,1.36-1.82,2.06c-0.21,0.25-0.32,0.6-0.56,0.8c-5.01,4.13-9.28,8.94-12.86,14.33 c-1.8,2.71-3.45,5.55-4.85,8.48c-1.01,2.13-1.49,4.51-2.21,6.78c-0.22,0.69-0.48,1.37-0.65,2.07c-0.55,2.33-1.15,4.65-1.56,7 c-0.38,2.22-0.54,4.49-0.8,6.73c-0.02,0.13-0.04,0.26-0.04,0.4c-0.25,4.3-0.6,8.6-0.72,12.9c-0.08,2.72,0.18,5.45,0.3,8.17 c0.09,1.99,0.07,3.99,0.31,5.96c0.36,2.88,0.94,5.72,1.36,8.59c0.87,5.96,2.94,11.6,4.5,17.37c0.31,1.15,0.41,2.39,0.9,3.46 c0.85,1.84,1.57,3.75,2.86,5.41c0.91,1.17,1.47,2.68,1.91,4.13c1.36,4.46,3.22,8.75,5.41,12.81c2.69,4.99,4.89,10.18,7.36,15.26 c1.42,2.92,2.98,5.78,4.48,8.66c0.21,0.41,0.46,0.82,0.61,1.26c0.7,2.17,1.98,3.89,3.87,5.14c0.9,0.59,1.21,1.39,1.46,2.44 c0.57,2.46,1.47,4.83,3.52,6.53c0.41,0.34,0.83,0.68,1.17,1.08c0.69,0.82,0.73,1.56-0.05,2.3c-1.24,1.19-2.57,2.28-3.88,3.39 c-0.56,0.47-1.24,0.81-1.76,1.31c-2.21,2.09-4.55,1.61-7.03,0.55c-0.94-0.4-2.06-0.57-3.09-0.53c-1.91,0.06-3.05-0.74-3.88-2.44 c-0.72-1.48-1.78-2.79-2.66-4.19c-0.35-0.56-0.76-1.14-0.88-1.76c-0.41-2.22-1.54-4.09-2.7-5.96c-0.25-0.39-0.48-0.8-0.69-1.21 c-1.3-2.69-2.62-5.38-3.89-8.09c-0.9-1.92-1.69-3.89-2.57-5.82c-1.07-2.36-2.26-4.67-3.27-7.05c-0.91-2.13-1.66-4.33-2.49-6.5 c-1.2-3.17-2.38-6.35-3.61-9.51c-0.62-1.59-1.32-3.14-1.98-4.71c-0.08-0.18-0.22-0.38-0.19-0.55c0.32-2.35-1.08-4.13-1.94-6.11 c-1.12-2.62-2.07-5.33-2.96-8.04c-0.6-1.83-1.01-3.72-1.45-5.6c-0.86-3.69-1.74-7.38-2.48-11.1c-0.27-1.34-1.13-2.53-0.91-4.03 C374.62,622.99,373.95,622.46,373.58,621.93";
        var vine = draw.path(vine_str);
        var water1 = draw.path("M206.62,636.83c-0.47,0-0.93,0-1.4,0c-2.44-0.32-4.84-1.1-7.35-0.66c-1.93,0.34-3.72-0.31-5.58-0.7 c-3.83-0.81-7.71-1.48-11.58-2.06c-6.61-0.99-13.22-1.94-19.85-2.78c-2.63-0.33-5.3-0.46-7.95-0.41c-1.49,0.03-2.97,0.68-4.47,0.94 c-2.15,0.37-4.35,0.52-6.48,0.99c-3.37,0.74-6.69,1.75-10.06,2.5c-1.78,0.39-3.63,0.4-5.43,0.72c-2.48,0.44-4.9,1.33-7.47,0.45 c-0.52-0.18-1.12-0.16-1.68-0.17c-3.34-0.09-6.65-0.35-9.86-1.33c-1.29-0.4-2.55-0.91-3.85-1.3c-1.2-0.36-1.78-1.26-1.58-2.51 c0.08-0.48,0.08-1,0.03-1.49c-0.09-0.96-0.34-1.91-0.34-2.86c-0.05-6.19-0.1-12.39-0.03-18.58c0.02-1.82,0.38-3.63,0.65-5.44 c0.05-0.32,0.41-0.82,0.68-0.85c2.63-0.36,5.26-0.75,7.91-0.89c2.25-0.12,4.52,0.06,6.78,0.12c1.76,0.04,3.52,0.1,5.27,0.13 c0.29,0,0.57-0.13,0.86-0.17c1.6-0.22,3.2-0.61,4.8-0.61c2.96,0,5.92,0.31,8.88,0.34c2.12,0.02,4.25-0.27,6.37-0.34 c3.36-0.11,6.73-0.16,10.09-0.24c1.33-0.03,2.66-0.14,3.99-0.13c2.36,0.01,4.72,0.18,7.08,0.12c5.86-0.14,11.72-0.39,17.58-0.53 c3.13-0.07,6.26,0.05,9.39,0.01c3.97-0.05,7.94,0.08,11.89-0.37c0.13-0.01,0.27,0,0.4,0.01c1.53,0.07,3.01,0.33,4.59,0.23 c4.31-0.28,8.65-0.18,12.98-0.23c1.66-0.02,3.33-0.04,4.99-0.07c5.32-0.07,10.64-0.19,15.96-0.2c3.46-0.01,6.92,0.21,10.38,0.2 c3.12-0.01,6.24-0.25,9.37-0.3c1.75-0.03,3.51,0.13,5.27,0.21c1.11,0.06,2.22,0.2,3.33,0.19c0.99,0,1.99-0.23,2.98-0.22 c2.56,0.02,5.12,0.18,7.68,0.17c1.92-0.01,3.83-0.22,5.74-0.29c5.42-0.2,10.84-0.39,16.26-0.54c3.92-0.11,7.84-0.16,11.77-0.21 c2.73-0.03,5.46,0,8.19-0.03c4-0.04,7.99-0.12,11.99-0.17c4.8-0.06,9.59-0.11,14.39-0.16c0.85-0.01,1.69,0,2.62,0 c-0.08,0.49-0.13,0.76-0.19,1.09c0.6-0.23,1.13-0.61,1.65-0.6c2.09,0.04,4.15-0.04,6.25-0.25c2.93-0.31,5.93-0.01,9.01,0.02 c0.12-0.25,0.32-0.7,0.45-0.98c0.65-0.06,1.18-0.13,1.71-0.16c2.66-0.14,5.32-0.3,7.98-0.38c2.56-0.08,5.12-0.1,7.68-0.08 c1.77,0.01,3.63,0.46,4.93-1.28c0.03-0.04,0.12-0.02,0.08-0.02c1.39,0.62,2.09,1.59,1.93,3.08c-0.02,0.22,0.08,0.45,0.12,0.68 c0,0.13,0,0.27,0,0.4c0,2.13,0,4.27,0,6.4c0,3.47,0,6.93,0,10.4c-0.61,2.77-1.13,5.55-0.53,8.38c0.15,0.72-0.06,1.16-0.56,1.65 c-2.3,2.24-5.22,3.43-8.07,4.68c-1.36,0.6-2.82,0.97-4.24,1.41c-0.85,0.26-1.73,0.4-2.57,0.69c-2.44,0.84-4.68,2.38-7.43,2.17 c-0.03,0-0.07,0.01-0.1,0.01c-2.44,0.28-4.89,0.68-7.22-0.28c-0.57,0.34-1.18,0.72-1.76,0.69c-1.63-0.08-3.24-0.35-4.86-0.51 c-0.56-0.06-1.13-0.07-1.69-0.01c-1.3,0.13-2.59,0.32-3.85,0.48c-0.17-0.57-0.26-0.88-0.38-1.26c-4.04,0.41-7.89-0.4-11.75-1.37 c-2.96-0.75-5.97-1.34-8.99-1.81c-1.86-0.29-3.82-0.48-5.67-0.24c-3.85,0.51-7.66,1.37-11.5,2.01c-5.44,0.91-10.72,2.68-16.3,2.79 c-2.59,0.05-5.18,0.41-7.77,0.45c-1.17,0.02-2.34-0.44-3.53-0.55c-3.91-0.37-7.81-0.78-11.73-1c-5.28-0.3-10.39-1.45-15.49-2.75 c-3.82-0.97-7.56-2.3-11.53-2.62c-1.78-0.14-3.54-0.57-5.34-0.19c-3.73,0.78-7.47,1.49-11.18,2.35c-7.06,1.63-14.11,3.33-21.15,5.04 C208.32,636.08,207.48,636.5,206.62,636.83z M360.2,623.96c-0.1,0.05-0.19,0.1-0.29,0.15c0.42,1.12,0.84,2.24,1.26,3.37 c0.13-0.05,0.25-0.1,0.38-0.15C361.1,626.2,360.65,625.08,360.2,623.96z M371.19,607.59c-0.07,0.02-0.14,0.04-0.21,0.06 c0.24,1.05,0.48,2.11,0.73,3.16c0.1-0.02,0.19-0.05,0.29-0.07C371.72,609.69,371.45,608.64,371.19,607.59z");
        var water2 = draw.path("M115.09,581.47c-3.27,0-6.53,0-9.8,0c-0.93-0.2-1.88-0.34-2.78-0.62c-0.29-0.09-0.67-0.52-0.68-0.81 c-0.1-2.65-0.13-5.29-0.18-7.94c-0.03-1.94-0.09-3.89-0.07-5.83c0.02-1.12,0.11-2.25,0.3-3.36c0.17-1,0.96-1.42,1.94-1.39 c1.79,0.06,3.59,0.04,5.38,0.06c2.48,0.04,4.97-0.57,7.45,0.12c0.86,0.24,1.71,0.53,2.58,0.74c0.43,0.1,0.97,0.24,1.34,0.08 c3.4-1.48,6.96-0.71,10.45-0.83c2.72-0.09,5.45-0.04,8.16-0.21c2.66-0.16,5.29-0.26,7.96-0.05c2.13,0.17,4.3-0.02,6.45-0.12 c1.34-0.06,2.67-0.34,4.01-0.39c1.92-0.07,3.85,0.02,5.78-0.04c1.09-0.04,2.17-0.35,3.25-0.37c2.85-0.06,5.71,0.01,8.57-0.03 c3.12-0.04,6.25-0.11,9.37-0.2c1.62-0.05,3.17,0.58,4.87,0.11c1.4-0.39,2.97-0.25,4.46-0.26c3.59-0.03,7.19-0.01,10.78-0.03 c1.3-0.01,2.59-0.14,3.88-0.13c2.52,0.02,5.04,0.15,7.57,0.15c1.56,0,3.12-0.21,4.68-0.22c3.36-0.03,6.72,0.05,10.07,0.01 c1.93-0.03,3.85-0.29,5.78-0.3c2.59,0,5.18,0.22,7.78,0.21c2.89-0.01,5.78-0.23,8.67-0.26c3.46-0.03,6.92,0.12,10.39,0.08 c3.65-0.05,7.3-0.22,10.95-0.38c4.89-0.21,9.78-0.23,14.67-0.69c4.16-0.39,8.36-0.36,12.55-0.38c2.99-0.02,5.98,0.27,8.97,0.26 c2.39,0,4.78-0.23,7.18-0.36c1.39-0.08,2.79-0.2,4.18-0.22c1.79-0.03,3.58,0.06,5.37,0.03c2.89-0.04,5.79-0.17,8.68-0.21 c3.39-0.05,6.79-0.09,10.18-0.04c1.79,0.03,3.57,0.27,5.35,0.42c0.92,0.08,1.85,0.24,2.77,0.24c4.29,0.01,8.58-0.05,12.87-0.04 c0.64,0,1.28,0.22,1.92,0.34c0.67,0.08,1.46-0.01,1.95,0.33c0.64,0.44,0.97,0.16,1.5-0.06c0.96-0.39,1.98-0.92,2.98-0.93 c2.72-0.03,5.45,0.26,8.17,0.29c2.66,0.03,5.32-0.14,7.99-0.18c1.71-0.03,1.87,0.11,1.9,1.85c0.03,1.83,0.23,3.61,0.81,5.35 c0,0.13,0,0.27,0,0.4c-0.24,0.99-0.75,1.99-0.67,2.95c0.23,2.76-0.03,5.49-0.63,8.13c-0.5,2.22-0.9,2.44-3.07,2.53 c-0.93,0.04-1.87-0.08-2.79-0.04c-2.62,0.12-5.24,0.38-7.87,0.42c-2.72,0.05-5.45-0.08-8.18-0.17c-0.52-0.02-1.04-0.17-1.56-0.27 c-0.56-0.11-1.12-0.32-1.68-0.33c-2.21-0.04-4.43,0.02-6.64-0.03c-4.38-0.1-8.77-0.39-13.15-0.35c-6.12,0.06-12.23,0.35-18.34,0.55 c-1.19,0.04-2.39,0.13-3.58,0.2c-2.12,0.13-4.24,0.26-6.36,0.38c-2.29,0.13-4.58,0.21-6.79-0.64c-0.09-0.03-0.2-0.02-0.3-0.02 c-2.66-0.05-5.33-0.12-7.99-0.13c-5.63-0.02-11.26-0.02-16.88-0.02c-1.33,0-2.66-0.02-3.99,0.02c-2.59,0.08-5.2,0.45-7.76,0.22 c-4.9-0.44-9.77-0.19-14.66-0.1c-3.66,0.07-7.32,0.03-10.99,0.07c-2.8,0.03-5.59,0.18-8.39,0.15c-2.39-0.03-4.82,0.41-7.18-0.33 c-0.11-0.04-0.29-0.02-0.38,0.04c-1.43,1.15-3.1,0.93-4.75,0.83c-0.93-0.06-1.86-0.04-2.79-0.05c-3.12-0.02-6.24-0.02-9.36-0.06 c-1.63-0.02-3.26-0.13-4.89-0.14c-1.43,0-2.86,0.1-4.29,0.14c-2.83,0.07-5.66,0.14-8.49,0.16c-1.53,0.01-3.06-0.08-4.59-0.1 c-1.33-0.02-2.66,0-3.99,0.01c-1.86,0.02-3.72,0.05-5.58,0.05c-1.95,0.01-3.9-0.01-5.85,0c-0.92,0-1.85,0.03-2.77,0.08 c-0.68,0.04-1.37,0.22-2.05,0.21c-2.62-0.04-5.24-0.25-7.85-0.18c-6.02,0.17-12.04,0.46-18.06,0.71c-2.92,0.12-5.85,0.29-8.77,0.4 c-1.13,0.04-2.26-0.03-3.38-0.08c-2.11-0.11-4.22-0.24-6.33-0.36c-0.06,0-0.12,0.05-0.19,0.06c-1.06,0.22-2.12,0.61-3.19,0.63 c-3.53,0.07-7.06,0-10.59,0.01C116.27,581.28,115.68,581.4,115.09,581.47z");
        var ref_x = water1.x();
        var ref_m = vine.cy();
        var scale = width / 417;
        water1.fill("#0003edAA");
        water2.fill("#0003edAA");
        vine.fill("#F2E6E0");
        grape.fill("#c03b1cAA");
        sky.fill("#0077f7AA");
        earth.fill("#008661AA");
        var earth_x = earth.x();
        var earth_y = earth.y();
        earth.move(earth_x, height + earth.height() / scale);
        var sky_x = sky.x();
        var sky_y = sky.y();
        sky.move(sky_x, -sky.height() / scale);
        var water1_x = water1.x();
        var water1_y = water1.y();
        water1.move(-water1.width(), water1_y);
        var water2_x = water2.x();
        var water2_y = water2.y();
        water2.move(-water2.width(), water2_y);
        var vine_x = vine.x();
        var vine_y = vine.y();
        var vine_w = vine.width();
        var vine_h = vine.height();
        grape.scale(.01);
        var maskRect = draw.rect(width, height).move(0, vine_h + height).fill("#F2E6E0");
        var mask = draw.mask();
        mask.add(vine);
        maskRect.maskWith(mask);
        rays.scale(.01);
        rays.animate(500).rotate(20).scale(1);
        rays.animate(6e4).rotate(340);
        water1.animate(1e3, "<>", 500).move(water1_x, water1_y);
        water2.animate(1e3, "<>", 1e3).move(water2_x, water2_y);
        earth.animate(1e3, "<>", 1500).move(earth_x, earth_y);
        sky.animate(1e3, "<>", 2e3).move(sky_x, sky_y);
        maskRect.animate(1e3, "<>", 2500).move(0, 0);
        grape.animate(1e3, "<>", 3e3).scale(1);
        var bg = draw.rect(width, height).move(0, 0).fill(VIVID).back();
        bg.opacity(1);
        bg.animate(3e3, "<>", 500).opacity(.3);
        var painting = draw.group();
        painting.add(rays);
        painting.add(earth);
        painting.add(sky);
        painting.add(grape);
        painting.add(water1);
        painting.add(water2);
        painting.scale(scale);
        vine.scale(scale);
        var mv_x = -ref_x / scale;
        var mv_y = (height / 2 - ref_m) / scale;
        painting.dmove(mv_x, mv_y);
        vine.dmove(mv_x - 5 / scale, mv_y + 5 / scale);
        maskRect.front();
    }
    destroy() {
        VMain.modalHide();
    }
}

class VService {
    constructor() {
        if (!VService.instance) {
            this._data = [];
            VService.instance = this;
        }
        return VService.instance;
    }
    autoresize(el) {
        el.style.height = "";
        el.style.height = el.scrollHeight + 4 + "px";
    }
    textToClipboard(text) {
        var dummy = document.createElement("textarea");
        document.body.appendChild(dummy);
        dummy.value = text;
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        _release_toast("text copied: " + text);
    }
    getArrayDepth(value) {
        function rec(v) {
            return Array.isArray(v) ? 1 + Math.max(...v.map(rec)) : 0;
        }
        let depth = rec(value);
        return depth;
    }
    searchArray(search_text, data, is_indepth = false) {
        if (null === search_text || undefined === search_text || search_text === "" || search_text.length < 3) return [];
        var results = [];
        var search_text = search_text.replace(/\s\s+/g, " ");
        var regexp = new RegExp(search_text.removeDiacritics(), "ig");
        for (let item of data) {
            if (item.name.removeDiacritics().search(regexp) > -1) {
                results.push(item);
            }
            if (is_indepth && undefined !== item.children) {
                var tmp_results = this.searchArray(search_text, item.children, is_indepth);
                results = results.concat(tmp_results);
            }
        }
        return results;
    }
    searchArrayExact(search_text, data) {
        if (null === search_text || undefined === search_text || search_text === "") return null;
        var results = [];
        search_text = search_text.replace(/\s\s+/g, " ").removeDiacritics();
        for (let item of data) {
            var regexp = new RegExp("^" + item.name.removeDiacritics() + "$", "i");
            if (search_text.search(regexp) > -1) {
                results.push(item);
            }
        }
        return results;
    }
    time_str(date) {
        var ss = ("0" + (date.getSeconds() + 1)).slice(-2);
        var mm = ("0" + date.getMinutes()).slice(-2);
        var hh = ("0" + date.getHours()).slice(-2);
        return hh + "-" + mm + "-" + ss;
    }
    date_str(date) {
        var mm = ("0" + (date.getMonth() + 1)).slice(-2);
        var dd = ("0" + date.getDate()).slice(-2);
        var yyyy = date.getFullYear();
        return yyyy + "-" + mm + "-" + dd;
    }
    uniq(a) {
        var seen = {};
        return a.filter(function(item) {
            return seen.hasOwnProperty(item) ? false : seen[item] = true;
        });
    }
    componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
    hexToRgb(hex) {
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        let rgb = result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : {
            r: 255,
            g: 255,
            b: 255
        };
        return this.saturateRgb(rgb);
    }
    saturateRgb(rgb) {
        return {
            r: rgb.r < 0 ? 0 : rgb.r > 255 ? 255 : rgb.r,
            g: rgb.g < 0 ? 0 : rgb.g > 255 ? 255 : rgb.g,
            b: rgb.b < 0 ? 0 : rgb.b > 255 ? 255 : rgb.b
        };
    }
    rgbToHex(r, g, b) {
        return "#" + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
    }
    getRandomPolar(R) {
        var a = 2 * Math.PI * Math.random();
        var r = R * Math.sqrt(Math.random());
        var x = r * Math.cos(a);
        var y = r * Math.sin(a);
        return {
            x: x,
            y: y
        };
    }
    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    flashControl(e) {
        e.getAttribute("flash") == "on" ? e.setAttribute("flash", "off") : e.setAttribute("flash", "on");
        var str = e.getAttribute("flash") == "on" ? "" : "-off";
        e.innerHTML = '<ons-icon icon="md-flash' + str + '"></ons-icon>';
        ABCamera.switchFlash(e.getAttribute("flash"));
    }
    dataURItoBlob(dataURI) {
        var byteString;
        if (dataURI.split(",")[0].indexOf("base64") >= 0) byteString = atob(dataURI.split(",")[1]); else byteString = unescape(dataURI.split(",")[1]);
        var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
        var ia = new Uint8Array(byteString.length);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ ia ], {
            type: mimeString
        });
    }
    dataURItoBlob1(dataURI) {
        var byteString = atob(dataURI.split(",")[1]);
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ ab ], {
            type: "image/jpeg"
        });
    }
    byteLength(str) {
        var s = str.length;
        for (var i = str.length - 1; i >= 0; i--) {
            var code = str.charCodeAt(i);
            if (code > 127 && code <= 2047) s++; else if (code > 2047 && code <= 65535) s += 2;
            if (code >= 56320 && code <= 57343) i--;
        }
        return s;
    }
    changeVisualItemBackround(mode) {
        var visualPageCarouselItem = document.getElementById("edit-wine-carousel-item-visual");
        if (visualPageCarouselItem === null) {
            return;
        }
        if (mode == "none") {
            visualPageCarouselItem.style = "background-image: none";
            visualPageCarouselItem.style = "background-color: transparent";
            ABCamera.hide();
        } else if (mode == "camera") {
            visualPageCarouselItem.style = "background-image: none";
            visualPageCarouselItem.style = "background-color: transparent";
            ABCamera.show();
        } else if (mode == "image") {
            visualPageCarouselItem.style = 'background-image: url("css/splash.png");';
            visualPageCarouselItem.style = "background-color: " + OPAQUE;
            ABCamera.hide();
        }
    }
    selectCurrency(event) {
        vWineSingleton.currentWine.currency = event.value;
    }
    shareUrl(product) {
        console.log("shareUrl");
        var subject = "";
        var url = jDrupal.settings.sitePath;
        if (product.type == "wine") {
            subject = product.getName();
            url += "/node/" + product.getId();
        }
        try {
            var options = {
                subject: subject,
                url: url
            };
            var onSuccess = function(result) {};
            var onError = function(msg) {};
            socialsharing.shareWithOptions(options, onSuccess, onError);
        } catch (err) {
            _debug_toast(err, "ERROR");
        }
        try {
            navigator.share({
                title: subject,
                text: subject,
                url: url
            }).then(function() {
                console.log("Successful share");
            }).catch(function(error) {
                console.log("Error sharing:", error);
            });
        } catch (err) {
            _debug_toast(err, "ERROR");
        }
    }
    getTimezone() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone.toString();
    }
    getWordsDifference(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        var matrix = [];
        var i;
        for (i = 0; i <= b.length; i++) {
            matrix[i] = [ i ];
        }
        var j;
        for (j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (i = 1; i <= b.length; i++) {
            for (j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
                }
            }
        }
        return matrix[b.length][a.length];
    }
}

const vServiceSingleton = new VService();

Object.freeze(vServiceSingleton);

class VUser {
    constructor() {
        if (!VUser.instance) {
            this.wines = [];
            this._data = [];
            VUser.instance = this;
            this.reset();
        }
        return VUser.instance;
    }
    reset() {
        this.settings = {
            langcode: _deviceLangcode,
            is_showHints: true,
            timezone: vServiceSingleton.getTimezone(),
            mail: "",
            location: {
                city: "",
                address: "",
                postcode: "",
                lat: 0,
                lng: 0
            },
            uid: 0,
            name: "visitor",
            organic: "",
            vegan: false,
            image: "css/splash.png",
            csrfToken: null,
            file: {
                url: "",
                width: 0,
                height: 0
            }
        };
        this.updateDebugging();
    }
    setCallback(callback) {
        this.callback = callback;
    }
    getId() {
        return this.settings.uid;
    }
    isAuthenticated() {
        return jDrupal.currentUser().isAuthenticated();
    }
    getTimezone() {
        return this.settings.timezone;
    }
    setCity(city) {
        this.settings.location.city = city;
        this.saveUserCache();
    }
    getCity() {
        return this.settings.location.city;
    }
    setCountryCode(country_code) {
        this.settings.location.country = country_code;
        this.saveUserCache();
    }
    getCountryCode() {
        return this.settings.location.country;
    }
    setAddress(address) {
        this.settings.location.address = address;
        this.saveUserCache();
    }
    setPostalCode(postal_code) {
        this.settings.location.postcode = postal_code;
        this.saveUserCache();
    }
    setLocation(latlng) {
        this.settings.location.lat = parseFloat(latlng[0]);
        this.settings.location.lng = parseFloat(latlng[1]);
        this.saveUserCache();
    }
    getLocation() {
        return [ this.settings.location.lat, this.settings.location.lng ];
    }
    signin(username = "", password = "") {
        return new Promise((resolve, reject) => {
            if (!_isOnline()) {
                _release_toast(VLocal.YouAreOffline);
                reject();
            }
            if (!jDrupal.currentUser().isAuthenticated()) {
                if (username === "" || password === "") {
                    reject();
                    _release_toast(" :<br>" + VLocal.UserNotFound);
                    return;
                }
                jDrupal.userLogin(username, password).then(() => {
                    this.updateUser().then(resolve);
                }, err => {
                    if (null == err.response) {
                        _release_toast(err);
                    } else if (err.response.includes("unrecognized")) _release_toast(username + " " + VLocal.UserNotFound); else _release_toast(err.response);
                    reject();
                });
            } else {
                _release_toast(username + " is already signed in");
                this.updateUser().then(resolve);
            }
        });
    }
    updateUser(user) {
        return new Promise((resolve, reject) => {
            let langcode = this.getUserLangcode();
            try {
                this.settings.uid = jDrupal.currentUser().id();
                this.settings.name = jDrupal.currentUser().getAccountName();
                let timeZoneDrupal = jDrupal.currentUser().get("timezone", 0);
                if (null != timeZoneDrupal) this.settings.timezone = timeZoneDrupal.value;
                let mailDrupal = jDrupal.currentUser().get("mail", 0);
                if (null != mailDrupal) this.settings.mail = mail.value;
                let langcodeDrupal = jDrupal.currentUser().get("langcode", 0);
                if (null != langcodeDrupal) langcode = langcodeDrupal.value;
                let userPictureDrupal = jDrupal.currentUser().get("field_user_picture", 0);
                if (null != userPictureDrupal) this.settings.file.url = this.settings.image = userPictureDrupal.url;
            } catch (err) {
                _debug_toast_err("signin1: " + err);
            }
            vDrupalSingleton.getSessionToken().then(csrfToken => {
                try {
                    this.settings.csrfToken = csrfToken;
                    this.saveUserCache();
                    if (langcode != this.getUserLangcode()) {
                        this.setUserLangcode(langcode);
                        location.reload();
                    }
                    VMain.createLeftSideMenu();
                    VMain.toggleLeftMenu();
                    VMain.showFabs();
                    this.getWines();
                } catch (err) {
                    _debug_toast_err("signin2: " + err);
                }
                resolve();
            });
        });
    }
    signup(username, password, mail) {
        return new Promise((resolve, reject) => {
            if (!_isOnline()) {
                _release_toast(VLocal.YouAreOffline);
                reject();
            }
            jDrupal.userRegister(username, password, mail, this.settings.langcode, this.settings.timezone).then(() => {
                this.updateUser().then(resolve);
            }, err => {
                if (null != err.response && err.response.includes("is already taken")) {
                    if (err.response.includes("username")) {
                        _release_toast(username + " " + VLocal.UserTaken);
                    } else if (err.response.includes("username")) {
                        _release_toast(mail + " " + VLocal.MailTaken);
                    }
                } else {
                    _release_toast(VLocal.UnableToConnect);
                }
                reject();
            });
        });
    }
    signout() {
        return new Promise((resolve, reject) => {
            if (!_isOnline()) {
                _release_toast(VLocal.YouAreOffline);
                reject();
            }
            jDrupal.userLogout().then(() => {
                vDrupalSingleton.getSessionToken().then(() => {
                    this.reset();
                    this.settings.uid = jDrupal.currentUser().id();
                    this.saveUserCache();
                    VMain.createLeftSideMenu();
                    VMain.toggleLeftMenu();
                    VMain.showFabs();
                    resolve();
                });
            }, err => {
                if (null != err.response) _release_toast(err.response); else _release_toast(VLocal.UnableToConnect);
                reject();
            });
        });
    }
    getWines() {
        var myWines_cached = JSON.parse(localStorage.getItem("myWines_cached"));
        if (null !== myWines_cached) {
            this.wines = myWines_cached;
        }
        if (this.wines.length === 0) {
            this.getWinesOnline().then(() => {
                localStorage.setItem("myWines_cached", JSON.stringify(this.wines));
                _debug_toast("Loaded " + this.wines.length + " wines for user " + this.settings.name, "DEBUG");
            });
        }
    }
    getWinesOnline() {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad("mywinesapp?_format=json").then(view => {
                this.wines = view.getResults();
                resolve();
            });
        });
    }
    updateDebugging() {
        try {
            if (this.settings.uid == 0) this.settings.name = device.uuid == null ? "browser" : device.uuid;
        } catch (err) {
            if (_is_app) {
                this.settings.uid = -1;
                this.settings.name = "error";
            } else {
                this.settings.name = "browser";
                this.settings.uid = 0;
            }
        }
        _debug_toast("uuid:" + String(device.uuid) + " name:" + String(this.settings.name), "DEBUG");
        window._isDebugUser = () => {
            try {
                return !_is_app || null != _localInterface.debug_users && (_localInterface.debug_users.includes(String(device.uuid)) && this.settings.uid == 0 || _localInterface.debug_users.includes(String(this.settings.uid)));
            } catch (e) {
                _debug_toast_err(e);
                if (!_is_app) console.log(e);
                return false;
            }
        };
        if (_deviceType() == "apple") {
            window.DEBUG_MODE = _isDebugUser() ? _localInterface.DEBUG_MODE_iOS : "";
        } else window.DEBUG_MODE = _isDebugUser() ? _localInterface.DEBUG_MODE_Android : "";
    }
    saveUserCache() {
        localStorage.setItem("user_settings_cached", JSON.stringify(this.settings));
    }
    getUserLangcode() {
        return this.settings.langcode;
    }
    setUserLangcode(langcode) {
        this.settings.langcode = langcode;
        this.saveUserCache();
    }
    switchVegan(event) {
        if (event.checked) this.settings.vegan = true; else this.settings.vegan = false;
        this.saveUserCache();
    }
    switchNatural(event) {
        if (event.checked) this.settings.organic = "natural"; else this.settings.organic = "bio";
        this.saveUserCache();
    }
    switchBio(event) {
        var naturalSwitchElement = document.getElementById("natural-switch");
        if (event.checked) {
            this.settings.organic = "bio";
            naturalSwitchElement.disabled = false;
        } else {
            this.settings.organic = "";
            naturalSwitchElement.checked = false;
            naturalSwitchElement.disabled = true;
        }
        this.saveUserCache();
    }
    updateMail(mail, pass) {
        var newUser = new jDrupal.User({
            preferred_langcode: [ {
                value: this.settings.langcode
            } ],
            uid: [ {
                value: jDrupal.currentUser().id()
            } ],
            timezone: [ {
                value: this.settings.timezone
            } ],
            pass: {
                existing: pass
            },
            mail: {
                value: mail
            }
        });
        this.save(newUser);
    }
    updatePassword(pass, newPass) {
        var newUser = new jDrupal.User({
            preferred_langcode: [ {
                value: this.settings.langcode
            } ],
            uid: [ {
                value: jDrupal.currentUser().id()
            } ],
            timezone: [ {
                value: this.settings.timezone
            } ],
            pass: {
                value: newPass,
                existing: pass
            }
        });
        this.save(newUser);
    }
    updatePicture(image_file) {
        var newUser = new jDrupal.User({
            preferred_langcode: [ {
                value: this.settings.langcode
            } ],
            uid: [ {
                value: jDrupal.currentUser().id()
            } ],
            timezone: [ {
                value: this.settings.timezone
            } ],
            field_user_picture: [ {
                target_id: image_file.attributes.drupal_internal__fid,
                alt: "",
                title: image_file.attributes.filename,
                width: this.settings.file.width,
                height: this.settings.file.height,
                target_type: "file",
                target_uuid: image_file.id,
                url: jDrupal.restPath() + image_file.attributes.uri.url
            } ]
        });
        this.save(newUser);
    }
    save(newUser) {
        newUser.save().then(() => {
            _release_toast(VLocal.UserSettingsSaved);
            try {
                if (null != newUser.entity.field_user_picture) {
                    this.settings.file.url = this.settings.image = newUser.entity.field_user_picture[0].url;
                }
                if (null != newUser.entity.mail) this.settings.mail = newUser.entity.mail.value;
                this.saveUserCache();
            } catch (err) {
                _debug_toast_err(err);
            }
        }, err => {
            if (null != err.response) _release_toast(err.response);
            _release_toast(VLocal.UserSettingsNotSaved);
        });
    }
}

const vUserSingleton = new VUser();

class VPageFactory {
    constructor() {
        return null;
    }
    static createPage(pageId, html) {
        if (null !== document.getElementById(pageId + ".html")) return;
        var pageTemplate = document.createElement("template");
        pageTemplate.id = pageId + ".html";
        pageTemplate.innerHTML = html;
        $("#app-body")[0].appendChild(pageTemplate);
    }
    static buildCameraPage(type) {
        var html = '<ons-page id= "camera-' + type + '-page" class="page__transparent">' + '<ons-fab modifier ="mini" position="top left" class="fab-text" style="width:100px!important; margin-left:-30px;" id="edit-wine-back-div" ontouchend="VMain.pushMainPage({\'id\': \'selected-wines.html\', prev: \'camera-' + type + "-page.html'});\">" + VLocal.Cancel + "</ons-fab>";
        if (_isDebugUser()) html += '<ons-fab id="' + type + '-camera-skip-fab" modifier ="mini" position="top right" class="fab-text" style="width:100px!important; margin-right:-30px;"">' + VLocal.Skip + ' <ons-icon icon="md-chevron-right"></ons-icon>' + "</ons-fab>";
        if (type == "wine") html += '<div class="wine-bottle" id="wine-bottle"></div>';
        if (type == "map") {
            html += '<div id="map-image-div" style="pointer-events: none; position:fixed; top:0px; left: 0px; width:100%; height:100%; background-color:transparent">' + '<img  style="position:absolute" id="map-image" />' + "</div>";
            html += '<div id="google-map-canvas" style="filter: opacity(0.5);  position:absolute; top:0; bottom: 0px; width:100%; height:100%; background-color:transparent"></div>';
            html += '<div id="drawing-canvas" style="display:none; position:absolute; top:0; bottom: 0px; width:100%; height:100%; background-color:transparent">' + "</div>";
        }
        html += '<ons-fab id="flash-fab" modifier="mini" flash="off" style="position:absolute; left: 20px; bottom:20px; transform:none!important" >' + '<ons-icon icon="md-flash-off"></ons-icon>' + "</ons-fab>" + '<ons-fab style="position:absolute; margin-left: auto; margin-right: auto; left:0; right:0; display:block; bottom:20px; transform:none!important" id="' + type + '-camera-fab" >' + '<ons-icon icon="md-camera-alt"></ons-icon>' + "</ons-fab>" + '<ons-fab id="' + type + '-browse-fab" modifier="mini" style="position:absolute; right: 20px; bottom:20px; transform:none!important" >' + '<ons-icon icon="md-image"></ons-icon>' + "</ons-fab>" + "</ons-page>";
        return html;
    }
    static buildPriceListItem() {
        return "<ons-list-item tappable >" + '<div class="left left-30" id="wine-price-title">' + VLocal.Price + "</div>" + '<div class="center"><ons-input id="wine-price" placeholder="' + VLocal.Price + '"></ons-input></div>' + '<div class="right" style="width:100px">' + '<div style="width:100px">' + '<ons-select id="choose-currency">' + '<option value="EUR">€</option>' + '<option value="USD">$</option>' + '<option value="JPY">¥</option>' + '<option value="KRW">₩</option>' + '<option value="CNE">¥</option>' + '<option value="GBP">£</option>' + '<option value="RUB">₽</option>' + "</ons-select>" + "</div>" + "<div >" + '<ons-checkbox modifier="noborder" id="wine-price-checked"></ons-checkbox>' + "</div>" + "</div>" + "</ons-list-item>";
    }
    static buildStockListItem() {
        return '<ons-list-item tappable modifier="nodivider">' + '<div class="left left-30" id="wine-stock-title">' + VLocal.Stock + "</div>" + '<div class="center"><ons-input id="wine-stock" type="number" min="0" value="1"></ons-input></div>' + '<div class="right" style="width:100px"><ons-checkbox modifier="noborder" id="wine-stock-checked"></ons-checkbox></div>' + "</ons-list-item>";
    }
    static buildBottomListItem() {
        return '<ons-list-item class="bottom-item" modifier ="nodivider" style="display:none; height:' + .8 * window.innerHeight + 'px"></ons-list-item>';
    }
    static buildGeneralListItems(pageId) {
        var html = VPageFactory.buildPhotoFab() + '<ons-list-item id="wine-name-element">' + '<div class="left left-30" id="wine-name-title">' + VLocal.Name + "</div>" + '<div class="center"><ons-input id="wine-name" placeholder="' + VLocal.Name + '"></ons-input></div>' + '<div class="right"><ons-checkbox modifier="noborder" id="wine-name-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item>" + '<div class="left left-30 "><span id="wine-boutique-title">' + VLocal.Boutique + "</span></div>" + '<div class="center" ><select id="wine-boutique" multiple="multiple" style="width: 100%;" class="demo-default selectized" placeholder="' + VLocal.Boutique + '"></select></div>' + '<div class="right"><ons-checkbox modifier="noborder" id="wine-boutique-checked"></ons-checkbox></div>' + "</ons-list-item>" + '<ons-list-item  id="wine-tasting-date-element">' + '<div class="left left-30 "><span id="wine-tasting-date-title">' + VLocal.TastingDate + "</span></div>" + '<div class="center"><ons-input id="wine-tasting-date" type="date" placeholder="' + VLocal.TastingDate + '" value="' + vServiceSingleton.date_str(new Date()) + '"></ons-input></div>' + '<div class="right"><ons-checkbox modifier="noborder" checked id="wine-tasting-date-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item>" + '<div class="left left-30 "><span id="wine-vintage-title">' + VLocal.Vintage + "</span></div>" + '<div class="center"><ons-input id="wine-vintage" type="number" placeholder="' + VLocal.Vintage + '" value="2020"></ons-input></div>' + '<div class="right"><ons-checkbox modifier="noborder" id="wine-vintage-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item>" + '<div class="left left-30 "><span id="wine-alcohol-title">' + VLocal.Alcohol + "</span></div>" + '<div class="center"><ons-input id="wine-alcohol" type="number"  placeholder="' + VLocal.Alcohol + '" value="13.5"></ons-input></div>' + '<div class="right"><ons-checkbox modifier="noborder" checked id="wine-alcohol-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item>" + '<div class="left left-30 "><span id="wine-bio-title">' + VLocal.Organic + "</span></div>" + '<div class="center" ><ons-select id="wine-bio" style="width: 100%;" class="demo-default selectized" placeholder="' + VLocal.Organic + '">' + '<option value="0">' + VLocal.wineBioRangeNames[0] + "</option>" + '<option value="1">' + VLocal.wineBioRangeNames[1] + "</option>" + '<option value="2">' + VLocal.wineBioRangeNames[2] + "</option>" + "</ons-select></div>" + '<div class="right"><ons-checkbox modifier="noborder" id="wine-bio-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item >" + '<div class="left left-30 "><span id="wine-sulfites-title">' + VLocal.Sulfites + "</span></div>" + '<div class="center" ><ons-select id="wine-sulfites" style="width: 100%;" class="demo-default selectized" placeholder="' + VLocal.Sulfites + '">' + '<option value="0">' + VLocal.wineSulfitesRangeNames[0] + "</option>" + '<option value="1">' + VLocal.wineSulfitesRangeNames[1] + "</option>" + "</ons-select></div>" + '<div class="right"><ons-checkbox modifier="noborder" id="wine-sulfites-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item >" + '<div class="left left-30 "><span id="wine-vegan-title">' + VLocal.Vegan + "</span></div>" + '<div class="center" ><ons-select id="wine-vegan" style="width: 100%;" class="demo-default selectized" placeholder="' + VLocal.Vegan + '">' + '<option value="0">' + VLocal.wineVeganRangeNames[0] + "</option>" + '<option value="1">' + VLocal.wineVeganRangeNames[1] + "</option>" + "</ons-select></div>" + '<div class="right"><ons-checkbox modifier="noborder" id="wine-vegan-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item >" + '<div class="left left-30 "><span id="wine-appellation-title">' + VLocal.Appellation + "</span></div>" + '<div class="center" ><select id="wine-appellation" multiple="multiple" style="width: 100%;" class="demo-default selectized" placeholder="' + VLocal.Appellation + '"></select></div>' + '<div class="right"><ons-checkbox modifier="noborder" id="wine-appellation-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item>" + '<div class="left left-30 "><span id="wine-producer-title">' + VLocal.Producer + "</span></div>" + '<div class="center" ><select id="wine-producer" multiple="multiple" style="width: 100%;" class="demo-default selectized" placeholder="' + VLocal.Producer + '"></select></div>' + '<div class="right"><ons-checkbox modifier="noborder" id="wine-producer-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item>" + '<div class="left left-30 "><span id="wine-varieties-title">' + VLocal.Varieties + "</span></div>" + '<div class="center" ><select id="wine-varieties" multiple="multiple" style="width: 100%;" class="demo-default selectized" placeholder="' + VLocal.Varieties + '"></select></div>' + '<div class="right"><ons-checkbox modifier="noborder" id="wine-varieties-checked"></ons-checkbox></div>' + "</ons-list-item>";
        return html;
    }
    static buildPhotoFab() {
        return '<ons-fab modifier ="mini quiet" position="bottom right" id="camera-fab" ontouchend="vCameraSingleton.hide(); VMain.popPage(); ">' + '<ons-icon icon="md-camera"></ons-icon>' + "</ons-fab>";
    }
    static buildCancelFab(pageId, top = 0) {
        return '<ons-fab modifier ="mini" position="top left" class="fab-text" style="width:120px!important; margin-top:' + top + "px; margin-left:-30px;\" id=\"edit-wine-back-div\" ontouchend=\"VMain.pushMainPage({'id': 'selected-wines.html', prev: '" + pageId + "-page.html'});\">" + '<ons-icon icon="fa-chevron-left"></ons-icon>&nbsp;' + VLocal.Cancel + "</ons-fab>";
    }
    static buildSaveFab(top = 0) {
        return '<ons-fab modifier ="mini quiet" position="top right" class="fab-text save-wine-button" style="width:120px!important; margin-top:' + top + 'px;  margin-right:-30px">' + VLocal.Save + '&nbsp;<ons-icon icon="fa-send"></ons-icon>' + "</ons-fab>";
    }
    static buildWinePageTabbar() {
        return '<ons-tabbar modifier="autogrow" id="edit-wine-tabbar" swipeable position="top">' + '<ons-tab page="edit-wine-page-general.html" label="' + VLocal.Description + '"  active>' + "</ons-tab>" + '<ons-tab page="edit-wine-page-visual.html" label="' + VLocal.Visual + '" >' + "</ons-tab>" + '<ons-tab page="edit-wine-page-olfaction.html" label="' + VLocal.Olfaction + '" >' + "</ons-tab>" + '<ons-tab page="edit-wine-page-taste.html" label="' + VLocal.Taste + '" >' + "</ons-tab>" + '<ons-tab page="edit-wine-page-conclusion.html" label="' + VLocal.Conclusion + '" >' + "</ons-tab>" + "</ons-tabbar>";
    }
    static buildWineGeneralPage(pageId) {
        return '<ons-page id="' + pageId + '"  >' + '<ons-list modifier="noborder" style="padding: 0; margin-top: 40px; width: 100%; background-color:' + TRANSPARENT + '">' + VPageFactory.buildGeneralListItems() + VPageFactory.buildStockListItem() + VPageFactory.buildBottomListItem() + "</ons-list>" + "</ons-page>";
    }
    static buildWineVisualPage(pageId) {
        return '<ons-page id="' + pageId + '">' + '<ons-speed-dial direction="up" style="position: absolute; left: 20px; bottom:20px; transform:scale(0.8)" id="red-palette">' + '<ons-fab style="background:#ff0000;">' + '<ons-icon style="transform: scale(1.5);" icon="md-palette"></ons-icon>' + "</ons-fab>" + "</ons-speed-dial>" + '<ons-speed-dial direction="up" style="position: absolute; left: 60px; bottom:20px; transform:scale(0.8)" id="white-palette">' + '<ons-fab style="background:#ffff00;">' + '<ons-icon style="transform: scale(1.5);" icon="md-palette"></ons-icon>' + "</ons-fab>" + "</ons-speed-dial>" + '<ons-speed-dial  direction="up" style="position: absolute; left: 100px; bottom:20px; transform:scale(0.8)" id="rose-palette">' + '<ons-fab style="background:#ff00a0;">' + '<ons-icon style="transform: scale(1.5);" icon="md-palette"></ons-icon>' + "</ons-fab>" + "</ons-speed-dial>" + '<ons-speed-dial direction="up" style="position: absolute; right: 0px; bottom:20px; transform:scale(0.8)" id="color-transparency">' + "<ons-fab>" + '<ons-icon style="transform: scale(1.5);" icon="fa-adjust"></ons-icon>' + "</ons-fab>" + '<ons-speed-dial-item style="border-radius:10px; height:200px; background:' + VIVID20 + ';">' + '<ons-range id="color-transparency-range" value="220" min="128" max="255" style="transform: rotate(270deg);  margin-left: -70px;  margin-top: 85px;  width: 180px;">' + "</ons-range>" + "</ons-speed-dial-item>" + "</ons-speed-dial>" + '<ons-speed-dial direction="up" style="position: absolute; bottom: 20px; right: 50px; transform:scale(0.8)" id="color-particles">' + "<ons-fab>" + '<ons-icon style="transform: scale(1.5);" icon="md-grain"></ons-icon>' + "</ons-fab>" + '<ons-speed-dial-item style="border-radius:10px; height:200px; background:' + VIVID20 + ';">' + '<ons-range id="color-particles-range" value="0" min="1" max="99" style="transform: rotate(270deg);  margin-left: -70px;  margin-top: 85px;  width: 180px;">' + "</ons-range>" + "</ons-speed-dial-item>" + "</ons-speed-dial>" + '<ons-speed-dial direction="up" style="position: absolute; bottom: 20px; right: 100px; transform:scale(0.8)" id="color-background">' + "<ons-fab>" + '<ons-icon style="transform: scale(1.5);" icon="md-crop-free"></ons-icon>' + "</ons-fab>" + "<ons-speed-dial-item>" + '<ons-fab modifier="mini" id="color-background-none" ontouchend="VMain.setBackground(\'' + OPAQUE + "');\">" + '<ons-icon icon="fa-file-o"></ons-icon>' + "</ons-fab>" + "</ons-speed-dial-item>" + "<ons-speed-dial-item>" + '<ons-fab modifier="mini" id="color-background-camera" ontouchend="VMain.setBackground(\'' + TRANSPARENT + "');\">" + '<ons-icon icon="fa-camera"></ons-icon>' + "</ons-fab>" + "</ons-speed-dial-item>" + "</ons-speed-dial>" + "</ons-page>";
    }
    static buildWineOlfactionPage(pageId) {
        return '<ons-page id="' + pageId + '" style="background:' + MIDTONE + '!important">' + '<ons-list modifier="noborder" style="margin-top: 40px; background-color:' + TRANSPARENT + '">' + '<ons-list-item class="range-item" modifier="nodivider">' + '<div class="left left-30 "><span id="wine-intensity-title">' + VLocal.Intensity + "</span></div>" + '<div class="center">' + "<ons-row>" + '<ons-range id="olfaction-intensity-range" value="0" min="0" max="100" style=" width:100%;"></ons-range>' + "</ons-row>" + '<ons-row class="range-item-value">' + '<i style="font-size:14px" id="intensity-range-link"></i>' + "</ons-row>" + "</div>" + '<div class="right"><ons-checkbox modifier="noborder" id="intensity-checked"></ons-checkbox></div>' + "</ons-list-item>" + "</ons-list>" + '<div id="sunburstchart" class="ons-swiper-target" style="bottom:0px; width: 100%; height:' + window.innerWidth + "px; background-color:" + TRANSPARENT + '">' + "</div>" + "</ons-page>";
    }
    static buildWineTastePage(pageId) {
        return '<ons-page id="' + pageId + '" style = "background:' + MIDTONE + '!important;">' + '<div id="taste-radar"  style = "background: inherit; position: fixed; margin-top:40px; height:350px; width:100%"; >' + "</div>" + "</ons-page>";
    }
    static buildWineConclusionPage(pageId) {
        return '<ons-page id="' + pageId + '" style="width:overflow-y: auto;" >' + VPageFactory.buildSaveFab(-20) + '<ons-list modifier="noborder" style="width: 100%; margin-top: 40px; background-color:' + TRANSPARENT + '">' + VPageFactory.buildPriceListItem() + "<ons-list-item >" + '<div class="left left-30" id="wine-conclusion-title">' + VLocal.Conclusion + "</div>" + '<div class="center"><textarea class="textarea" style="-webkit-box-sizing: border-box;" rows="10"  id="wine-conclusion" placeholder="' + VLocal.Conclusion + '"></textarea></div>' + '<div class="right"><ons-checkbox modifier="noborder" id="wine-conclusion-checked"></ons-checkbox></div>' + "</ons-list-item>" + "<ons-list-item>" + '<div class="left left-30 "><span id="wine-food-title">' + VLocal.FoodPairing + "</span></div>" + '<div class="center" ><select id="wine-food" multiple="multiple" style="width: 100%;" class="demo-default selectized" placeholder="' + VLocal.FoodPairing + '"></select></div>' + '<div class="right"><ons-checkbox modifier="noborder" id="wine-food-checked"></ons-checkbox></div>' + "</ons-list-item>" + VPageFactory.buildBottomListItem() + "</ons-list>" + "</ons-page>";
    }
    static buildSaveWineErrorUls(wine) {
        var error_html = "<ul style='list-style-type:none; color:red'>";
        var error = error_html.length;
        var warning_html = "<ul style='list-style-type: none; color:orange'>";
        var warning = warning_html.length;
        var selectedAppellations = $(document.getElementById("wine-appellation"))[0].selectize.items;
        var selectedProducer = $(document.getElementById("wine-producer"))[0].selectize.items;
        var selectedBoutique = $(document.getElementById("wine-boutique"))[0].selectize.items;
        var selectedVarieties = $(document.getElementById("wine-varieties"))[0].selectize.items;
        var isNew = (selection, type, data) => {
            let result = [];
            wine[type] = [];
            for (let element of selection) {
                if (isNaN(parseInt(element))) {
                    let tmp = data.find(d => d.tid == element);
                    if (null != tmp) {
                        result.push(tmp);
                    } else result.push({
                        name: element
                    });
                } else wine[type].push({
                    tid: parseInt(element)
                });
            }
            return result;
        };
        var newAppellations = isNew(selectedAppellations, "appellations", vDataSingleton.allAppellations);
        var newProducer = isNew(selectedProducer, "producer", vDataSingleton.allProducers);
        var newBoutique = isNew(selectedBoutique, "boutique", vDataSingleton.allBoutiques);
        var newVarieties = isNew(selectedVarieties, "varieties", vDataSingleton.allVarieties);
        if (wine.name === "") error_html += "<li>" + VLocal.EmptyWineName + "</li>";
        if (null == wine.image || "" === wine.image.url) warning_html += "<li>" + VLocal.EmptyWineLabel + "</li>";
        if (wine.vintage === "") warning_html += "<li>" + VLocal.EmptyVintage + "</li>";
        if (wine.tastingDate === "") warning_html += "<li>" + VLocal.EmptyTastingDate + "</li>";
        if (wine.alcohol === "") warning_html += "<li>" + VLocal.EmptyAlcohol + "</li>";
        if (null == wine.appellations || wine.appellations.lenth == 0 || selectedAppellations.length == 0) warning_html += "<li>" + VLocal.EmptyAppellation + "</li>"; else if (selectedAppellations.length > 0 && newAppellations.length > 0) {
            warning_html += "<li>" + newAppellations[0].name + " " + VLocal.AppellationWillBeCreated + "</li>";
        }
        if (null == wine.producer || selectedProducer.length == 0) warning_html += "<li>" + VLocal.EmptyProducer + "</li>"; else if (selectedProducer.length > 0 && newProducer.length > 0) {
            warning_html += "<li>" + newProducer[0].name + " " + VLocal.ProducerWillBeCreated + "</li>";
        }
        if (null == wine.boutique || selectedBoutique.length == 0) warning_html += "<li>" + VLocal.EmptyBoutique + "</li>"; else if (selectedBoutique.length > 0 && newBoutique.length > 0) {
            warning_html += "<li>" + newBoutique[0].name + " " + VLocal.BoutiqueWillBeCreated + "</li>";
        }
        if (null == wine.varieties || wine.varieties.lenth == 0 || selectedVarieties.length == 0) warning_html += "<li>" + VLocal.EmptyVarieties + "</li>"; else if (selectedVarieties.length > 0 && newVarieties.length > 0) {
            warning_html += "<li>" + newVarieties[0].name + " " + VLocal.VarietyWillBeCreated + "</li>";
        }
        if (wine.isOpen()) {
            if (wine.aromas.length === 0) error_html += "<li>" + VLocal.EmptyAromas + "</li>";
            if (null == wine.intensity) error_html += "<li>" + VLocal.EmptyIntensity + "</li>";
            if (null == wine.color.code) error_html += "<li>" + VLocal.EmptyColor + "</li>";
        }
        var ret = [];
        if (error_html.length - error > 0) ret["errors"] = error_html + "</ul>";
        if (warning_html.length - warning > 0) ret["warnings"] = warning_html + "</ul>";
        ret["producer"] = newProducer;
        ret["boutique"] = newBoutique;
        ret["appellations"] = newAppellations;
        ret["varieties"] = newVarieties;
        return ret;
    }
    static buildSaveFoodErrorUls(food) {
        var error_html = "<ul style='list-style-type:none; color:red'>";
        var error = error_html.length;
        var warning_html = "<ul style='list-style-type: none; color:orange'>";
        var warning = warning_html.length;
        if (food.name === "") error_html += "<li>" + VLocal.EmptyWineName + "</li>";
        if (undefined == food.label || food.label === "") warning_html += "<li>" + VLocal.EmptyWineLabel + "</li>";
        if (food.tags.length === 0) warning_html += "<li>" + VLocal.EmptyTags + "</li>";
        if (food.wines.length === 0) warning_html += "<li>" + VLocal.EmptyWines + "</li>";
        if (undefined == food.color) error_html += "<li>" + VLocal.EmptyColor + "</li>";
        var ret = [];
        if (error_html.length - error > 0) ret["errors"] = error_html + "</ul>";
        if (warning_html.length - warning > 0) ret["warnings"] = warning_html + "</ul>";
        return ret;
    }
}

class VCamera {
    constructor() {
        if (!VCamera.instance) {
            this._data = [];
            VCamera.instance = this;
            this.maxWidth = window.outerWidth;
            this.maxHeight = window.outerHeight, this.active = true;
            this.side = "back";
            this.initialized = false;
        }
        return VCamera.instance;
    }
    init(side) {
        if (this.initialized) {
            this.show(side);
            return;
        }
        this.initialized = true;
        this.side = side;
        this.startCameraBelow(side).then(() => {
            this.showSupportedPictureSizes().then(() => {
                try {
                    CameraPreview.setFlashMode(CameraPreview.FLASH_MODE.OFF);
                } catch (err) {}
                window.addEventListener("touchstart", function(e) {
                    if (!this.active) return;
                    let clientX = e.touches[0].clientX;
                    let clientY = e.touches[0].clientY;
                    try {
                        CameraPreview.tapToFocus(clientX, clientY);
                    } catch (err) {
                        _debug_toast(err, "ERROR");
                    }
                }, false);
            });
        });
    }
    startCameraAbove() {
        return new Promise((resolve, reject) => {
            try {
                CameraPreview.startCamera({
                    x: 50,
                    y: 50,
                    width: 300,
                    height: 300,
                    toBack: false,
                    previewDrag: true,
                    tapPhoto: true
                }, resolve, reject);
            } catch (err) {
                _debug_toast(err, "ERROR");
                reject();
            }
        });
    }
    startCameraBelow(side) {
        return new Promise((resolve, reject) => {
            try {
                CameraPreview.startCamera({
                    camera: side,
                    tapPhoto: false,
                    tapFocus: true,
                    previewDrag: false,
                    toBack: true
                }, () => {
                    CameraPreview.show();
                    resolve();
                }, reject);
            } catch (err) {
                _debug_toast(err, "ERROR");
                reject();
            }
        });
    }
    stopCamera() {
        CameraPreview.stopCamera();
    }
    toDataURL(src) {
        return new Promise((resolve, reject) => {
            var img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = function() {
                var canvas = document.createElement("canvas");
                var ctx = canvas.getContext("2d");
                canvas.height = this.naturalHeight;
                canvas.width = this.naturalWidth;
                ctx.drawImage(this, 0, 0);
                resolve({
                    data: canvas.toDataURL("image/jpeg", .9),
                    width: canvas.width,
                    height: canvas.height
                });
            };
            img.src = src;
            if (img.complete || img.complete === undefined) {
                img.src = "data:image/jpeg;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
                img.src = src;
            }
        });
    }
    browsePicture() {
        return new Promise((resolve, reject) => {
            try {
                if (false && _deviceType() == "apple") {
                    window.imagePicker.getPictures(filePath => {
                        this.toDataURL(filePath).then(image => {
                            var d = new Date();
                            resolve({
                                data: image.data,
                                url: "gallery-" + vServiceSingleton.date_str(d) + "-" + vServiceSingleton.time_str(d) + ".jpg",
                                width: image.width,
                                height: image.height,
                                info: null
                            });
                        });
                    }, function(error) {
                        _release_toast(error);
                        reject();
                    }, {
                        quality: 70,
                        maximumImagesCount: 1
                    });
                } else {
                    navigator.camera.getPicture(imageData => {
                        StatusBar.hide();
                        this.toDataURL("data:image/jpg;base64," + imageData).then(image => {
                            var d = new Date();
                            StatusBar.show();
                            resolve({
                                data: image.data,
                                url: "gallery-" + vServiceSingleton.date_str(d) + "-" + vServiceSingleton.time_str(d) + ".jpg",
                                width: image.width,
                                height: image.height,
                                info: null
                            });
                        });
                    }, () => {
                        StatusBar.show();
                        reject();
                    }, {
                        quality: 70,
                        sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
                        allowEdit: false,
                        destinationType: Camera.DestinationType.DATA_URL
                    });
                }
            } catch (err) {
                StatusBar.show();
                _debug_toast(err, "ERROR");
                resolve("css/splash.png");
            }
        });
    }
    takePicture() {
        return new Promise(resolve => {
            try {
                CameraPreview.takePicture({
                    width: this.maxWidth,
                    height: this.maxHeight,
                    quality: 90
                }, cameraData => {
                    var d = new Date();
                    resolve({
                        data: "data:image/jpg;base64," + cameraData,
                        url: "camera-" + vServiceSingleton.date_str(d) + "-" + vServiceSingleton.time_str(d) + ".jpg",
                        width: this.maxWidth,
                        height: this.maxHeight,
                        info: null
                    });
                });
            } catch (err) {
                _release_toast(err);
                resolve("css/splash.png");
            }
        });
    }
    takeSnapshot() {
        return new Promise(resolve => {
            try {
                CameraPreview.takeSnapshot(function(cameraData) {
                    var d = new Date();
                    resolve({
                        data: "data:image/jpg;base64," + cameraData,
                        url: "snapshot-" + vServiceSingleton.date_str(d) + "-" + vServiceSingleton.time_str(d) + ".jpg",
                        width: window.innerWidth,
                        height: window.innerHeight,
                        info: null
                    });
                });
            } catch (err) {
                _release_toast(err);
                resolve("css/splash.png");
            }
        });
    }
    switchFlash(flash) {
        try {
            flash == "on" ? CameraPreview.setFlashMode(CameraPreview.FLASH_MODE.ON) : CameraPreview.setFlashMode(CameraPreview.FLASH_MODE.OFF);
        } catch (err) {
            _debug_toast(err, "ERROR");
        }
    }
    switchCamera() {
        CameraPreview.switchCamera();
    }
    show(side = "back") {
        this.active = true;
        try {
            if (side != this.side) CameraPreview.switchCamera();
            this.side = side;
            CameraPreview.show();
        } catch (err) {
            _debug_toast(err, "ERROR");
        }
    }
    hide() {
        this.active = false;
        try {
            CameraPreview.hide();
        } catch (err) {
            _debug_toast(err, "ERROR");
        }
    }
    changeFlashMode() {
        var mode = document.getElementById("selectFlashMode").value;
        CameraPreview.setFlashMode(mode);
    }
    changePreviewSize() {
        window.smallPreview = !window.smallPreview;
        if (window.smallPreview) {
            CameraPreview.setPreviewSize({
                width: 100,
                height: 100
            });
        } else {
            CameraPreview.setPreviewSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        }
    }
    showSupportedPictureSizes() {
        return new Promise((resolve, reject) => {
            try {
                CameraPreview.getSupportedPictureSizes(dimensions => {
                    let i = 0;
                    let candidates = [];
                    for (let d of dimensions) {
                        let ratio = d.height / d.width;
                        let size = d.width * d.height;
                        let M = 1e6;
                        let ideal = 1280 * 720;
                        if (String(ratio) == "0.5625" && size == ideal) {
                            this.maxWidth = d.width;
                            this.maxHeight = d.height;
                            candidates = [];
                            break;
                        } else if (size > .75 * ideal && size < 1.25 * ideal) {
                            candidates.push(d);
                        }
                    }
                    for (let c of candidates) {
                        let ratio = c.height / c.width;
                        if (String(ratio) == "0.5625") {
                            this.maxWidth = c.width;
                            this.maxHeight = d.height;
                            candidates = [];
                            break;
                        }
                    }
                    if (candidates.length > 0) {
                        this.maxWidth = c[0].width;
                        this.maxHeight = c[0].height;
                    }
                    resolve();
                }, resolve);
            } catch (err) {
                this.maxWidth = window.outerWidth;
                this.maxHeight = window.outerHeight;
                resolve();
                _debug_toast(err, "ERROR");
            }
        });
    }
}

const vCameraSingleton = new VCamera();

class VRadar {
    constructor() {}
    generateChart(wine, title = "", id = wine.nid, target = "chart-target-" + id) {
        return new Promise(function(resolve, reject) {
            try {
                var radarChart = echarts.init(document.getElementById(target));
                var complexity = wine.aromas.length;
                var max_complexity = 10;
                for (let aroma of wine.aromas) {
                    if (complexity < max_complexity) {
                        if (undefined !== wine.aromas && undefined === wine.aromas.children) complexity += 1;
                    }
                }
                if (complexity > max_complexity) complexity = max_complexity;
                radarChart.setOption({
                    tooltip: null,
                    radar: {
                        shape: "circle",
                        startAngle: 68,
                        name: {
                            color: "#fff",
                            backgroundColor: VIVID67,
                            borderRadius: 3,
                            padding: [ 3, 5 ]
                        },
                        indicator: [ {
                            name: VLocal.Acidity,
                            min: 0,
                            max: 5
                        }, {
                            name: VLocal.Salt,
                            min: 0,
                            max: 3
                        }, {
                            name: VLocal.Bitterness,
                            min: 0,
                            max: 3
                        }, {
                            name: VLocal.Body,
                            min: 0,
                            max: 5
                        }, {
                            name: VLocal.Persistence,
                            min: 0,
                            max: 5
                        }, {
                            name: VLocal.Complexity,
                            min: 0,
                            max: max_complexity
                        }, {
                            name: VLocal.Astringency,
                            min: 0,
                            max: 5
                        }, {
                            name: VLocal.Tannins,
                            min: 0,
                            max: 5
                        } ],
                        center: [ "50%", "50%" ],
                        radius: 60,
                        splitArea: {
                            areaStyle: {
                                color: [ "#ffffffe0", "#FCF6E8e0" ],
                                shadowColor: "rgba(0, 0, 0, 0.3)",
                                shadowBlur: 10
                            }
                        },
                        axisLine: {
                            lineStyle: {
                                color: "rgba(255, 255, 255, 0.5)"
                            }
                        },
                        splitLine: {
                            lineStyle: {
                                color: "rgba(255, 255, 255, 0.5)"
                            }
                        }
                    },
                    series: [ {
                        axisName: "Wine qualities",
                        type: "radar",
                        symbol: "none",
                        data: [ {
                            value: [ wine.acid, wine.salt, wine.bitter, wine.body, wine.persistence, complexity, wine.astr, wine.tannins ],
                            name: wine.name
                        } ],
                        areaStyle: {
                            opacity: .9,
                            color: new echarts.graphic.RadialGradient(.5, .5, 1, [ {
                                color: VIVID10,
                                offset: 0
                            }, {
                                color: VIVID67,
                                offset: 1
                            } ])
                        },
                        itemStyle: {
                            color: VIVID
                        }
                    } ]
                });
                resolve();
            } catch (err) {
                console.log(err);
                resolve();
            }
        });
    }
    generateEditableChart(product, targetDiv, title = "Taste") {
        return new Promise(function(resolve, reject) {
            var tasteData = product.getTasteArray();
            var tasteKeys = product.getTasteKeys();
            try {
                setTimeout(() => {
                    var tasteIndicator = product.getType() == "wine" ? [ {
                        name: VLocal.Acidity,
                        min: 0,
                        max: 5
                    }, {
                        name: VLocal.Bitterness,
                        min: 0,
                        max: 3
                    }, {
                        name: VLocal.Salt,
                        min: 0,
                        max: 3
                    }, {
                        name: VLocal.Sugar,
                        min: 0,
                        max: 5
                    }, {
                        name: VLocal.Body,
                        min: 0,
                        max: 5
                    }, {
                        name: VLocal.Persistence,
                        min: 0,
                        max: 5
                    }, {
                        name: VLocal.Gas,
                        min: 0,
                        max: 3
                    }, {
                        name: VLocal.Tannins,
                        min: 0,
                        max: 5
                    }, {
                        name: VLocal.Astringency,
                        min: 0,
                        max: 5
                    } ] : [ {
                        name: VLocal.Acidity,
                        min: 0,
                        max: 5
                    }, {
                        name: VLocal.Bitterness,
                        min: 0,
                        max: 3
                    }, {
                        name: VLocal.Salt,
                        min: 0,
                        max: 3
                    }, {
                        name: VLocal.Sugar,
                        min: 0,
                        max: 4
                    }, {
                        name: VLocal.Fat,
                        min: 0,
                        max: 4
                    }, {
                        name: VLocal.Spiciness,
                        min: 0,
                        max: 4
                    } ];
                    var radarChart = echarts.init(document.getElementById(targetDiv));
                    var symbolSize = 10;
                    radarChart.setOption({
                        tooltip: null,
                        radar: {
                            shape: "circle",
                            startAngle: tasteData.length == 9 ? 90 : 60,
                            axisNameGap: -40,
                            name: {
                                color: "#fff",
                                backgroundColor: VIVID67,
                                borderRadius: 3,
                                padding: [ 5, 5 ]
                            },
                            indicator: tasteIndicator,
                            center: [ "50%", "50%" ],
                            radius: "95%",
                            splitArea: {},
                            axisLine: {
                                lineStyle: {
                                    color: "rgba(255, 255, 255, 0.5)"
                                }
                            },
                            splitLine: {
                                lineStyle: {
                                    color: "rgba(255, 255, 255, 0.5)"
                                }
                            }
                        },
                        series: [ {
                            id: "taste-radar",
                            name: title,
                            type: "radar",
                            data: [ {
                                value: tasteData,
                                name: title
                            } ],
                            symbolSize: symbolSize,
                            areaStyle: {
                                opacity: .9,
                                color: new echarts.graphic.RadialGradient(.5, .5, 1, [ {
                                    color: VIVID10,
                                    offset: 0
                                }, {
                                    color: VIVID67,
                                    offset: 1
                                } ])
                            },
                            itemStyle: {
                                color: VIVID
                            }
                        } ]
                    });
                    setTimeout(() => {
                        radarChart.setOption({
                            graphic: echarts.util.map(tasteData, function(item, dataIndex) {
                                return {
                                    type: "circle",
                                    x: radarChart._coordSysMgr._coordinateSystems[0].dataToPoint(item, dataIndex)[0],
                                    y: radarChart._coordSysMgr._coordinateSystems[0].dataToPoint(item, dataIndex)[1],
                                    color: "yellow",
                                    shape: {
                                        cx: 0,
                                        cy: 0,
                                        r: symbolSize * 2
                                    },
                                    invisible: true,
                                    draggable: true,
                                    ondrag: echarts.util.curry(onPointDragging, dataIndex),
                                    onmousedown: () => {
                                        document.getElementById("edit-" + product.getType() + "-tabbar").swipeable = false;
                                    },
                                    onmouseup: () => {
                                        document.getElementById("edit-" + product.getType() + "-tabbar").swipeable = true;
                                    },
                                    z: 100
                                };
                            })
                        });
                    }, 100);
                    function onPointDragging(dataIndex, dx, dy) {
                        var newData = radarChart._coordSysMgr._coordinateSystems[0].pointToData([ this.x, this.y ]);
                        if (newData[1] == tasteData[dataIndex] || newData[1] < radarChart._coordSysMgr._coordinateSystems[0]._indicatorAxes[dataIndex].model.option.min || newData[1] > radarChart._coordSysMgr._coordinateSystems[0]._indicatorAxes[dataIndex].model.option.max) {} else {
                            tasteData[dataIndex] = newData[1];
                            var taste = Math.ceil(tasteData[dataIndex]);
                            product.setTaste(tasteKeys[dataIndex], taste);
                        }
                        var point = radarChart._coordSysMgr._coordinateSystems[0].dataToPoint(tasteData[dataIndex], dataIndex);
                        this.x = point[0];
                        this.y = point[1];
                        radarChart.setOption({
                            series: [ {
                                id: "taste-radar",
                                data: [ {
                                    value: tasteData,
                                    name: title
                                } ]
                            } ]
                        });
                    }
                    resolve();
                }, 0);
            } catch (err) {
                console.log(err);
                resolve();
            }
        });
    }
}

class VData {
    constructor() {
        if (!VData.instance) {
            this._data = [];
            VData.instance = this;
        }
        return VData.instance;
    }
    selectedWines = [];
    wineColors = {
        red: [],
        white: [],
        rose: []
    };
    allVarieties = [];
    allProducers = [];
    allAppellations = [];
    allHierarchies = [];
    aromasSeries = [];
    foodSeries = [];
    selectedAromasIds = [];
    selectedFoodIds = [];
    allFood = [];
    allAromas = [];
    allUsers = [];
    allBoutiques = [];
    remoteDataIndex = 0;
    remoteDataNumber = 8;
    flattern(series, target) {
        for (let item of series) {
            if (!item.children) {
                let a = {};
                if (undefined === item.label.rich.image.backgroundColor.image.src) {
                    a.img = item.label.rich.image.backgroundColor.image;
                } else {
                    a.img = item.label.rich.image.backgroundColor.image.src;
                }
                a.tid = item.tid;
                a.name = item.name;
                target.push(a);
            } else this.flattern(item.children, target);
        }
    }
    setColors(data) {
        var colorFamilies = [ "red", "white", "rose" ];
        var colorFamily = "";
        var firstColorCode = "";
        var i = 0;
        this.wineColors = {
            red: [],
            white: [],
            rose: []
        };
        for (let color of data) {
            if (parseInt(color.tid) < 4) {
                colorFamily = colorFamilies[parseInt(color.tid) - 1];
                i = 0;
                continue;
            }
            if (color.code == "") color.code = firstColorCode;
            if (colorFamily == "red") this.wineColors.red.push(color); else if (colorFamily == "white") this.wineColors.white.push(color); else if (colorFamily == "rose") this.wineColors.rose.push(color);
            if (i == 0) firstColorCode = color.code;
            i++;
        }
        this.setCache("wineColors", this.wineColors);
    }
    setHierarchies(hierarchies) {
        for (let hierarchy of hierarchies) {
            if (hierarchy.pid === "") {
                hierarchy.children = [];
                this.allHierarchies.push(hierarchy);
            }
        }
        function recur(parents) {
            for (let parent of parents) {
                var i = 0;
                for (let hierarchy of hierarchies) {
                    if (parent.tid == hierarchy.pid) {
                        hierarchy.children = [];
                        parent.children.push(hierarchy);
                    }
                }
            }
        }
        recur(this.allHierarchies);
        this.setCache("allHierarchies", this.allHierarchies);
    }
    getFullHierarchy(element, series) {
        let taxonomy = [ element ];
        recur(taxonomy[0].pid);
        function recur(pid) {
            var a = series.find(d => parseInt(d.tid) == parseInt(pid));
            if (undefined !== a) {
                taxonomy.push(a);
                recur(a.pid);
            } else return;
        }
        return taxonomy.reverse();
    }
    setSeries(results, path) {
        var Mb = Math.round(vServiceSingleton.byteLength(JSON.stringify(results)) / 1024) / 1e3;
        _debug_toast(path + " results size is " + Mb + "Mb", "DEBUG");
        vBench.begin(path + " flattern");
        var series = [];
        var index = 0;
        for (let result of results) {
            result.name = result.name.replace(/&amp;/g, "&");
            if (result.pid === "") {
                let a = {
                    name: result.name,
                    img: result.img,
                    tid: result.tid,
                    pid: 0,
                    label: {
                        position: "inside"
                    },
                    children: []
                };
                series.push(a);
            }
            index++;
        }
        function recur(parents) {
            for (let parent of parents) {
                var i = 0;
                for (let result of results) {
                    if (parent.tid == result.pid) {
                        let a = {
                            name: result.name,
                            img: result.img,
                            tid: result.tid,
                            pid: result.pid,
                            children: [],
                            label: {
                                position: "inside",
                                align: "center",
                                formatter: null,
                                rich: null
                            }
                        };
                        if (path == "foodapp" && undefined !== result.salt) {
                            a.salt = parseInt(result.salt) - 1;
                            a.bitterness = parseInt(result.bitterness) - 1;
                            a.sugar = parseInt(result.sugar) - 1;
                            a.acidity = parseInt(result.acidity) - 1;
                            a.spiciness = parseInt(result.spiciness) - 1;
                            a.aromas = result.aromas;
                            a.fat = parseInt(result.fat) - 1;
                            a.description = result.description;
                        }
                        parent.children.push(a);
                        i++;
                    }
                }
                if (i > 0) recur(parent.children); else {
                    parent.value = 1;
                    parent.label.align = "center";
                    parent.label.rotate = 0;
                    parent.label.rich = {
                        title: {
                            align: "center",
                            fontStyle: "normal",
                            fontWeight: "100"
                        },
                        image: {
                            height: 40,
                            align: "right",
                            backgroundColor: {
                                image: parent.img
                            }
                        }
                    };
                    delete parent.img;
                    delete parent.children;
                }
            }
        }
        recur(series);
        vBench.end(path + " flattern");
        if (path == "aromasapp") {
            this.aromasSeries = series;
            this.setCache("aromasSeries", this.aromasSeries);
            this.flattern(this.aromasSeries, this.allAromas);
        } else if (path == "foodapp") {
            this.foodSeries = series;
            this.setCache("foodSeries", this.foodSeries);
            this.flattern(this.foodSeries, this.allFood);
        }
    }
    clearCache() {
        this.allVarieties = [];
        this.allProducers = [];
        this.allBoutiques = [];
        this.allAppellations = [];
        this.aromasSeries = [];
        this.foodSeries = [];
        this.wineColors = {
            red: [],
            white: [],
            rose: []
        };
        this.removeCache("foodSeries");
        this.removeCache("aromasSeries");
        this.removeCache("wineColors");
        this.removeCache("allVarieties");
        this.removeCache("allAppellations");
        this.removeCache("allHierarchies");
        this.removeCache("allProducers");
        this.removeCache("allBoutiques");
        this.remoteDataIndex = 0;
        this.removeCache("allUsers");
    }
    removeCache(name) {
        localStorage.removeItem(name + "_cached");
        var MbTotal = Math.round(JSON.stringify(localStorage) / 1024) / 1e3;
        _debug_toast(name + " is removed from storage, total size is " + MbTotal + "Mb", "debug");
    }
    setCache(name, data) {
        try {
            localStorage.setItem(name + "_cached", JSON.stringify(data));
            var Mb = Math.round(vServiceSingleton.byteLength(JSON.stringify(data)) / 1024) / 1e3;
            var MbTotal = Math.round(vServiceSingleton.byteLength(JSON.stringify(localStorage)) / 1024) / 1e3;
            _debug_toast(name + " storage size is " + Mb + "Mb of total " + MbTotal, "debug");
        } catch (err) {
            _debug_toast(err, "error");
        }
    }
    getCache(name) {
        try {
            let obj = JSON.parse(localStorage.getItem(name + "_cached"));
            var Mb = Math.round(vServiceSingleton.byteLength(localStorage.getItem(name + "_cached")) / 1024) / 1e3;
            var MbTotal = Math.round(vServiceSingleton.byteLength(JSON.stringify(localStorage)) / 1024) / 1e3;
            _debug_toast(name + " storage size is " + Mb + "Mb of total " + MbTotal, "debug");
            return obj;
        } catch (err) {
            _debug_toast(err, "error");
            return null;
        }
    }
    loadCache() {
        var foodSeries_cached = this.getCache("foodSeries");
        if (null !== foodSeries_cached) {
            this.foodSeries = foodSeries_cached;
            this.remoteDataIndex++;
            this.flattern(this.foodSeries, this.allFood);
        }
        var aromasSeries_cached = this.getCache("aromasSeries");
        if (null !== aromasSeries_cached) {
            this.aromasSeries = aromasSeries_cached;
            this.remoteDataIndex++;
            this.flattern(this.aromasSeries, this.allAromas);
        }
        var wineColors_cached = this.getCache("wineColors");
        if (null !== wineColors_cached) {
            this.wineColors = wineColors_cached;
            this.remoteDataIndex++;
        }
        var allVarieties_cached = this.getCache("allVarieties");
        if (null !== allVarieties_cached) {
            this.allVarieties = allVarieties_cached;
            this.remoteDataIndex++;
        }
        var allAppellations_cached = this.getCache("allAppellations");
        if (null !== allAppellations_cached) {
            this.allAppellations = allAppellations_cached;
            this.remoteDataIndex++;
        }
        var allHierarchies_cached = this.getCache("allHierarchies");
        if (null !== allHierarchies_cached) {
            this.allHierarchies = allHierarchies_cached;
            this.remoteDataIndex++;
        }
        var allProducers_cached = this.getCache("allProducers");
        if (null !== allProducers_cached) {
            this.allProducers = allProducers_cached;
        }
        var allBoutiques_cached = this.getCache("allBoutiques");
        if (null !== allBoutiques_cached) {
            this.allBoutiques = allBoutiques_cached;
        }
    }
    checkIfLoaded() {
        if (this.remoteDataIndex >= this.remoteDataNumber) {
            if (this.remoteDataIndex != this.remoteDataNumber) {
                _debug_toast("this.remoteDataIndex=" + this.remoteDataIndex, "error");
            }
            return true;
        } else {
            return false;
        }
    }
    searchSeriesById(id, series) {
        var item = series.find(item => parseInt(item.tid) == parseInt(id));
        if (undefined === item) {
            for (let parent of series) {
                if (undefined !== parent.children) item = this.searchSeriesById(id, parent.children);
                if (undefined !== item) {
                    break;
                }
            }
            return item;
        } else {
            return item;
        }
    }
    findColorById(tid) {
        for (let color of this.wineColors.red) {
            if (color.tid == tid) return color;
        }
        for (let color of this.wineColors.white) {
            if (color.tid == tid) return color;
        }
        for (let color of this.wineColors.rose) {
            if (color.tid == tid) return color;
        }
        return null;
    }
    setSelectedWines(wines) {
        vDataSingleton.selectedWines = wines;
        for (let wine of vDataSingleton.selectedWines) {
            var wineAromaIds = wine.aromas.split(",");
            wine.aromas = [];
            for (let wineAromaId of wineAromaIds) {
                var aromaObject = vDataSingleton.searchSeriesById(wineAromaId, vDataSingleton.aromasSeries);
                if (aromaObject && undefined !== aromaObject) wine.aromas.push(aromaObject);
            }
            var appellationIds = wine.appellations.split(",");
            wine.appellations = [];
            for (let appellationId of appellationIds) {
                var appellationObject = vDataSingleton.allAppellations.find(appellation => parseInt(appellation.tid) === parseInt(appellationId));
                if (appellationObject && undefined !== appellationObject) {
                    wine.appellations.push(appellationObject);
                }
            }
            wine.color = vDataSingleton.findColorById(wine.color);
            var varietiesIds = wine.varieties.split(",");
            wine.varieties = [];
            for (let varietiesId of varietiesIds) {
                var varietyObject = vDataSingleton.allVarieties.find(variety => parseInt(variety.tid) === parseInt(varietiesId));
                if (varietyObject && undefined !== varietyObject) {
                    wine.varieties.push(varietyObject);
                }
            }
        }
    }
    getWineById(nid) {
        return vDataSingleton.selectedWines.find(selectedWine => parseInt(selectedWine.nid) === parseInt(nid));
    }
}

const vDataSingleton = new VData();

class VDrupal {
    constructor() {
        if (!VDrupal.instance) {
            this._data = [];
            VDrupal.instance = this;
        }
        return VDrupal.instance;
    }
    getWines(filter) {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad("winesapp/" + filter + "?_format=json").then(view => {
                vDataSingleton.setSelectedWines(view.getResults());
                resolve();
            });
        });
    }
    getColorsOnline() {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad("colorsapp/" + vUserSingleton.settings.langcode + "?_format=json").then(function(view) {
                var results = view.getResults();
                vDataSingleton.setColors(results);
                resolve();
            });
        });
    }
    getVarietesOnline() {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad("varietiesapp/" + "?_format=json").then(function(view) {
                vDataSingleton.allVarieties = view.getResults();
                vDataSingleton.setCache("allVarieties", vDataSingleton.allVarieties);
                resolve();
            });
        });
    }
    getProducersOnline() {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad("producersapp/" + "?_format=json").then(function(view) {
                vDataSingleton.allProducers = view.getResults();
                vDataSingleton.setCache("allProducers", vDataSingleton.allProducers);
                resolve();
            });
        });
    }
    getBoutiquesOnline() {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad("boutiquesapp/" + "?_format=json").then(function(view) {
                vDataSingleton.allBoutiques = view.getResults();
                vDataSingleton.setCache("allBoutiques", vDataSingleton.allBoutiques);
                resolve();
            });
        });
    }
    getAppellationsOnline() {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad("appellationsapp/" + "?_format=json").then(function(view) {
                vDataSingleton.allAppellations = view.getResults();
                vDataSingleton.setCache("allAppellations", vDataSingleton.allAppellations);
                resolve();
            });
        });
    }
    getHierarchiesOnline() {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad("hierarchiesapp/" + vUserSingleton.settings.langcode + "?_format=json").then(function(view) {
                var hierarchies = view.getResults();
                vDataSingleton.setHierarchies(hierarchies);
                resolve();
            });
        });
    }
    getSeriesOnline(path) {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad(path + "/" + vUserSingleton.settings.langcode + "?_format=json").then(function(view) {
                var results = view.getResults();
                vDataSingleton.setSeries(results, path);
                resolve();
            });
        });
    }
    getSessionToken() {
        return new Promise((resolve, reject) => {
            var ajaxRequest = $.ajax({
                url: jDrupal.restPath() + "session/token?_format=json",
                type: "GET",
                success: function(result) {
                    resolve(result);
                },
                error: function(jqXHR, textStatus) {
                    if (DEBUG_MODE) console.log(textStatus);
                    _release_toast(VLocal.ServerGetResultsError);
                    reject();
                }
            });
        });
    }
    userLogin(name, pass) {
        return new Promise((resolve, reject) => {
            var ajaxRequest = $.ajax({
                url: jDrupal.restPath() + "user/login?_format=json",
                type: "POST",
                data: JSON.stringify({
                    name: name,
                    pass: pass
                }),
                success: function(result) {
                    jDrupal.userLoad(result.current_user.uid).then(user => {
                        resolve(user);
                    });
                },
                error: function(jqXHR, textStatus) {
                    if (DEBUG_MODE) console.log(textStatus);
                    _release_toast(VLocal.ServerGetResultsError);
                    reject();
                }
            });
        });
    }
    getUsersOnline() {
        return new Promise(function(resolve, reject) {
            jDrupal.viewsLoad("allusersapp?_format=json").then(function(view) {
                vDataSingleton.allUsers = view.getResults();
                vDataSingleton.setCache("allUsers", vDataSingleton.allUsers);
                resolve();
            });
        });
    }
    getServerData() {
        return new Promise((resolve, reject) => {
            if (vDataSingleton.aromasSeries.length === 0) {
                this.getSeriesOnline("aromasapp").then(() => {
                    vDataSingleton.remoteDataIndex++;
                });
            }
            this.getBoutiquesOnline().then(() => {
                vDataSingleton.remoteDataIndex++;
                if (vDataSingleton.checkIfLoaded()) resolve();
            });
            this.getProducersOnline().then(() => {
                vDataSingleton.remoteDataIndex++;
                if (vDataSingleton.checkIfLoaded()) resolve();
            });
            if (vDataSingleton.wineColors.red.length === 0) {
                this.getColorsOnline().then(() => {
                    vDataSingleton.remoteDataIndex++;
                    if (vDataSingleton.checkIfLoaded()) resolve();
                });
            }
            if (vDataSingleton.allVarieties.length === 0) {
                this.getVarietesOnline().then(() => {
                    vDataSingleton.remoteDataIndex++;
                    if (vDataSingleton.checkIfLoaded()) resolve();
                });
            }
            if (vDataSingleton.allAppellations.length === 0) {
                this.getAppellationsOnline().then(() => {
                    vDataSingleton.remoteDataIndex++;
                    if (vDataSingleton.checkIfLoaded()) resolve();
                });
            }
            if (vDataSingleton.allHierarchies.length === 0) {
                this.getHierarchiesOnline().then(() => {
                    vDataSingleton.remoteDataIndex++;
                    if (vDataSingleton.checkIfLoaded()) resolve();
                });
            }
            if (vDataSingleton.foodSeries.length === 0) {
                this.getSeriesOnline("foodapp").then(() => {
                    vDataSingleton.remoteDataIndex++;
                    if (vDataSingleton.checkIfLoaded()) resolve();
                });
            }
            this.getUsersOnline();
            if (vDataSingleton.checkIfLoaded()) resolve();
        });
    }
    deleteNode(node, nid) {
        return new Promise(function(resolve, reject) {
            node.delete(nid).then(() => {
                _release_toast(VLocal.WineDeleted);
                VMain.modalHide();
                if (nid == -1) {
                    VMain.popPage().then(() => {
                        VMain.popPage().then(resolve);
                    });
                } else resolve(nid);
            }, () => {
                _release_toast(VLocal.ServerGetResultsError);
                VMain.modalHide();
                reject();
            });
        });
    }
    postComment(text, nid) {
        return new Promise(function(resolve, reject) {
            var comment = new jDrupal.Comment({
                entity_id: [ {
                    target_id: nid
                } ],
                entity_type: [ {
                    value: "node"
                } ],
                comment_type: [ {
                    target_id: "wine_comments"
                } ],
                subject: [ {
                    value: text
                } ],
                comment_body: [ {
                    value: text,
                    format: "plain_text"
                } ],
                field_name: [ {
                    value: "comment"
                } ]
            });
            comment.save().then(() => {
                resolve();
                _release_toast("comment saved");
            }, err => {
                _release_toast(JSON.stringify(err));
                reject();
            });
        });
    }
    uploadImage(image, path) {
        return new Promise((resolve, reject) => {
            if (image.data == image.url) {
                resolve(null);
                return;
            }
            VMain.modalShow("modal-save-wine").then(() => {
                let tokenReady = () => {
                    var saveProgressStatus = document.getElementById("wine-save-progress-status");
                    saveProgressStatus.style = "display:block";
                    var ajaxRequest = $.ajax({
                        url: path,
                        type: "POST",
                        data: vServiceSingleton.dataURItoBlob(image.data),
                        processData: false,
                        crossDomain: false,
                        timeout: 3e4,
                        cache: false,
                        headers: {
                            "X-CSRF-Token": vUserSingleton.settings.csrfToken,
                            "Content-Type": "application/octet-stream",
                            Accept: "application/vnd.api+json",
                            "Content-Disposition": 'form-data; filename="' + image.url + '"'
                        },
                        success: result => {
                            VMain.modalHide();
                            resolve(result.data);
                        },
                        xhr: () => {
                            var Mb = Math.round(vServiceSingleton.byteLength(image.data) / 1024) / 1e3;
                            _debug_toast("image data size : " + Mb + "Mb");
                            try {
                                var xhr = new XMLHttpRequest();
                                xhr.upload.onprogress = function(evt) {};
                                return xhr;
                            } catch (err) {
                                _debug_toast_err(err);
                            }
                        },
                        error: (jqXHR, textStatus) => {
                            VMain.modalHide();
                            if (DEBUG_MODE) console.log(textStatus);
                            if (textStatus === "timeout") {
                                _release_toast(VLocal.UploadTimeout);
                            } else {
                                _release_toast(VLocal.ServerGetResultsError);
                            }
                            reject();
                        }
                    });
                };
                if (null == vUserSingleton.settings.csrfToken || "" == vUserSingleton.settings.csrfToken) {
                    this.getSessionToken().then(() => {
                        vUserSingleton.settings.csrfToken = csrfToken;
                        tokenReady();
                    });
                } else {
                    tokenReady();
                }
            });
        });
    }
    uploadImageCordova(image, path) {
        return new Promise((resolve, reject) => {
            try {
                var config = {};
                var uploader = FileTransferManager.init(config, function(event) {
                    console.log(event);
                    if (event.state == "UPLOADED") {
                        console.log("upload: " + event.id + " has been completed successfully");
                        console.log(event.statusCode, event.serverResponse);
                        resolve(event);
                    } else if (event.state == "FAILED") {
                        if (event.id) {
                            console.log("upload: " + event.id + " has failed");
                        } else {
                            console.error("uploader caught an error: " + event.error);
                        }
                        reject();
                    } else if (event.state == "UPLOADING") {
                        progressValue = event.loaded / event.total;
                        WaveProgress.setProgress(event * 100);
                        console.log("uploading: " + event.id + " progress: " + event.progress + "%");
                    }
                });
                var payload = {
                    id: image.url,
                    filePath: "file://" + vServiceSingleton.dataURItoBlob(image.data),
                    fileKey: "file",
                    serverUrl: path,
                    notificationTitle: "Uploading images",
                    headers: {
                        "X-CSRF-Token": vUserSingleton.settings.csrfToken,
                        "Content-Type": "application/octet-stream",
                        Accept: "application/vnd.api+json",
                        "Content-Disposition": 'form-data; filename="' + image.url + '"'
                    }
                };
                uploader.startUpload(payload);
            } catch (err) {
                _release_toast("FileTransferManager plugin failed:<br>" + err);
                reject();
            }
        });
    }
    uploadImageCordovaX(ft, image, path) {
        return new Promise((resolve, reject) => {
            function win(r) {
                _release_toast("Code = " + r.responseCode + "<br>" + "Response = " + r.response + "<br>" + "Sent = " + r.bytesSent);
                resolve(r.response);
            }
            function fail(error) {
                _release_toast("An error has occurred: Code = " + error.code + "<br>" + "upload error source " + error.source + "<br>" + "upload error target " + error.target + r.bytesSent);
                reject();
            }
            var uri = encodeURI(path);
            var options = new FileUploadOptions();
            options.fileName = image.url;
            options.mimeType = "application/octet-stream";
            options.httpMethod = "POST";
            var headers = {
                "X-CSRF-Token": vUserSingleton.settings.csrfToken,
                "Content-Type": "application/octet-stream",
                Accept: "application/vnd.api+json",
                "Content-Disposition": 'form-data; filename="' + image.url + '"'
            };
            options.headers = headers;
            var progressValue = 0;
            ft.onprogress = function(progressEvent) {
                if (progressEvent.lengthComputable) {
                    progressValue = progressEvent.loaded / progressEvent.total;
                } else {
                    progressValue++;
                }
                WaveProgress.setProgress(progressValue * 100);
            };
            let fileURL = vServiceSingleton.dataURItoBlob(image.data);
            ft.upload(fileURL, uri, win, fail, options);
        });
    }
    saveTag(tagPayload) {
        return new Promise((resolve, reject) => {
            var ajaxRequest = $.ajax({
                url: jDrupal.restPath() + "taxonomy/term",
                type: "POST",
                data: JSON.stringify(tagPayload),
                processData: true,
                crossDomain: false,
                timeout: 1e4,
                cache: false,
                headers: {
                    "X-CSRF-Token": vUserSingleton.settings.csrfToken,
                    "Content-Type": "application/json",
                    Accept: "application/vnd.api+json"
                },
                success: result => {
                    resolve(result);
                },
                error: (jqXHR, textStatus) => {
                    if (DEBUG_MODE) console.log(textStatus);
                    if (textStatus === "timeout") {
                        _release_toast(VLocal.UploadTimeout);
                    } else {
                        _release_toast(VLocal.ServerGetResultsError);
                    }
                    reject();
                }
            });
        });
    }
    hook_rest_pre_process(xhr, data) {
        console.log(xhr);
        console.log(data);
    }
}

const vDrupalSingleton = new VDrupal();

Object.freeze(vDrupalSingleton);

class VAbstractProduct {
    constructor(type) {
        this.type = type;
    }
    setCallback(callback) {
        this.callback = callback;
    }
    getType() {
        return this.type;
    }
    getId() {
        return this.nid;
    }
    setName(name) {
        this.name = name;
    }
    getName() {
        return "" === this.name ? "" : this.name;
    }
    getAuthor() {
        return this.author;
    }
    getPrice() {
        return this.price;
    }
    setPrice(price) {
        this.price = price;
    }
    getAuthorPic() {
        return this.getAuthor().pic == "" ? "css/logo.png" : this.getAuthor().pic;
    }
    getAuthorName() {
        return this.getAuthor().name;
    }
    isEditable() {
        return this.editable;
    }
    getDate() {
        return this.publishDate;
    }
    getImage() {
        return this.image;
    }
    getConclusion() {
        return null == this.conclusion ? "" : this.conclusion;
    }
    setConclusion(conclusion) {
        this.conclusion = conclusion;
    }
    getTaste() {
        return this.taste;
    }
    getTasteByKey(key) {
        return this.taste[key];
    }
    getTasteKeys() {}
    getTasteArray() {
        var tasteData = [];
        for (let key of this.getTasteKeys()) {
            tasteData.push(this.getTasteByKey(key));
        }
        return tasteData;
    }
    setTaste(key, value) {
        this.taste[key] = value;
    }
    setImage(img) {
        this.image = img;
    }
    getBoutique() {
        return this.boutique;
    }
    getBoutiqueId() {
        if (null != this.boutique && this.boutique.length > 0) {
            return this.boutique.map(boutique => boutique ? boutique.tid : null)[0];
        } else return null;
    }
    getBoutiqueLocation() {
        if (null != this.boutique && this.boutique.length > 0) {
            return this.boutique.map(boutique => boutique ? boutique.location : null)[0];
        } else return null;
    }
    getBoutiqueName() {
        if (null != this.boutique && this.boutique.length > 0) {
            return this.boutique.map(boutique => boutique ? boutique.name : "").join(", ");
        } else return "";
    }
    getProducer() {
        return this.producer;
    }
    getProducerId() {
        if (null != this.producer && this.producer.length > 0) {
            return this.producer.map(producer => producer ? producer.tid : null)[0];
        } else return null;
    }
    getProducerLocation() {
        if (null != this.producer && this.producer.length > 0) {
            return this.producer.map(producer => producer ? producer.location : null)[0];
        } else return null;
    }
    getProducerText() {
        if (null != this.producer && this.producer.length > 0) {
            return this.producer.map(producer => producer ? producer.name : "").join(", ");
        } else return "";
    }
    getAppellations() {
        return this.appellations;
    }
    getAppellationsText() {
        if (null != this.appellations && this.appellations.length > 0) {
            return this.appellations.map(appellation => appellation ? appellation.name : "").join(", ");
        } else return "";
    }
    getAppellationsIds() {
        if (null != this.appellations && this.appellations.length > 0) {
            return this.appellations.map(appellation => appellation ? appellation.tid : null);
        } else return [];
    }
    updateSelectedAromas(aromasIds) {
        this.aromas = [];
        if (aromasIds.length == 0) return;
        for (var id of aromasIds) {
            var aroma = vDataSingleton.searchSeriesById(id, vDataSingleton.aromasSeries);
            this.aromas.push({
                name: aroma.name,
                tid: id
            });
        }
    }
    getAromas() {
        return this.aromas;
    }
    getAromasIds() {
        return this.aromas.map(a => a.tid);
    }
    validate(check) {
        var errorHTML = "";
        var buttonLabels = [];
        if (undefined == check["errors"] && undefined == check["warnings"]) {
            this.save();
        } else {
            if (undefined !== check["errors"]) {
                buttonLabels.push(VLocal.Ok);
                errorHTML = check["errors"] + check["warnings"];
            } else {
                errorHTML = check["warnings"];
                buttonLabels.push(VLocal.Cancel);
                buttonLabels.push(VLocal.Save);
            }
            ons.notification.confirm({
                title: VLocal.IncompleteInformation,
                messageHTML: errorHTML,
                buttonLabels: buttonLabels,
                cancelable: false,
                primaryButtonIndex: 1
            }).then(input => {
                if (input == 1) this.save(check);
            });
        }
    }
    delete(wid = -1) {
        ons.notification.confirm({
            title: "",
            messageHTML: this.name + " " + VLocal.WillBeDeleted,
            buttonLabels: [ VLocal.Cancel, VLocal.Delete ],
            cancelable: true,
            primaryButtonIndex: 1
        }).then(input => {
            console.log(input);
            if (input == 1) {
                VMain.modalShow("modal-custom");
                if (wid == -1) {
                    vDrupalSingleton.deleteNode(this.node, this.nid).then(() => {
                        if (this.callback) this.callback();
                    });
                } else {
                    jDrupal.entityLoad("node", wid).then(n => {
                        vDrupalSingleton.deleteNode(n, wid).then(() => {
                            if (this.callback) this.callback();
                        });
                    });
                }
            }
        });
    }
    createTag(target, tagToCreate) {
        return new Promise((resolve, reject) => {
            if (tagToCreate.name === "") {
                resolve();
            } else {
                var name = tagToCreate.name.replace(/\s\s+/g, " ");
                var field_name = "";
                let tagPayload = {};
                if (target == "producer" || target == "boutique") {
                    field_name = "field_" + target;
                    tagPayload = {
                        vid: [ {
                            target_id: target
                        } ],
                        name: [ {
                            value: name
                        } ],
                        field_latlng: [ {
                            lat: tagToCreate.location.lat,
                            lng: tagToCreate.location.lng
                        } ],
                        field_google_place_id: [ {
                            value: tagToCreate.tid
                        } ],
                        field_address: [ {
                            organization: name,
                            postal_code: tagToCreate.postcode,
                            country_code: tagToCreate.country,
                            locality: tagToCreate.city,
                            address_line1: tagToCreate.address
                        } ]
                    };
                } else if (target == "appellation") {
                    field_name = "field_wine_appellation";
                    tagPayload = {
                        vid: [ {
                            target_id: "geography"
                        } ],
                        name: [ {
                            value: name
                        } ]
                    };
                } else if (target == "variety") {
                    field_name = "field_grape_varieties";
                    tagPayload = {
                        vid: [ {
                            target_id: "wine_varieties"
                        } ],
                        name: [ {
                            value: name
                        } ]
                    };
                }
                var searchExisting = null;
                if (target == "producer") searchExisting = vServiceSingleton.searchArrayExact(name, vDataSingleton.allProducers); else if (target == "boutique") searchExisting = vServiceSingleton.searchArrayExact(name, vDataSingleton.allBoutiques); else if (target == "appellation") searchExisting = vServiceSingleton.searchArrayExact(name, vDataSingleton.allAppellations); else if (target == "variety") searchExisting = vServiceSingleton.searchArrayExact(name, vDataSingleton.allVarieties);
                let goAhead = true;
                if (searchExisting.length > 0) {
                    for (let tag of searchExisting) {
                        if (searchExisting[0].gid) goAhead = false;
                    }
                }
                if (goAhead) {
                    vDrupalSingleton.saveTag(tagPayload).then(result => {
                        console.log(result);
                        let tag = {
                            tid: result.tid[0].value,
                            name: name
                        };
                        if (target == "producer") {
                            vDataSingleton.allProducers.push(tag);
                            vDataSingleton.setCache("allProducers", vDataSingleton.allProducers);
                        } else if (target == "boutique") {
                            vDataSingleton.allBoutiques.push(tag);
                        } else if (target == "appellation") {
                            vDataSingleton.allAppellations.push(tag);
                            vDataSingleton.setCache("allAppellations", vDataSingleton.allAppellations);
                        } else if (target == "variety") {
                            vDataSingleton.allVarieties.push(tag);
                            vDataSingleton.setCache("allVarieties", vDataSingleton.allVarieties);
                        }
                        resolve(tag);
                    }, () => {
                        VMain.modalHide();
                        _release_toast(VLocal.WineNotSaved);
                        reject();
                    });
                } else {
                    resolve(searchResults[0].tid);
                }
            }
        });
    }
}

class VSearch {
    constructor() {
        if (!VSearch.instance) {
            this._data = [];
            VSearch.instance = this;
        }
        return VSearch.instance;
    }
    createPerfectWineFilter() {
        var filter = "0/0";
        switch (vUserSingleton.settings.organic) {
          case "bio":
            filter = "1+2/0+1";
            break;

          case "natural":
            filter = "1+2/1";
            break;

          case "none":
          default:
            filter = "0:2/0:1";
            break;
        }
        if (vUserSingleton.settings.vegan) filter += "/1"; else filter += "/0+1";
        if (vDataSingleton.selectedAromasIds.length == 0) filter += "/all"; else filter += "/" + vDataSingleton.selectedAromasIds.join("+") + "";
        if (vDataSingleton.selectedFoodIds.length == 0) return filter; else {
            for (let tid of vDataSingleton.selectedFoodIds) {
                var item = vDataSingleton.searchSeriesById(tid, vDataSingleton.foodSeries);
                var min_acidity = Math.ceil(item.acidity + item.fat + item.sugar + item.salt) + 1;
                var max_acidity = Math.floor(6 / (item.bitterness + item.spiciness + 1));
                if (min_acidity > 5) min_acidity = 5;
                if (min_acidity > max_acidity) max_acidity = min_acidity;
                if (max_acidity > 5) max_acidity = 5;
                filter += "/" + min_acidity + ":" + max_acidity;
                var min_bitterness = item.bitterness + 1;
                var max_bitterness = Math.floor(8 / (item.acidity + item.spiciness + 1));
                if (min_bitterness > max_bitterness) max_bitterness = min_bitterness;
                if (max_bitterness > 3) max_bitterness = 3;
                filter += "/" + min_bitterness + ":" + max_bitterness;
                var min_body = Math.ceil(item.bitterness + item.fat + item.sugar + item.spiciness) + 1;
                var max_body = Math.floor(7 / (item.acidity + item.salt + 1));
                if (min_body > 5) min_body = 5;
                if (min_body > max_body) max_body = min_body;
                if (max_body > 5) max_body = 5;
                filter += "/" + min_body + ":" + max_body;
                var min_tannins = Math.ceil(item.fat + item.sugar + item.salt + item.bitterness) + 1;
                var max_tannins = Math.floor(8 / (item.acidity + item.spiciness + 1));
                if (min_tannins > 5) min_tannins = 5;
                if (min_tannins > max_tannins) max_tannins = min_tannins;
                if (max_tannins > 5) max_tannins = 5;
                filter += "/" + min_tannins + ":" + max_tannins;
                var min_astringency = Math.ceil(item.fat + item.sugar + item.salt + item.bitterness) + 1;
                var max_astringency = Math.floor(8 / (item.acidity + item.spiciness + 1));
                if (min_astringency > 5) min_astringency = 5;
                if (min_astringency > max_astringency) max_astringency = min_astringency;
                if (max_astringency > 5) max_astringency = 5;
                filter += "/" + min_astringency + ":" + max_astringency;
                var min_salt = item.salt + 1;
                var max_salt = 3;
                filter += "/" + min_salt + ":" + max_salt;
                var min_sugar = Math.ceil(item.sugar + item.spiciness) + 1;
                var max_sugar = 5;
                if (min_sugar > 5) min_sugar = 5;
                if (min_sugar > max_sugar) max_sugar = min_sugar;
                filter += "/" + min_sugar + ":" + max_sugar;
                var min_persistence = Math.ceil(item.fat / 4 + item.sugar / 4 + item.bitterness / 2 + item.spiciness / 3) + 1;
                var max_persistence = Math.floor(7 / (item.acidity + item.salt + 1));
                if (min_persistence > 5) min_persistence = 5;
                if (min_persistence > max_persistence) max_persistence = min_persistence;
                if (max_persistence > 5) max_persistence = 5;
                filter += "/" + min_persistence + ":" + max_persistence;
                return filter;
            }
        }
    }
    createWineElement(wine, i, itemHeight) {
        var returnElement = document.createElement("ons-card");
        returnElement.style = "padding:0px";
        returnElement.id = "wine_" + wine.nid;
        returnElement.setAttribute("modifier", "tappable");
        var chartDiv = document.createElement("div");
        chartDiv.setAttribute("id", "chart-target-" + wine.nid);
        var wineDetailsListItem = document.createElement("ons-list-item");
        wineDetailsListItem.setAttribute("modifier", "nodivider");
        wineDetailsListItem.style = "font-size: smaller;";
        var aromasDiv = document.createElement("div");
        aromasDiv.classList.add("center");
        var wineAromaNames = [];
        for (let aroma of wine.aromas) {
            if (aroma && aroma.label && aroma.label.rich) {
                wineAromaNames.push('<img height="32px" src="' + aroma.label.rich.image.backgroundColor.image + '"/>&nbsp&nbsp');
            }
        }
        aromasDiv.innerHTML = wineAromaNames.join(" ");
        var appellationsDiv = document.createElement("div");
        appellationsDiv.classList.add("left");
        var appellationNames = [];
        for (let appellation of wine.appellations) {
            appellationNames.push(appellation.name);
        }
        appellationsDiv.innerHTML = appellationNames.join(", ");
        var wineListHeader = document.createElement("ons-list-header");
        wineListHeader.style = "text-transform:none;";
        wineListHeader.innerHTML = "<strong>" + wine.name + " " + wine.year + "</strong>";
        if ("" !== wine.producer) wineListHeader.innerHTML += " " + wine.producer;
        wineListHeader.setAttribute("modifier", "nodivider");
        var wineListItem = document.createElement("ons-list-item");
        wineListItem.setAttribute("modifier", "nodivider");
        wineListItem.style = "background-color: white!important";
        wineListItem.addEventListener("click", () => {
            vCardSingleton.open(wine.nid, wine.name);
        });
        appellationsDiv.addEventListener("click", () => {
            this.openAppellationMap(wine);
        });
        aromasDiv.addEventListener("click", () => {
            this.openAromasSankey(wine);
        });
        var whiteDiv = document.createElement("div");
        whiteDiv.classList.add("center");
        whiteDiv.style = "padding: 0px 6px 0px 0; background-color: white!important";
        var imageDiv = document.createElement("div");
        imageDiv.style = "margin-left:-14px; position: absolute; height:" + itemHeight + "px;" + "-webkit-mask-image: linear-gradient(to right, transparent 0%, black 25%,  black 75%, transparent 100%);";
        imageDiv.innerHTML = '<img src="' + jDrupal.settings.sitePath + wine.image + '"/>';
        var tmpColor = wine.color.code + (255 * (parseInt(wine.transparency) / 5)).toString(16);
        chartDiv.style = "margin-left:auto; margin-right: -6px; height:" + itemHeight + "px; width:" + .8 * window.innerWidth + "px; " + "background: linear-gradient(to right, transparent,  " + tmpColor + ")";
        whiteDiv.appendChild(imageDiv);
        whiteDiv.appendChild(chartDiv);
        wineListItem.appendChild(whiteDiv);
        wineDetailsListItem.appendChild(appellationsDiv);
        wineDetailsListItem.appendChild(aromasDiv);
        returnElement.appendChild(wineListHeader);
        returnElement.appendChild(wineListItem);
        returnElement.appendChild(wineDetailsListItem);
        let generateRadar = () => {
            let radar = new VRadar();
            radar.generateChart(wine).then(() => {
                var sugarDiv = document.createElement("div");
                sugarDiv.style = "right: 10px;  top: 20px;  position: absolute;";
                var spark = parseInt(wine.gas) > 2 ? 0 : 2;
                var sugar = parseInt(wine.sugar) - 1 + spark;
                sugar = sugar > 5 ? 5 : sugar;
                sugarDiv.innerHTML = VLocal.wineSugarRangeNames[sugar];
                wineListItem.appendChild(sugarDiv);
                setTimeout(() => {
                    VAlcohol.setGauge(wine.nid, wine.alcohol);
                }, 300);
            });
        };
        setTimeout(() => {
            generateRadar();
        }, i < 3 ? 100 : 1e3);
        return returnElement;
    }
    showWines() {
        var winesInfiniteList = document.getElementById("wines-infinite-list");
        var itemHeight = 220;
        if ("" !== winesInfiniteList.innerHTML) {
            winesInfiniteList.refresh();
            return;
        }
        winesInfiniteList.delegate = {
            configureItemScope: function(i, itemScope) {
                console.log(i + ": " + vDataSingleton.selectedWines[i].nid + " itemScope:" + itemScope);
            },
            createItemContent: i => {
                let wine = vDataSingleton.selectedWines[i];
                return this.createWineElement(wine, i, itemHeight);
            },
            countItems: () => {
                this.showBoutiques();
                return vDataSingleton.selectedWines.length;
            },
            calculateItemHeight: function(index) {
                return itemHeight;
            }
        };
    }
    isScrolledIntoView(el) {
        var rect = el.getBoundingClientRect();
        var elemTop = rect.top;
        var elemBottom = rect.bottom;
        var isVisible = elemTop >= 0 && elemBottom <= window.innerHeight;
        return isVisible;
    }
    showBoutiques() {
        var toastMap = document.getElementById("toast-map");
        var winesInfiniteList = document.getElementById("wines-infinite-list");
        if (toastMap.visible && vMapSingleton.boutiquesGoogleMap && winesInfiniteList.parentNode.hasChildNodes()) {
            let elements = winesInfiniteList.parentNode.childNodes;
            let index = 1;
            let element = elements[index];
            while (element) {
                let wine = vDataSingleton.selectedWines[index - 1];
                let isVisible = this.isScrolledIntoView(element);
                var markerIndex = vMapSingleton.boutiqueMarkers.map(x => {
                    return x.id;
                }).indexOf(index);
                if (wine.boutique && wine.boutique != "" && isVisible && markerIndex < 0) {
                    let boutique = vDataSingleton.allBoutiques.find(b => parseInt(b.tid) == parseInt(wine.boutique));
                    if (boutique && boutique.geo) {
                        let latlng = boutique.geo.split(";");
                        vMapSingleton.boutiqueMarkers.push({
                            id: index,
                            marker: new google.maps.Marker({
                                position: {
                                    lat: parseFloat(latlng[0]),
                                    lng: parseFloat(latlng[1])
                                },
                                map: vMapSingleton.boutiquesGoogleMap,
                                icon: BOUTIQUE_ICON
                            })
                        });
                        let infoContent = document.createElement("div");
                        infoContent.style = "color:black";
                        infoContent.addEventListener("click", () => {
                            vCardSingleton.open(wine.nid, wine.name);
                        });
                        infoContent.innerHTML = "<strong>" + wine.name + "</strong>" + "<i>" + wine.price + "</i>" + "<br><b> " + boutique.name + "</b>";
                        const infowindow = new google.maps.InfoWindow({
                            content: infoContent
                        });
                        infowindow.open({
                            anchor: vMapSingleton.boutiqueMarkers[vMapSingleton.boutiqueMarkers.length - 1].marker,
                            map: vMapSingleton.boutiquesGoogleMap,
                            shouldFocus: true
                        });
                    }
                }
                if (!isVisible && markerIndex > -1) {
                    vMapSingleton.boutiqueMarkers.splice(markerIndex, 1)[0].marker.setMap(null);
                }
                index++;
                element = elements[index];
            }
        }
    }
    openAppellationMap(wine) {
        var dialog = document.getElementById("map-card");
        if (dialog) {
            generate();
            dialog.show();
        } else {
            ons.createElement("wine-details-map.html", {
                append: true
            }).then(dialog => {
                dialog.show().then(generate);
            });
        }
        function generate() {
            if (!dialog) dialog = document.getElementById("map-card");
            dialog.querySelector(".alert-dialog").style.background = "transparent";
            dialog.querySelector(".alert-dialog").style.width = .9 * window.innerWidth + "px";
            dialog.querySelector(".alert-dialog").style.width = .9 * window.innerWidth + "px";
            dialog.querySelector("#appellation-map-canvas").style.filter = VMain.isDarkMode() ? "brightness(0.6)" : "";
            vMapSingleton.setGoogleMap("appellation-map-canvas").then(() => {
                vMapSingleton.loadAppellation(wine, "map-legend");
            });
            dialog.style.borderRadius = "10px";
        }
    }
    openAromasSankey(wine) {
        var dialog = document.getElementById("sankey-card");
        if (dialog) {
            generate();
            dialog.show();
        } else {
            ons.createElement("wine-details-sankey.html", {
                append: true
            }).then(dialog => {
                dialog.show().then(generate);
            });
        }
        function generate() {
            if (!dialog) dialog = document.getElementById("sankey-card");
            dialog.querySelector(".alert-dialog").style.background = "transparent";
            dialog.querySelector(".alert-dialog").style.width = .9 * window.innerWidth + "px";
            new VSankey(wine);
            dialog.querySelector("canvas").style.borderRadius = "10px";
        }
    }
    searchWineByTitle(target) {
        console.log(document.getElementById(target).value);
    }
}

const vSearchSingleton = new VSearch();

Object.freeze(vSearchSingleton);

class VBench {
    constructor() {
        if (!VBench.instance) {
            this._data = [];
            VBench.instance = this;
        }
        try {
            this.uid = device.uuid == null ? "browser" : device.uuid;
        } catch (err) {
            this.uid = "browser";
        }
        this.benchMap = new Map();
        return VBench.instance;
    }
    begin(instr) {
        let bench = this.benchMap.get(instr);
        if (undefined === bench || null === bench.e) {
            this.benchMap.set(instr, {
                b: new Date(),
                e: null
            });
        } else {
            this.benchMap.set(instr, {
                b: bench + new Date(),
                e: null
            });
        }
    }
    end(instr) {
        let bench = this.benchMap.get(instr);
        if (null == bench) {
            this.error(instr + " not found");
            return null;
        } else {
            bench.e = new Date();
            this.log(instr, bench);
            this.benchMap.delete(instr);
            return bench.e - bench.b;
        }
    }
    log(str, bench) {
        console.log("BENCH for " + this.uid + ": " + str + " took " + (bench.e - bench.b) + "ms");
    }
    error(error) {
        console.log("BENCH ERROR for " + this.uid + ": " + error);
    }
}

const vBench = new VBench();

Object.freeze(vBench);

class VAlcohol {
    constructor() {}
    static setGauge(id, alcohol, s = 40, target = "chart-target-" + id) {
        if (null === document.getElementById(id)) {
            var gaugeDiv = document.createElement("div");
            gaugeDiv.style = "position:absolute; right: 7px; bottom:15px; ";
            gaugeDiv.id = "gauge-" + id;
            document.getElementById(target).appendChild(gaugeDiv);
            var svg = SVG(gaugeDiv.id).size(s, s);
            var config = liquidFillGaugeDefaultSettings();
            config.circleThickness = .1;
            config.circleColor = VIVID;
            config.textColor = VIVID;
            config.waveTextColor = VIVID;
            config.waveColor = VIVID67;
            config.textVertPosition = .52;
            config.waveAnimateTime = 5e3;
            config.waveHeight = .1;
            config.waveAnimate = true;
            config.waveCount = 2;
            config.waveOffset = .25;
            config.textSize = 1.1;
            config.minValue = 5;
            config.maxValue = 55;
            config.displayPercent = true;
            var gauge = loadLiquidFillGauge(svg.id(), alcohol, config);
            document.getElementById(svg.id()).style = "background-color: white ; border-radius:50%;";
        }
    }
}

class VPrompt {
    constructor() {
        this.createPrompt();
        this.promptTarget = null;
        this.targetListerner = null;
        this.fabListerner = null;
        this.clickCounter = 0;
        VPrompt.instance = this;
    }
    static destroy() {
        VPrompt.instance = null;
        VPrompt.fabListerner = null;
        VPrompt.promptTarget = null;
        VPrompt.targetListerner = null;
        delete VPrompt.instance;
    }
    createPrompt() {
        if (null !== document.getElementById("prompt.html")) return;
        var prompt = document.createElement("template");
        prompt.id = "prompt.html";
        prompt.innerHTML = '<ons-row id="prompt-content" style="z-index: -1; position:fixed; bottom:0;">' + '<textarea  class="prompt" id="prompt-textarea" rows="1"></textarea>' + "</ons-row>";
        $("#app-body")[0].appendChild(prompt);
        ons.createElement(prompt.id, {
            append: true
        }).then(() => {
            let promptTextArea = document.getElementById("prompt-textarea");
            promptTextArea.style.display = "none;";
            promptTextArea.addEventListener("blur", () => {
                document.getElementById("prompt-dialog").hide();
                this.blurPrompt("textarea");
            });
            promptTextArea.addEventListener("input", el => {
                el.currentTarget.style.height = "";
                el.currentTarget.style.height = el.currentTarget.scrollHeight + 4 + "px";
            });
        });
        var promptDialog = document.createElement("template");
        promptDialog.id = "prompt-dialog.html";
        promptDialog.innerHTML = '<ons-dialog cancelable mask-color="rgba(195, 133, 48, 0.0)" id="prompt-dialog" visible="false" animation="none" >' + '<div class="dialog" style="z-index: 20001; position:fixed; top: unset;  bottom: 0px; min-width: unset; transform: unset; min-height: unset; left: unset; right: 0px; height: 44px; width: 44px;" >' + '<div class="dialog-container" style="left:0; right:0; top:0; bottom:0; background-color:' + TRANSPARENT + '" >' + '<ons-fab class="fab-micro" id="prompt-post-fab"><ons-icon icon="fa-send"></ons-icon></ons-fab>' + "</div>" + "</div>" + "</ons-dialog>";
        $("#app-body")[0].appendChild(promptDialog);
        ons.createElement(promptDialog.id, {
            append: true
        }).then(dialog => {
            dialog.addEventListener("prehide", () => {
                this.blurPrompt();
            });
            dialog.addEventListener("preshow", () => {
                this.focusPrompt();
            });
        });
    }
    clearPrompt() {
        document.getElementById("prompt-textarea").value = "";
        document.getElementById("prompt-textarea").style.height = "initial";
        document.getElementById("prompt-content").style.zIndex = "-1";
        document.getElementById("prompt-content").style.display = "none";
        if (this.promptTarget) this.promptTarget.style.display = "";
        document.getElementById("prompt-dialog").hide();
        if (null != this.promptTarget) this.promptTarget.removeEventListener("click", this.targetListerner);
        document.getElementById("prompt-post-fab").removeEventListener("touchend", this.fabListerner);
    }
    blurPrompt() {
        document.getElementById("prompt-content").style.zIndex = "-1";
        if (this.promptTarget) this.promptTarget.style.display = "";
        this.clickCounter = 0;
    }
    prompt() {
        document.getElementById("prompt-dialog").show();
    }
    focusPrompt() {
        document.getElementById("prompt-content").style.zIndex = "10000";
        document.getElementById("prompt-content").style.display = "";
        document.getElementById("prompt-textarea").focus();
    }
    bindPrompt(target, title, callback) {
        this.targetListerner = document.getElementById(target).addEventListener("click", e => {
            this.promptTarget = e.currentTarget;
            let promptElement = null;
            promptElement = document.getElementById("prompt-textarea");
            promptElement.style.display = "block";
            promptElement.setAttribute("placeholder", title);
            this.promptTarget.style.display = "none";
            this.prompt();
        });
        this.fabListerner = document.getElementById("prompt-post-fab").addEventListener("touchend", () => {
            if (this.promptTarget) {
                this.promptTarget.style.display = "";
                if (this.clickCounter == 0) {
                    this.clickCounter++;
                    callback(document.getElementById("prompt-textarea").value);
                }
            }
        });
    }
}

class VCard extends VPrompt {
    constructor() {
        if (!VCard.instance) {
            super();
            VCard.instance = this;
            this.locales = {
                fr: "fr-FR",
                en: "en-US",
                es: "es-ES",
                ru: "ru-RU"
            };
            this.pageId = "wine-card-page";
        }
        return VCard.instance;
    }
    open(nid, title) {
        this.createPage();
        this.comments = [];
        this.vWine = new VWine(OPEN);
        this.vWine.setCallback(() => {
            this.clearPrompt();
            VMain.pushMainPage({
                id: "selected-wines.html",
                prev: "wine-card-page.html"
            });
        });
        var html = '<ons-page id="generate-image-page">' + "<ons-toolbar>" + '<div class="left"><ons-back-button></ons-back-button></div>' + '<div class="center" id="generate-image-page-title">' + title + "</div>" + "</ons-toolbar>" + "</ons-page>";
        VPageFactory.createPage("generate-image-page", html);
        VMain.pushPage({
            id: "wine-card.html",
            title: '" + ' + title + ' + "'
        }, "fade").then(() => {
            this.vWine.load(nid).then(() => {
                this.showWineCard();
                document.getElementById("toggle-footer-1").addEventListener("click", () => {
                    this.toggleFoooter();
                });
                document.getElementById("toggle-footer-2").addEventListener("click", () => {
                    this.toggleFoooter();
                });
                if (vUserSingleton.isAuthenticated() && _isDebugUser()) {
                    document.getElementById("wine-comments-fake-input").removeAttribute("disabled");
                    this.bindPrompt("wine-comments-fake", VLocal.PostAComment, resp => {
                        this.postComment(resp);
                    });
                } else {
                    document.getElementById("wine-comments-fake-input").setAttribute("disabled", "true");
                }
                document.getElementById("action-sheet-dialog-edit").addEventListener("click", () => {
                    VMain.popPage().then(() => {
                        VMain.editWine(this.vWine);
                    });
                });
                document.getElementById("action-sheet-dialog-generate").addEventListener("click", () => {
                    this.vWine.generateImage();
                });
                document.getElementById("action-sheet-dialog-delete").addEventListener("click", () => {
                    this.vWine.delete();
                });
                document.getElementById("action-sheet-dialog-share").addEventListener("click", () => {
                    vUserSingleton.shareUrl();
                });
            });
        });
    }
    static showActionSheetDialog() {
        document.getElementById("action-sheet-dialog").show();
    }
    static hideActionSheetDialog() {
        document.getElementById("action-sheet-dialog").hide();
    }
    static destroy() {
        VCard.instance.clearPrompt();
        VCard.instance = null;
        VCard.comments = null;
        VCard.vWine = null;
        delete VCard.instance;
    }
    createPage() {
        if (null !== document.getElementById("wine-card.html")) return;
        var wineDetails = document.createElement("template");
        wineDetails.id = "wine-card.html";
        var today = new Date();
        var date = today.toDateString();
        let comment_display = _isInReview() ? "display:none" : "";
        var html = '<ons-page id="wine-card-page">' + "<ons-toolbar>" + '<div class="left"><ons-back-button></ons-back-button></div>' + '<div class="center" style="max-width:90%;" id="wine-card-toolbar-title" >' + "</div>" + '<div class="right" style="right: 5px; position: fixed;">' + '<ons-toolbar-button  id="wine-card-edit-button" id="info-button" onclick="VCard.showActionSheetDialog()">' + '<ons-icon icon="md-more-vert" class="list-item__icon"></ons-icon>' + "</ons-toolbar-button>" + "</div>" + "</ons-toolbar>" + '<ons-progress-bar style="z-index:10; width:100%; top:0px; position:absolute;" id="wine-card-progressbar" secondary-value="100" class="progressStyle" indeterminate></ons-progress-bar>' + '<div id="wine-card-label-div" style="transition: height 0.6s; overflow:hidden; height:100%; width:100%; position:absolute;">' + '<img class="reflect" id="wine-card-label" style="width:100%;" />' + "</div>" + '<div id="wine-card-thumbnail-div" style="overflow:hidden; height:100%; width:100%; top:0px; position:absolute;">' + '<img class="reflect" id="wine-card-thumbnail" style="width:100%; filter:blur(20px);" />' + "</div>" + '<ons-card modifier="mini" id="footer-card"  style="height:100px; margin-top:-30px; overflow-y: hidden; margin:0; transition: height 0.6s cubic-bezier(0.68, -0.55, 0.27, 1.55) 0s; position: absolute; bottom:0px; left:0px; width:100%; border-radius: 10px 10px 0px 0px; background-color:fffffff1" >' + '<ons-list modifier="noborder" style="margin-top:-15px; overflow-y: hidden; height: 100%;">' + '<ons-list-item  id="toggle-footer-1" modifier="nodivider" style="min-height: 10px; height: 0; padding:0; background-color: ' + TRANSPARENT + ';" ripple><ons-icon icon="md-unfold-more" style="margin-left: 50%;"></ons-icon></ons-list-item>' + '<ons-list-item  id="toggle-footer-2"  modifier="nodivider" ripple style="width:100%; border-radius: 10px; padding:0" >' + '<div class="left">' + '<img id="wine-author-avatar" style="border-radius:50%; height:40px; border: 2px solid ' + VIVID + "; background-color: " + OPAQUE + ';"   src="css/splash.png">' + "</div>" + '<div class="center">' + '<p id="wine-author-name"></p>' + "</div>" + '<div class="right">' + '<p id="wine-author-date">' + date + "</p>" + "</div>" + "</ons-list-item>" + '<ons-list-item  modifier="nodivider" style="width:100%; margin-top:-15px; padding:0">' + '<div id="wine-card-name" style="font-weight: bold;" >' + "</div>" + "</ons-list-item>" + '<ons-list-item modifier="nodivider" style="width:100%; margin-top:-20px; padding:0; ">' + '<div id="wine-card-properties" style="text-aling:justify; overflow-y:auto; width:100%; ">' + "</div>" + "</ons-list-item>" + '<ons-list-item style="' + comment_display + '" modifier="nodivider" id="wine-comments-fake" style="width:100%; margin-top:-20px; padding:0; ">' + '<ons-button  modifier="quiet"  id="wine-comments-fake-input"  style="font-size: small; color:grey; padding: 0 10px 0 10px; text-aling:justify; width:98%; margin-left:1%; border: 1px solid ' + VIVID + '; border-radius: 5px; ">' + VLocal.PostAComment + "</ons-button>" + "</ons-list-item>" + '<ons-list-item modifier="nodivider" style="width:100%; margin-top:-20px; padding:0; ">' + '<div id="comments-container" style="text-aling:justify; overflow-y:auto; width:100%;">' + '<ons-progress-bar id="wine-comments-progressbar" style="width:100%; height:5px;" secondary-value="100" class="progressStyle" indeterminate></ons-progress-bar>' + '<ons-list modifier="noborder" style="margin-top: -5px;">' + '<ons-lazy-repeat id="comments-infinite-list" style="background-color: transparent;"></ons-lazy-repeat>' + "</ons-list>" + "</div>" + "</ons-list-item>" + "</ons-list>" + "</ons-card>" + '<ons-action-sheet id="action-sheet-dialog" cancelable>' + '<ons-action-sheet-button id="action-sheet-dialog-share" ontouchend="VCard.hideActionSheetDialog(); " icon="md-square-o">' + VLocal.Share + "</ons-action-sheet-button>" + '<ons-action-sheet-button id="action-sheet-dialog-edit" ontouchend="VCard.hideActionSheetDialog(); " icon="md-square-o">' + VLocal.Edit + "</ons-action-sheet-button>" + '<ons-action-sheet-button id="action-sheet-dialog-generate" ontouchend="VCard.hideActionSheetDialog(); " icon="md-square-o">' + VLocal.Generate + "</ons-action-sheet-button>" + '<ons-action-sheet-button id="action-sheet-dialog-delete" ontouchend="VCard.hideActionSheetDialog(); " modifier="destructive"  icon="md-square-o">' + VLocal.Delete + "</ons-action-sheet-button>" + '<ons-action-sheet-button ontouchend="VCard.hideActionSheetDialog();" icon="md-square-o">' + VLocal.Cancel + "</ons-action-sheet-button>" + "</ons-action-sheet>" + '<ons-popover id="popover-dialog" cancelable direction="down">' + '<ons-list id="popover-list">' + '<ons-list-item class="more-options" tappable ontouchend="VMain.hideDialog(\'popover-dialog\')">' + '<div class="center">' + VLocal.Edit + "</div>" + "</ons-list-item>" + '<ons-list-item class="more-options" tappable ontouchend="VMain.hideDialog(\'popover-dialog\')">' + '<div class="center">' + VLocal.Delete + "</div>" + "</ons-list-item>" + '<ons-list-item class="more-options" tappable ontouchend="VMain.hideDialog(\'popover-dialog\')">' + '<div class="center">' + VLocal.Share + "</div>" + "</ons-list-item>" + "</ons-list>" + "</ons-popover>" + "</ons-page>";
        wineDetails.innerHTML = html;
        $("#app-body")[0].appendChild(wineDetails);
    }
    toggleFoooter() {
        var min = 100;
        var max = window.innerHeight - 100;
        var target = document.getElementById("footer-card");
        if (target.style.height == min + "px") {
            target.style.height = max + "px";
            target.firstChild.style.overflowY = "auto";
        } else {
            target.style.height = min + "px";
            target.firstChild.style.overflowY = "hidden";
            this.clearPrompt();
        }
    }
    loadComments(nid) {
        return new Promise((resolve, reject) => {
            jDrupal.viewsLoad("commentsapp/" + nid + "?_format=json").then(view => {
                document.getElementById("wine-comments-progressbar").style.display = "none";
                var comments = view.getResults();
                resolve(comments);
            });
        });
    }
    sortComments(comments) {
        this.comments = comments;
        return this.comments;
    }
    showComments(comments) {
        var commentsInfiniteList = document.getElementById("comments-infinite-list");
        const options = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        };
        commentsInfiniteList.delegate = {
            createItemContent: i => {
                var returnElement = document.createElement("ons-card");
                returnElement.style = "padding:0px; margin-left: " + comments[i].thread * 20 + "px;";
                returnElement.setAttribute("modifier", "nodivider tappable");
                var listItem = document.createElement("ons-row");
                listItem.setAttribute("modifier", "nodivider");
                var leftElement = document.createElement("ons-col");
                leftElement.setAttribute("width", "50px");
                leftElement.innerHTML = '<img height="30px" style="border-radius:50%; margin: 8px;" src="' + comments[i].picture + '" />';
                var centerElement = document.createElement("ons-col");
                centerElement.innerHTML = '<p style = "font-size: smaller"><strong color=' + VIVID + ">" + comments[i].author + "</strong><br>" + comments[i].body + "</p>";
                var rightElement = document.createElement("ons-col");
                rightElement.setAttribute("width", "50px");
                let date = new Date(comments[i].date);
                rightElement.innerHTML = '<p style = "font-size: x-small">' + date.toLocaleString(this.locales[vUserSingleton.settings.langcode], options) + "</p>";
                var listFooter = document.createElement("ons-row");
                listFooter.setAttribute("modifier", "nodivider");
                var replyButton = document.createElement("ons-button");
                replyButton.setAttribute("style", "font-size: small;");
                replyButton.setAttribute("modifier", "quiet");
                replyButton.innerHTML = '<ons-icon icon="fa-reply"></ons-icon>';
                replyButton.addEventListener("click", () => {
                    this.postComment();
                });
                listItem.appendChild(leftElement);
                listItem.appendChild(centerElement);
                listItem.appendChild(rightElement);
                returnElement.appendChild(listItem);
                returnElement.appendChild(listFooter);
                return returnElement;
            },
            countItems: function() {
                return comments.length;
            },
            calculateItemHeight: function(index) {
                return 36;
            }
        };
        commentsInfiniteList.refresh();
    }
    postComment(body) {
        if (!vTensorFlowSingleton) vTensorFlowSingleton = new VTensorFlow(); else {
            VMain.modalShow().then(() => {
                vTensorFlowSingleton.toxicity([ body ]).then(() => {
                    vDrupalSingleton.postComment(body, this.vWine.getId()).then(() => {
                        let now = new Date();
                        const options = {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                        };
                        this.comments = [ {
                            body: body,
                            picture: vUserSingleton.settings.image,
                            author: vUserSingleton.settings.name,
                            date: now.toLocaleString(this.locales[vUserSingleton.settings.langcode], options)
                        }, ...this.comments ];
                        this.clearPrompt();
                        this.showComments(this.comments);
                        VMain.modalHide();
                    }, () => {
                        _release_toast(VLocal.UnableToPostMessages);
                        VMain.modalHide();
                    });
                }, reason => {
                    if ("error" == reason) {
                        _release_toast(VLocal.UnableToPostMessages);
                    } else {
                        _release_toast(VLocal.CommentViolation);
                    }
                    VMain.modalHide();
                });
            });
        }
    }
    showWineCard() {
        document.getElementById("wine-card-toolbar-title").innerText = this.vWine.getName();
        var generalPage = document.getElementById("wine-card-general-page");
        document.getElementById("wine-author-avatar").src = this.vWine.getAuthorPic();
        document.getElementById("wine-card-edit-button").style.display = this.vWine.isEditable() ? "" : "none";
        try {
            document.getElementById("wine-author-name").innerText = this.vWine.getAuthorName();
        } catch (err) {
            _debug_toast_err(err);
            _release_toast(VLocal.ServerGetResultsError);
        }
        document.getElementById("wine-author-date").innerText = this.vWine.getDate();
        var labelImage = document.getElementById("wine-card-label");
        labelImage.src = this.vWine.getImage().url;
        var labelImageDiv = document.getElementById("wine-card-thumbnail-div");
        var labelThumbnailDiv = document.getElementById("wine-card-thumbnail-div");
        var labelThumbnail = document.getElementById("wine-card-thumbnail");
        labelThumbnail.src = jDrupal.settings.sitePath + vDataSingleton.getWineById(this.vWine.getId()).image;
        labelThumbnail.onload = function() {
            $("#wine-card-thumbnail").reflect({
                opacity: .7,
                height: 1
            });
            this.style.width = "100%";
            VMain.modalHide();
        };
        labelImage.style.display = "none";
        function waitForImageToLoad(imageElement) {
            return new Promise(resolve => {
                imageElement.onload = resolve;
            });
        }
        waitForImageToLoad(labelImage).then(() => {
            VMain.removeElement(labelThumbnailDiv);
            document.getElementById("wine-card-progressbar").style = "display:none";
            $("#wine-card-label").reflect({
                opacity: .7,
                height: 1
            });
            labelImage.nextSibling.style = "display:block; width:100%";
            labelImage.style = "display:block; width:100%; margin-bottom:-10px";
            labelImage.parentNode.style = "display:block; width:100%;";
        });
        var wineProperties = document.getElementById("wine-card-properties");
        wineProperties.innerHTML = this.vWine.getConclusion();
        this.loadComments(this.vWine.getId()).then(comments => {
            this.showComments(this.sortComments(comments));
        });
    }
}

const vCardSingleton = new VCard();

class VAbstractEditor {
    constructor() {
        this.pageId = "";
        return null;
    }
    init(type, isNew, callback) {
        if (!vTensorFlowSingleton && type != "map") vTensorFlowSingleton = new VTensorFlow();
        VPageFactory.createPage("camera-" + type + "-page", VPageFactory.buildCameraPage(type));
        VMain.setBackground(TRANSPARENT);
        document.getElementById("splitter-content").load("camera-" + type + "-page.html").then(() => {
            var labelPage = document.getElementById("camera-" + type + "-page");
            labelPage.firstChild.style = "background-color:transparent";
            vCameraSingleton.init(type == "user" ? "front" : "back");
            document.getElementById(type + "-camera-fab").addEventListener("touchend", () => {
                vCameraSingleton.takePicture().then(image => {
                    callback(image);
                });
            });
            document.getElementById(type + "-browse-fab").addEventListener("touchend", () => {
                vCameraSingleton.browsePicture().then(image => {
                    callback(image);
                });
            });
            if (!isNew && type != "user") {
                callback(null);
            }
        });
    }
    setBackground(imgData) {
        var page = document.getElementById(this.pageId + "-page");
        if (null === imgData || "" === imgData || 15 > imgData.length) {
            page.setAttribute("style", "background-color:" + imgData + "!important;");
        } else {
            var style = "background-size: cover!important; background-repeat: no-repeat!important; background-position: center!important;";
            page.setAttribute("style", 'background-image:url("' + imgData + '")!important;' + style);
        }
    }
}

class VUserEditor extends VAbstractEditor {
    constructor(target) {
        super();
        this.pageId = "camera-user";
        this.isNew = !vUserSingleton.isAuthenticated();
        if (!vTensorFlowSingleton) vTensorFlowSingleton = new VTensorFlow();
    }
    editUserPicture() {
        $("#sidemenu-left")[0].close();
        this.init("user", this.isNew, image => {
            let testImg = document.createElement("img");
            testImg.id = "test-img";
            var ratio = image.width / image.height;
            testImg.src = image.data;
            testImg.height = window.innerHeight;
            testImg.width = testImg.height * ratio;
            $("#app-body")[0].appendChild(testImg);
            VMain.modalShow();
            testImg.addEventListener("load", () => {
                vCameraSingleton.hide();
                vTensorFlowSingleton.blazeFace(testImg.id).then(() => {
                    vTensorFlowSingleton.explicit(testImg.id).then(() => {
                        VMain.modalHide();
                        $("#app-body")[0].removeChild(testImg);
                        VMain.pushMainPage({
                            id: "selected-wines.html",
                            prev: this.pageId + "-page.html"
                        });
                        try {
                            var path = jDrupal.restPath() + "jsonapi/profile/aromanaut/field_user_photo";
                            vDrupalSingleton.uploadImage(image, path).then(image_file => {
                                vUserSingleton.updatePicture(image_file);
                            }, () => {
                                _release_toast(VLocal.UploadError);
                            }, () => {
                                _release_toast("couldn't upload picture");
                                VMain.pushMainPage({
                                    id: "selected-wines.html",
                                    prev: this.pageId + "-page.html"
                                });
                            });
                        } catch (err) {
                            _debug_toast_err(err);
                        }
                    }, () => {
                        _release_toast("explicit content");
                        VMain.modalHide();
                        $("#app-body")[0].removeChild(testImg);
                    });
                }, () => {
                    VMain.modalHide();
                    $("#app-body")[0].removeChild(testImg);
                });
            });
        });
    }
    prompt(target) {
        var msgHTML = "";
        var title = "";
        if (target == "signin") {
            msgHTML = '<ons-input id="username-input" placeholder="' + VLocal.Username + '" modifier="underbar" float>' + '</ons-input><br><ons-input id="password-input" placeholder="' + VLocal.Password + '" type="password" float></ons-input>';
            title = VLocal.SignIn;
        } else if (target == "signup" || target == "edit") {
            let disabledName = target == "edit" ? "disabled" : "";
            let editName = target == "edit" ? vUserSingleton.settings.name : "";
            let editMail = target == "edit" ? vUserSingleton.settings.mail : "";
            msgHTML = '<ons-list style="background-color:' + TRANSPARENT + '"><ons-list-item modifier="nodivider" ><div class="left"><ons-icon icon="md-face" class="list-item__icon"></ons-icon></div>' + '<label class="center"><ons-input ' + disabledName + ' id="username-input" value="' + editName + '" placeholder="' + VLocal.Username + '" modifier="underbar" maxlength="20"  float></ons-input></label></ons-list-item>' + '<ons-list-item modifier="nodivider" ><div class="left"><ons-icon icon="md-key" class="list-item__icon"></ons-icon></div>' + '<label class="center"><ons-input id="password-input" float maxlength="20" placeholder="' + VLocal.Password + '" type="password"></ons-input></label></ons-list-item>';
            if (target == "edit") msgHTML += '<ons-list-item modifier="nodivider" ><div class="left"><ons-icon icon="md-key" class="list-item__icon"></ons-icon></div>' + '<label class="center"><ons-input id="new-password-input" float maxlength="20" placeholder="' + VLocal.NewPassword + '" type="password"></ons-input></label></ons-list-item>';
            msgHTML += '<ons-list-item modifier="nodivider" ><div class="left"><ons-icon icon="fa-envelope" class="list-item__icon"></ons-icon></div>' + '<label class="center"><ons-input id="email-input" float maxlength="20" value="' + editMail + '" placeholder="' + VLocal.Email + '"></ons-input></label></ons-list-item></ons-list>';
            title = target == "signup" ? VLocal.SignUp : VLocal.Edit;
        } else if (target == "signout") {
            ons.notification.confirm({
                title: VLocal.SignOut,
                messageHTML: VLocal.YouWillBeSignedOut,
                buttonLabels: [ VLocal.Ok, VLocal.Cancel ]
            }).then(function(input) {
                if (input == 0) vUserSingleton.signout();
            });
            return;
        }
        var dialog = document.getElementById("alert-dialog-" + target);
        if (dialog) dialog.parentNode.removeChild(dialog);
        var listHeaderHTML = target;
        var dialogHTML = '<ons-alert-dialog id="alert-dialog-' + target + '" >' + '<div class="alert-dialog-title">' + title + "</div>" + '<div class="alert-dialog-content">' + msgHTML + "</div>" + "<ons-alert-dialog-button>" + VLocal.Ok + "</ons-alert-dialog-button>" + "<ons-alert-dialog-button  ontouchend=\"document.getElementById('alert-dialog-" + target + "').hide()\">" + VLocal.Cancel + "</ons-alert-dialog-button>" + "</ons-alert-dialog>";
        var createAlertDialog = () => {
            var dialogTemplate = document.createElement("template");
            dialogTemplate.id = "alert-dialog-" + target + ".html";
            dialogTemplate.innerHTML = dialogHTML;
            $("#app-body")[0].appendChild(dialogTemplate);
            ons.createElement("alert-dialog-" + target + ".html", {
                append: true
            }).then(() => {
                dialog = document.getElementById("alert-dialog-" + target);
                dialog.querySelectorAll("ons-alert-dialog-button")[0].addEventListener("click", () => {
                    if (target == "signin") {
                        var username = document.getElementById("username-input").value;
                        var password = document.getElementById("password-input").value;
                        vUserSingleton.signin(username, password).then(() => {
                            dialog.hide();
                        });
                    } else if (target == "signup") {
                        var username = document.getElementById("username-input").value;
                        var password = document.getElementById("password-input").value;
                        var email = document.getElementById("email-input").value;
                        vUserSingleton.signup(username, password, email).then(() => {
                            vUserSingleton.signin(username, password).then(() => {
                                dialog.hide();
                            });
                        });
                    } else if (target == "edit") {
                        var password = document.getElementById("password-input").value;
                        var newPassword = document.getElementById("new-password-input").value;
                        var email = document.getElementById("email-input").value;
                        vUserSingleton.updateMail(email, password);
                        if ("" != newPassword.replace(" ", "")) vUserSingleton.updatePassword(password, newPassword);
                    }
                });
                dialog.show();
                dialog.addEventListener("posthide", () => {
                    dialog.parentNode.removeChild(dialog);
                });
            });
        };
        createAlertDialog();
    }
}

class VFoodEditor extends VAbstractEditor {
    constructor(vFood = null) {
        super();
        this.vFood = vFood;
        this.is_new = this.vWine === null ? true : false;
        this.initTabs = [ false, false ];
        this.aromaBurst = null;
        this.initFoodEditor();
    }
    createPage() {
        var pageId = "edit-food";
        if (null !== document.getElementById(pageId + ".html")) return;
        var mainPageTemplate = document.createElement("template");
        mainPageTemplate.id = pageId + ".html";
    }
    initFoodEditor() {
        this.init("food").then(() => {
            VPageFactory.buildSaveFoodErrorUls(this.vFood);
        });
    }
}

class VBottleEditor extends VAbstractEditor {
    constructor(vWine = null, callback = null) {
        super();
        this.pageId = null == callback ? "edit-cellar" : "edit-wine";
        let isNew = null == vWine;
        this.vWine = isNew ? new VWine(null == callback ? SEALED : OPEN) : vWine;
        this.init("wine", isNew, image => {
            this.vWine.setCallback(() => {
                VMain.pushMainPage({
                    id: "selected-wines.html",
                    prev: this.pageId + "-page.html"
                });
            });
            this.initBottle(image, callback);
        });
    }
    verifyImage(image) {
        return new Promise((resolve, reject) => {
            let testImg = document.createElement("img");
            testImg.id = "test-img";
            testImg.crossOrigin = "anonymous";
            testImg.src = image.data;
            $("#app-body")[0].appendChild(testImg);
            testImg.addEventListener("load", () => {
                testImg.height = window.innerHeight;
                testImg.style = "position:absolute;  left:" + (-testImg.width + window.innerWidth) / 2 + "px";
                vTensorFlowSingleton.classify(testImg.id).then(() => {
                    vTensorFlowSingleton.explicit(testImg.id).then(() => {
                        $("#app-body")[0].removeChild(testImg);
                        resolve();
                    }, () => {
                        _release_toast(VLocal.ExplicitContent);
                        $("#app-body")[0].removeChild(testImg);
                        reject();
                    });
                }, () => {
                    _release_toast(VLocal.NotABottle);
                    $("#app-body")[0].removeChild(testImg);
                    reject();
                });
            });
        });
    }
    recognizeImage(image) {
        vCameraSingleton.toDataURL(image.data).then(base64 => {
            (async () => {
                try {
                    await tessWorker.initialize("fra");
                    const data = await tessWorker.recognize(base64.data);
                    console.log(data);
                    _release_toast(data.text);
                } catch (err) {
                    _debug_toast_err(err);
                }
            })();
        });
    }
    initBottle(image, callback) {
        vDrupalSingleton.getAppellationsOnline().then(() => {});
        VPageFactory.createPage(this.pageId, this.buildMainHTML());
        let imageVerified = () => {
            VMain.pushPage({
                id: this.pageId + ".html"
            }).then(() => {
                VMain.setBackground(MILKY);
                $(document.getElementById("wine-boutique")).selectize(new SelectizeOptions("boutique", vDataSingleton.allBoutiques, [ this.vWine.getBoutiqueId() ], 1));
                $(document.getElementById("wine-producer")).selectize(new SelectizeOptions("producer", vDataSingleton.allProducers, [ this.vWine.getProducerId() ], 1));
                $(document.getElementById("wine-varieties")).selectize(new SelectizeOptions("varieties", vDataSingleton.allVarieties, this.vWine.getVarietiesIds(), 20));
                $(document.getElementById("wine-appellation")).selectize(new SelectizeOptions("appellation", vDataSingleton.allAppellations, this.vWine.getAppellationsIds(), 3));
                $("input").focus(function() {
                    $("html, body").animate({
                        scrollTop: $(this).offset().top + "px"
                    }, "fast");
                });
                $.extend($(document.getElementById("#wine-name input")), new InputOptions("name", v => {
                    this.vWine.setName(v);
                }));
                $.extend($(document.getElementById("#wine-vintage input")), new InputOptions("vintage", v => {
                    this.vWine.setVintage(v);
                }));
                $.extend($(document.getElementById("#wine-alcohol input")), new InputOptions("alcohol", v => {
                    this.vWine.setAlcohol(v);
                }));
                $.extend($(document.getElementById("#wine-stock input")), new InputOptions("stock", v => {
                    this.vWine.setStock(v);
                }));
                document.getElementById("wine-tasting-date").addEventListener("blur", () => {
                    this.vWine.setTastingDate(document.getElementById("wine-tasting-date").value);
                });
                if (this.vWine.isOpen()) {
                    document.getElementById("wine-tasting-date").value = this.vWine.getTastingDate();
                } else {
                    $(".save-wine-button").on("click", () => {
                        this.vWine.validate(VPageFactory.buildSaveWineErrorUls(this.vWine));
                    });
                    document.getElementById("wine-price").value = this.vWine.getPrice();
                    document.getElementById("choose-currency").value = this.vWine.getCurrency();
                    $.extend($(document.getElementById("#wine-price input")), new InputOptions("price", v => {
                        this.vWine.setStock(v);
                    }));
                    document.getElementById(this.pageId + "-page").addEventListener("show", e => {
                        this.setBackground(this.vWine.getImage().data);
                    });
                }
                document.getElementById("wine-vintage").value = this.vWine.getVintage();
                document.getElementById("wine-name").value = this.vWine.getName();
                document.getElementById("wine-alcohol").value = this.vWine.getAlcohol();
                document.getElementById("wine-appellation").value = this.vWine.getAppellationsText();
                document.getElementById("wine-producer").value = this.vWine.getProducerText();
                document.getElementById("wine-boutique").value = this.vWine.getBoutiqueName();
                document.getElementById("wine-varieties").value = this.vWine.getVarietiesText();
                document.getElementById("wine-bio").value = this.vWine.getBio();
                document.getElementById("wine-sulfites").value = this.vWine.getSulfites();
                document.getElementById("wine-vegan").value = this.vWine.getVegan();
                document.getElementById("wine-stock").value = this.vWine.getStock();
                document.getElementById("wine-bio").addEventListener("change", e => {
                    this.vWine.setBio(e.target.value);
                });
                document.getElementById("wine-sulfites").addEventListener("change", e => {
                    this.vWine.setSulfites(e.target.value);
                });
                document.getElementById("wine-vegan").addEventListener("change", e => {
                    this.vWine.setVegan(e.target.value);
                });
                if (callback) callback();
            });
        };
        if (!image) {
            image = this.vWine.getImage();
            imageVerified();
        } else {
            if (undefined === image || image === "" || image === "css/splash.png" || image === "default") {
                this.vWine.setImage({
                    data: "css/splash.png",
                    url: "css/splash.png"
                });
            } else {
                VMain.modalShow().then(() => {
                    document.getElementById("modal-text").innerHTML = VLocal.ProcessingImage;
                    this.verifyImage(image).then(() => {
                        this.vWine.setImage(image);
                        VMain.modalHide();
                        imageVerified();
                    }, () => {
                        VMain.modalHide();
                        this.vWine.setImage(null);
                    });
                });
            }
        }
    }
    buildMainHTML() {
        return '<ons-page id="' + this.pageId + '-page" class="page__transparent">' + VPageFactory.buildCancelFab(this.pageId, -10) + '<ons-list modifier="noborder" style="padding: 0; width: 100%; margin-top: 40px; background-color:' + TRANSPARENT + '">' + VPageFactory.buildGeneralListItems() + VPageFactory.buildPriceListItem() + VPageFactory.buildSaveFab(-10) + VPageFactory.buildStockListItem() + VPageFactory.buildBottomListItem() + "</ons-list>" + "</ons-page>";
    }
}

class VWineEditor extends VBottleEditor {
    constructor(vWine = null) {
        VPageFactory.createPage("edit-wine-page-general", VPageFactory.buildWineGeneralPage("edit-wine-page-general"));
        VPageFactory.createPage("edit-wine-page-visual", VPageFactory.buildWineVisualPage("edit-wine-page-visual"));
        VPageFactory.createPage("edit-wine-page-olfaction", VPageFactory.buildWineOlfactionPage("edit-wine-page-olfaction"));
        VPageFactory.createPage("edit-wine-page-taste", VPageFactory.buildWineTastePage("edit-wine-page-taste"));
        VPageFactory.createPage("edit-wine-page-conclusion", VPageFactory.buildWineConclusionPage("edit-wine-page-conclusion"));
        super(vWine, () => {
            this.initWine();
        });
    }
    buildMainHTML() {
        return '<ons-page id="' + this.pageId + '-page" class="page__transparent">' + VPageFactory.buildCancelFab(this.pageId, 30) + VPageFactory.buildWinePageTabbar() + "</ons-page>";
    }
    initWine() {
        document.getElementById("edit-wine-page-general").addEventListener("show", e => {
            VMain.setBackground(MILKY);
            this.setBackground(this.vWine.getImage().data);
        });
        this.initTabs = [ false, false, false, false, false ];
        this.aromaBurst = null;
        document.getElementById("edit-wine-tabbar").addEventListener("prechange", e => {
            switch (e.index) {
              case 0:
                {
                    vCameraSingleton.hide();
                    VMain.setBackground(MILKY);
                    this.setBackground(this.vWine.getImage().data);
                    break;
                }

              case 1:
                {
                    vCameraSingleton.show();
                    VMain.setBackground(TRANSPARENT);
                    this.setBackground(TRANSPARENT);
                    if (this.initTabs[e.index]) break;
                    var visualPage = document.getElementById("edit-wine-page-visual");
                    visualPage.firstChild.style = "background-color:transparent";
                    var colorTransparencyRange = document.getElementById("color-transparency-range");
                    colorTransparencyRange.parentNode.parentNode.showItems().then(() => {
                        colorTransparencyRange.value = 128 + (this.vWine.getTransparency() - 1) * 31;
                    });
                    var colorParticlesRange = document.getElementById("color-particles-range");
                    document.getElementById("color-particles-range").parentNode.parentNode.showItems().then(() => {
                        colorParticlesRange.value = (this.vWine.getParticles() - 1) * 49;
                    });
                    var wineGlassImg = document.getElementById("wine-glass");
                    if (wineGlassImg === null) {
                        wineGlassImg = document.createElement("img");
                        wineGlassImg.id = "wine-glass";
                        wineGlassImg.src = "css/glass.png";
                        visualPage.appendChild(wineGlassImg);
                        wineGlassImg.addEventListener("load", () => {
                            var ratio = wineGlassImg.width / wineGlassImg.height;
                            this.originalGlassWidth = wineGlassImg.width;
                            this.originalGlassHeight = wineGlassImg.height;
                            wineGlassImg.height = visualPage.clientHeight;
                            wineGlassImg.width = wineGlassImg.height * ratio;
                            wineGlassImg.style = "z-index: 999; position:absolute; left:50%; margin-left:-" + wineGlassImg.width / 2 + "px; bottom:0px";
                            this.updateWineglass();
                        });
                    }
                    var redPalette = document.getElementById("red-palette");
                    var whitePalette = document.getElementById("white-palette");
                    var rosePalette = document.getElementById("rose-palette");
                    colorTransparencyRange.addEventListener("change", e => {
                        this.vWine.setTransparency(Math.round((parseInt(e.target.value) - 127) / 33) + 1);
                        this.updateWineglass();
                    });
                    colorParticlesRange.addEventListener("change", e => {
                        this.vWine.setParticles(Math.ceil(parseInt(e.target.value) / 33));
                        this.updateWineglass();
                    });
                    for (var i = 0; i < 3; i++) {
                        var colors = [];
                        var palette = null;
                        if (i == 0) {
                            colors = vDataSingleton.wineColors.red;
                            palette = redPalette;
                        } else if (i == 1) {
                            colors = vDataSingleton.wineColors.white;
                            palette = whitePalette;
                        } else if (i == 2) {
                            colors = vDataSingleton.wineColors.rose;
                            palette = rosePalette;
                        }
                        for (var color of colors) {
                            var sdi;
                            sdi = document.createElement("ons-speed-dial-item");
                            sdi.innerHTML = color.name;
                            sdi.color = color;
                            sdi.style = "font-size:15px; border-radius:10px; margin-right:-20px; width:80px; background: " + color.code;
                            sdi.addEventListener("touchend", e => {
                                this.vWine.setColor(e.target.color);
                                this.updateWineglass();
                            });
                            palette.appendChild(sdi);
                        }
                        palette.addEventListener("touchend", function() {
                            if (this == redPalette) {
                                whitePalette.hideItems();
                                rosePalette.hideItems();
                            } else if (this == rosePalette) {
                                whitePalette.hideItems();
                                redPalette.hideItems();
                            } else if (this == whitePalette) {
                                redPalette.hideItems();
                                rosePalette.hideItems();
                            }
                        });
                    }
                    redPalette.showItems();
                    break;
                }

              case 2:
                {
                    vCameraSingleton.hide();
                    VMain.setBackground(OPAQUE);
                    this.setBackground(OPAQUE);
                    if (this.initTabs[e.index]) break;
                    var olfactionIntensityRange = document.getElementById("olfaction-intensity-range");
                    olfactionIntensityRange.value = this.vWine.getIntensity() * 20;
                    olfactionIntensityRange.addEventListener("change", e => {
                        this.vWine.setIntensity(Math.round(e.target.value / 25) + 1);
                        document.getElementById("intensity-checked").checked = this.vWine.getIntensity() > 0;
                        document.getElementById("intensity-range-link").innerHTML = VLocal.wineIntensityRangeNames[this.vWine.getIntensity() - 1];
                    });
                    for (let aroma of this.vWine.getAromas()) {
                        vDataSingleton.selectedAromasIds.push(aroma.tid);
                    }
                    vDataSingleton.selectedAromasIds = [];
                    this.aromaBurst = new VBurst("sunburstchart", this.vWine);
                    break;
                }

              case 3:
                {
                    vCameraSingleton.hide();
                    VMain.setBackground(OPAQUE);
                    this.setBackground(OPAQUE);
                    if (this.initTabs[e.index]) break;
                    let radar = new VRadar();
                    radar.generateEditableChart(this.vWine, "taste-radar").then(() => {});
                    break;
                }

              case 4:
                {
                    vCameraSingleton.hide();
                    VMain.setBackground(MILKY);
                    this.setBackground(this.vWine.getImage().data);
                    if (this.initTabs[e.index]) break;
                    $(".save-wine-button").on("click", () => {
                        if (null != this.aromaBurst) this.vWine.updateSelectedAromas(this.aromaBurst.getSelectedItemsIds());
                        this.vWine.validate(VPageFactory.buildSaveWineErrorUls(this.vWine));
                    });
                    let foodElement = document.getElementById("wine-food");
                    $(document.getElementById("wine-food")).selectize(new SelectizeOptions("food", vDataSingleton.allFood, this.vWine.getFoodIds(), 20, items => {
                        this.vWine.food = [];
                        for (let item of items) {
                            this.vWine.food.push(vDataSingleton.searchSeriesById(item, vDataSingleton.foodSeries));
                        }
                    }));
                    $.extend($(document.getElementById("#wine-conclusion input")), new InputOptions("conclusion", v => {
                        this.vWine.setConclusion(v);
                    }));
                    $.extend($(document.getElementById("#wine-price input")), new InputOptions("price", v => {
                        this.vWine.setPrice(v);
                    }));
                    document.getElementById("wine-conclusion").text = this.vWine.getConclusion();
                    document.getElementById("wine-price").value = this.vWine.getPrice();
                    document.getElementById("choose-currency").value = this.vWine.getCurrency();
                    document.getElementById("choose-currency").addEventListener("change", e => {
                        this.vWine.setCurrency(e.target.value);
                    });
                    break;
                }
            }
            this.initTabs[e.index] = true;
        });
    }
    updateWineglass() {
        var colorTransparencyRange = document.getElementById("color-transparency-range");
        var colorParticlesRange = document.getElementById("color-particles-range");
        var color = this.vWine.getColor().code + parseInt(colorTransparencyRange.value).toString(16);
        var particles = colorParticlesRange.value;
        var delta_color = 30;
        var visualPage = document.getElementById("edit-wine-page-visual");
        if (visualPage === null) {
            return;
        }
        var draw;
        var drawingDiv = document.getElementById("drawing");
        if (drawingDiv !== null) {
            visualPage.removeChild(drawingDiv);
        }
        drawingDiv = document.createElement("div");
        drawingDiv.id = "drawing";
        var wineGlassImg = document.getElementById("wine-glass");
        var scale = wineGlassImg.width / this.originalGlassWidth;
        drawingDiv.style = "position:absolute; width:" + visualPage.clientWidth + "px; height: " + visualPage.clientHeight + "px; margin-top: 15px;";
        visualPage.appendChild(drawingDiv);
        draw = SVG("drawing").size(visualPage.clientWidth, visualPage.clientHeight);
        var wine = draw.path(this.wineSpot);
        var wineWidth = 180 * scale;
        var wineHeight = 200 * scale;
        wine.size(wineWidth, wineHeight);
        var color1 = color.substr(0, 7);
        var opacity = parseInt(color.substr(7, 2), 16) / 255;
        var rgb = vServiceSingleton.hexToRgb(color1);
        var r = rgb.r + delta_color / 5;
        var g = rgb.g + delta_color / 5;
        var b = rgb.b + delta_color / 5;
        r = r > 254 ? 255 : r;
        g = g > 254 ? 255 : g;
        b = b > 254 ? 255 : b;
        var color2 = vServiceSingleton.rgbToHex(r, g, b);
        var gradient = draw.gradient("radial", stop => {
            stop.at({
                offset: .3,
                color: color1,
                opacity: opacity
            });
            stop.at({
                offset: .85,
                color: color2,
                opacity: opacity * .99
            });
            stop.at({
                offset: 1,
                color: color2,
                opacity: 0
            });
        });
        var offsetX = (visualPage.clientWidth - wineWidth) / 2;
        var offsetY = 16 * scale;
        wine.fill(gradient).move(offsetX, offsetY);
        var minSize = 0;
        var maxSize = Math.floor(Math.sqrt(particles));
        for (var i = 0; i < particles * 10; i++) {
            var particle = draw.path("M " + vServiceSingleton.getRandomInt(minSize, maxSize) + "," + vServiceSingleton.getRandomInt(minSize, maxSize) + " " + vServiceSingleton.getRandomInt(minSize, maxSize) + "," + vServiceSingleton.getRandomInt(minSize, maxSize) + " " + vServiceSingleton.getRandomInt(minSize, maxSize) + "," + vServiceSingleton.getRandomInt(minSize, maxSize) + " " + vServiceSingleton.getRandomInt(minSize, maxSize) + "," + vServiceSingleton.getRandomInt(minSize, maxSize) + " Z");
            var R = wineWidth / 2 - 20;
            var p = vServiceSingleton.getRandomPolar(R);
            particle.fill(color).move(p.x + offsetX + R + 17, p.y + offsetY + R + 32);
        }
    }
    wineSpot = "M2.7,108.4c-0.4,7.6-0.3,16.4-0.3,16.4c0,0.4,0.1,4.5,0.3,7.6c0.7,13.4,4.3,24.9,4.5,25.8c1.6,5.1,5.3,15.5,13.1,26.8c2.9,4.2,6.1,8.8,11.6,13.6c6.5,5.7,12.5,8.7,16.9,10.9c9,4.4,16.5,6.1,18.7,6.6c7.9,1.7,13.9,1.7,20.5,1.8c7.2,0,12.7,0.1,20-1.5c8.6-1.9,14.8-5,18.9-7.1c2.4-1.2,9.3-4.9,17.2-11.4c3.8-3.1,8.6-7.1,13.1-13.1c5.8-7.7,8-14.3,11.9-26.3c2.6-7.9,5.1-15.9,5.3-25.8c0-0.5,0-0.5,0-7.8c0-10.1,0-16.3,0-16.7c0-3.8-1.3-41.4-30.1-68.7c-6.6-6.3-26.3-25.1-56.3-25c-30.1,0-49.9,19-55.8,24.8C32.2,39.2,5,65.3,2.7,108.4z";
}

class VWine extends VAbstractProduct {
    constructor(willBeOpen = true) {
        super("wine");
        Object.assign(this, this.reset());
        this.willBeOpen = willBeOpen;
    }
    originalGlassWidth = 0;
    originalGlassHeight = 0;
    getTasteKeys() {
        return [ "acidity", "bitterness", "salt", "sugar", "body", "persistence", "gas", "tannins", "astringency" ];
    }
    reset() {
        var today = new Date();
        return {
            editable: true,
            call: 0,
            nid: -1,
            open: false,
            author: jDrupal.currentUser().id(),
            name: "Château Paris",
            vintage: today.getFullYear(),
            publishDate: vServiceSingleton.date_str(today),
            tastingDate: vServiceSingleton.date_str(today),
            alcohol: 13,
            appellations: [ null ],
            producer: [ null ],
            boutique: [ null ],
            varieties: [ null ],
            bio: {
                value: 0,
                name: VLocal.wineBioRangeNames[0]
            },
            sulfites: {
                value: 0,
                name: VLocal.wineSulfitesRangeNames[0]
            },
            vegan: {
                value: 0,
                name: VLocal.wineVeganRangeNames[0]
            },
            aromas: [ {
                tid: 0,
                name: "Grape"
            } ],
            intensity: 1,
            visual: {
                transparency: 3,
                particles: 1
            },
            color: vDataSingleton.wineColors.red[0],
            taste: {
                sugar: 1,
                salt: 1,
                tannins: 1,
                astringency: 1,
                persistence: 1,
                bitterness: 1,
                acidity: 1,
                body: 1,
                gas: 1
            },
            conclusion: "",
            image: null,
            price: 10,
            stock: 0,
            currency: "EUR",
            food: [ {
                tid: 0,
                name: "French fries"
            } ],
            entity: null
        };
    }
    decreaseStock() {
        return new Promise((resolve, reject) => {
            this.node.entity.field_stock_counter[0].value = this.stock - 1;
            this.node.save().then(() => {
                resolve(--this.stock);
            });
        });
    }
    getStock() {
        return null === this.stock ? 0 : this.stock;
    }
    setStock(stock) {
        this.stock = stock;
    }
    isOpen() {
        return this.open | this.willBeOpen;
    }
    wasOpen() {
        return this.open;
    }
    getTastingDate() {
        return this.tastingDate;
    }
    setTastingDate(date) {
        this.tastingDate = date;
    }
    getBio() {
        return this.bio.value;
    }
    setBio(bio) {
        return this.bio.value = bio;
    }
    getSulfites() {
        return this.sulfites.value;
    }
    setSulfites(sulfites) {
        this.sulfites.value = sulfites;
    }
    getVegan() {
        return this.vegan.value;
    }
    setVegan(vegan) {
        this.vegan.value = vegan;
    }
    getVintage() {
        return this.vintage;
    }
    setVintage(vintage) {
        this.vintage = vintage;
    }
    getCurrency() {
        return this.currency;
    }
    setCurrency(currency) {
        this.currency = currency;
    }
    getAlcohol() {
        return this.alcohol;
    }
    setAlcohol(alcohol) {
        this.alcohol = alcohol;
    }
    getVarieties() {
        return this.varieties;
    }
    getVarietiesText() {
        if (null != this.getVarieties() && this.varieties.length > 0) {
            return this.varieties.map(variety => variety ? variety.name : "").join(", ");
        } else return "";
    }
    getVarietiesIds() {
        if (null != this.getVarieties() && this.varieties.length > 0) {
            return this.varieties.map(variety => variety ? variety.tid : null);
        } else return [];
    }
    getFood() {
        return this.food;
    }
    getFoodText() {
        if (null != this.getFood() && this.food.length > 0) {
            return this.food.map(f => f ? f.name : "").join(", ");
        } else return "";
    }
    getFoodIds() {
        if (null != this.getFood() && this.varieties.length > 0) {
            return this.food.map(f => f ? f.tid : null);
        } else return [];
    }
    getTransparency() {
        return this.visual.transparency;
    }
    setTransparency(value) {
        this.visual.transparency = value;
    }
    getParticles() {
        return this.visual.particles;
    }
    setParticles(value) {
        this.visual.particles = value;
    }
    getColor() {
        return this.color;
    }
    setColor(color) {
        this.color = color;
    }
    getIntensity() {
        return this.intensity;
    }
    setIntensity(value) {
        this.intensity = value;
    }
    getAromas() {
        return this.aromas;
    }
    load(wid) {
        return new Promise((resolve, reject) => {
            VMain.modalShow("modal-custom");
            jDrupal.entityLoad("node", wid).then(node => {
                var varieties = [];
                for (let v of node.entity.field_grape_varieties) {
                    varieties.push(vDataSingleton.allVarieties.find(variety => parseInt(variety.tid) === parseInt(v.target_id)));
                }
                var appellations = [];
                for (let a of node.entity.field_wine_appellation) {
                    appellations.push(vDataSingleton.allAppellations.find(appellation => parseInt(appellation.tid) === parseInt(a.target_id)));
                }
                var producer = [];
                for (let p of node.entity.field_producer) {
                    producer.push(vDataSingleton.allProducers.find(producer => parseInt(producer.tid) == parseInt(p.target_id)));
                }
                var boutique = [];
                for (let p of node.entity.field_boutique) {
                    boutique.push(vDataSingleton.allBoutiques.find(boutique => parseInt(boutique.tid) == parseInt(p.target_id)));
                }
                var aromas = [];
                for (let a of node.entity.field_wine_aromas) {
                    aromas.push(vDataSingleton.searchSeriesById(a.target_id, vDataSingleton.aromasSeries));
                }
                var food = [];
                for (let f of node.entity.field_food_pairing) {
                    food.push(vDataSingleton.searchSeriesById(f.target_id, vDataSingleton.foodSeries));
                }
                var color = null;
                if (node.entity.field_wine_color.length > 0) {
                    color = vDataSingleton.wineColors.red.find(color => parseInt(color.tid) == parseInt(node.entity.field_wine_color[0].target_id));
                    if (undefined == color) color = vDataSingleton.wineColors.white.find(color => parseInt(color.tid) == parseInt(node.entity.field_wine_color[0].target_id));
                    if (undefined == color) color = vDataSingleton.wineColors.rose.find(color => parseInt(color.tid) == parseInt(node.entity.field_wine_color[0].target_id));
                }
                var publishDate = new Date().toDateString();
                if (node.entity.field_tasting_date.length > 0) publishDate = new Date(node.entity.created[0].value).toDateString();
                var tastingDate = 0;
                if (node.entity.field_tasting_date.length > 0) tastingDate = node.entity.field_tasting_date[0].value;
                var conclusion = "";
                if (node.entity.field_conclusion.length > 0) conclusion = node.entity.field_conclusion[0].value;
                var bio = 0;
                if (node.entity.field_wine_bio.length > 0) bio = parseInt(node.entity.field_wine_bio[0].value);
                var vegan = false;
                if (undefined !== node.entity.field_vegan && node.entity.field_vegan.length > 0) vegan = node.entity.field_vegan[0].value == 1 ? true : false;
                var open = true;
                if (node.entity.field_open.length > 0) open = node.entity.field_open[0].value == 1 ? true : false;
                var sulfites = 0;
                if (node.entity.field_wine_sulfites.length > 0) sulfites = parseInt(node.entity.field_wine_sulfites[0].value);
                var vintage = 0;
                if (node.entity.field_vintage.length > 0) vintage = parseInt(node.entity.field_vintage[0].value);
                var alcohol = 0;
                if (node.entity.field_alcohol.length > 0) alcohol = parseFloat(node.entity.field_alcohol[0].value);
                var url = "css/splash.png";
                var label = null;
                if (node.entity.field_wine_label.length > 0) {
                    url = node.entity.field_wine_label[0].url;
                    label = node.entity.field_wine_label[0];
                }
                var price = 0;
                var currency = "EUR";
                if (node.entity.field_bottle_price.length > 0) {
                    price = parseFloat(node.entity.field_bottle_price[0].number);
                    currency = node.entity.field_bottle_price[0].currency_code;
                }
                var stock = 0;
                if (undefined != node.entity.field_stock_counter && node.entity.field_stock_counter.length > 0) {
                    stock = parseInt(node.entity.field_stock_counter[0].value);
                }
                var authorID = node.entity.uid[0].target_id;
                Object.assign(this, {
                    editable: false,
                    open: open,
                    call: 0,
                    nid: parseInt(node.entity.nid[0].value),
                    name: node.entity.title[0].value,
                    author: null,
                    vintage: vintage,
                    publishDate: publishDate,
                    tastingDate: tastingDate,
                    alcohol: alcohol,
                    appellations: appellations,
                    producer: producer,
                    boutique: boutique,
                    varieties: varieties,
                    bio: {
                        value: bio,
                        name: VLocal.wineBioRangeNames[bio]
                    },
                    sulfites: {
                        value: sulfites,
                        name: VLocal.wineSulfitesRangeNames[sulfites]
                    },
                    vegan: {
                        value: vegan,
                        name: VLocal.wineVeganRangeNames[vegan]
                    },
                    aromas: aromas,
                    intensity: parseInt(node.entity.field_wine_intensity[0].value),
                    visual: {
                        transparency: parseInt(node.entity.field_wine_transparency[0].value),
                        particles: parseInt(node.entity.field_wine_particules[0].value)
                    },
                    color: color,
                    taste: {
                        sugar: parseInt(node.entity.field_wine_sugar[0].value),
                        salt: parseInt(node.entity.field_wine_salt[0].value),
                        tannins: parseInt(node.entity.field_wine_tannins[0].value),
                        astringency: parseInt(node.entity.field_wine_astringency[0].value),
                        persistence: parseInt(node.entity.field_wine_persistence[0].value),
                        bitterness: parseInt(node.entity.field_wine_bitterness[0].value),
                        acidity: parseInt(node.entity.field_wine_acidity[0].value),
                        gas: parseInt(node.entity.field_wine_gas[0].value),
                        body: parseInt(node.entity.field_wine_body[0].value)
                    },
                    conclusion: conclusion,
                    image: {
                        data: url,
                        url: url,
                        info: label
                    },
                    price: price,
                    currency: currency,
                    stock: stock,
                    food: food,
                    node: node
                });
                jDrupal.viewsLoad("authorapp/" + authorID + "?_format=json").then(view => {
                    var views = view.getResults();
                    if (views.length == 0) {
                        this.author = {
                            uid: -1,
                            name: VLocal.Unknown,
                            pic: ""
                        };
                        VMain.modalHide();
                        resolve();
                    } else {
                        this.author = views[0];
                        this.editable = _isDebugUser() || this.author.uid == jDrupal.currentUser().id() || 1 == jDrupal.currentUser().id() ? true : false;
                        VMain.modalHide();
                        resolve();
                    }
                });
            });
        }, () => {
            _release_toast(VLocal.ServerGetResultsError);
            reject();
        });
    }
    createNewNode() {
        if (!this.wasOpen() && this.isOpen() && this.getStock() > 0) this.stock--;
        var aromasTmp = [];
        for (let aroma of this.aromas) {
            if (aroma) aromasTmp.push({
                target_id: aroma.tid
            });
        }
        var varietiesTmp = [];
        for (let variety of this.varieties) {
            if (variety) varietiesTmp.push({
                target_id: variety.tid
            });
        }
        var appellationsTmp = [];
        for (let appellation of this.appellations) {
            if (appellation) appellationsTmp.push({
                target_id: appellation.tid
            });
        }
        var pairingTmp = [];
        for (let pairing of this.food) {
            if (pairing) pairingTmp.push({
                target_id: pairing.tid
            });
        }
        var producerTmp = [];
        for (let producer of this.producer) {
            if (producer) producerTmp.push({
                target_id: producer.tid
            });
        }
        var boutiqueTmp = [];
        for (let boutique of this.boutique) {
            if (boutique) boutiqueTmp.push({
                target_id: boutique.tid
            });
        }
        var node = new jDrupal.Node({
            type: [ {
                target_id: "wine"
            } ],
            title: [ {
                value: this.name
            } ],
            field_conclusion: [ {
                value: this.conclusion
            } ],
            field_vintage: [ {
                value: this.vintage
            } ],
            field_alcohol: [ {
                value: this.alcohol
            } ],
            field_bottle_price: [ {
                number: this.price,
                currency_code: this.currency
            } ],
            field_stock_counter: [ {
                value: parseInt(this.stock)
            } ],
            field_wine_aromas: aromasTmp,
            field_producer: producerTmp,
            field_boutique: boutiqueTmp,
            field_tasting_date: [ {
                value: this.tastingDate
            } ],
            field_grape_varieties: varietiesTmp,
            field_wine_appellation: appellationsTmp,
            field_food_pairing: pairingTmp,
            field_wine_transparency: [ {
                value: this.visual.transparency
            } ],
            field_wine_particules: [ {
                value: this.visual.particles
            } ],
            field_wine_gas: [ {
                value: this.taste.gas
            } ],
            field_wine_body: [ {
                value: this.taste.body
            } ],
            field_wine_acidity: [ {
                value: this.taste.acidity
            } ],
            field_wine_bitterness: [ {
                value: this.taste.bitterness
            } ],
            field_wine_astringency: [ {
                value: this.taste.astringency
            } ],
            field_wine_tannins: [ {
                value: this.taste.tannins
            } ],
            field_wine_sugar: [ {
                value: this.taste.sugar
            } ],
            field_wine_salt: [ {
                value: this.taste.salt
            } ],
            field_wine_persistence: [ {
                value: this.taste.persistence
            } ],
            field_wine_intensity: [ {
                value: this.intensity
            } ],
            field_wine_bio: [ {
                value: this.bio.value
            } ],
            field_wine_sulfites: [ {
                value: this.sulfites.value
            } ],
            field_wine_color: [ {
                target_id: this.color.tid
            } ],
            field_wine_label: [ {
                target_id: null
            } ],
            field_open: [ {
                value: this.isOpen()
            } ],
            field_vegan: [ {
                value: this.vegan.value
            } ],
            nid: [ {
                value: this.nid
            } ]
        });
        if (this.nid < 0) delete node.entity.nid;
        return node;
    }
    save(check) {
        if (!check) this.tidsCreated(); else {
            var producerToCreate = check.producer;
            var boutiqueToCreate = check.boutique;
            var appellationsToCreate = check.appellations;
            var varietiesToCreate = check.varieties;
            if (0 == producerToCreate.length && 0 == boutiqueToCreate.length && 0 == appellationsToCreate.length && 0 == varietiesToCreate.length) this.tidsCreated(); else if (producerToCreate.length > 0) {
                this.createTag("producer", producerToCreate[0]).then(resultTag => {
                    this.producer.push(resultTag);
                    this.tidsCreated();
                });
            } else if (boutiqueToCreate.length > 0) {
                this.createTag("boutique", boutiqueToCreate[0]).then(resultTag => {
                    this.boutique.push(resultTag);
                    this.tidsCreated();
                });
            } else if (appellationsToCreate.length > 0) {
                this.createTag("appellation", appellationsToCreate.pop()).then(resultTag => {
                    this.appellations.push(resultTag);
                    check.appellations = appellationsToCreate;
                    this.save(check);
                });
            } else if (varietiesToCreate.length > 0) {
                this.createTag("variety", varietiesToCreate.pop()).then(resultTag => {
                    this.varieties.push(resultTag);
                    check.varieties = varietiesToCreate;
                    this.save(check);
                });
            }
        }
    }
    tidsCreated() {
        var node = this.createNewNode();
        var path = jDrupal.restPath() + "jsonapi/node/" + this.getType() + "/field_" + this.getType() + "_label";
        var image = this.getImage();
        vDrupalSingleton.uploadImage(image, path).then(image_file => {
            console.log("width" + this.getImage().width);
            if (null == image_file) {
                delete node.entity.field_wine_label;
            } else {
                node.entity.field_wine_label = [ {
                    target_id: image_file.attributes.drupal_internal__fid,
                    alt: "",
                    title: image_file.attributes.filename,
                    width: this.getImage().width,
                    height: this.getImage().height,
                    target_type: "file",
                    target_uuid: image_file.id,
                    url: jDrupal.restPath() + image_file.attributes.uri.url
                } ];
            }
            node.save().then(entity => {
                _release_toast(VLocal.WineSaved);
                if (this.callback) this.callback();
            }, () => {
                VMain.modalHide();
                VMain.setBackground(OPAQUE);
                _release_toast(VLocal.WineNotSaved);
            });
        }, () => {
            VMain.modalHide();
            _release_toast(VLocal.UnableToConnect);
        });
    }
    previewLabel(event) {
        let formData = new FormData($("#wine-label-form")[0]);
        if (formData.get("img").size / 1024 > 1e5) {
            for (var key of formData.keys()) {
                formData.delete(key);
            }
            _release_toast("File too big!");
            return;
        }
        var file = event.target.files[0];
        var reader = new FileReader();
        if (file) {
            reader.readAsDataURL(file);
        }
        reader.addEventListener("load", () => {
            ABCamera.mode = "photo";
            ABCamera.takePicture(reader.result);
        }, false);
    }
    generateImage() {
        VMain.pushPage({
            id: "generate-image-page.html",
            title: '" + ' + this.name + ' + "'
        }, "fade").then(() => {
            let wine = vDataSingleton.selectedWines.find(w => w.nid == this.nid);
            var page = document.getElementById("generate-image-page");
            var exportElement = document.getElementById("image-export");
            if (exportElement !== null) {
                page.removeChild(exportElement);
            }
            exportElement = document.createElement("div");
            exportElement.id = "image-export";
            var wineElement = document.createElement("ons-card");
            wineElement.style = "padding:0px; height:100%";
            wineElement.id = "wine_" + this.nid;
            var chartDiv = document.createElement("div");
            chartDiv.setAttribute("id", "chart_generate_" + this.nid);
            var wineDetailsListItem = document.createElement("ons-list-item");
            wineDetailsListItem.setAttribute("modifier", "nodivider");
            wineDetailsListItem.style = "font-size: smaller;";
            var wineHeader = document.createElement("ons-list-header");
            wineHeader.style = "text-transform:none;";
            wineHeader.innerHTML = "<strong>" + this.name + " " + this.vintage + "</strong>";
            if ("" !== this.producer) wineHeader.innerHTML += " " + this.producer.name;
            wineHeader.setAttribute("modifier", "nodivider");
            var wineBody = document.createElement("ons-list-item");
            wineBody.setAttribute("modifier", "nodivider");
            wineBody.style = "background-color: white!important";
            let itemHeight = 220;
            var whiteDiv = document.createElement("div");
            whiteDiv.classList.add("center");
            whiteDiv.style = "padding: 0px 6px 0px 0; background-color: white!important";
            var imageDiv = document.createElement("div");
            imageDiv.style = "margin-left:-14px; position: absolute; height:" + itemHeight + "px;" + "-webkit-mask-image: linear-gradient(to right, transparent 0%, black 25%,  black 75%, transparent 100%);";
            imageDiv.innerHTML = '<img src="' + this.image.url + '" style="height:' + itemHeight + 'px;"' + '"/>';
            var tmpColor = this.color.code + (255 * (parseInt(this.visual.transparency) / 5)).toString(16);
            chartDiv.style = "margin-left:auto; margin-right: -6px; height:" + itemHeight + "px; width:" + .8 * window.innerWidth + "px; " + "background: linear-gradient(to right, transparent,  " + tmpColor + ")";
            whiteDiv.appendChild(imageDiv);
            whiteDiv.appendChild(chartDiv);
            wineBody.appendChild(whiteDiv);
            var appellationsDiv = document.createElement("div");
            appellationsDiv.style = 'width:"' + window.innerWidth + '"px; height:' + itemHeight + "px;";
            appellationsDiv.id = "appellation-map-" + this.nid;
            var aromasDiv = document.createElement("div");
            aromasDiv.id = "wine-generate-sankey-" + this.nid;
            aromasDiv.classList.add("center");
            aromasDiv.style = "height: " + (window.innerHeight - 220 * 2) + "px; width: " + window.innerWidth + "px";
            setTimeout(() => {
                new VSankey(this, aromasDiv.id);
            }, 100);
            wineElement.appendChild(wineHeader);
            wineElement.appendChild(wineBody);
            wineElement.appendChild(appellationsDiv);
            wineElement.appendChild(aromasDiv);
            exportElement.appendChild(wineElement);
            page.appendChild(exportElement);
            let radar = new VRadar();
            vMapSingleton.setGoogleMap(appellationsDiv.id).then(() => {
                vMapSingleton.loadAppellation(wine, "map-legend");
            });
            radar.generateChart(wine, "", this.nid, "chart_generate_" + this.nid).then(() => {
                var sugarDiv = document.createElement("div");
                sugarDiv.style = "right: 10px;  top: 20px;  position: absolute;";
                var spark = parseInt(this.taste.gas) > 2 ? 0 : 2;
                var sugar = parseInt(this.taste.sugar) - 1 + spark;
                sugar = sugar > 5 ? 5 : sugar;
                sugarDiv.innerHTML = VLocal.wineSugarRangeNames[sugar];
                wineBody.appendChild(sugarDiv);
                setTimeout(() => {
                    VAlcohol.setGauge("generate-gauge-" + this.nid, this.alcohol, 40, "chart_generate_" + this.nid);
                }, 1);
                try {
                    const svgDocument = elementToSVG(exportElement);
                    const svgString = new XMLSerializer().serializeToString(svgDocument);
                    console.log(svgString);
                } catch (e) {
                    console.log(e);
                }
            });
        });
    }
}

class VBurst {
    constructor(target, product) {
        this.sunBurstChart = null;
        var minAngle = 360;
        var resolution = window.innerWidth * window.innerHeight;
        if (resolution <= 181760) minAngle = 30; else if (resolution <= 250125) minAngle = 20; else if (resolution <= 304704) minAngle = 15; else if (resolution <= 786432) minAngle = 10; else minAngle = 5;
        if ("wine" == product || "wine" == product.type) {
            this.selectedIds = typeof product == "string" ? vDataSingleton.selectedAromasIds : product.getAromasIds();
            this.sunburstOptions = {
                tooltip: null,
                backgroundColor: OPAQUE,
                aria: {
                    show: false
                },
                sort: null,
                downplay: null,
                highlight: null,
                emphasis: null,
                nodeClick: false,
                highlightPolicy: "none",
                series: {
                    zlevel: 2,
                    type: "sunburst",
                    emphasis: {
                        focus: "descendant"
                    },
                    data: vDataSingleton.aromasSeries,
                    center: [ "50%", "50%" ],
                    radius: [ 0, "80%" ],
                    label: {
                        fontSize: 10,
                        formatter: function(param) {
                            var depth = param.treePathInfo.length;
                            if (depth == 4) {
                                var arr = [ "{image|}" ];
                                return arr.join("");
                            } else return param.name;
                        }
                    },
                    levels: [ {}, {
                        r0: "10%",
                        r: "45%",
                        itemStyle: {
                            borderWidth: 2
                        },
                        label: {
                            rotate: "0",
                            align: "center"
                        }
                    }, {
                        minAngle: minAngle,
                        r0: "45%",
                        r: "85%",
                        label: {
                            minAngle: minAngle,
                            rotate: "0",
                            align: "center"
                        }
                    }, {
                        r0: "85%",
                        r: "95%",
                        minAngle: minAngle,
                        label: {
                            minAngle: minAngle,
                            padding: 3,
                            rotate: 0
                        },
                        itemStyle: {
                            borderWidth: 3,
                            opacity: .2
                        }
                    } ]
                }
            };
        } else {
            this.selectedIds = vDataSingleton.selectedFoodIds;
            this.sunburstOptions = {
                tooltip: null,
                aria: {
                    show: true
                },
                sort: null,
                series: {
                    zlevel: 2,
                    type: "sunburst",
                    emphasis: {
                        focus: "descendant"
                    },
                    data: vDataSingleton.foodSeries,
                    center: [ "50%", "50%" ],
                    radius: [ 0, "80%" ],
                    label: {
                        fontSize: 10,
                        formatter: function(param) {
                            var depth = param.treePathInfo.length;
                            if (depth == 4) {
                                var arr = [ "{image|}" ];
                                return arr.join("");
                            } else return param.name;
                        }
                    },
                    levels: [ {}, {
                        r0: "10%",
                        r: "45%",
                        itemStyle: {
                            borderWidth: 2
                        },
                        label: {
                            rotate: "0",
                            align: "center"
                        }
                    }, {
                        minAngle: minAngle,
                        r0: "45%",
                        r: "85%",
                        label: {
                            minAngle: minAngle,
                            rotate: "0",
                            align: "center"
                        }
                    }, {
                        r0: "85%",
                        r: "95%",
                        minAngle: minAngle,
                        label: {
                            minAngle: minAngle,
                            padding: 3,
                            rotate: 0
                        },
                        itemStyle: {
                            borderWidth: 3,
                            opacity: .2
                        }
                    } ]
                }
            };
        }
        this.divElement = document.getElementById(target);
        this.sunBurstChart = echarts.init(this.divElement, "fruit");
        this.sunBurstChart.setOption(this.sunburstOptions, true);
        this.sunBurstChart.on("click", params => {
            if (params.dataType === "edge") {
                console.log("edge");
            }
            if (params.componentType == "series") {
                var option = {
                    depth: params.treePathInfo.length,
                    direction: params.dataType,
                    data: params.data
                };
                if (option.depth == 4) {
                    console.log(option.data);
                    this.selectizeInstance.addItem(option.data.tid);
                }
            }
        });
        var tmpEl = document.createElement("div");
        tmpEl.width = "100%";
        this.selectizeElement = document.createElement("select");
        this.selectizeElement.id = "selectize-select";
        this.selectizeElement.setAttribute("multiple", "multiple");
        this.selectizeElement.classList.add(...[ "demo-default", "selectized" ]);
        this.selectizeElement.placeholder = VLocal.Aromas;
        tmpEl.appendChild(this.selectizeElement);
        this.divElement.parentNode.appendChild(tmpEl);
        let tmp = $(this.selectizeElement).selectize({
            plugins: [ "restore_on_backspace", "remove_button" ],
            delimiter: ",",
            persist: false,
            hideSelected: false,
            closeAfterSelect: true,
            maxItems: 20,
            openOnFocus: false,
            options: vDataSingleton.allAromas,
            labelField: "name",
            searchField: "name",
            valueField: "tid",
            create: _isDebugUser(),
            showAddOptionOnCreate: false,
            render: {
                item: function(item, escape) {
                    let html = '<div class="item">';
                    if (item.hasOwnProperty("img")) html += '<img height="24px" src="' + item.img + '"/ >&nbsp;';
                    html += '<span class="name">' + escape(item.name) + "</span></div>";
                    return html;
                }
            }
        });
        this.selectizeInstance = tmp[0].selectize;
        setTimeout(() => {
            for (let id of this.selectedIds) {
                this.selectizeInstance.addItem(id);
            }
        }, 500);
    }
    getSelectedItemsIds() {
        return this.selectizeInstance.items;
    }
}

class VFood extends VAbstractProduct {
    constructor() {
        super("food");
        Object.assign(this, this.reset());
    }
    getTasteKeys() {
        return [ "acidity", "bitterness", "salt", "sugar", "fat", "spiciness" ];
    }
}

class VFoodSearch {
    constructor(target) {
        this.divElement = document.getElementById(target);
        var tmpEl = document.createElement("div");
        tmpEl.width = "100%";
        tmpEl.style = "border: 1px solid " + VIVID10 + "; border-radius: 4px;";
        this.selectizeElement = document.createElement("select");
        this.selectizeElement.id = "selectize-select";
        this.selectizeElement.setAttribute("multiple", "multiple");
        this.selectizeElement.classList.add(...[ "demo-default", "selectized" ]);
        this.selectizeElement.placeholder = VLocal.Aromas;
        tmpEl.appendChild(this.selectizeElement);
        this.divElement.parentNode.appendChild(tmpEl);
        let tmp = $(this.selectizeElement).selectize({
            plugins: [ "restore_on_backspace", "remove_button" ],
            delimiter: ",",
            persist: false,
            hideSelected: false,
            closeAfterSelect: true,
            maxItems: 20,
            maxOptions: 1,
            openOnFocus: false,
            options: vDataSingleton.allFood,
            labelField: "name",
            searchField: "name",
            valueField: "tid",
            create: _isDebugUser(),
            showAddOptionOnCreate: false,
            render: {
                item: function(item, escape) {
                    let html = '<div class="item">';
                    if (item.hasOwnProperty("img")) html += '<img height="24px" src="' + item.img + '"/ >&nbsp;';
                    html += '<span class="name">' + escape(item.name) + "</span></div>";
                    return html;
                }
            }
        });
        this.selectizeInstance = tmp[0].selectize;
        setTimeout(() => {
            this.selectizeInstance.addItem(vDataSingleton.allFood[0].tid);
        }, 1e3);
    }
}

class VSankey {
    constructor(wine, target = "wine-sankey") {
        if (!VSankey.instance || target != "wine-sankey") {
            this._data = [];
            VSankey.instance = this;
            this.chart = echarts.init(document.getElementById(target), "macarons2");
        }
        VSankey.instance.init(wine);
        return VSankey.instance;
    }
    init(wine) {
        var data = [];
        var links = [];
        var climates = [];
        var appellation_name = "Unknown appellation";
        let i = 0;
        do {
            if (null === wine.appellations[i] || wine.appellations.length == 0 || undefined === wine.appellations[i]) {
                climates = [ "hot", "mild", "cold" ];
            } else {
                climates = wine.appellations[i].climates.length === 0 ? [ "hot", "mild", "cold" ] : wine.appellations[i].climates;
                appellation_name = wine.appellations[i].name;
                appellation_name += undefined !== wine.appellations[i].type ? " " + wine.appellations[i].type : "";
            }
            data.push(createNormalLabel(appellation_name, wine.color.code.substr(0, 7), 0));
            i++;
        } while (i < wine.appellations.length);
        var variety_aromas = [];
        var age_aromas = [];
        var botrytis_aromas = [];
        var fort_aromas = [];
        var late_aromas = [];
        var malo_aromas = [];
        var oak_aromas = [];
        var oxide_aromas = [];
        var yeast_aromas = [];
        for (let variety of wine.varieties) {
            variety_aromas[variety.name] = [];
            data.push(createNormalLabel(variety.name, variety.color == "white" ? "#EDE06E" : "#9C121F", 1));
            links.push({
                source: data[0].name,
                target: variety.name,
                value: 1
            });
        }
        var aromaDepthIndex = 1;
        var aroma_depth = 3;
        for (let wine_aroma of wine.aromas) {
            if (aromaDepthIndex % 7 === 0) aroma_depth++;
            data.push(createRichLabel(wine_aroma.name, wine_aroma.color, aroma_depth, null === wine_aroma.label.rich ? "" : wine_aroma.label.rich.image.backgroundColor.image));
            links.push({
                source: wine_aroma.name,
                target: wine.name,
                color: wine_aroma.color,
                value: 1
            });
            aromaDepthIndex++;
            if (wine.varieties.length == 0) continue;
            for (let variety of wine.varieties) {
                for (let climate of climates) {
                    for (let variety_aroma_id of variety.hot) {
                        if (climate == "hot" && (wine_aroma.tid == variety_aroma_id || wine_aroma.pid == variety_aroma_id) && !variety_aromas[variety.name].includes(wine_aroma.name)) {
                            data.find(d => d.name == wine_aroma.name).depth = 2;
                            links.push({
                                source: variety.name,
                                target: wine_aroma.name,
                                value: 1
                            });
                            variety_aromas[variety.name].push(wine_aroma.name);
                            aromaDepthIndex--;
                        }
                    }
                    for (let variety_aroma_id of variety.mild) {
                        if (climate == "mild" && (wine_aroma.tid == variety_aroma_id || wine_aroma.pid == variety_aroma_id) && !variety_aromas[variety.name].includes(wine_aroma.name)) {
                            data.find(d => d.name == wine_aroma.name).depth = 2;
                            links.push({
                                source: variety.name,
                                target: wine_aroma.name,
                                value: 1
                            });
                            variety_aromas[variety.name].push(wine_aroma.name);
                            aromaDepthIndex--;
                        }
                    }
                    for (let variety_aroma_id of variety.cold) {
                        if (climate == "cold" && (wine_aroma.tid == variety_aroma_id || wine_aroma.pid == variety_aroma_id) && !variety_aromas[variety.name].includes(wine_aroma.name)) {
                            data.find(d => d.name == wine_aroma.name).depth = 2;
                            links.push({
                                source: variety.name,
                                target: wine_aroma.name,
                                value: 1
                            });
                            variety_aromas[variety.name].push(wine_aroma.name);
                            aromaDepthIndex--;
                        }
                    }
                }
                let varietyColor = variety.color == "white" ? "#EDE06E" : "#9C121F";
                aromaDepthIndex = loopOnSpec(variety.age, varietyColor, age_aromas, wine_aroma.tid, wine_aroma.pid, wine_aroma.name, "css/bottles.png", variety.name, "Age", aromaDepthIndex);
                aromaDepthIndex = loopOnSpec(variety.botrytis, varietyColor, botrytis_aromas, wine_aroma.tid, wine_aroma.pid, wine_aroma.name, "css/grapes.png", variety.name, "Botrytis", aromaDepthIndex);
                aromaDepthIndex = loopOnSpec(variety.fort, varietyColor, fort_aromas, wine_aroma.tid, wine_aroma.pid, wine_aroma.name, "css/thermometer.png", variety.name, "Fortified", aromaDepthIndex);
                aromaDepthIndex = loopOnSpec(variety.late, varietyColor, late_aromas, wine_aroma.tid, wine_aroma.pid, wine_aroma.name, "css/grapes.png", variety.name, "Late harvest", aromaDepthIndex);
                aromaDepthIndex = loopOnSpec(variety.malo, varietyColor, malo_aromas, wine_aroma.tid, wine_aroma.pid, wine_aroma.name, "css/fermentation.png", variety.name, "Malolactic fermentation", aromaDepthIndex);
                aromaDepthIndex = loopOnSpec(variety.oak, varietyColor, oak_aromas, wine_aroma.tid, wine_aroma.pid, wine_aroma.name, "css/barrels.png", variety.name, "Oak", aromaDepthIndex);
                aromaDepthIndex = loopOnSpec(variety.oxide, varietyColor, oxide_aromas, wine_aroma.tid, wine_aroma.pid, wine_aroma.name, "css/oxydative.png", variety.name, "Oxidative", aromaDepthIndex);
                aromaDepthIndex = loopOnSpec(variety.yeast, varietyColor, yeast_aromas, wine_aroma.tid, wine_aroma.pid, wine_aroma.name, "css/yeast.png", variety.name, "Yeast", aromaDepthIndex);
            }
        }
        if (aromaDepthIndex % 7 === 0 && aroma_depth > 3) aroma_depth--;
        data.push(createNormalLabel(wine.name, wine.color.code.substr(0, 7), aroma_depth + 1, false));
        if (wine.varieties.length == 0) {
            data.push(createNormalLabel("Unknown variety", "grey", 1));
            links.push({
                source: data[0].name,
                target: "Unknown variety",
                value: 1
            });
        }
        const varietiesData = data.filter(d => d.depth == 1);
        const aromasData = data.filter(d => d.depth == 2);
        for (let variety of varietiesData) {
            const varietiesLinksWithAromas = links.filter(link => link.source == variety.name);
            if (varietiesLinksWithAromas.length > 0) {
                links.find(link => link.target == variety.name).value = varietiesLinksWithAromas.length;
            } else {
                links.push({
                    source: variety.name,
                    target: wine.name,
                    value: 1
                });
            }
        }
        if (aromasData.length > 0) {
            const specData = data.filter(d => d.depth == 1.5);
            for (let aroma of aromasData) {
                const aromaParentsLinks = links.filter(link => link.target == aroma.name);
                var val = aromaParentsLinks.length;
                var is_spec = false;
                for (let spec of specData) {
                    const parentSpecLinks = aromaParentsLinks.find(link => link.source == spec.name);
                    if (undefined === parentSpecLinks) continue; else {
                        const varietySpecLinks = links.filter(link => link.target == spec.name);
                        val += varietySpecLinks.length == 0 ? 0 : varietySpecLinks.length - 1;
                        is_spec = true;
                        aromaParentsLinks.find(link => link.target == aroma.name && link.source == spec.name).value = varietySpecLinks.length == 0 ? 1 : varietySpecLinks.length;
                    }
                }
                if (is_spec) links.find(link => link.source == aroma.name).value = val == 0 ? 1 : val;
            }
        }
        function loopOnSpec(spec_array, varietyColor, aromas_array, aroma_tid, aroma_pid, aroma_name, aroma_img, variety_name, spec_name, adi) {
            for (let variety_aroma_id of spec_array) {
                if (aroma_tid == variety_aroma_id || aroma_pid == variety_aroma_id) {
                    data.find(d => d.name == aroma_name).depth = 2;
                    if (aromas_array.length === 0) {
                        data.push(createRichLabel(spec_name, varietyColor, 1.5, aroma_img, 40));
                    }
                    if (!variety_aromas[variety_name].includes(spec_name)) {
                        links.push({
                            source: variety_name,
                            target: spec_name,
                            value: 1
                        });
                        variety_aromas[variety_name].push(spec_name);
                    }
                    if (!aromas_array.includes(aroma_name)) {
                        links.push({
                            source: spec_name,
                            target: aroma_name,
                            value: 1
                        });
                        aromas_array.push(aroma_name);
                        adi--;
                    }
                }
            }
            return adi;
        }
        function createNormalLabel(name, color, depth, breakline = true) {
            var data_name = name;
            if (breakline && data_name.indexOf(" - ") > 0) {
                data_name = data_name.replace(" - ", "\n");
            } else if (breakline && data_name.indexOf(" ") > 0) {
                data_name = data_name.replace(" ", "\n");
            }
            return {
                name: name,
                depth: depth,
                value: 1,
                itemStyle: {
                    normal: {
                        color: color,
                        borderColor: color
                    }
                },
                label: {
                    normal: {
                        formatter: data_name,
                        position: "inside",
                        verticalAlign: "middle",
                        color: "white",
                        textBorderColor: "black"
                    }
                }
            };
        }
        function createRichLabel(name, color, depth, img, size = 40) {
            var offset = [ size == 64 ? 16 : 6, 5 ];
            var data_name = name;
            if (data_name.indexOf(" ") > 0) {
                data_name = data_name.replace(" ", "\n");
                offset[1] = 10;
            }
            return {
                name: name,
                depth: depth,
                value: 1,
                itemStyle: {
                    normal: {
                        color: color,
                        borderColor: color
                    }
                },
                label: {
                    verticalAlign: "bottom",
                    position: "inside",
                    offset: offset,
                    formatter: [ "{b|}", "{a|" + data_name + "}" ].join("\n"),
                    rich: {
                        a: {
                            color: "white",
                            textBorderColor: "black",
                            fontSize: 10
                        },
                        b: {
                            backgroundColor: {
                                image: img
                            },
                            height: size
                        }
                    }
                }
            };
        }
        var chart_option = {
            backgroundColor: PASTEL,
            animation: false,
            silent: false,
            series: [ {
                type: "sankey",
                top: "5%",
                bottom: "5%",
                left: "5%",
                right: "5%",
                width: "90%",
                height: "90%",
                layoutIterations: 1,
                nodeGap: 40,
                focusNodeAdjacency: "allEdges",
                data: data,
                nodeWidth: 20,
                links: links,
                orient: "vertical",
                label: {
                    position: "top"
                },
                lineStyle: {
                    color: "source",
                    curveness: .6
                }
            } ]
        };
        this.chart.setOption(chart_option, true);
    }
}

if (!Array.prototype.last) {
    Array.prototype.last = function() {
        return this[this.length - 1];
    };
}

var WaveProgress = {
    center: 0,
    points: 10,
    smooth: true,
    path: null,
    pathHeight: 1,
    progress: 0,
    frameInterval: null,
    size: {
        w: 0,
        h: 0
    },
    can: null,
    setProgress: function(p) {
        this.progress = this.size.h - Math.round(p / 100 * this.size.h);
    },
    init: function(t) {
        var target = document.getElementById(t);
        var canvas = document.getElementById("wave-progress-canvas");
        if (null !== canvas) {
            paper.clear();
            target.removeChild(canvas);
        }
        canvas = document.createElement("canvas");
        canvas.id = "wave-progress-canvas";
        canvas.style = "width:100%; height:100%; position: absolute; top:0px; left: 0px; z-index:-1";
        target.insertBefore(canvas, target.firstChild);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        paper.setup(canvas);
        this.size.h = paper.view.size.height;
        this.size.w = paper.view.size.width + 50;
        this.pathHeight = 0;
        this.progress = this.size.h;
        this.path = new paper.Path();
        this.path.fillColor = VIVID, this.path.opacity = .9;
        this.center = paper.view.center;
        this.path.segments = [];
        this.path.add(paper.view.bounds.bottomLeft);
        var point = new paper.Point(-50, this.size.h);
        this.path.add(point);
        for (var i = 1; i < this.points + 1; i++) {
            point = new paper.Point(this.size.w / this.points * i, this.size.h);
            this.path.add(point);
        }
        this.path.add(paper.view.bounds.bottomRight);
        paper.view.onFrame = function(event) {
            if (event.count % 5 === 0) {
                WaveProgress.updateFrame();
            }
        };
    },
    updateFrame: function() {
        var height = 0;
        if (this.progress > 30) {
            height = this.progress;
        }
        this.pathHeight += (this.center.y - this.pathHeight) / 100;
        for (var i = 1; i < this.points + 2; i++) {
            var sinSeed = 2 * this.progress + (i + i % 10) * 100;
            var sinHeight = .1 * Math.sin(sinSeed / (200 * Math.random())) * this.pathHeight;
            var yPos = Math.sin(sinSeed / 100 * Math.random()) * sinHeight + height;
            this.path.segments[i].point.y = yPos;
        }
        this.path.smooth({
            type: "continuous"
        });
    }
};

function testWaveProgress() {
    WaveProgress.init("body");
    var p = 0;
    setInterval(function() {
        p = p + Math.round(Math.random());
        if (p < 100) WaveProgress.setProgress(p); else {
            p = 0;
            WaveProgress.init("body");
        }
    }, 30);
}

DEFAULT_ZOOM = 11;

class VMap {
    constructor() {
        if (!VMap.instance) {
            this._data = [];
            VMap.instance = this;
            this.is_googleMapLoaded = false;
            this.geolocationSuccess = true;
        }
        return VMap.instance;
    }
    reset() {
        this.mapchart = null;
        this.funnelchart = null;
        this.boutiquesGoogleMap = null;
        this.appellationGoogleMap = null;
        this.aopTagGoogleMap = null;
        this.appellations = [];
        this.taxonomy = [];
        this.target = null;
        this.legend = null;
        this.funnel = null;
        this.color = null;
        this.producerMarker = null;
        this.userMarker = null;
        this.boutiqueMarkers = [];
        this.appellationPolygones = [];
        this.nameToSearch = "";
        this.mapOptions = {
            center: this.lastLocation,
            zoom: DEFAULT_ZOOM,
            mapTypeControl: false,
            disableDefaultUI: true,
            zoomControl: false,
            zoomControlOptions: {
                style: google.maps.ZoomControlStyle.SMALL
            },
            backgroundColor: "rgba(255,255,255,0.5)",
            styles: _googleMapStyle,
            mapTypeId: "terrain"
        };
        if ("" !== vUserSingleton.getCity() && vServiceSingleton.getTimezone() == vUserSingleton.getTimezone()) {
            this.setLocation(vUserSingleton.getLocation());
        } else {
            this.geocodePosition({
                address: vServiceSingleton.getTimezone()
            }).then(latlng => {
                this.setLocation(latlng);
            });
        }
    }
    getSuggestions(predictions, status) {
        const allowedTypes = [ "bar", "restaurant", "cafe", "department_store", "supermarket", "shopping_mall", "store", "meal_delivery", "meal_takeaway", "liquor_store", "point_of_interest" ];
        var suggestions = [];
        return new Promise((resolve, reject) => {
            if (status != google.maps.places.PlacesServiceStatus.OK || !predictions) {
                console.log(status);
                reject();
            }
            predictions.forEach(prediction => {
                let intersection = prediction.types.filter(x => allowedTypes.includes(x));
                if (intersection.length > 0) {
                    var request = {
                        placeId: prediction.place_id,
                        fields: [ "name", "geometry", "type", "vicinity", "address_components" ]
                    };
                    this.googlePlacesService.getDetails(request, (place, status) => {
                        if (status == google.maps.places.PlacesServiceStatus.OK) {
                            var postcode = "";
                            var country = "";
                            var city = "";
                            for (let component of place.address_components) {
                                if (component.types[0] == "postal_code") {
                                    postcode = component.long_name;
                                } else if (component.types[0] == "country") {
                                    country = component.short_name;
                                } else if (component.types[0] == "locality") {
                                    city = component.long_name;
                                }
                            }
                            suggestions.push({
                                name: place.name,
                                search: place.name + " (" + place.vicinity + ")",
                                tid: prediction.place_id,
                                address: place.vicinity,
                                postcode: postcode,
                                country: country,
                                city: city,
                                location: {
                                    lat: place.geometry.location.lat(),
                                    lng: place.geometry.location.lng()
                                }
                            });
                            console.log(place);
                        }
                    });
                }
            });
            setTimeout(() => {
                resolve(suggestions);
            }, 500);
        });
    }
    getAutocompleteService() {
        return this.autocompleteService;
    }
    loadGoogleMapScript() {
        return new Promise((resolve, reject) => {
            if (this.is_googleMapLoaded) {
                resolve();
            } else if (navigator.geolocation) {
                _debug_toast("Geolocation supported", "DEBUG");
                _load_script("https://maps.googleapis.com/maps/api/js?" + "&key=AIzaSyDc0SyINoAZ7LA97IO224lHKbujwEKmkbI&libraries=geometry,places,drawing").then(() => {
                    _debug_toast("Geolocation google maps loaded", "DEBUG");
                    this.is_googleMapLoaded = true;
                    this.patchGoogleMaps();
                    this.googlePlacesService = new google.maps.places.PlacesService(document.createElement("div"));
                    this.autocompleteService = new google.maps.places.AutocompleteService();
                    this.reset();
                    resolve();
                }, () => {
                    _debug_toast("Geolocation google maps not loaded", "ERROR");
                });
            } else {
                reject();
                _debug_toast("Geolocation not supported", "ERROR");
            }
        });
    }
    patchGoogleMaps() {
        google.maps.Polygon.prototype.getBounds = function() {
            var bounds = new google.maps.LatLngBounds();
            var paths = this.getPaths();
            var path;
            for (var i = 0; i < paths.getLength(); i++) {
                path = paths.getAt(i);
                for (var ii = 0; ii < path.getLength(); ii++) {
                    bounds.extend(path.getAt(ii));
                }
            }
            return bounds;
        };
    }
    geocodePosition(position) {
        return new Promise(function(resolve, reject) {
            var latlng = [ 48.85, 2.34 ];
            var geocoder = new google.maps.Geocoder();
            console.log();
            geocoder.geocode(position, (results, status) => {
                console.log(results);
                if (status == google.maps.GeocoderStatus.OK) {
                    for (let component of results[0].address_components) {
                        if (component.types[0] == "address") {
                            vUserSingleton.setAddress(component.long_name);
                        } else if (component.types[0] == "postal_code") {
                            vUserSingleton.setPostalCode(component.long_name);
                        } else if (component.types[0] == "country") {
                            vUserSingleton.setCountryCode(component.short_name);
                        } else if (component.types[0] == "locality") {
                            vUserSingleton.setCity(component.long_name);
                        }
                    }
                    latlng = [ results[0].geometry.location.lat(), results[0].geometry.location.lng() ];
                    vUserSingleton.setLocation(latlng);
                    resolve(latlng);
                } else resolve(latlng);
            }, () => {
                resolve(latlng);
            });
        });
    }
    setUserPositionMarker(lat, lng) {
        if (this.boutiquesGoogleMap !== null) {
            this.boutiquesGoogleMap.setCenter({
                lat: lat,
                lng: lng
            });
            var marker = new google.maps.Marker({
                position: {
                    lat: lat,
                    lng: lng
                },
                map: this.boutiquesGoogleMap,
                animation: google.maps.Animation.DROP,
                icon: "css/geoloc.svg"
            });
        }
    }
    setProducerPositionMarker(producer) {
        if (this.producerMarker) this.producerMarker.setMap(null);
        if (!producer.geo) return;
        let latlng = producer.geo.split(";");
        this.appellationGoogleMap.setCenter(producer.location);
        this.producerMarker = new google.maps.Marker({
            position: {
                lat: parseFloat(latlng[0]),
                lng: parseFloat(latlng[1])
            },
            map: this.appellationGoogleMap,
            animation: google.maps.Animation.DROP
        });
        const infoContent = "<h3>" + producer.name + "</h3>" + "<p>" + producer.address + "</p>";
        const infowindow = new google.maps.InfoWindow({
            content: infoContent
        });
        infowindow.open({
            anchor: this.producerMarker,
            map: this.appellationGoogleMap,
            shouldFocus: false
        });
    }
    getUserLocation() {
        return new Promise((resolve, reject) => {
            if (_localInterface.is_appInReview) reject(); else if (!this.geolocationSuccess) {
                ons.notification.confirm({
                    title: VLocal.PermissionsNeeded,
                    messageHTML: VLocal.MapPermissions,
                    buttonLabels: [ VLocal.Ok, VLocal.Cancel ]
                }).then(function(input) {
                    if (input == 0) {
                        this.userLocationGranted().then(resolve, reject);
                    } else {
                        this.geolocationSuccess = false;
                        reject();
                    }
                });
            }
        });
    }
    userLocationGranted() {
        return new Promise((resolve, reject) => {
            var options = {
                enableHighAccuracy: true,
                timeout: 1e4,
                maximumAge: 0
            };
            navigator.geolocation.getCurrentPosition(position => {
                this.geolocationSuccess = true;
                this.setLocation([ position.coords.latitude, position.coords.longitude ]);
                this.geocodePosition({
                    location: this.lastLocation
                });
                resolve();
            }, () => {
                this.geolocationSuccess = false;
                this.setLocation(vUserSingleton.getLocation());
                resolve();
                _debug_toast("Geolocation failed", "DEBUG");
            }, options);
        });
    }
    setLocation(latlng) {
        this.lastLocation = new google.maps.LatLng(latlng[0], latlng[1]);
    }
    setGoogleMap(canvasName) {
        return new Promise((resolve, reject) => {
            var mapCanvas = document.getElementById(canvasName);
            if ("boutiques-map-canvas" == canvasName) {
                if (!this.boutiquesGoogleMap) this.boutiquesGoogleMap = new google.maps.Map(mapCanvas, this.mapOptions);
                this.setUserPositionMarker(this.lastLocation.lat(), this.lastLocation.lng());
                const options = {
                    componentRestrictions: {
                        country: "fr"
                    },
                    fields: [ "formatted_address", "geometry", "name" ],
                    origin: this.boutiquesGoogleMap.getCenter(),
                    strictBounds: false,
                    types: [ "establishment" ]
                };
                const autocomplete = new google.maps.places.Autocomplete(document.getElementById("address-search").childNodes[1], options);
                autocomplete.bindTo("bounds", this.boutiquesGoogleMap);
                autocomplete.addListener("place_changed", () => {
                    const place = autocomplete.getPlace();
                    if (!place.geometry || !place.geometry.location) {
                        _release_toast("No details available for input: '" + place.name + "'");
                        return;
                    }
                    if (place.geometry.viewport) {
                        this.boutiquesGoogleMap.fitBounds(place.geometry.viewport);
                    } else {
                        this.boutiquesGoogleMap.setCenter(place.geometry.location);
                    }
                    this.boutiquesGoogleMap.setZoom(DEFAULT_ZOOM);
                    this.setUserPositionMarker(place.geometry.location.lat(), place.geometry.location.lng());
                });
                let i = 0;
            } else this.appellationGoogleMap = new google.maps.Map(mapCanvas, this.mapOptions);
            resolve();
        });
    }
    createFunnelChart(appellation) {
        return;
        var data = [];
        var i = 0;
        var colors = [];
        var values = [];
        var labels = [];
        for (let hierarchy of vDataSingleton.allHierarchies) {
            if (appellation.hierarchy == hierarchy.tid) {
                var parent = vDataSingleton.allHierarchies.find(p => parseInt(p.tid) == parseInt(hierarchy.pid));
                labels.push(parent.name);
                values.push(parseInt(parent.rating));
                var max = 0;
                for (let sibling of parent.children) {
                    labels.push(sibling.name);
                    values.push(parseInt(sibling.rating));
                    max++;
                }
                for (i = 0; i < 2 * max; i++) {
                    i % 2 === 0 && parseInt(hierarchy.rating) == i / 2 ? colors.push("gold") : colors.push("gray");
                }
                break;
            }
        }
        if (!this.funnel) {
            this.funnel = new FunnelGraph({
                container: "#" + this.legend,
                gradientDirection: "vertical",
                data: {
                    labels: labels,
                    colors: colors,
                    values: values
                },
                color: "#FF5500",
                displayPercent: false,
                direction: "vertical",
                width: 100,
                height: 300
            });
            this.funnel.draw();
        } else this.funnel.updateData({
            labels: labels,
            colors: colors,
            values: values
        });
    }
    createFunnelChartX(appellations) {
        var data = [];
        var i = 0;
        for (let appellation of appellations) {
            let item = {
                value: i,
                name: "订单",
                itemStyle: {
                    borderColor: "#fff",
                    borderWidth: 2,
                    color: i < appellations.length - 1 ? "gris" : "gold"
                }
            };
            data.push(item);
            i++;
        }
        var option = {
            title: {
                text: "漏斗图",
                subtext: "纯属虚构"
            },
            tooltip: {
                trigger: "item",
                formatter: "{a} <br/>{b} : {c}%"
            },
            toolbox: {
                feature: {
                    dataView: {
                        readOnly: true
                    },
                    restore: {},
                    saveAsImage: {}
                }
            },
            legend: {
                data: [ "展现", "点击", "访问", "咨询", "订单" ]
            },
            series: [ {
                type: "funnel",
                left: "10%",
                top: 60,
                bottom: 60,
                width: "80%",
                min: 0,
                max: appellations.length > 2 ? appellations[1] : appellations.length,
                minSize: "0%",
                maxSize: "100%",
                sort: "ascending",
                gap: 2,
                label: {
                    show: true,
                    position: "inside"
                },
                labelLine: {
                    length: 10,
                    lineStyle: {
                        width: 1,
                        type: "solid"
                    }
                },
                itemStyle: {
                    borderColor: "#fff",
                    borderWidth: 1
                },
                emphasis: {
                    label: {
                        fontSize: 20
                    }
                },
                data: data
            } ]
        };
        var funnelchart = echarts.init(document.getElementById(this.legend), "vintage");
        funnelchart.setOption(option, true);
    }
    setPoly(coords, color) {
        if (coords.length == 0 || !this.appellationGoogleMap) {
            _release_toast(VLocal.EmptyAppellation);
            return;
        }
        var depth = vServiceSingleton.getArrayDepth(coords);
        if (depth == 1) {
            if (undefined !== coords) this.appellationGoogleMap.setCenter({
                lat: coords[0],
                lng: coords[1]
            });
            return;
        }
        if (depth == 2) coords = [ coords ];
        let i = 0;
        let maxArea = 0;
        let tmp = 0;
        let maxIndex = 0;
        for (let poly of coords) {
            let googleCoord = [];
            for (let point of poly) {
                googleCoord.push({
                    lat: point[0],
                    lng: point[1]
                });
            }
            this.appellationPolygones.push(new google.maps.Polygon({
                paths: googleCoord,
                strokeOpacity: .8,
                strokeWeight: 0,
                fillColor: color,
                fillOpacity: .35
            }));
            this.appellationPolygones[i].setMap(this.appellationGoogleMap);
            tmp = google.maps.geometry.spherical.computeArea(this.appellationPolygones[i].getPath());
            if (tmp > maxArea) {
                maxArea = tmp;
                maxIndex = i;
            }
            i++;
        }
        this.appellationGoogleMap.fitBounds(this.appellationPolygones[maxIndex].getBounds());
    }
    loadAppellation(wine, legend) {
        this.legend = legend;
        this.color = wine.color.code;
        let producer = vServiceSingleton.searchArrayExact(wine.producer, vDataSingleton.allProducers);
        if (null != producer && producer.length == 1) this.setProducerPositionMarker(producer[0]);
        var i = this.appellationPolygones.length - 1;
        while (this.appellationPolygones[i]) {
            this.appellationPolygones.pop().setMap(null);
            i--;
        }
        if (wine.appellations.length == 0) return;
        this.taxonomy = [];
        for (let appellation of wine.appellations) {
            this.taxonomy = this.taxonomy.concat(vDataSingleton.getFullHierarchy(appellation, vDataSingleton.allAppellations));
        }
        console.log(this.taxonomy);
        if (this.taxonomy.length > 1 && this.taxonomy[0].pid == "") this.taxonomy.shift();
        this.loopOnTaxonomy(0);
    }
    loopOnTaxonomy(i) {
        jDrupal.viewsLoad("detailedappellationsapp/" + this.taxonomy[i].tid + "?_format=json").then(view => {
            try {
                var appellation = view.getResults()[0];
                var delta_color = i * Math.floor(255 / this.taxonomy.length / 10);
                var rgb = vServiceSingleton.hexToRgb(this.color);
                rgb.r += delta_color;
                rgb.g += delta_color;
                rgb.b += delta_color;
                rgb = vServiceSingleton.saturateRgb(rgb);
                this.color = vServiceSingleton.rgbToHex(rgb.r, rgb.g, rgb.b);
                console.log(this.color);
                this.setPoly(JSON.parse(appellation.geojson), this.color);
                delete appellation.geojson;
                this.appellations.push(appellation);
            } catch (err) {
                console.log(err);
            }
            if (i < this.taxonomy.length - 1) {
                setTimeout(() => {
                    this.loopOnTaxonomy(++i);
                }, 10);
            }
        }, e => {
            console.log(e);
            return;
        });
    }
    createMapChart() {
        var series = mapchart.getOption().series;
        mapchart.setOption({
            geo: [ {
                center: JSON.parse(results[0].geojson)[0]
            } ]
        });
        for (let j in results) {
            series.push({
                name: results[j].name,
                type: "custom",
                coordinateSystem: "geo",
                renderItem: function(params, api) {
                    try {
                        var coords = JSON.parse(results[j].geojson);
                        if (null === coords || coords.length == 0) return;
                        var points = [];
                        for (var i = 0; i < coords.length; i++) {
                            points.push(api.coord(coords[i]));
                        }
                        var color = "white";
                        return {
                            type: "polygon",
                            shape: {
                                points: echarts.graphic.clipPointsByRect(points, {
                                    x: params.coordSys.x,
                                    y: params.coordSys.y,
                                    width: params.coordSys.width * 20,
                                    height: params.coordSys.height * 20
                                })
                            },
                            style: api.style({
                                fill: color,
                                stroke: echarts.color.lift(color)
                            })
                        };
                    } catch (err) {
                        return null;
                    }
                },
                itemStyle: {
                    opacity: .5
                },
                animation: false,
                silent: false,
                data: [ {
                    value: 0
                } ],
                tooltip: {
                    trigger: "item",
                    formatter: "{a}"
                }
            });
        }
        mapchart.setOption({
            series: series
        });
        map_option = {
            backgroundColor: "transparent",
            roam: true,
            geo: {
                zoom: 15,
                map: "world",
                label: {
                    emphasis: {
                        show: true
                    }
                },
                itemStyle: {
                    normal: {
                        areaColor: VIDID,
                        borderColor: "#ce1906"
                    },
                    emphasis: {
                        areaColor: "#95473f"
                    }
                },
                silent: true,
                regions: [ {
                    name: taxonomy[0].name,
                    itemStyle: {
                        areaColor: "red",
                        color: "red"
                    },
                    label: {
                        show: true
                    }
                } ]
            },
            series: []
        };
        if (map_option && typeof map_option === "object") {
            mapchart.setOption(map_option, true);
        }
        mapchart = echarts.init(document.getElementById(this.target), "vintage");
        var geoCoordMap = {
            Paris: [ 2.35, 48.85 ],
            Dijon: [ 20.35, 47.85 ]
        };
        var convertData = function(data) {
            var res = [];
            for (var i = 0; i < data.length; i++) {
                var geoCoord = geoCoordMap[data[i].name];
                if (geoCoord) {
                    res.push(geoCoord.concat(data[i].value));
                }
            }
            return res;
        };
    }
    zoomIn() {
        mapchart.setOption({
            geo: [ {
                zoom: mapchart.getOption().geo[0].zoom + 1
            } ]
        });
    }
    zoomOut() {
        mapchart.setOption({
            geo: [ {
                zoom: mapchart.getOption().geo[0].zoom - 1
            } ]
        });
    }
    static createAOPTag() {
        var AOPMap = document.getElementById("AOP-map.html");
        if (null === AOPMap) AOPMap = document.createElement("template");
        vCameraSingleton.init("back");
        AOPMap.id = "AOP-map.html";
        AOPMap.innerHTML = '<ons-page id="AOP-map-page" class="page__transparent">' + "<ons-toolbar>" + '<div class="left">' + "<ons-back-button ontouchend=\"VMain.pushMainPage({'id': 'aromaburst.html', prev: 'camera.html'});\"></ons-back-button>" + "</div>" + '<div class="center" style="width: 100%;max-height: 24px; margin-top: 8px;">' + '<ons-search-input  style="width: 100%;" id="google-place-input" placeholder="Search place" float></ons-search-input>' + "</div>" + '<div class="right">' + '<ons-toolbar-button id="map-save-fab" >' + '<ons-icon icon="md-save"></ons-icon>' + "</ons-toolbar-button>" + '<ons-toolbar-button id="map-undo-fab" >' + '<ons-icon icon="md-undo"></ons-icon>' + "</ons-toolbar-button>" + "</div>" + "</ons-toolbar>" + '<div id="map-image-div" style="pointer-events: none; position:fixed; top:0px; left: 0px; width:100%; height:100%; background-color:transparent">' + '<img  style="position:absolute" id="map-image" />' + "</div>" + '<div id="google-map-AOP-canvas" style="filter: opacity(0.2);  position:absolute; top:0; bottom: 0px; width:100%; height:100%; background-color:transparent">' + "</div>" + '<div id="drawing-canvas" style="display:none; position:absolute; top:0; bottom: 0px; width:100%; height:100%; background-color:transparent">' + "</div>" + '<ons-fab position="bottom center" id="map-camera-fab" >' + '<ons-icon icon="md-camera-alt"></ons-icon>' + "</ons-fab>" + "</ons-page>";
        $("#app-body")[0].appendChild(AOPMap);
        $("#sidemenu-left")[0].close();
        var polygonData = [];
        var shapes = [];
        let shapes_index = 0;
        VMain.setBackground(TRANSPARENT);
        document.getElementById("splitter-content").load("AOP-map.html").then(() => {
            vCameraSingleton.show();
            document.getElementById("map-save-fab").addEventListener("touchend", () => {
                polygonData = [];
                var precision = .5 * this.zoomScales[0] / this.zoomScales[this.aopTagGoogleMap.getZoom()];
                for (let shape of shapes) {
                    var poly = [];
                    for (let p of shape.array().value) {
                        let g = point2LatLng(p[0], p[1], this.aopTagGoogleMap);
                        poly.push([ setPrecision(g.lat(), precision), setPrecision(g.lng(), precision) ]);
                    }
                    var uniq = uniqBy(poly, JSON.stringify);
                    console.log(uniq.length + "vs" + poly.length);
                    polygonData.push(uniq);
                }
                vServiceSingleton.textToClipboard(JSON.stringify(polygonData));
                function setPrecision(v, p) {
                    return Math.round(v * p) / p;
                }
                function uniqBy(a, key) {
                    var seen = {};
                    return a.filter(function(item) {
                        var k = key(item);
                        return seen.hasOwnProperty(k) ? false : seen[k] = true;
                    });
                }
            });
            document.getElementById("map-camera-fab").addEventListener("touchend", () => {
                if (_is_app) vCameraSingleton.takePicture().then(imageData => {
                    pictureTaken(imageData);
                    document.getElementById("map-camera-fab").style.display = "none";
                }); else pictureTaken(null);
            });
            document.getElementById("map-undo-fab").addEventListener("touchend", () => {
                shapes_index--;
                shapes.pop().remove();
                polygonData.pop();
            });
            let point2LatLng = (x, y, map) => {
                var topRight = map.getProjection().fromLatLngToPoint(map.getBounds().getNorthEast());
                var bottomLeft = map.getProjection().fromLatLngToPoint(map.getBounds().getSouthWest());
                var scale = Math.pow(2, map.getZoom());
                var worldPoint = new google.maps.Point(x / scale + bottomLeft.x, y / scale + topRight.y);
                return map.getProjection().fromPointToLatLng(worldPoint);
            };
            let pictureTaken = imageData => {
                var mapImage = document.getElementById("map-image");
                mapImage.src = imageData;
                if (imageData == null) mapImage.src = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAoHCBYVFRgVFRUYGBgYGBgYGBkYGhgYGBgYGBgZGRgYGBgcIS4lHB4rIRgYJjgmKy8xNTU1GiQ7QDszPy40NTEBDAwMEA8QHhISGjQhJCM0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDE0NDQ0NDQ0NDQ0NDQ0NDQ0NDE0NDQ0NDQ0NDQ0NP/AABEIALcBEwMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAACBQYBB//EADoQAAIBAwIEAwUGBAYDAAAAAAECAAMEESExBRJBUWFxgRMikaGxBjLB0eHwFEJSggcjYnKi8RWywv/EABkBAAMBAQEAAAAAAAAAAAAAAAABAgMEBf/EACIRAQEBAQACAwACAwEAAAAAAAABAhEhMQMSQTJxQmGxIv/aAAwDAQACEQMRAD8A4kJLBJbM9DSieBPCe8g/plgYRWgAwi9pcUlhFMIqwAIoCWW3EZVIVUgCy28uLeNLTlLpwi59B5wBcJOO4hV991G3N+k7lKeF19fOfPqp958/1N9ZNXFeaWVoHmnqmIGQYVTFg0IrwMwphg0VVoUNAGUeGSoe8TVoZGgOthK6hRnU9ukvauWcaaDoIhTcf97TT4S2WJ9B5yGnWza2/M2SMTYRAOkBRUKu+T10nrP4/KORFpTiYztHOH3vKBiZ13UidCuUbB2z8JOp1Wbx3dvdEgHP4zUs64Y4O/TxnIWd1ia1Cp1U4Pbp+kxsaugvq601/wBR2H4zEVyd5WvUZ25mOSe/Tw8p6ieM2xJzwy1fPkdIZYBcdzCAjxmjPooMsDBr6y6wMTMk8kgHxgP3Uy6unUYl56Uz0ls0Smh2IhBbDpA+xlkBHWAMLQ8IVKXhB06hjdN8wCq0x2hkp9oRfKXCjtABhD/SDM3jrlVRiugdczX5e2Ypxa1NWkyZ13Ge41EVOe3pqabAT51xQAVXxsWO206kcU5qYQ6OCEYdR0z8Ji/aakqsgUY92LvT9MTMsDKCTMQHBllaBVpdTAGFMKGgVh1pntF05KLThEEWBxGi4PqIlQei/SbnCP1nO5M3/s+xYjbEFOlRzjXWec/rAmqztyA6Dcj6S9RcaZlI6BXeJ1BmMssqEkmLY1DjB6TZta5mTRp9ozbvM9Rpm9dNQYMNYYU++fSIWDzXp6yc6+tVrM1Ago/pM9z/AKfnLFHydZ6KfjN55jnvh4vkJdZXSTMYEzJKc/hPIB8fDmXV4t7SWDy0HEYQ6KD2iKPGEaAM+xHlLikemsqjmE8RAPUcjeHRwYuK/RoTA6QA0jekDkjv9ZV6h7QDF4/w0N/mIeVx/wAsd5zXE7vnChhh10M6vil2EXPXpmcPXfmYt3Mlf4HmeSSCCVkhkpk7S1vSJOI8MD3E1PU9PTvJtXMq2tqSd1+J/Ka9vwh22ENw20C6nedLYXVNcDmAPjMdav43xifrnG+zdQj7ufLQ/OZ9bh7oeVlII76fWfV7BlfUMreRBh73hqVF5XXPY9R5GTN1V+Ofj4/7I7kY+OZrcIDD3FGpOnrvHOP2rWz8je8pGUONx+Yj3AnR9BppptkeUv7c8pmOnrOmEXlGrdfOXqLjeeU6LoSMZJzr1itdyZpNS+mOs3PuK1Kgg+aUxCUk5mwIEcs6RMNcU+R/AjI/GFpe6ISrbs6M/VfeHl1+X0hqdis65RLOvia9tc5M5elUmvwx9Zz10OkzkQLExijSyJSpQOpxtNMa54rHeO+YXJkBnoXwl1SbMVcyQvNJAPh3NLB4Dnlg8ZGVeHSpEw0sHgGglWE/iQNyAB8pg3vEQmg1bt285j17x3+82nht4QDpL77QouiDnPfZf1mW3HazbMFA7dPUzJRCZcHH7xFabao8fuBpzBv7R84wn2jfPvIh8iV+RzOeU4PX5SyNDtDQ4txH2gGARjPzG+ZimNFvDPpiS2RS6hjhSRknb1h0/fhVbRiM432/fSe1kCgDHvddc4mxxqp7LCLjWYGSTFLb5q9SZ8T2PSY4wNz+/hNnhVrj3jv+9pj0cZx8TOksNgZG6rE7WpZW/OfePKi/ePfwE6ewurY4QU0YbHmC/U6kzDwHTkAwPnG+G8MoKNaHO3cnP/Ux8fro5fyN16dtTxVT3Cp2B90+GJscIv0raBhnt1nz7idoyZITkTOeXJIHl2jn2d4ezMtRmKLzALrhmbssVn+1Tvo/9seHVayENT+4edHXXl6MrY6EdfAR77GUaKWgUovOwyx/mLjQgHz/AAmvxO5/hipdzytkcxHug6YDHGBnPXsZyHDr0UrupQU+6XLp25W1wPLMfbIWZLfbfuLUkkZ1B0P78pzvEaZRyD11nV3BI5H3ByD57j8Zicdpcy82NRr6dRFjXND5c9yxVWP2yACI0THqc63DTdNeY9hNei4A5QNMYmbbrHWqBFLHYfPsBAMOrT5HZOx+W4+WJpcKQl1A7zPTLuSd2OT+U6zglqFwes5b/p1T15dFSogKJKigAwqDSL3zYU/veVIjrMMoTPSYMzpc62ZJTMkA+GZnoMpPQYEKGil7e4BC77eUvWqco+Uy7hs6jrvEYJ7nrLcuPh9ZQAnSWzr8oAWme8jKM51M8pgE7+We8OKAxjnHhiLp8DGZdaWfDWFSi2MEZ+fwPSGov/KR4RWnI8p2oP1Hn4S91ZcqhmXQ9Rp21+c0EpheVsgjHhr4HxjeQ6Mh1B+6dyBj5jT5TO6rXOZWO3CWaj7ctzKnKCvUAnAOeoyQPUTHdtSfhO24TT5BUtqoIWopVXG2u34fCc3xPgtSjU5GU4z7pGoIOcH5Ss6l9r+b4uSWT3/0hb75+E6Ow6CZFC33GNVOs3eG09RJ3rp/FnjpuH0s4zOrsaA0wJz1imAJ0Nk5xpOe10/Uv9pCjJ7PGu+exEHwmwp1XWrVUAoKYQDJVAmD7pO2WGT39BL3dehSfNRgWC82CC2dtlAJJ10Hn2j9nxm3qL7tcIc4Aqo9JTjbVwBrKzLYjVkNGiSjI7e1Vy/PzY1DsSFHYBSAPKfNeM0BRvkxoqsFH+0ouPnmfUreoCfu8pGjAYxtkEY3/WfP/wDE6mErUXH8yMG/tYYP/L6Rz3xN8eXX03DJg7GZ/E0HIR1EDwS7DU1Gc+6J5xWp7pBmf60c3TfEbovrMpqnvYmlaLO3F7HBvP102bWJXtz7RsD7o28T3nl1cYHIv93l2l7KhkiZ73+Rp8WP8q0eFWvWdZYU5k2FHadDapgTNpo4owJk8TrahfX8vxmo7YEw6vvMWPX6dJpidv8ATHd5P7ByTJiXdgIIvmbsXuZJJIE+EmeieSQAddMiY7nWbTbTFcYOO0DQHtCopGsCsZSqQO8VOPTVBGCvljQia1sp5cjGRg7YOO8UporjAHKw+caS4GAOUZGmfunzz+Ezq48dyx0Gv71BENb8PYnOmfgdemsNRtc+8CB3yw+kfosvck7ZOq+WDvJtVIVfhzDcgeDAqPLzh7Ohg4Oh9dIWtXzoQMdsaek9ouDjp0B/AxWqk8t+hb86KjYIzv2PUZ7bRm44ctRDTq5D0gSjjdkJz64inCn0wSfWb1B150dtSoK57qRggzDvK7c3ueV84vbP2DlWAxjR+rgtt57aeIjHCt51XHuDrVUr0Oqnqp6ETjrNHpuUcYIOPA+I8Jd12M5nmnYWrTVoXIUTnreriPJUB6zKtLGvTZXOW189ZuW70mHKQp9JiWCAjpN+gicu2scTpZKAViVPukDTfGNsHoMdJ8y/xTuc3FNP6KfMf73I/wDifTynLsdJ8P8AtpetVu6zqMoGCL5IOX4Ehj6zXGbdMfk1zIfBPtI1A8jar0Pb9J0NTjXtRvPnopZJ0xNPhtfTHbSabxPcT8fyXvK3HqYOZv0LgezDj7x0A8es5Nqmdt5t2NIqozv185M19YdxNXy0banzGdFYW20zOGUMkTrLG3ma7eG7Gjia1NcRa3SNnSOM6VvqmFx30mWzw9/Uy2M7RMidPxzk/tzbva8AyYXaeZAgXfM0QJ7SSL8pkiD4jJPDJmARpnXlHXmHr+c0GMGYjZaiERtp7c08HI6wAaFEbCY5QQcH9/Pxg7YM74zn01gaT5AGfjHrchTvnyxj1mfpr7aNTIQAaY66A/nB0amCADr17/GBqVmcYx5SUWC7zO1eY0qVMt8945QtATufTvE7avjabNie8z1qx0ZzKPaAocbjxxpNummRkbdfGKJSBEJRcodfu/SZW9aScPJTJGNxMbi/DA3vAar18O34zaD41Bl7hQy5jlU5q3o9DGksj0npIB2mtZgHECtLW4ZdxHUvWG5IjooiJ8TYU6b1MfcRmx3IGQI4m8L8c+0XJT5EP+Ywwv8Apz/Oe3h3M+dVqQXrmNUqTAFnYs7HmYncmLXTCdmc/WOLevtWbWpjtFKXuuR31jtQy1pYc7B226Dv5xask8niW68HuF0eYhj6fnOktqWcCJWtDGBOi4Xa95z2urnGpwy22nR21OJWVGa1FI4y1R6YlbiryqSekvmZPFLjJ5B5n8BHmdvE6vJ0mzEkk9ZYCUWEAnY5VWHSehBL6CL1q0CE5xJE/amSAfFmMrmeEzwmIIxkWDZpeltEZdxriK16RU+HSOkaxa5qZOBAB0ahGk0bcjSZ70CBn4wlvV2kanZ2NMeLyt9CMfQT1aXMdotSaP2rTnrpzIbt7XGs1LVcQVuoxCE46zK3rfM42qVVQJZ6y4mMjxlTJ4fTC3oXQ5x9Ixb3owRnTcTMZc9IJ6fbSODpm4qYfzM17CvtOcYHqdoelfldxmUnrrjcTN+0FwP4d/7f/ZZl/wDmh1BiPGL8VabIucnG/gwP4Ssz/wBROv41hXF12mfUqwj2tT+gny1gra0d25SCAN86ek6rqe+uSZvece2duXbbT6zrqHDeVAxEPwXhSgDT9J0F3TAQD0+U5d7+1dWczM4x7O1yZ0NnQxiKW3Imruq/7iB9YyvF7cHHtk9Dn6STtdDapH0mTw+8R8cjq3kQT8JrKZcrKzyFd3ARSx2AnNrW5iSTqTmOcdr8x5B5n8P35TGoOVOD6flNPh1O2fqPlxr6y/jVWFivtDjoICrW7v8ACdTmN1XA3MSesvTWCKr1y30kL9lxAl+aewOW7fOSAfHSZVjKzx5JvGMJSOkC7aS1PUYit4clqtRidFntOhy+cMqASy0ydpndda5xwJsRT2Rz7oJ8ps0eH531mpa2AHST9/q0+n2ZdvbuwGmJp2tg02La2HaaFOiJhrbbOGfRokCeuDNNkEG1IGR1rwnRQmMqmJYaQb1YyWbSL1KoEFWrTPeoTCRNpqrcQYfMDTTMbpUZXooCwMJTp5jQt41bWnhF0+BULXMcXh+ek07WxmnTtNNpPVeHNqlVPuMPUZidzXuW+8+ngAJ19W3Ezbi1B6Q+w51xVa1JPM2WPc6mFtqbdFnQPY5MNRsMdI/sX1JWVs2hx8J0ljxGsgwTzr2bf0beDtrWaAt9Iu07wpz85JO53g6lPI/feNNb41EiAHT4wg7PRDnOzQyFR0lrmhn99Yj7TGh3nZ8PyfacvtxfN8f1vZ6pp6/hF3rmVLZ3MoXAm7nW5z3kgfaiSAcrR4a7gEIoEpxrhYFIs7KCuoAG5mxwe4qsugCjuZyvGbhndg7FsEjTbScktd1zJGI6CWXOwhOSGppK6ykWpUu8dpU4Kms1bKjmRqtMxe2tJq0rbENa24xH/ZYmN03zkmlPEuRGOWW5IlEST1llaNmhPUtYAi6Zidy2JtvazIvqOIQqyKj5lqVLO8uqaxylTl9RxVKUbo0pESN0Ek1cg9va5mnbWk8tFmjT0ki0W3oAQ7ACKvdcsQr35jTzpy4cRFzA+3JhUGYlSPAusbpoJ5ToxulSgLV6VKMKk9ppCgRo6A9OYPGOdGDIxGdCNCM+s6RplcXpcy48YHGZb8VcjDqrfIxTiTrkMNO4/WUemVORL3CCohH7yJWNfXUo3n7ZsJ/xQ2Gp7DWeEsegERp3qroBg9gCYX+JY7KR56T0HmmOQ95Ir7Ru8kYU4zxNUBp099iR08vGcs65kVidTIZxycdt10uyT1VhMSyiV1PF6Im3YCZFFZsWQmemmI3rURh2ETt6gAgbm7BOBMvbb0fQxpEmbavmalIxBdacMlORYYCBKGnpMDi9GdMsx+LrpBLmUpxpFleWESPpjU1jdERanG6MKqNG3jqtpEqBjyGIqTu8zOXJM2blMiZqpgwEHoU8x2nRg6KRxBAq8RMRuksGFhEOIEOBPQZXMrzQ6XFy0RuhkgRgvBMuYKjKuKEz6ich8DN2usyr0aQW5N3w7gae82vmc6Sz1+3ziFWv7774DEfA4lKlZj0wJ6Of4x5e/wCVM+1PcSTO5pI+lwnUIycbZOPKUzJJOZ1VZZ6DJJAzFEzUtmnkkjTTI1auRBW+ScySSfxf63LTSaVNpJJnVmlaHVpJIJqxeZt/qJJIEw6g1kSSSURinHaMkkmrP0BH6YkkhE1d0zFTb6ySRkOi4jdJZJIhRgstiSSAUJgHbEkklUDStmMpJJGC1yZzX2kvfZUi3UkAeZ2kklfH5sG7zNcKlQnrPSx67yST0Xmq5kkkgH//2Q==";
                mapImage.onload = () => {
                    var ratio = mapImage.naturalHeight / mapImage.naturalWidth;
                    mapImage.height = window.outerHeight + 44;
                    mapImage.width = mapImage.height / ratio;
                    mapImage.style.left = (window.outerWidth - mapImage.width) / 2 + "px";
                    document.getElementById("drawing-canvas").style.display = "block";
                    var drawer = new SVG("drawing-canvas").size("100%", "100%");
                    console.log(drawer);
                    const getDrawObject = () => {
                        const option = {
                            stroke: "#ff0099",
                            "stroke-width": 2,
                            "fill-opacity": .2
                        };
                        return drawer.polyline().fill("none").stroke({
                            stroke: "#ff0099",
                            width: 1
                        });
                    };
                    drawer.on("mousedown", function(event) {
                        const shape = getDrawObject();
                        console.log(shapes_index);
                        shapes[shapes_index] = shape;
                        shape.draw(event);
                    });
                    drawer.on("mousemove", function(event) {
                        if (shapes[shapes_index]) {
                            shapes[shapes_index].draw("point", event);
                        }
                    });
                    drawer.on("mouseup", function(event) {
                        shapes[shapes_index].draw("stop", event);
                        shapes_index++;
                    });
                };
            };
            this.zoomScalesAbs = [ 591657550.5, 295828775.3, 147914387.6, 73957193.82, 36978596.91, 18489298.45, 9244649.227, 4622324.614, 2311162.307, 1155581.153, 577790.5767, 288895.2884, 144447.6442, 72223.82209, 36111.91104, 18055.95552, 9027.977761, 4513.98888, 2256.99444, 1128.49722 ];
            this.zoomScales = [ 1048576, 524288, 262144, 131072, 65536, 32768, 16384, 8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1 ];
            var newLocation = new google.maps.LatLng(48.85, 2.35);
            var mapOptions = {
                center: newLocation,
                zoom: 15,
                mapTypeControl: true,
                disableDefaultUI: true,
                zoomControl: false,
                scaleControl: true,
                zoomControlOptions: {
                    style: google.maps.ZoomControlStyle.SMALL
                },
                backgroundColor: "none",
                styles: _googleMapStyle
            };
            var mapCanvas = document.getElementById("google-map-AOP-canvas");
            this.aopTagGoogleMap = new google.maps.Map(mapCanvas, mapOptions);
            var googlePlaceInput = document.getElementById("google-place-input");
            var searchBox = new google.maps.places.SearchBox(googlePlaceInput);
            this.aopTagGoogleMap.addListener("bounds_changed", () => {
                searchBox.setBounds(this.aopTagGoogleMap.getBounds());
            });
            searchBox.addListener("places_changed", () => {
                var bounds = new google.maps.LatLngBounds();
                var places = searchBox.getPlaces();
                places.forEach(function(place) {
                    if (!place.geometry) {
                        console.log("Returned place contains no geometry");
                        return;
                    }
                    if (place.geometry.viewport) {
                        bounds.union(place.geometry.viewport);
                    } else {
                        bounds.extend(place.geometry.location);
                    }
                });
                this.aopTagGoogleMap.fitBounds(bounds);
            });
        });
    }
    googleMapStyle = [ {
        featureType: "all",
        elementType: "geometry",
        stylers: [ {
            color: "#212121"
        } ]
    }, {
        featureType: "all",
        elementType: "labels.text.fill",
        stylers: [ {
            color: "#757575"
        } ]
    }, {
        featureType: "all",
        elementType: "labels.text.stroke",
        stylers: [ {
            color: "#212121"
        } ]
    }, {
        featureType: "all",
        elementType: "labels.icon",
        stylers: [ {
            visibility: "off"
        } ]
    }, {
        featureType: "administrative",
        elementType: "geometry",
        stylers: [ {
            color: "#757575"
        } ]
    }, {
        featureType: "administrative.country",
        elementType: "labels.text.fill",
        stylers: [ {
            color: "#b10c0c"
        } ]
    }, {
        featureType: "administrative.province",
        elementType: "all",
        stylers: [ {
            visibility: "on"
        } ]
    }, {
        featureType: "administrative.province",
        elementType: "geometry.fill",
        stylers: [ {
            visibility: "on"
        } ]
    }, {
        featureType: "administrative.province",
        elementType: "labels",
        stylers: [ {
            visibility: "on"
        } ]
    }, {
        featureType: "administrative.locality",
        elementType: "all",
        stylers: [ {
            visibility: "simplified"
        }, {
            color: "#ff0000"
        } ]
    }, {
        featureType: "administrative.locality",
        elementType: "geometry.fill",
        stylers: [ {
            visibility: "simplified"
        } ]
    }, {
        featureType: "administrative.locality",
        elementType: "geometry.stroke",
        stylers: [ {
            visibility: "on"
        } ]
    }, {
        featureType: "administrative.locality",
        elementType: "labels",
        stylers: [ {
            visibility: "on"
        } ]
    }, {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [ {
            color: "#663030"
        } ]
    }, {
        featureType: "administrative.locality",
        elementType: "labels.text.stroke",
        stylers: [ {
            visibility: "simplified"
        } ]
    }, {
        featureType: "landscape",
        elementType: "geometry.fill",
        stylers: [ {
            visibility: "off"
        } ]
    }, {
        featureType: "landscape.man_made",
        elementType: "geometry.fill",
        stylers: [ {
            visibility: "on"
        }, {
            color: "#ff0000"
        } ]
    }, {
        featureType: "poi",
        elementType: "all",
        stylers: [ {
            visibility: "off"
        } ]
    }, {
        featureType: "road",
        elementType: "all",
        stylers: [ {
            visibility: "off"
        } ]
    }, {
        featureType: "road",
        elementType: "geometry.fill",
        stylers: [ {
            color: "#757575"
        } ]
    }, {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [ {
            color: "#ffffff"
        } ]
    }, {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [ {
            color: "#3c3c3c"
        }, {
            visibility: "simplified"
        } ]
    }, {
        featureType: "road.highway.controlled_access",
        elementType: "geometry",
        stylers: [ {
            color: "#4e4e4e"
        } ]
    }, {
        featureType: "road.arterial",
        elementType: "geometry",
        stylers: [ {
            color: "#373737"
        } ]
    }, {
        featureType: "road.local",
        elementType: "all",
        stylers: [ {
            visibility: "off"
        } ]
    }, {
        featureType: "road.local",
        elementType: "labels.text.fill",
        stylers: [ {
            color: "#ffffff"
        } ]
    }, {
        featureType: "transit",
        elementType: "labels.text.fill",
        stylers: [ {
            color: "#757575"
        } ]
    }, {
        featureType: "water",
        elementType: "geometry",
        stylers: [ {
            color: "#000000"
        }, {
            visibility: "off"
        } ]
    }, {
        featureType: "water",
        elementType: "geometry.fill",
        stylers: [ {
            visibility: "on"
        }, {
            color: "#5c06ff"
        } ]
    }, {
        featureType: "water",
        elementType: "geometry.stroke",
        stylers: [ {
            visibility: "on"
        } ]
    }, {
        featureType: "water",
        elementType: "labels",
        stylers: [ {
            visibility: "on"
        }, {
            color: "#f60000"
        } ]
    }, {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [ {
            color: "#d61313"
        } ]
    }, {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [ {
            color: "#ff0000"
        }, {
            visibility: "on"
        } ]
    }, {
        featureType: "water",
        elementType: "labels.icon",
        stylers: [ {
            visibility: "off"
        } ]
    } ];
}

const vMapSingleton = new VMap();

vMapSingleton.loadGoogleMapScript().then(() => {
    console.log("Map initialized");
});

const BOUTIQUE_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAABEuAAARLgB9zfXegAABihJREFUaN7tl9tvXFcVxn9rn7nYnhlfMnZsEzshURSC5LrUBKSEcBOKFBP1oUVOJEqagir1DXjiEXjKH8ADf0BfKCY8FJCIxANCTV5wFB6SKnJpYxffk7k5mduZOXsvHmZ8mcSNZ6ZpEdJ80pbOOXuvdb5vrbXX2Qc66KCDDjrooIMO2oa0alC5OAMQA14EwjiH98aPnblwwQDYt99W96d3BRG816+oefll0VQK+6tfohsbeK/9SM0rrwiAnf29utlZwfMEWAQWI7N/aIlPqE3hrwK/BQ3R3e3kyBELhLBWefjAAR7GQCxmAW/bShXN5bafyegXLKGQQTUMvAtcrlycKbcioiUB9ej3AJeAOE6REycCOX7cAEbTaav374OIRySiMjriGgQAurZmCQJDKCRy/LiTgQE0nTaIfA/4KnCzFU6mjeifBb4FgIiaU6eEri4DoB9+qJrJGESQREIZHGq0FIGHD6CQVwAZGhKOHnU4BzAAzJiQSOXSzPMXUI9+FHgTSKCKJAdVJl/cie78vFCtCqqQHFRJJBr9i6C5nGg6owCEQmImXgBjtL5i2gU6hjbDqL0MTALfrbFVZGrKyehozUe55HRxoRZlVWRkBKLRpzNQLotubOw8OnlSiMcVVYBjwHcA7OVXn5+AevQN8ENgEFXo6VFz5owgIgC6uqa6tCSIgAhy6JBuzTUgCITVle0Yy9CQSDK5JSAEXALtsb7XDLWWMjABzGxHf/ywk6NHt+313j0ln68JMEbp69vbtyq6vAJaY0wiIXLixJYAgLMgX2uW1L4C7JXXcb6PiFxE5BAi4HlqTp9Wenq2oqr6/vuCqgBINKoyMuwaHInUvjrGoBvrUCptMRbzwiQSiWg9e30iMh3ki9jLr+0rYN82mr6/ANAbCoe/iZEAxZI8oPbIF1UzWQuKZLPq3bkD2WwAwNCQWuOpZjIWQLJZQtkcms7UnH78sdqVFdFksqagr0895wJSKUHEQ/UbNgj6CoXHm59aQDGXA5GCWnsDY05JNNoTP3+eykA/qfV1AA7EY3RPTpKfnwdVEtPfx++JkVrfQIDB3gRmaorH77wDIsTPT1OORsms1zbzYG8v0a+8RP7aNbRSKeLc38Xz8rvK6tNhYWKCu9CVvnr1rdLcnO8KBXXOaaFQ0EKhoNY5daWS+rdva/nWLXXFoton54tFLd26peXbt9WVSg32zjm1+byW5ub89NWrb92FroWJiaa4NX0Wqu+5bwN/LTntLjtF6uaK1lyZep1bBXbmDZAI1e4eOygGrmFeUXo9Q7cnJWAa+MdeDaytEtoLNzcrvJerYJ6hXwScKtmKZTxq+NmRBGERZlfzXE8V8XbZKvDmWJxzg90tc2lLQNEqmapi5JNrNF+1pP2AbNUS6dv5oD0KHGu+JbQrwk6h6Nqr97YEyK7xJHynpP0qGd8SaK29mydszXbx1LBVeZ+bgL0EBapk/ICUH1CpR7NdUp+DgFrIRATrlEdVS8qvUgjcvpauLpaGPaC0WUHtZ8CvlqnYgGwQ5lHgUKXei7aPR6gqWu9RW/hSLMy5ZDdmV3oUGOtq7uzzXAR8sPEB1/91k0pQ5eDBCZL9h8mXHjHad5B8xWezmAWUWFcvw7F+DoR3+tXZgSgv9UYaykuB/lA7vyYtCPjL4jwVa8NVZ+V3d97j4eYDjAi6Nkcpc48HxU26D46z/HiTVCEHQCzaw9dPTvHGl09vd51r68W92+h4nHPJz7CN/vRvf8RVK2fEmK7AOZK1QzTqFymUC8RF+Gjl3wjQVyfrijn+fOcGPxgfZ2TsGPCMNmo/4zb6i6V5fBuMGGkx1aokVhehLuB/1ka7V9doPcG1jRwuFnfu66NhTZvkockfmqWlZVbuzqGhiHEmRCtDvRC6lTVVPJSI8NSo9y2x1oZr71xtSsC+mfvP8kp9pVzIbyz/plp4fKzVfPcOjxHrT6IoK2XLw4p9ysVYV4jBiNFKNfinc+7XwHWAw2OHnum72RKKo3olMTweQWShGeG7oeoolcsgwpDAcPTpNU4DSj4IjAE/AW4A+f18NyugDPxc1XntFuz2xw2wn7Rm59ICpfbe1EEHHXTQQQf/R/gvNvX3YT7/I3cAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTktMDMtMjlUMTE6NDQ6MDUrMDA6MDDVkMETAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE5LTAzLTI5VDExOjQ0OjA1KzAwOjAwpM15rwAAAEZ0RVh0c29mdHdhcmUASW1hZ2VNYWdpY2sgNi43LjgtOSAyMDE5LTAyLTAxIFExNiBodHRwOi8vd3d3LmltYWdlbWFnaWNrLm9yZ0F74sgAAAAYdEVYdFRodW1iOjpEb2N1bWVudDo6UGFnZXMAMaf/uy8AAAAYdEVYdFRodW1iOjpJbWFnZTo6aGVpZ2h0ADUxMsDQUFEAAAAXdEVYdFRodW1iOjpJbWFnZTo6V2lkdGgANTEyHHwD3AAAABl0RVh0VGh1bWI6Ok1pbWV0eXBlAGltYWdlL3BuZz+yVk4AAAAXdEVYdFRodW1iOjpNVGltZQAxNTUzODU5ODQ1ASR1+wAAABN0RVh0VGh1bWI6OlNpemUAMTEuNEtCQtZTjksAAAA7dEVYdFRodW1iOjpVUkkAZmlsZTovLy4vdXBsb2Fkcy81Ni9MTm9HZ0o5LzE4NjEvc2hvcF8xMTgxOTQucG5nIy75CQAAAABJRU5ErkJggg==";

class VMapEditor extends VAbstractEditor {
    constructor(vWine = null, callback = null) {
        super();
        this.pageId = "edit-map";
        this.aopTagGoogleMap = null;
        this.init("map", false, image => {
            if (null == image) {
                this.initMapEditor();
            } else {
                this.pictureTaken(image.data);
            }
            console.log(image);
        });
        this.polygonData = [];
        this.shapes = [];
        this.shapes_index = 0;
        this.zoomScalesAbs = [ 591657550.5, 295828775.3, 147914387.6, 73957193.82, 36978596.91, 18489298.45, 9244649.227, 4622324.614, 2311162.307, 1155581.153, 577790.5767, 288895.2884, 144447.6442, 72223.82209, 36111.91104, 18055.95552, 9027.977761, 4513.98888, 2256.99444, 1128.49722 ];
        this.zoomScales = [ 1048576, 524288, 262144, 131072, 65536, 32768, 16384, 8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1 ];
    }
    initMapEditor() {
        VMain.toggleLeftMenu();
        VPageFactory.createPage(this.pageId, this.buildMainHTML());
        var newLocation = new google.maps.LatLng(48.85, 2.35);
        var mapOptions = {
            center: newLocation,
            zoom: 15,
            mapTypeControl: true,
            disableDefaultUI: true,
            zoomControl: false,
            scaleControl: true,
            zoomControlOptions: {
                style: google.maps.ZoomControlStyle.SMALL
            },
            backgroundColor: "none",
            styles: _googleMapStyle
        };
        var mapCanvas = document.getElementById("google-map-canvas");
        this.aopTagGoogleMap = new google.maps.Map(mapCanvas, mapOptions);
        document.getElementById("map-camera-skip-fab").addEventListener("touchend", () => {
            this.polygonData = [];
            var precision = .5 * this.zoomScales[0] / this.zoomScales[this.aopTagGoogleMap.getZoom()];
            for (let shape of this.shapes) {
                var poly = [];
                for (let p of shape.array().value) {
                    let g = this.point2LatLng(p[0], p[1], this.aopTagGoogleMap);
                    poly.push([ setPrecision(g.lat(), precision), setPrecision(g.lng(), precision) ]);
                }
                var uniq = uniqBy(poly, JSON.stringify);
                console.log(uniq.length + "vs" + poly.length);
                this.polygonData.push(uniq);
            }
            vServiceSingleton.textToClipboard(JSON.stringify(this.polygonData));
            function setPrecision(v, p) {
                return Math.round(v * p) / p;
            }
            function uniqBy(a, key) {
                var seen = {};
                return a.filter(function(item) {
                    var k = key(item);
                    return seen.hasOwnProperty(k) ? false : seen[k] = true;
                });
            }
        });
        document.getElementById("flash-fab").addEventListener("touchend", () => {
            if (this.shapes_index == 0) {
                this.aopTagGoogleMap.setOptions({
                    gestureHandling: "none"
                });
                document.getElementById("drawing-canvas").style.display = "block";
                var drawer = new SVG("drawing-canvas").size("100%", "100%");
                console.log(drawer);
                const getDrawObject = () => {
                    const option = {
                        stroke: "#ff0099",
                        "stroke-width": 2,
                        "fill-opacity": .2
                    };
                    return drawer.polyline().fill("none").stroke({
                        stroke: "#ff0099",
                        width: 1
                    });
                };
                drawer.on("touchstart", event => {
                    const shape = getDrawObject();
                    console.log(this.shapes_index);
                    this.shapes[this.shapes_index] = shape;
                    shape.draw(event);
                });
                drawer.on("touchmove", event => {
                    if (this.shapes[this.shapes_index]) {
                        this.shapes[this.shapes_index].draw("point", event);
                    }
                });
                drawer.on("touchend", event => {
                    this.shapes[this.shapes_index].draw("stop", event);
                    this.shapes_index++;
                });
            } else {
                this.shapes_index--;
                this.shapes.pop().remove();
                this.polygonData.pop();
            }
        });
    }
    buildMainHTML() {
        return '<ons-page id="' + this.pageId + '-page" class="page__transparent">' + VPageFactory.buildCancelFab(this.pageId, -10) + '<ons-list modifier="noborder" style="padding: 0; width: 100%; margin-top: 40px; background-color:' + TRANSPARENT + '">' + VPageFactory.buildBottomListItem() + "</ons-list>" + "</ons-page>";
    }
    pictureTaken(imageData) {
        this.aopTagGoogleMap.setOptions({
            gestureHandling: "greedy"
        });
        var mapImage = document.getElementById("map-image");
        mapImage.src = imageData;
        if (imageData == null) mapImage.src = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAoHCBYVFRgVFRUYGBgYGBgYGBkYGhgYGBgYGBgZGRgYGBgcIS4lHB4rIRgYJjgmKy8xNTU1GiQ7QDszPy40NTEBDAwMEA8QHhISGjQhJCM0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDE0NDQ0NDQ0NDQ0NDQ0NDQ0NDE0NDQ0NDQ0NDQ0NP/AABEIALcBEwMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAACBQYBB//EADoQAAIBAwIEAwUGBAYDAAAAAAECAAMEESExBRJBUWFxgRMikaGxBjLB0eHwFEJSggcjYnKi8RWywv/EABkBAAMBAQEAAAAAAAAAAAAAAAABAgMEBf/EACIRAQEBAQACAwACAwEAAAAAAAABAhEhMQMSQTJxQmGxIv/aAAwDAQACEQMRAD8A4kJLBJbM9DSieBPCe8g/plgYRWgAwi9pcUlhFMIqwAIoCWW3EZVIVUgCy28uLeNLTlLpwi59B5wBcJOO4hV991G3N+k7lKeF19fOfPqp958/1N9ZNXFeaWVoHmnqmIGQYVTFg0IrwMwphg0VVoUNAGUeGSoe8TVoZGgOthK6hRnU9ukvauWcaaDoIhTcf97TT4S2WJ9B5yGnWza2/M2SMTYRAOkBRUKu+T10nrP4/KORFpTiYztHOH3vKBiZ13UidCuUbB2z8JOp1Wbx3dvdEgHP4zUs64Y4O/TxnIWd1ia1Cp1U4Pbp+kxsaugvq601/wBR2H4zEVyd5WvUZ25mOSe/Tw8p6ieM2xJzwy1fPkdIZYBcdzCAjxmjPooMsDBr6y6wMTMk8kgHxgP3Uy6unUYl56Uz0ls0Smh2IhBbDpA+xlkBHWAMLQ8IVKXhB06hjdN8wCq0x2hkp9oRfKXCjtABhD/SDM3jrlVRiugdczX5e2Ypxa1NWkyZ13Ge41EVOe3pqabAT51xQAVXxsWO206kcU5qYQ6OCEYdR0z8Ji/aakqsgUY92LvT9MTMsDKCTMQHBllaBVpdTAGFMKGgVh1pntF05KLThEEWBxGi4PqIlQei/SbnCP1nO5M3/s+xYjbEFOlRzjXWec/rAmqztyA6Dcj6S9RcaZlI6BXeJ1BmMssqEkmLY1DjB6TZta5mTRp9ozbvM9Rpm9dNQYMNYYU++fSIWDzXp6yc6+tVrM1Ago/pM9z/AKfnLFHydZ6KfjN55jnvh4vkJdZXSTMYEzJKc/hPIB8fDmXV4t7SWDy0HEYQ6KD2iKPGEaAM+xHlLikemsqjmE8RAPUcjeHRwYuK/RoTA6QA0jekDkjv9ZV6h7QDF4/w0N/mIeVx/wAsd5zXE7vnChhh10M6vil2EXPXpmcPXfmYt3Mlf4HmeSSCCVkhkpk7S1vSJOI8MD3E1PU9PTvJtXMq2tqSd1+J/Ka9vwh22ENw20C6nedLYXVNcDmAPjMdav43xifrnG+zdQj7ufLQ/OZ9bh7oeVlII76fWfV7BlfUMreRBh73hqVF5XXPY9R5GTN1V+Ofj4/7I7kY+OZrcIDD3FGpOnrvHOP2rWz8je8pGUONx+Yj3AnR9BppptkeUv7c8pmOnrOmEXlGrdfOXqLjeeU6LoSMZJzr1itdyZpNS+mOs3PuK1Kgg+aUxCUk5mwIEcs6RMNcU+R/AjI/GFpe6ISrbs6M/VfeHl1+X0hqdis65RLOvia9tc5M5elUmvwx9Zz10OkzkQLExijSyJSpQOpxtNMa54rHeO+YXJkBnoXwl1SbMVcyQvNJAPh3NLB4Dnlg8ZGVeHSpEw0sHgGglWE/iQNyAB8pg3vEQmg1bt285j17x3+82nht4QDpL77QouiDnPfZf1mW3HazbMFA7dPUzJRCZcHH7xFabao8fuBpzBv7R84wn2jfPvIh8iV+RzOeU4PX5SyNDtDQ4txH2gGARjPzG+ZimNFvDPpiS2RS6hjhSRknb1h0/fhVbRiM432/fSe1kCgDHvddc4mxxqp7LCLjWYGSTFLb5q9SZ8T2PSY4wNz+/hNnhVrj3jv+9pj0cZx8TOksNgZG6rE7WpZW/OfePKi/ePfwE6ewurY4QU0YbHmC/U6kzDwHTkAwPnG+G8MoKNaHO3cnP/Ux8fro5fyN16dtTxVT3Cp2B90+GJscIv0raBhnt1nz7idoyZITkTOeXJIHl2jn2d4ezMtRmKLzALrhmbssVn+1Tvo/9seHVayENT+4edHXXl6MrY6EdfAR77GUaKWgUovOwyx/mLjQgHz/AAmvxO5/hipdzytkcxHug6YDHGBnPXsZyHDr0UrupQU+6XLp25W1wPLMfbIWZLfbfuLUkkZ1B0P78pzvEaZRyD11nV3BI5H3ByD57j8Zicdpcy82NRr6dRFjXND5c9yxVWP2yACI0THqc63DTdNeY9hNei4A5QNMYmbbrHWqBFLHYfPsBAMOrT5HZOx+W4+WJpcKQl1A7zPTLuSd2OT+U6zglqFwes5b/p1T15dFSogKJKigAwqDSL3zYU/veVIjrMMoTPSYMzpc62ZJTMkA+GZnoMpPQYEKGil7e4BC77eUvWqco+Uy7hs6jrvEYJ7nrLcuPh9ZQAnSWzr8oAWme8jKM51M8pgE7+We8OKAxjnHhiLp8DGZdaWfDWFSi2MEZ+fwPSGov/KR4RWnI8p2oP1Hn4S91ZcqhmXQ9Rp21+c0EpheVsgjHhr4HxjeQ6Mh1B+6dyBj5jT5TO6rXOZWO3CWaj7ctzKnKCvUAnAOeoyQPUTHdtSfhO24TT5BUtqoIWopVXG2u34fCc3xPgtSjU5GU4z7pGoIOcH5Ss6l9r+b4uSWT3/0hb75+E6Ow6CZFC33GNVOs3eG09RJ3rp/FnjpuH0s4zOrsaA0wJz1imAJ0Nk5xpOe10/Uv9pCjJ7PGu+exEHwmwp1XWrVUAoKYQDJVAmD7pO2WGT39BL3dehSfNRgWC82CC2dtlAJJ10Hn2j9nxm3qL7tcIc4Aqo9JTjbVwBrKzLYjVkNGiSjI7e1Vy/PzY1DsSFHYBSAPKfNeM0BRvkxoqsFH+0ouPnmfUreoCfu8pGjAYxtkEY3/WfP/wDE6mErUXH8yMG/tYYP/L6Rz3xN8eXX03DJg7GZ/E0HIR1EDwS7DU1Gc+6J5xWp7pBmf60c3TfEbovrMpqnvYmlaLO3F7HBvP102bWJXtz7RsD7o28T3nl1cYHIv93l2l7KhkiZ73+Rp8WP8q0eFWvWdZYU5k2FHadDapgTNpo4owJk8TrahfX8vxmo7YEw6vvMWPX6dJpidv8ATHd5P7ByTJiXdgIIvmbsXuZJJIE+EmeieSQAddMiY7nWbTbTFcYOO0DQHtCopGsCsZSqQO8VOPTVBGCvljQia1sp5cjGRg7YOO8UporjAHKw+caS4GAOUZGmfunzz+Ezq48dyx0Gv71BENb8PYnOmfgdemsNRtc+8CB3yw+kfosvck7ZOq+WDvJtVIVfhzDcgeDAqPLzh7Ohg4Oh9dIWtXzoQMdsaek9ouDjp0B/AxWqk8t+hb86KjYIzv2PUZ7bRm44ctRDTq5D0gSjjdkJz64inCn0wSfWb1B150dtSoK57qRggzDvK7c3ueV84vbP2DlWAxjR+rgtt57aeIjHCt51XHuDrVUr0Oqnqp6ETjrNHpuUcYIOPA+I8Jd12M5nmnYWrTVoXIUTnreriPJUB6zKtLGvTZXOW189ZuW70mHKQp9JiWCAjpN+gicu2scTpZKAViVPukDTfGNsHoMdJ8y/xTuc3FNP6KfMf73I/wDifTynLsdJ8P8AtpetVu6zqMoGCL5IOX4Ehj6zXGbdMfk1zIfBPtI1A8jar0Pb9J0NTjXtRvPnopZJ0xNPhtfTHbSabxPcT8fyXvK3HqYOZv0LgezDj7x0A8es5Nqmdt5t2NIqozv185M19YdxNXy0banzGdFYW20zOGUMkTrLG3ma7eG7Gjia1NcRa3SNnSOM6VvqmFx30mWzw9/Uy2M7RMidPxzk/tzbva8AyYXaeZAgXfM0QJ7SSL8pkiD4jJPDJmARpnXlHXmHr+c0GMGYjZaiERtp7c08HI6wAaFEbCY5QQcH9/Pxg7YM74zn01gaT5AGfjHrchTvnyxj1mfpr7aNTIQAaY66A/nB0amCADr17/GBqVmcYx5SUWC7zO1eY0qVMt8945QtATufTvE7avjabNie8z1qx0ZzKPaAocbjxxpNummRkbdfGKJSBEJRcodfu/SZW9aScPJTJGNxMbi/DA3vAar18O34zaD41Bl7hQy5jlU5q3o9DGksj0npIB2mtZgHECtLW4ZdxHUvWG5IjooiJ8TYU6b1MfcRmx3IGQI4m8L8c+0XJT5EP+Ywwv8Apz/Oe3h3M+dVqQXrmNUqTAFnYs7HmYncmLXTCdmc/WOLevtWbWpjtFKXuuR31jtQy1pYc7B226Dv5xask8niW68HuF0eYhj6fnOktqWcCJWtDGBOi4Xa95z2urnGpwy22nR21OJWVGa1FI4y1R6YlbiryqSekvmZPFLjJ5B5n8BHmdvE6vJ0mzEkk9ZYCUWEAnY5VWHSehBL6CL1q0CE5xJE/amSAfFmMrmeEzwmIIxkWDZpeltEZdxriK16RU+HSOkaxa5qZOBAB0ahGk0bcjSZ70CBn4wlvV2kanZ2NMeLyt9CMfQT1aXMdotSaP2rTnrpzIbt7XGs1LVcQVuoxCE46zK3rfM42qVVQJZ6y4mMjxlTJ4fTC3oXQ5x9Ixb3owRnTcTMZc9IJ6fbSODpm4qYfzM17CvtOcYHqdoelfldxmUnrrjcTN+0FwP4d/7f/ZZl/wDmh1BiPGL8VabIucnG/gwP4Ssz/wBROv41hXF12mfUqwj2tT+gny1gra0d25SCAN86ek6rqe+uSZvece2duXbbT6zrqHDeVAxEPwXhSgDT9J0F3TAQD0+U5d7+1dWczM4x7O1yZ0NnQxiKW3Imruq/7iB9YyvF7cHHtk9Dn6STtdDapH0mTw+8R8cjq3kQT8JrKZcrKzyFd3ARSx2AnNrW5iSTqTmOcdr8x5B5n8P35TGoOVOD6flNPh1O2fqPlxr6y/jVWFivtDjoICrW7v8ACdTmN1XA3MSesvTWCKr1y30kL9lxAl+aewOW7fOSAfHSZVjKzx5JvGMJSOkC7aS1PUYit4clqtRidFntOhy+cMqASy0ydpndda5xwJsRT2Rz7oJ8ps0eH531mpa2AHST9/q0+n2ZdvbuwGmJp2tg02La2HaaFOiJhrbbOGfRokCeuDNNkEG1IGR1rwnRQmMqmJYaQb1YyWbSL1KoEFWrTPeoTCRNpqrcQYfMDTTMbpUZXooCwMJTp5jQt41bWnhF0+BULXMcXh+ek07WxmnTtNNpPVeHNqlVPuMPUZidzXuW+8+ngAJ19W3Ezbi1B6Q+w51xVa1JPM2WPc6mFtqbdFnQPY5MNRsMdI/sX1JWVs2hx8J0ljxGsgwTzr2bf0beDtrWaAt9Iu07wpz85JO53g6lPI/feNNb41EiAHT4wg7PRDnOzQyFR0lrmhn99Yj7TGh3nZ8PyfacvtxfN8f1vZ6pp6/hF3rmVLZ3MoXAm7nW5z3kgfaiSAcrR4a7gEIoEpxrhYFIs7KCuoAG5mxwe4qsugCjuZyvGbhndg7FsEjTbScktd1zJGI6CWXOwhOSGppK6ykWpUu8dpU4Kms1bKjmRqtMxe2tJq0rbENa24xH/ZYmN03zkmlPEuRGOWW5IlEST1llaNmhPUtYAi6Zidy2JtvazIvqOIQqyKj5lqVLO8uqaxylTl9RxVKUbo0pESN0Ek1cg9va5mnbWk8tFmjT0ki0W3oAQ7ACKvdcsQr35jTzpy4cRFzA+3JhUGYlSPAusbpoJ5ToxulSgLV6VKMKk9ppCgRo6A9OYPGOdGDIxGdCNCM+s6RplcXpcy48YHGZb8VcjDqrfIxTiTrkMNO4/WUemVORL3CCohH7yJWNfXUo3n7ZsJ/xQ2Gp7DWeEsegERp3qroBg9gCYX+JY7KR56T0HmmOQ95Ir7Ru8kYU4zxNUBp099iR08vGcs65kVidTIZxycdt10uyT1VhMSyiV1PF6Im3YCZFFZsWQmemmI3rURh2ETt6gAgbm7BOBMvbb0fQxpEmbavmalIxBdacMlORYYCBKGnpMDi9GdMsx+LrpBLmUpxpFleWESPpjU1jdERanG6MKqNG3jqtpEqBjyGIqTu8zOXJM2blMiZqpgwEHoU8x2nRg6KRxBAq8RMRuksGFhEOIEOBPQZXMrzQ6XFy0RuhkgRgvBMuYKjKuKEz6ich8DN2usyr0aQW5N3w7gae82vmc6Sz1+3ziFWv7774DEfA4lKlZj0wJ6Of4x5e/wCVM+1PcSTO5pI+lwnUIycbZOPKUzJJOZ1VZZ6DJJAzFEzUtmnkkjTTI1auRBW+ScySSfxf63LTSaVNpJJnVmlaHVpJIJqxeZt/qJJIEw6g1kSSSURinHaMkkmrP0BH6YkkhE1d0zFTb6ySRkOi4jdJZJIhRgstiSSAUJgHbEkklUDStmMpJJGC1yZzX2kvfZUi3UkAeZ2kklfH5sG7zNcKlQnrPSx67yST0Xmq5kkkgH//2Q==";
        mapImage.onload = () => {
            var ratio = mapImage.naturalHeight / mapImage.naturalWidth;
            mapImage.height = window.outerHeight + 44;
            mapImage.width = mapImage.height / ratio;
            mapImage.style.left = (window.outerWidth - mapImage.width) / 2 + "px";
            document.getElementById("drawing-canvas").style.display = "none";
        };
    }
    point2LatLng(x, y, map) {
        var topRight = map.getProjection().fromLatLngToPoint(map.getBounds().getNorthEast());
        var bottomLeft = map.getProjection().fromLatLngToPoint(map.getBounds().getSouthWest());
        var scale = Math.pow(2, map.getZoom());
        var worldPoint = new google.maps.Point(x / scale + bottomLeft.x, y / scale + topRight.y);
        return map.getProjection().fromPointToLatLng(worldPoint);
    }
}

class VCellar {
    constructor() {
        this.createPage();
        this.cellarWines = [];
    }
    myCellarListProgressBar = null;
    open() {
        $("#sidemenu-left")[0].close();
        this.createPage();
        VMain.pushPage({
            id: "my-cellar-page.html"
        }).then(() => {
            this.myCellarListProgressBar = document.getElementById("my-cellar-list-progressbar");
            this.getWines();
        });
    }
    nid = 0;
    getWines() {
        this.cellarWines = [];
        var filter = jDrupal.currentUser().id();
        filter = "0" == filter && _isDebugUser() ? "1" : filter;
        jDrupal.viewsLoad("mycellarapp/" + filter + "?_format=json").then(view => {
            this.myCellarListProgressBar.style = "display:none";
            this.cellarWines = view.getResults();
            var winesInfiniteList = document.getElementById("my-cellar-infinite-list");
            winesInfiniteList.delegate = {
                createItemContent: i => {
                    var carouselElement = document.createElement("ons-carousel");
                    carouselElement.setAttribute("auto-scroll", "");
                    carouselElement.setAttribute("swipeable", "");
                    carouselElement.setAttribute("centered", "");
                    carouselElement.setAttribute("initial-index", "1");
                    var carouselItem0 = document.createElement("ons-carousel-item");
                    var carouselItem1 = document.createElement("ons-carousel-item");
                    var carouselItem2 = document.createElement("ons-carousel-item");
                    carouselItem0.style = carouselItem2.style = "background:" + PASTEL + ";height:auto; display: flex;  align-items: center; padding-inline: 20px; color: " + VIVID;
                    carouselItem0.innerHTML = carouselItem2.innerHTML = VLocal.OpenANewBottle;
                    carouselItem0.style.justifyContent = "flex-end";
                    var cardElement = document.createElement("ons-card");
                    cardElement.style = "padding:2px; margin:4px;";
                    var listItem = document.createElement("ons-list-item");
                    listItem.setAttribute("modifier", "nodivider");
                    var titleElement = document.createElement("ons-list-title");
                    titleElement.setAttribute("modifier", "nodivider");
                    titleElement.style = "text-transform:none; border-radius: inherit;";
                    titleElement.innerHTML = "<strong>" + this.cellarWines[i].name + " " + this.cellarWines[i].year + "</strong>";
                    var leftElement = document.createElement("div");
                    leftElement.setAttribute("class", "left");
                    leftElement.innerHTML = '<img height="60px" src="' + jDrupal.settings.sitePath + this.cellarWines[i].label + '" />';
                    leftElement.addEventListener("click", () => {
                        var vWine = new VWine(SEALED, this.getWines);
                        vWine.load(this.cellarWines[i].nid).then(() => {
                            VMain.editBottle(vWine);
                        });
                    });
                    var centerElement = document.createElement("div");
                    centerElement.setAttribute("class", "center");
                    const appellation = vDataSingleton.allAppellations.find(appellation => parseInt(appellation.tid) === parseInt(this.cellarWines[i].app));
                    centerElement.innerHTML = "";
                    if (parseInt(this.cellarWines[i].sugar) > 1) centerElement.innerHTML += "<p>" + VLocal.wineSugarRangeNames[parseInt(this.cellarWines[i].sugar) - 1] + "</p>";
                    if (null !== appellation && undefined !== appellation) centerElement.innerHTML += "<p>" + appellation.name + "</p>";
                    if ("" !== this.cellarWines[i].producer) centerElement.innerHTML += "<br>" + this.cellarWines[i].producer;
                    if ("" !== this.cellarWines[i].alcohol) centerElement.innerHTML += "<br>" + this.cellarWines[i].alcohol + "%";
                    var rightElement = document.createElement("div");
                    rightElement.setAttribute("class", "right");
                    var stockDiv = document.createElement("span");
                    stockDiv.setAttribute("class", "fa-stack");
                    var circleSpan = document.createElement("span");
                    circleSpan.setAttribute("class", "fa fa-circle-o fa-stack-2x");
                    var stockElement = document.createElement("strong");
                    stockElement.setAttribute("class", "fa-stack-1x");
                    stockElement.innerHTML = this.cellarWines[i].stock;
                    stockDiv.appendChild(circleSpan);
                    stockDiv.appendChild(stockElement);
                    carouselElement.addEventListener("postchange", e => {
                        e.stopPropagation();
                        if (e.activeIndex == 1) return;
                        var vWine = new VWine(OPEN, this.getWines);
                        vWine.load(this.cellarWines[i].nid).then(() => {
                            if (vWine.wasOpen()) {
                                vWine.decreaseStock().then(newStock => {
                                    carouselElement.setActiveIndex(1).then(() => {
                                        stockElement.innerHTML = newStock;
                                        if (newStock == 0) {
                                            var index = this.cellarWines.findIndex(w => w.nid === vWine.getId());
                                            if (index > -1) {
                                                this.cellarWines.splice(index, 1);
                                                if (carouselElement) VMain.removeElement(carouselElement);
                                            }
                                        }
                                    });
                                });
                            } else {
                                carouselElement.setActiveIndex(1).then(() => {
                                    VMain.editWine(vWine);
                                });
                            }
                        });
                    });
                    rightElement.appendChild(stockDiv);
                    listItem.appendChild(leftElement);
                    listItem.appendChild(centerElement);
                    listItem.appendChild(rightElement);
                    cardElement.appendChild(titleElement);
                    cardElement.appendChild(listItem);
                    cardElement.style.backgroundColor = this.cellarWines[i].color;
                    carouselItem1.appendChild(cardElement);
                    carouselElement.appendChild(carouselItem0);
                    carouselElement.appendChild(carouselItem1);
                    carouselElement.appendChild(carouselItem2);
                    return carouselElement;
                },
                countItems: () => {
                    return this.cellarWines.length;
                },
                calculateItemHeight: i => {
                    return 109;
                }
            };
            winesInfiniteList.refresh();
        });
    }
    createPage() {
        if (null !== document.getElementById("my-cellar-page.html")) return;
        var myCellar = document.createElement("template");
        myCellar.id = "my-cellar-page.html";
        myCellar.innerHTML = '<ons-page id="my-cellar-page">' + "<ons-toolbar>" + '<div class="left">' + "<ons-back-button ontouchend=\"VMain.pushMainPage({'id': 'selected-wines.html', prev: 'my-cellar-page.html'});\"></ons-back-button>" + "</div>" + '<div class="center" id="my-cellar-toolbar-title">' + VLocal.MyCellar + "</div>" + '<div class="right">' + '<ons-toolbar-button id="add-wine-button" onclick="VMain.addBottle();">' + '<img style="width: 1.28571429em; vertical-align: middle;" class="list-item__icon cellar" src="css/wine-bottle-solid.svg">' + "</ons-toolbar-button>" + "</div>" + "</ons-toolbar>" + '<div style="background-color: ' + PASTEL + ';" class="page__white">' + '<ons-progress-bar id="my-cellar-list-progressbar" style="width:100%; height:5px;" secondary-value="100"' + 'class="progressStyle" indeterminate></ons-progress-bar>' + '<ons-list style="margin-top: -5px; background-color: ' + OPAQUE + ';" modifier="noborder">' + '<ons-lazy-repeat id="my-cellar-infinite-list"></ons-lazy-repeat>' + "</ons-list>" + "</div>" + "</ons-page>";
        $("#app-body")[0].appendChild(myCellar);
    }
}

class VOpenCV {
    constructor() {
        if (!VOpenCV.instance) {
            this._data = [];
            VOpenCV.instance = this;
        }
        return VOpenCV.instance;
    }
    createFileFromUrl(path, url) {
        return new Promise((resolve, reject) => {
            let request = new XMLHttpRequest();
            request.open("GET", url, true);
            request.responseType = "arraybuffer";
            request.onload = function(ev) {
                if (request.readyState === 4) {
                    if (request.status === 200) {
                        let data = new Uint8Array(request.response);
                        cv.FS_createDataFile("/", path, data, true, false, false);
                        resolve();
                    } else {
                        console.log("Failed to load " + url + " status: " + request.status);
                    }
                }
            };
            request.send();
        });
    }
    faceDetect(srcId) {
        let src = cv.imread(srcId);
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        let faceCascade = new cv.CascadeClassifier();
        let url = "https://raw.githubusercontent.com/opencv/opencv/4.x/data/haarcascades/";
        let faceCascadeSrc = [ "lbpcascade_frontalface.xml", "lbpcascade_frontalface_improved.xml", "haarcascade_lowerbody.xml", "haarcascade_frontalface_default.xml", "haarcascade_frontalface_alt.xml", "haarcascade_frontalface_alt2.xml" ];
        let eyeCascadeSrc = "haarcascade_eye.xml";
        let detect = () => {
            if (faceCascadeSrc.length == 0) {
                src.delete();
                gray.delete();
                faceCascade.delete();
                $("#app-body")[0].removeChild(document.getElementById(srcId));
                return;
            }
            let src = faceCascadeSrc.pop();
            if (src.includes("lbpcascade")) url = "https://raw.githubusercontent.com/opencv/opencv/4.x/data/lbpcascades/";
            this.createFileFromUrl(src, url + src).then(() => {
                vBench.begin("faceDetect");
                faceCascade.load(src);
                let msize = new cv.Size(0, 0);
                let faces = new cv.RectVector();
                faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0, msize, msize);
                let ms = vBench.end("faceDetect");
                _release_toast(src + " detected " + faces.size() + " faces in " + ms + "ms");
                detect();
            });
        };
        detect();
    }
}

const vOpenCVSingleton = new VOpenCV();

Object.freeze(vOpenCVSingleton);

class VTensorFlow {
    constructor() {
        if (!VTensorFlow.instance) {
            this._data = [];
            VTensorFlow.instance = this;
            this.classifyModel = null;
            this.nsfwjsModel = null;
            this.blazeFaceModel = null;
            this.loadModels();
            this.loadCounter = 0;
            this.modelsNumber = 4;
        }
        return VTensorFlow.instance;
    }
    loadModels() {
        VMain.modalShow().then(() => {
            this.checkLoadState();
            mobilenet.load({
                version: 2,
                alpha: 1
            }).then(model => {
                this.classifyModel = model;
                this.checkLoadState();
            }, e => {
                this.checkLoadState();
                _debug_toast("couldn't load mobilenet model: " + e);
            });
            nsfwjs.load(_localInterface.serverUrl + "/min_nsfwjs/", {
                size: 299
            }).then(model => {
                this.nsfwjsModel = model;
                this.checkLoadState();
            }, e => {
                this.checkLoadState();
                _debug_toast("couldn't load nsfwjs model: " + e);
            });
            blazeface.load().then(model => {
                this.blazeFaceModel = model;
                this.checkLoadState();
            }, e => {
                this.checkLoadState();
                _debug_toast("couldn't load blazeface model: " + e);
            });
            const threshold = .9;
            toxicity.load(threshold).then(model => {
                this.toxicityModel = model;
                this.checkLoadState();
            }, e => {
                this.checkLoadState();
                _debug_toast("couldn't load toxicity model: " + e);
            });
        });
    }
    checkLoadState() {
        this.loadCounter++;
        document.getElementById("modal-text").innerHTML = VLocal.Loading + " " + parseInt(1e3 * (this.loadCounter - 1) / this.modelsNumber) / 10 + "%";
        if (this.loadCounter == this.modelsNumber) {
            document.getElementById("modal-text").innerHTML = VLocal.Done;
            setTimeout(() => {
                document.getElementById("modal-text").innerHTML = VLocal.Loading;
                VMain.modalHide();
            }, 3e3);
        }
    }
    classify(srcId) {
        return new Promise((resolve, reject) => {
            if (null == this.classifyModel) reject();
            const img = document.getElementById(srcId);
            vBench.begin("classify");
            this.classifyModel.classify(img, 5).then(predictions => {
                let text = "mobilenet <br>";
                for (let prediction of predictions) {
                    text += prediction.className + ": " + prediction.probability + "<br>";
                }
                _release_toast("classify took " + vBench.end("classify") + "ms", 2e3);
                if (text.includes("wine") && text.includes("bottle")) {
                    resolve();
                } else {
                    reject();
                }
            }, e => {
                _release_toast("couldn't classify: " + e, 1e3);
                reject();
            });
        });
    }
    explicit(srcId) {
        return new Promise((resolve, reject) => {
            if (null == this.nsfwjsModel) reject();
            const img = document.getElementById(srcId);
            vBench.begin("explicit");
            let deny = false;
            let badCategories = [ "Porn", "Hentai", "Sexy" ];
            this.nsfwjsModel.classify(img).then(predictions => {
                let text = "explicit <br>";
                for (let prediction of predictions) {
                    text += JSON.stringify(prediction) + "<br>";
                    if (parseFloat(prediction.probability) > .2) {
                        if (badCategories.find(word => word == prediction.className)) deny = true;
                    }
                }
                _release_toast("explicit took " + vBench.end("explicit") + "ms", 2e3);
                if (deny) reject(); else resolve();
            }, e => {
                _debug_toast("couldn't classify: " + e);
                reject();
            });
        });
    }
    detect(srcId) {
        return new Promise((resolve, reject) => {
            const img = document.getElementById(srcId);
            vBench.begin("detect");
            try {
                cocoSsd.load().then(model => {
                    model.detect(img).then(predictions => {
                        let text = "cocossd<br>";
                        for (let prediction of predictions) {
                            text += prediction.class + ": " + prediction.score + "<br>";
                        }
                        text += "took " + vBench.end("detect") + "ms";
                        _debug_toast(text);
                        if (text.includes("wine") || text.includes("bottle")) {
                            resolve();
                        } else {
                            reject();
                        }
                    }, e => {
                        _debug_toast("couldn't detect: " + e);
                        reject();
                    });
                }, e => {
                    _debug_toast("couldn't load model: " + e);
                    reject();
                });
            } catch (err) {
                _debug_toast_err(err);
                reject();
            }
        });
    }
    blazeFace(srcId) {
        return new Promise((resolve, reject) => {
            if (null == this.blazeFaceModel) reject();
            const img = document.getElementById(srcId);
            vBench.begin("blazeFace");
            const returnTensors = false;
            this.blazeFaceModel.estimateFaces(img, returnTensors).then(predictions => {
                let text = "blazeFace<br>";
                if (predictions.length > 0) {}
                text += "took " + vBench.end("blazeFace") + "ms";
                _debug_toast("detected faces: " + predictions.length + "<br> " + text);
                if (predictions.length == 1) resolve(); else reject();
            }, () => reject);
        });
    }
    toxicity(sentences = [ "you suck" ]) {
        return new Promise((resolve, reject) => {
            this.toxicityModel.classify(sentences).then(predictions => {
                for (let prediction of predictions) {
                    for (let result of prediction.results) {
                        if (result.match == true) reject(prediction.label);
                    }
                }
                resolve();
                console.log(predictions);
            }, () => {
                reject("error");
            });
        });
    }
}

var vTensorFlowSingleton = null;

class SelectizeOptions {
    constructor(elementName, opt, itm, max, callback, typeCallBack) {
        let checkElement = "" !== elementName ? document.getElementById("wine-" + elementName + "-checked") : null;
        let autocompleteSessionToken = null;
        return {
            timeoutExpired: false,
            timeoutTyping: null,
            plugins: [ "restore_on_backspace", "remove_button" ],
            delimiter: ",",
            persist: true,
            hideSelected: false,
            loadThrottle: 1e3,
            maxItems: max,
            maxOptions: 4,
            openOnFocus: false,
            options: opt,
            items: itm,
            labelField: "name",
            searchField: "name",
            valueField: "tid",
            preload: false,
            createOnBlur: false && _isDebugUser() && elementName == "producer",
            create: _isDebugUser() && (elementName == "producer" || elementName == "boutique" || elementName == "appellation"),
            onFocus: function() {
                autocompleteSessionToken = new google.maps.places.AutocompleteSessionToken();
                $(".bottom-item").show();
            },
            onBlur: function() {
                $(".bottom-item").hide();
                if (callback) callback(this.items);
            },
            onChange: function(v) {
                $(".bottom-item").hide();
                if (checkElement) this.items.length > 0 ? checkElement.setAttribute("checked", "") : checkElement.removeAttribute("checked");
            },
            onType: function(t) {
                if (this.timeoutTyping && !this.timeoutExpired) {
                    clearTimeout(this.timeoutTyping);
                    this.timeoutTyping = null;
                }
                if ("boutique" != elementName && "producer" != elementName || t.length < 3 || this.currentResults.items.length > 0) return;
                this.timeoutTyping = setTimeout(() => {
                    this.timeoutExpired = true;
                    vMapSingleton.getAutocompleteService().getPlacePredictions({
                        input: t,
                        sessionToken: autocompleteSessionToken,
                        componentRestrictions: "boutique" == elementName ? {
                            country: vUserSingleton.getCountryCode()
                        } : null
                    }, (predictions, status) => {
                        vMapSingleton.getSuggestions(predictions, status).then(suggestions => {
                            for (let suggestion of suggestions) {
                                this.addOption(suggestion);
                                if ("boutique" == elementName) vDataSingleton.allBoutiques.push(suggestion); else if ("producer" == elementName) vDataSingleton.allProducers.push(suggestion);
                            }
                            this.setTextboxValue(suggestions[0].search);
                            this.refreshOptions();
                            console.log(this.options);
                            clearTimeout(this.timeoutTyping);
                            this.timeoutTyping = null;
                            this.timeoutExpired = false;
                        });
                    });
                }, 3e3);
            },
            onItemRemove: function(v) {
                this.blur();
            },
            render: {
                item: function(item, escape) {
                    let html = '<div class="item">';
                    if (item.hasOwnProperty("img")) html += '<img height="24px" src="' + item.img + '"/ >&nbsp;';
                    html += '<span class="name">' + escape(item.name) + "</span></div>";
                    return html;
                }
            }
        };
    }
}

class InputOptions {
    constructor(elementName, callback) {
        let checkElement = "" !== elementName ? document.getElementById("wine-" + elementName + "-checked") : null;
        let thisElement = "" !== elementName ? document.getElementById("wine-" + elementName) : null;
        if (thisElement) {
            thisElement.addEventListener("focus", function() {
                $(".bottom-item").show();
            });
            thisElement.addEventListener("blur", function(e) {
                $(".bottom-item").hide();
                callback(e.target.value);
            });
            thisElement.addEventListener("change", function(e) {
                $(".bottom-item").hide();
                "" !== String(e.target.value).trim() ? checkElement.setAttribute("checked", "") : checkElement.removeAttribute("checked");
            });
        }
    }
}

(function() {
    function a(a, b, c) {
        this.el = a, a.remember("_paintHandler", this);
        var d = this, e = this.getPlugin();
        this.parent = a.parent(SVG.Nested) || a.parent(SVG.Doc), this.p = this.parent.node.createSVGPoint(), 
        this.m = null, this.startPoint = null, this.lastUpdateCall = null, this.options = {}, 
        this.set = new SVG.Set();
        for (var f in this.el.draw.defaults) this.options[f] = this.el.draw.defaults[f], 
        "undefined" != typeof c[f] && (this.options[f] = c[f]);
        e.point && (e.pointPlugin = e.point, delete e.point);
        for (var f in e) this[f] = e[f];
        b || this.parent.on("click.draw", function(a) {
            d.start(a);
        });
    }
    a.prototype.transformPoint = function(a, b) {
        return this.p.x = a - (this.offset.x - window.pageXOffset), this.p.y = b - (this.offset.y - window.pageYOffset), 
        this.p.matrixTransform(this.m);
    }, a.prototype.start = function(a) {
        var b = this;
        this.m = this.el.node.getScreenCTM().inverse(), this.offset = {
            x: window.pageXOffset,
            y: window.pageYOffset
        }, this.options.snapToGrid *= Math.sqrt(this.m.a * this.m.a + this.m.b * this.m.b), 
        this.startPoint = this.snapToGrid(this.transformPoint(a.clientX, a.clientY)), this.init && this.init(a), 
        this.el.fire("drawstart", {
            event: a,
            p: this.p,
            m: this.m
        }), SVG.on(window, "mousemove.draw", function(a) {
            b.update(a);
        }), this.start = this.point;
    }, a.prototype.point = function(a) {
        return this.point != this.start ? this.start(a) : this.pointPlugin ? this.pointPlugin(a) : void this.stop(a);
    }, a.prototype.stop = function(a) {
        a && this.update(a), this.clean && this.clean(), SVG.off(window, "mousemove.draw"), 
        this.parent.off("click.draw"), this.el.forget("_paintHandler"), this.el.draw = function() {}, 
        this.el.fire("drawstop");
    }, a.prototype.update = function(a) {
        !a && this.lastUpdateCall && (a = this.lastUpdateCall), this.lastUpdateCall = a, 
        this.m = this.el.node.getScreenCTM().inverse(), this.calc(a), this.el.fire("drawupdate", {
            event: a,
            p: this.p,
            m: this.m
        });
    }, a.prototype.done = function() {
        this.calc(), this.stop(), this.el.fire("drawdone");
    }, a.prototype.cancel = function() {
        this.stop(), this.el.remove(), this.el.fire("drawcancel");
    }, a.prototype.snapToGrid = function(a) {
        var b = null;
        if (a.length) return b = [ a[0] % this.options.snapToGrid, a[1] % this.options.snapToGrid ], 
        a[0] -= b[0] < this.options.snapToGrid / 2 ? b[0] : b[0] - this.options.snapToGrid, 
        a[1] -= b[1] < this.options.snapToGrid / 2 ? b[1] : b[1] - this.options.snapToGrid, 
        a;
        for (var c in a) b = a[c] % this.options.snapToGrid, a[c] -= (b < this.options.snapToGrid / 2 ? b : b - this.options.snapToGrid) + (0 > b ? this.options.snapToGrid : 0);
        return a;
    }, a.prototype.param = function(a, b) {
        this.options[a] = null === b ? this.el.draw.defaults[a] : b, this.update();
    }, a.prototype.getPlugin = function() {
        return this.el.draw.plugins[this.el.type];
    }, SVG.extend(SVG.Element, {
        draw: function(b, c, d) {
            b instanceof Event || "string" == typeof b || (c = b, b = null);
            var e = this.remember("_paintHandler") || new a(this, b, c || {});
            return b instanceof Event && e.start(b), e[b] && e[b](c, d), this;
        }
    }), SVG.Element.prototype.draw.defaults = {
        snapToGrid: 1,
        drawCircles: !0
    }, SVG.Element.prototype.draw.extend = function(a, b) {
        var c = {};
        "string" == typeof a ? c[a] = b : c = a;
        for (var d in c) {
            var e = d.trim().split(/\s+/);
            for (var f in e) SVG.Element.prototype.draw.plugins[e[f]] = c[d];
        }
    }, SVG.Element.prototype.draw.plugins = {}, SVG.Element.prototype.draw.extend("rect image", {
        init: function(a) {
            var b = this.startPoint;
            this.el.attr({
                x: b.x,
                y: b.y,
                height: 0,
                width: 0
            });
        },
        calc: function(a) {
            var b = {
                x: this.startPoint.x,
                y: this.startPoint.y
            }, c = this.transformPoint(a.clientX, a.clientY);
            b.width = c.x - b.x, b.height = c.y - b.y, this.snapToGrid(b), b.width < 0 && (b.x = b.x + b.width, 
            b.width = -b.width), b.height < 0 && (b.y = b.y + b.height, b.height = -b.height), 
            this.el.attr(b);
        }
    }), SVG.Element.prototype.draw.extend("line polyline polygon", {
        init: function(a) {
            this.set = new SVG.Set();
            var b = this.startPoint, c = [ [ b.x, b.y ], [ b.x, b.y ] ];
            this.el.plot(c), this.options.drawCircles && this.drawCircles();
        },
        calc: function(a) {
            var b = this.el.array().valueOf();
            if (b.pop(), a) {
                var c = this.transformPoint(a.clientX, a.clientY);
                b.push(this.snapToGrid([ c.x, c.y ]));
            }
            this.el.plot(b), this.options.drawCircles && this.drawCircles();
        },
        point: function(a) {
            if (this.el.type.indexOf("poly") > -1) {
                var b = this.transformPoint(a.clientX, a.clientY), c = this.el.array().valueOf();
                return c.push(this.snapToGrid([ b.x, b.y ])), this.el.plot(c), this.options.drawCircles && this.drawCircles(), 
                void this.el.fire("drawpoint", {
                    event: a,
                    p: {
                        x: b.x,
                        y: b.y
                    },
                    m: this.m
                });
            }
            this.stop(a);
        },
        clean: function() {
            this.set.each(function() {
                this.remove();
            }), this.set.clear(), delete this.set;
        },
        drawCircles: function() {
            var a = this.el.array().valueOf();
            this.set.each(function() {
                this.remove();
            }), this.set.clear();
            for (var b = 0; b < a.length; ++b) {
                this.p.x = a[b][0], this.p.y = a[b][1];
                var c = this.p.matrixTransform(this.parent.node.getScreenCTM().inverse().multiply(this.el.node.getScreenCTM()));
                this.set.add(this.parent.circle(5).stroke({
                    width: 1
                }).fill("#ccc").center(c.x, c.y));
            }
        },
        undo: function() {
            this.set.length() && (this.set.members.splice(-2, 1)[0].remove(), this.el.array().value.splice(-2, 1), 
            this.el.plot(this.el.array()), this.el.fire("undopoint"));
        }
    }), SVG.Element.prototype.draw.extend("circle", {
        init: function(a) {
            var b = this.startPoint;
            this.el.attr({
                cx: b.x,
                cy: b.y,
                r: 1
            });
        },
        calc: function(a) {
            var b = this.transformPoint(a.clientX, a.clientY), c = {
                cx: this.startPoint.x,
                cy: this.startPoint.y,
                r: Math.sqrt((b.x - this.startPoint.x) * (b.x - this.startPoint.x) + (b.y - this.startPoint.y) * (b.y - this.startPoint.y))
            };
            this.snapToGrid(c), this.el.attr(c);
        }
    }), SVG.Element.prototype.draw.extend("ellipse", {
        init: function(a) {
            var b = this.startPoint;
            this.el.attr({
                cx: b.x,
                cy: b.y,
                rx: 1,
                ry: 1
            });
        },
        calc: function(a) {
            var b = this.transformPoint(a.clientX, a.clientY), c = {
                cx: this.startPoint.x,
                cy: this.startPoint.y,
                rx: Math.abs(b.x - this.startPoint.x),
                ry: Math.abs(b.y - this.startPoint.y)
            };
            this.snapToGrid(c), this.el.attr(c);
        }
    });
}).call(this);