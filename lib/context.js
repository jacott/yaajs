module.exports = Context;

var contexts = {};

function Context(opts) {
  var ctx = this;
  ctx.modules = {};
  ctx.paths= {};
  ctx.moduleConfig = {};
  ctx.requireDefine = false;
  contexts[this.name = opts.context||''] = this;
  (this.config = config.bind(this))(opts);
  this.require = new Context.Module(this, "").require;
}

Context.prototype = {
  constructor: Context,

  uri: function (id, suffix) {
    if (id == null) return;
    if (/(?:^(?:[a-z]+:\/)?\/|\.js$)/i.test(id))
      return id;

    if (suffix === undefined)
      suffix = '.js';
    var ctx = this;

    var paths = ctx.paths;
    if (paths) {
      var parts = id.split('/');
      var path;
      for(var i = 0; i < parts.length; ++i) {
        paths = paths[parts[i]];
        if (! paths) break;
        if (paths['/location']) path = [paths['/location']];
        else path && path.push(parts[i]);
      }
      if (path) {
        --i;
        while (++i < parts.length) path.push(parts[i]);
        id = path.join('/');
        if (/^(?:[a-z]+:\/)?\//i.test(path[0]))
          return id+suffix;
      }
    }

    return ctx.baseUrl+id+suffix;
  },

  normalizeId: function (id, dir) {
    var ctx = this;
    var parts = [];
    if (id[0] === '.') {
      if (dir) id = dir + '/' + id;
      id.split('/').forEach(function (part) {
        switch (part) {
        case '.': case '':
          break;
        case '..':
          if (parts.length === 0) throw new Error(id + ": does not resolve within baseUrl");
          parts.pop();
          break;
        default:
          parts.push(part);
        }
      });

      id = parts.join('/');
    }
    var packages = ctx.packages;
    if (packages = packages && ctx.packages[id])
      id += '/' + packages;
    return id;
  },
};

Context.remove = function (name) {
  delete contexts[name];
};

function config(opts) {
  var ctx = this;
  if (! opts) return ctx;
  var name = opts.context;
  if (name !== undefined && name !== ctx.name) {
    return contexts[name] ? contexts[name].config(opts) : new Context(opts);
  }
  var value = opts.baseUrl;
  if (value !== undefined) {
    ctx.baseUrl = value;
    if (ctx.baseUrl.charAt(ctx.baseUrl.length -1) !== '/')
      ctx.baseUrl += '/';
  }

  opts.config && setNameValue(ctx, 'moduleConfig', opts.config);
  opts.paths && setPaths(ctx, opts.paths);
  opts.packages && setPackages(this, opts.packages);
  opts.shim && setNameValue(ctx,'shim', opts.shim);
  if (opts.requireDefine !== undefined)
    ctx.requireDefine = !! opts.requireDefine;
  if (opts.nodeRequire) ctx.nodeRequire = opts.nodeRequire;
  if (Context._onConfig) {
    Context._onConfig(ctx);
  }
  return this;
}

function setPaths(ctx, value) {
  var paths = ctx.paths = {};
  for (var id in value) {
    setPath(paths, id, value[id]);
  }
}

function setPath(paths, name, location) {
  name.split("/").forEach(function (part) {
    paths = paths[part] || (paths[part] = {});
  });
  paths['/location'] = location;
}

function setNameValue(ctx, name, value) {
  var field = ctx[name] = {};
  for (var id in value) {
    field[ctx.normalizeId(id)] = value[id];
  }
}

function setPackages(ctx, value) {
  var packages = ctx.packages = {};
  value.forEach(function (entry) {
    if (typeof entry === 'string') {
      var name = entry;
    } else {
      var name = entry.name;
      var main = entry.main;
      if (entry.location) {
        setPath(ctx.paths, name, entry.location);
      }
    }
    packages[ctx.normalizeId(name)] = main || "main";
  });
}
