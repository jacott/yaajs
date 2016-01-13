module.exports = Module;

var UNLOADED = Module.UNLOADED = -2;
var ERROR = Module.ERROR = -1;
var INIT = Module.INIT = 0;
var LOADING = Module.LOADING = 1;
var WAIT_PLUGIN = Module.WAIT_PLUGIN = 2;
var PREPARING = Module.PREPARING = 3;
var READY_WAIT_PLUGIN = Module.READY_WAIT_PLUGIN = 4;
var LOADED = Module.LOADED = 5;
var READY = Module.READY = 6;

function fetchModule(ctx, id, parent, callback, error) {
  var mod = ctx.modules[id];
  var named = callback === 'named';
  if (mod) {
    if (named) {
      if (mod.state > WAIT_PLUGIN)
        throw mod.newError("Defined more than once");

      return mod;
    }

  } else {
    var match = /^([^!]+)!(.*)$/.exec(id);
    var mod = match ? newResourceModule(ctx, match[1], match[2], parent, named && id)
          : new Module(ctx, id);

    if (named) return mod;
  }

  if (callback) {
    if (mod.state === READY)
      callback(mod.exports, mod);
    else if (mod.callback)
      mod.callback.push(callback);
    else
      mod.callback = [callback];
  } else if (parent && parent.id && mod.dependants[parent.id] === undefined) {
    if (parent.state !== READY && mod.state !== READY) {
      mod.dependants[parent.id] = 1;
      ++ctx.depCount;
      ++parent.depCount;
    }
  }

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
    ctx.paused || ctx.loadModule(mod);
  }

  return mod;
}

function decDepCount(mod) {
  --mod.ctx.depCount;
  --mod.depCount;
  isReady(mod) && mod._ready();
}

function isReady(mod) {
  if (mod.depCount < 0 || mod.ctx.depCount < 0)
    throw new Error("depCount below zero!");
  return mod.depCount === 0 && mod.state === LOADED && ! mod.ctx.paused;
}

function Module(ctx, id, state) {
  var mod = this;
  mod.state = state || INIT;
  mod.ctx = ctx;
  mod.dependants = {};
  mod.id = id;
  mod.depCount = 0;

  if (id || mod.state !== INIT) ++ctx.resolvingCount;
  if (id) {
    ctx.modules[id] = mod;
    if (state === undefined) mod.uri = ctx.uri(id);
  } else {
    Module.without.push(mod);
  }
}

Module.without = [];

var commentRe = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;
var requireRe = /(?:[^.]|^)\brequire\s*\(\s*(["'])([^\1\s)]+)\1\s*\)/g;
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
    Module._prepare(mod, deps, body, argc);
    return;
  }
  Module._globalDefineResult = [name, deps, body, argc];
}

Module._prepare = function(mod, deps, body, autoRequire) {
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
  if (mod.state !== READY_WAIT_PLUGIN)
    mod.state = PREPARING;

  ctx.waitReady[mod.id] = mod;

  if (deps) {
    for(var i = 0; i < deps.length; ++i) {
      var name = deps[i];
      if (/^(?:require|exports|module)$/.test(name))
        continue;
      var dMod = mod.dependOn(name);
      deps[i] = dMod.id;
      if (mod.state === UNLOADED) {
        --ctx.resolvingCount;
        breakCycle(ctx);
        return;
      }
    }
  }

  --ctx.resolvingCount;

  if (mod.state !== READY_WAIT_PLUGIN) {
    mod.state = LOADED;
    isReady(mod) && mod._ready();
  }
  ctx.paused || breakCycle(ctx);
};

Module.breakCycle = breakCycle;

function breakCycle(ctx) {
  while (ctx.resolvingCount === 0 && ctx.loadingCount === 0 && ctx.depCount !== 0) {
    var perm = {};
    var link = null;
    for (var wm in ctx.waitReady) {
      link  = findCycle(ctx.modules[wm], {}, perm);
      if (link) break;
    }
    if (link) {
      if (ctx.enforceAcyclic) {
        var error = link[0].newError("Cycle detected to " + link[1].id);
        var mod = link[0];
        link[0]._error(error);
        if (link[0].state === UNLOADED) {
          continue;
        }
      }
      link[0].depMap[link[1].id] = 0;
      link[1].dependants[link[0].id] = 0;

      decDepCount(link[0]);
    } else {
      throw new Error("Unexpected: Can't find cycle!");
    }
  }}

Module._informDependants = informDependants;

Module._unpause = function (ctx) {
  ctx.paused = false;
  var modules = ctx.modules;
  for (var id in modules) {
    var mod = modules[id];
    switch(mod.state) {
    case LOADED:
      isReady(mod) && mod._ready();
      break;
    case LOADING:
      ctx.loadModule(mod);
      break;
    }
  }
  breakCycle(ctx);
}

function findCycle(mod, temp, perm) {
  var modId = mod.id;
  if (perm[modId]) return;
  temp[modId] = true;

  var modules = mod.ctx.modules;
  var waitReady = mod.ctx.waitReady;
  var reqs = mod.depMap;
  try {
    for (var id in reqs) {
      if (! id || ! waitReady[id] || ! reqs[id]) continue;
      var child = modules[id];
      if (temp[id]) return [mod, child];
      var x = findCycle(child, temp, perm);
      if (x)
        return x;
    }
  } finally {
    perm[modId] = true;
    temp[modId] = false;
  }
}

function runBody(mod) {
  if (mod.requireDeps) {
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
    var result = mod.body.apply(global, args);
  } else if (mod.exports) {
    var result = mod.body.call(global, mod.require, mod.exports, mod);
  } else {
    mod.exports = mod.body.call(global);
  }
  if (result !== undefined)
    mod.exports = result;
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
      var oldCtx = Module.currentCtx;
      Module.currentCtx = mod.ctx;
      try {
        runBody(mod);
      } catch(ex) {
        ex.onload = true;
        ex.module = mod;
        mod._error(ex);
        if (mod.state === ERROR) return;
      } finally {
        Module.currentCtx = oldCtx;
      }
    }

    delete mod.ctx.waitReady[mod.id];
    mod.state = READY;
    mod.plugin && mod.plugin.ready();
    informDependants(mod);
  },

  _nodefine: function () {
    var ctx = this.ctx;
    var shim = ctx.shim && ctx.shim[this.id];
    if (shim && ! shim.expectDefine) {
      Module._prepare(this, shim.deps, shim.exports || function () {});
      return;
    }
    if (ctx.enforceDefine)
      this._error(this.newError('Define not run', 'nodefine'));
    else
      Module._prepare(this);
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

  dependOn: function (id) {
    id = this.normalizeId(id);
    if (this.depCount == null) this.depCount = 0;
    var dMod = fetchModule(this.ctx, id, this);
    if (! this.depMap)
      this.depMap = {};
    this.depMap[dMod.id] = 1;
    return dMod;
  },

  unload: function () {
    var mod = this;
    if (mod.state === UNLOADED)
      return;

    var ctx = mod.ctx;
    var modules = ctx.modules;
    delete modules[mod.id];
    if (mod.depMap) for (var id in mod.depMap) {
      var depon = modules[id];
      if (depon)
        delete depon.dependants[mod.id];
    }
    ctx.depCount -= mod.depCount;
    mod.depCount = 0;
    mod.depMap = null;
    isReady(mod); // assert depCount >= 0
    if (mod.id) {
      delete ctx.waitReady[mod.id];
      if (mod.state < LOADED)
        --ctx.resolvingCount;
    }
    mod.state = UNLOADED;
    for (var id in mod.dependants) {
      var subm = modules[id];
      subm && subm.unload();
    }
    mod.uri && ctx.undef(mod);
    mod._unloads && mod._unloads.forEach(function (func) {
      func(mod);
    });
  },

  onUnload: function (func) {
    (this._unloads || (this._unloads = [])).push(func);
  },

  newError: function (message, attr) {
    var ex = new Error("Module: "+this.id + " - " + message);
    if (attr) ex[attr] = true;
    ex.module = this;
    return ex;
  },

  _error: function(error, tracking) {
    var mod = this;
    if (tracking) {
      var nested = true;
    } else {
      tracking = {}; // me might have cycles
    }

    tracking[mod.id] = 1;

    try {
      mod.prevState = mod.state;
      mod.state = ERROR;
      if (mod.onError) {
        try {
          var errorError = null;

          mod.onError.some(function (cb) {
            cb(error, mod);
            return mod.state !== ERROR;

          });
        } catch(ex) {
          errorError = ex;
        }
      }
      if (mod.state === ERROR) {
        var modules = mod.ctx.modules;
        for (var id in mod.dependants) {
          var subm = modules[id];
          subm && ! tracking[id] && subm._error(error, tracking);
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
      if (mod.state === ERROR) {
        mod.state = mod.prevState;
        mod.prevState = mod.onError = null;
        nested || mod.unload();
      } else {
        mod.prevState = null;
      }
    }
  },
};

function informDependants(mod) {
  var waitReady = mod.ctx.waitReady;
  for (var id in mod.dependants) {
    var subm = waitReady[id];
    if (subm) {
      decDepCount(subm);
    }
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
        try {
        if (errorValue)
          error(errorValue);
        else
          callback.apply(mod, ids.map(function (id) {
            return results[id];
          }));
        } catch(ex) {
          if (ctx.onError)
            ctx.onError(errorValue || ex, mod, ex);
          else
            throw ex;
        }
      };

      var failure = error && function (value, mod) {
        errorValue = errorValue || value || mod.newError('unexpected error');
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

      mod = new Module(pluginMod.ctx, id, WAIT_PLUGIN);
      return mod;
    }
    var parentId = parent ? parent.id : '';
    var parents = plugin.waiting[parentId] || (plugin.waiting[parentId] = {});
    var args = parents[name];
    if (args) return args[1];
    if (! mod)
      mod = new Module(pluginMod.ctx, '', WAIT_PLUGIN);
    args = parents[name] = [parent, mod];
    return mod;
  },

  normName: function (name, parent) {
    var loader = this.mod.exports;
    if (parent) {
      return loader.normalize ?
        loader.normalize(name, function (id) {return parent.normalizeId(id)}, parent) :
      parent.normalizeId(name);
    }
    return name;
  },

  load: function (name, mod) {
    if (mod.state >= PREPARING) return;
    mod.ctx.waitReady[mod.id] = mod;
    mod.state = PREPARING;
    var loader = this.mod.exports;
    var onLoad = function (value) {
      if (value !== undefined) mod.exports = value;
      mod.ctx.waitReady[mod.id] = mod;
      --mod.ctx.resolvingCount;
      mod.state = LOADED;
      isReady(mod) && mod._ready();
      breakCycle(mod.ctx);
    };
    onLoad.error = function (error) {mod._error(error)};
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
          for (var id in curr.dependants) {
            mod.dependants[id] = 1;
          }
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
        isReady(mod) && mod._ready();
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
    pMod = new Module(ctx, pluginId);
    pMod.state = LOADING;
    ctx.paused || ctx.loadModule(pMod);
  }
  if (id) {
    var mod = new Module(ctx, id);
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
