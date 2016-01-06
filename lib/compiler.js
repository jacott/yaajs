var Context = require('./context');
var Module = require('./module');
Context.Module = Module;
var path = require('path');
var fs = require('fs');
var UglifyJS = require("uglify-js/tools/node");
var yaajs = require('./index');

Context.setGlobalName('requirejs');

global.define = Module.define;

var compileConfig, codeTree;

var runtimeLoadModule = Module.prototype.loadModule;

var compileCtx, runtimeCtx;

Module.prototype.loadModule = function () {
  var mod = this;
  if (mod.ctx !== compileCtx) return runtimeLoadModule.call(mod);
  try {
    var oldCtx = Module.currentCtx;
    var ctx = Module.currentCtx = mod.ctx;
    var contents = fs.readFileSync(mod.uri);
    if (compileConfig.onBuildRead)
      contents = compileConfig.onBuildRead(mod, contents);

    parseContents(mod, contents.toString());

  } catch(ex) {
    throw ex;
  } finally {
    Module.currentCtx = oldCtx;
  }
};

var runtimePluginFetch = Module.Plugin.prototype.fetch;

Module.Plugin.prototype.fetch = function (name, parent) {
  var pluginMod = this.mod;
  if (pluginMod.ctx !== compileCtx) return runtimePluginFetch.call(this, name, parent);

  var loader, loaderMod;

  function loaderCallback(arg, mod) {loader = arg, loaderMod = mod}
  runtimeCtx.require(pluginMod.id, loaderCallback);
  if (loader.pluginBuilder) {
    runtimeCtx.require(loaderMod.normalizeId(loader.pluginBuilder), loaderCallback);
  }
  name = loader.normalize ? loader.normalize(name, parent) : parent.normalizeId(name);
  var id = pluginMod.id+'!'+name;
  var modules = pluginMod.ctx.modules;
  var resMod = modules[id];

  if (resMod) return resMod;

  var mod = new Module(pluginMod.ctx, id, Module.WAIT_PLUGIN);

  function onLoad(value) {
    if (value !== undefined)
      mod.exports = value;
    mod.state = Module.READY;
    Module._informDependants(mod);
  };

  onLoad.error = function () {};

  onLoad.fromText = function (code) {
    parseContents(mod, code);
  };

  loader.load(name, mod.require, onLoad);

  function onWrite(code) {
    codeTree = {code: code, next: codeTree};
  }
  loader.write && loader.write(pluginMod.id, name, onWrite);
  return mod;
};

function parseContents(mod, code) {
  var ast = UglifyJS.parse(code);

  var defTokenCount = -1;
  var name, deps, defDeps;
  var requireName, requireState;
  var depsMap = {};
  var processor = findDefine;
  var startpos, endpos;

  ast.walk(new UglifyJS.TreeWalker(function(node, descend){
    return processor(node, descend);
  }));

  if (startpos && ! name) {
    var middle = JSON.stringify(mod.id) + ",";
    if (deps) middle += JSON.stringify(deps);
    if (defDeps) middle += ", ";
    code = code.slice(0, startpos) + middle + code.slice(endpos);
  }

  codeTree = {code: code, next: codeTree};

  Module._prepareDefine(mod, deps, mod.exports);

  function addDep(name) {
    if (! name) return;
    var match = /^([^!]+)!(.*)$/.exec(name);
    if (match) {
      mod.require(name, function (_, mod) {
        name = mod.id;
      });
    }
    name = mod.normalizeId(name);
    if (name && ! depsMap[name]) {
      depsMap[name] = true;
      deps.push(name);
    }
  }

  function findDefine(node, descend) {
    if (node.TYPE === 'Call' &&
        node.start.type === 'name' &&
        node.start.value === 'define') {
      processor = defineArgs;
      name = null;
      descend();
      if (name !== null && name !== mod.id)
        processor = findDefine;
      else
        processor = finished;
      return true;
    }
  }

  function defineArgs(node, descend) {
    if (++defTokenCount === 0) return;
    if (startpos) return true;
    switch(node.TYPE) {
    case 'String':
      name = node.start.value;
      processor = finished;
      return true;
    case 'Array':
      startpos = node.start.pos;
      endpos = node.end.endpos;
      deps = [];
      processor = parseList;
      descend();
      processor = finished;
      return true;
    case 'Function':
      defDeps = true;
      startpos = node.start.pos;
      endpos = startpos;
      deps = [];
      processor = parseFunction;
      descend();
      processor = finished;
      return true;
    default:
      startpos = node.start.pos;
      endpos = startpos;
      processor = finished;
      return true;
    }
  }

  function finished() {return true}

  function parseList(node) {
    switch(node.TYPE) {
    case 'String': case 'SymbolFunarg':
      addDep(node.start.value);
    }
    return true;
  }

  function parseFunction(node, descend) {
    if(node.TYPE === 'SymbolFunarg') {
      /^(?:require|exports|module)$/.test(node.start.value) &&
        addDep(node.start.value);
      return true;
    }
    processor = findRequire;
    return processor(node, descend);
  }

  function findRequire(node, descend) {
    if (node.TYPE === 'Call' &&
        node.start.type === 'name' &&
        node.start.value === 'require') {
      processor = parseRequire;
      requireName = null; requireState = 'Call';
      descend();
      processor = findRequire;
      requireName && addDep(requireName);
      return true;
    }
  }

  function parseRequire(node, descend) {
    var start = node.start;
    switch(node.TYPE) {
    case 'Call':
      requireName = null;
      requireState = start.type === 'name' && start.value === 'require' && 'Call';
      break;
    case 'SymbolRef':
      requireState = requireState === 'Call' && 'SymbolRef';
      break;
    case 'String':
      if (requireState === 'SymbolRef')
        requireName = start.value;
      requireState = null;
      break;
    default:
      requireName = requireState = null;
    }
    if (node instanceof UglifyJS.AST_Scope) {
      processor = findRequire;
      descend();
      processor = parseRequire;
      requireName = null;
      requireState = null;
      return true;
    }
  }
}

function compile(config, callback, error) {
  runtimeCtx = yaajs.config(config);

  compileCtx = Module.mainCtx = new Context(config);
  compileConfig = config;
  codeTree = {};

  compileCtx.require(config.name, function () {
    callback(codeTree);
  });
}

module.exports.compile = compile;
