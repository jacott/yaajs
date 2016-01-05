module.exports = Module;

var UNLOADED = Module.UNLOADED = -2;
var ERROR = Module.ERROR = -1;
var INIT = Module.INIT = 0;
var LOADING = Module.LOADING = 1;
var WAIT_PLUGIN = Module.WAIT_PLUGIN = 2;
var READY_WAIT_PLUGIN = Module.READY_WAIT_PLUGIN = 3;
var LOADED = Module.LOADED = 4;
var READY = Module.READY = 5;

function fetchModule(ctx, id, parent, callback, error) {
  var mod = ctx.modules[id];
  var named = callback === 'named';
  if (mod) {
    if (named) {
      if (mod.state > WAIT_PLUGIN)
        throw mod.error("Defined more than once");

      return mod;
    }

  } else {
    var match = /^([^!]+)!(.*)$/.exec(id);
    var mod = match ? newResourceModule(ctx, match[1], match[2], parent, named && id)
          : ctx.modules[id] = new Module(ctx, id);

    if (named) return mod;
  }

  if (callback) {
    if (mod.state === READY)
      callback(mod.exports, mod);
    else if (mod.callback)
      mod.callback.push(callback);
    else
      mod.callback = [callback];
  } else if (parent)
    mod.dependants[parent.id] = 1;

  if (error) {
    if (mod.onError)
      mod.onError.push(error);
    else
      mod.onError = [error];
  }

  if (match) {
    if (mod.id && mod.state !== READY)
      return fetchResourceModule(ctx, mod);
  } else if (mod.state === INIT) {
    mod.state = LOADING;
    ctx.paused || mod.loadModule();
  }

  return mod;
}

function Module(ctx, id) {
  var mod = this;
  mod.state = INIT;
  mod.ctx = ctx;
  mod.dependants = {};
  mod.id = id;

  if (id) mod.uri = ctx.uri(id);
}

var commentRe = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;
var requireRe = /(?:[^.]|^)\brequire\s*\(\s*(["'])([^\1\s]+)\1\s*\)/g;
Module.define = define;
define.amd = {};

function define(name, deps, body) {
  if (deps === undefined) {
    body = name; name = null;
  } else {
    if (body === undefined) {
      body = deps;
      if (typeof name === 'string') {
        deps = null;
      } else {
        deps = name; name = null;
      }
    }
  }
  if (deps == null && typeof body === 'function' && body.length) {
    deps = [];
    var argc = body.length;

    body.toString()
      .replace(commentRe, '')
      .replace(requireRe, function (match, quote, dep) {
        deps.push(dep);
      });
  }
  if (typeof name === 'string') {
    var mod = fetchModule(Module.currentCtx, name, null, 'named');
    Module._prepareDefine(mod, deps, body, argc);
    return;
  }
  Module._globalDefineResult = [name, deps, body, argc];
}

Module._prepareDefine = function(mod, deps, body, autoRequire) {
  if (typeof body !== 'function') {
    mod.exports = body;
  } else {
    mod.body = body;
    if (autoRequire)
      mod.exports = {};
    else if (deps && deps.length)
      mod.requireDeps = deps;
  }

  var ctx = mod.ctx;
  if (mod.state === READY_WAIT_PLUGIN)
    var depCount = 1;
  else {
    mod.state = LOADED;
    depCount = 0;
  }

  var depMap = {};
  if (deps) for(var i = 0; i < deps.length; ++i) {
    var name = deps[i];
    if (/^(?:require|exports|module)$/.test(name))
      continue;
    deps[i] = name = mod.normalizeId(name);
    if (depMap[name]) continue;
    depMap[name] = 1;
    var dMod = fetchModule(ctx, name, mod);
    if (dMod.state !== READY &&
        (dMod.state !== LOADED || ! isCircular(mod, dMod))) {
      ++depCount;
    }
  }
  mod.depCount = depCount;
  depCount || ctx.paused || mod._ready();
};

Module._informDependants = informDependants;

Module.loadPaused = function (ctx) {
  ctx.paused = false;
  var modules = ctx.modules;
  for (var id in modules) {
    var mod = modules[id];
    switch(mod.state) {
    case LOADED:
      mod.depCount || mod._ready();
      break;
    case LOADING:
      mod.loadModule();
      break;
    }
  }
}

function isCircular(mod, dep) {
  var modules = mod.ctx.modules;
  var dependants = mod.dependants;

  if (dependants[dep.id])
    return true;

  for (var id in dependants) {
    if (! id) continue;
    var child = modules[id];
    if (child.state === LOADED && isCircular(child, dep))
      return true;
  }
}

Module.prototype = {
  constructor: Module,
  toUrl: function (id) {
    if (id.slice(-3) === '.js') {
      return this.ctx.uri(this.normalizeId(id.slice(0, -3)), '')+'.js';
    }
    return this.ctx.uri(this.normalizeId(id), '');
  },

  _ready: function () {
    var mod = this;
    if (mod.body) {
      try {
        var oldCtx = Module.currentCtx;
        Module.currentCtx = mod.ctx;
        if (mod.exports) {
          var result = mod.body(mod.require, mod.exports, mod);
        } else if (mod.requireDeps) {
          var args = mod.requireDeps; mod.requireDeps = null;
          var len = args.length = Math.min(mod.body.length, args.length);
          var modules = mod.ctx.modules;
          for(var i = 0; i < len; ++i) {
            var rId = args[i];
            switch(rId) {
            case 'require': args[i] = mod.require; break;
            case 'exports': args[i] = mod.exports = {}; break;
            case 'module': args[i] = mod; break;
            default:
              args[i] = fetchModule(mod.ctx, rId, mod).exports;
            }
          }
          var result = mod.body.apply(mod, args);
        } else {
          mod.exports = mod.body();
        }
        if (result !== undefined)
          mod.exports = result;
      } catch(ex) {
        ex.onload = true;
        ex.module = mod;
        mod.handleError(ex);
        if (mod.state === ERROR) return;
      } finally {
        Module.currentCtx = oldCtx;
      }
    }

    mod.state = READY;
    mod.plugin && mod.plugin.ready();
    informDependants(mod);
  },

  _nodefine: function () {
    var ctx = this.ctx;
    var shim = ctx.shim && ctx.shim[this.id];
    if (shim && ! shim.expectDefine) {
      Module._prepareDefine(this, shim.deps, shim.exports || function () {});
      return;
    }
    if (ctx.requireDefine)
      this.handleError(this.error('Define not run', 'nodefine'));
    else
      Module._prepareDefine(this);
  },

  get require() {
    return this._require || (this._require = buildRequire(this));
  },

  config: function () {
    return this.ctx.moduleConfig[this.id] || (this.ctx.moduleConfig[this.id] = {});
  },

  get dir() {
    if (this._dir === undefined) {
      var ridx = this.id.lastIndexOf('/');
      this._dir = ridx === '-1' ? '' :  this.id.slice(0,ridx+1);
    }
    return this._dir;
  },

  normalizeId: function (id) {
    var mod = this;
    var ctx = mod.ctx;
    var idMod = ctx.modules[id];
    if (idMod) return id;

    if (/(?:^(?:[a-z]+:\/)?\/|\.js$)/i.test(id))
      return id;

    if (id.charAt(0) === ".") {
      var dir = mod.dir;
    }

    return ctx.normalizeId(id, dir);
  },

  get: function (id) {
    var modules = this.ctx.modules;
    var mod = modules[id];
    return mod || modules[this.normalizeId(id)];
  },

  addDependancy: function (modOrId) {
    this.dependants[modOrId.id || modOrId] = 1;
  },

  unload: function () {
    this.state = UNLOADED;
    var modules = this.ctx.modules;
    delete modules[this.id];
    for (var id in this.dependants) {
      var subm = modules[id];
      subm && subm.unload();
    }
    this.uri && this.undef();
    this._unloads && this._unloads.forEach(function (func) {
      func(this);
    });
  },

  onUnload: function (func) {
    (this._unloads || (this._unloads = [])).push(func);
  },

  error: function (message, attr) {
    var ex = new Error("Module: "+this.id + " - " + message);
    if (attr) ex[attr] = true;
    ex.module = this;
    return ex;
  },

  handleError: function(error, nested) {
    try {
      var mod = this;
      mod.state = ERROR;

      if (mod.onError) {
        try {
          var errorError = null;

          mod.onError.forEach(function (cb) {
            cb(error, mod);
          });
        } catch(ex) {
          errorError = ex;
        }
      }
      if (mod.state === ERROR) {
        var modules = mod.ctx.modules;
        for (var id in mod.dependants) {
          var subm = modules[id];
          subm && subm.handleError(error, true);
        }

      }
      if (nested || mod.state !== ERROR) return;
      if (mod.ctx.onError)
        mod.ctx.onError(error, mod, errorError);
      else if (errorError)
        throw errorError;
      else if (errorError === undefined)
        throw error;
    } finally {
      mod.onError = null;
      nested || (mod.state === ERROR && mod.unload());
    }
  },
};

function informDependants(mod) {
  var modules = mod.ctx.modules;
  for (var id in mod.dependants) {
    var subm = modules[id];
    if (subm && --subm.depCount === 0)
      subm._ready();
  }
  if (mod.callback) {
    mod.callback.forEach(function (cb) {
      cb(mod.exports, mod);
    });
    mod.callback = null;
  }
}

function buildRequire(mod) {
  var ctx = mod.ctx;
  function require(id, callback, error) {
    if (Array.isArray(id)) {
      var results = {};
      var errorValue;
      var ids = id.map(function (id) {return mod.normalizeId(id)});
      var count = ids.length;
      var success = function (value, subMod) {
        results[subMod.id] = value;
        --count || finished();
      };

      var finished = function () {
        finished = null;
        if (errorValue)
          error(errorValue);
        else
          callback.apply(mod, ids.map(function (id) {
            return results[id];
          }));
      };

      var failure = error && function (value, mod) {
        errorValue = errorValue || value || mod.error('unexpected error');
        --count || error(errorValue);
      };
      ids.forEach(function (id) {
        --count;
        switch(id) {
        case 'require': results[id] = mod.require; return;
        case 'exports': results[id] = mod.exports; return;
        case 'module': results[id] = mod; return;
        }
        ++count;
        fetchModule(ctx, id, mod, success, failure);
      });
      if (count === 0 && finished) finished();
      return;
    }
    id = mod.normalizeId(id);
    var rmod = fetchModule(ctx, id, mod, callback, error);
    return rmod.exports;
  }
  require.module = mod;
  require.toUrl = toUrl;
  return require;
}

function toUrl(path) {
  return this.module.toUrl(path);
}

function Plugin(mod) {
  this.mod = mod;
  mod.plugin = this;
  this.waiting = {};
}

Module.Plugin = Plugin;

Plugin.prototype = {
  constructor: Plugin,

  fetch: function (name, parent, mod) {
    var plugin = this;
    var pluginMod = plugin.mod;
    if (pluginMod.state === READY) {
      name = plugin.normName(name, parent);
      var id = pluginMod.id+'!'+name;
      var modules = pluginMod.ctx.modules;
      var resMod = modules[id];
      if (resMod)
        return resMod;

      mod = modules[id] = new Module(pluginMod.ctx, '');
      mod.id = id; mod.state = WAIT_PLUGIN;
      return mod;
    }
    var parentId = parent ? parent.id : '';
    var parents = plugin.waiting[parentId] || (plugin.waiting[parentId] = {});
    var args = parents[name];
    if (! args) {
      if (! mod) {
        mod = new Module(pluginMod.ctx, '');
        mod.state = WAIT_PLUGIN;
      }
      args = parents[name] = [parent, mod];
    }

    return mod;
  },

  normName: function (name, parent) {
    var loader = this.mod.exports;
    if (parent)
      return loader.normalize ? loader.normalize(name, parent) : parent.normalizeId(name);
    return name;
  },

  load: function (name, mod) {
    var loader = this.mod.exports;
    var onLoad = function (value) {
      if (value !== undefined)
        mod.exports = value;
      mod.state = READY;
      informDependants(mod);
    };
    onLoad.error = function (error) {
      mod.handleError(error);
    };
    loader.load(name, mod.require, onLoad);
  },

  ready: function () {
    var waiting = this.waiting;
    this.waiting = null;
    var resolved = {};
    for (var pId in waiting) {
      var mods = waiting[pId];
      for (var name in mods) {
        var args = mods[name];
        var curr = args[1];
        name = this.normName(name, args[0]);
        var mod = resolved[name];
        if (mod) {
          if (curr === mod) continue;
          if (curr.id) {
            resolved[name] = curr; curr = mod; mod = resolved[name];
          }
          for (var id in curr.dependants)
            mod.dependants[id] = 1;
          if (curr.callback) {
            if (mod.callback)
              curr.callback.forEach(function (arg) {mod.callback.push(arg)});
            if (mod.error)
              curr.error.forEach(function (arg) {mod.error.push(arg)});
          }
        } else {
          resolved[name] = curr;
        }
      }
    }

    var pluginPrefix = this.mod.id+'!';

    for (var name in resolved) {
      var mod = resolved[name];
      if (mod.state === READY_WAIT_PLUGIN) {
        mod.state = LOADED;
        --mod.depCount || mod._ready();
      } else {
        mod.id = pluginPrefix+name;
        mod.ctx.modules[mod.id] = mod;
        this.load(name, mod);
      }
    }
  },
};

function newResourceModule(ctx, pluginId, name, parent, id) {
  var modules = ctx.modules;
  var pMod = modules[pluginId];
  if (! pMod) {
    modules[pluginId] = pMod = new Module(ctx, pluginId);
    pMod.state = LOADING;
    ctx.paused || pMod.loadModule();
  }
  if (id) {
    var mod = ctx.modules[id] = new Module(ctx, id);
    if (pMod.state === READY)
      return mod;
    mod.state = READY_WAIT_PLUGIN;
  }
  return (pMod.plugin || new Plugin(pMod)).fetch(name, parent, mod);
}

function fetchResourceModule(ctx, mod) {
  var modules = ctx.modules;
  var match = mod.id.split('!');
  var pMod = modules[match[0]];
  if (pMod.state === READY)
    pMod.plugin.load(match[1], mod);

  return mod;
}
