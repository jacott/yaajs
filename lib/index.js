var path = require('path');
var vm = require('vm');
var fs = require('fs');

var Context = require('./context');
var Module = require('./module');
Context.Module = Module;

Module.prototype.undef = function () {};

Module.prototype.loadModule = function (callback, error) {
  var mod = this;
  try {
    var oldCtx = Module.currentCtx;
    Module.currentCtx = mod.ctx;
    vm.runInThisContext(wrap(mod,fs.readFileSync(mod.uri)), mod.uri, true, 5000);

    if (mod.state > Module.LOADING)
      return;

    if (callback) {
      callback();
      return;
    }

  } catch(ex) {
    if (ex.code === 'ENOENT') {
      try {
        var result = yaajs.nodeRequire(mod.id);
        Module._prepareDefine(mod, null, null, result);
        return;
      } catch(ex2) {
        if (ex2.code !== 'MODULE_NOT_FOUND')
          ex = ex2;
      }
      ex.onload = true;
    }
    ex.module = mod;
    if (error)
      error(ex);
    else
      mod.handleError(ex);
    return;
  } finally {
    Module.currentCtx = oldCtx;
  }

  var gdr = Module._globalDefineResult;
  Module._globalDefineResult = null;
  if (! gdr) {
    return mod._nodefine();
  }

  Module._prepareDefine(mod, gdr[1], gdr[2], gdr[3]);
};

function wrap(mod, code) {
  var ctx = mod.ctx;
  return wrapStart +
    code +
    '\n}(__yaajsVars__.define, __yaajsVars__.nodeRequire, __yaajsVars__.yaajs));';
}

var wrapStart;

Context.setGlobalName = function (value) {
  wrapStart = '(function (define, require, '+value+') { ';
};

Context.setGlobalName('yaajs');

Context._onConfig = function (ctx) {
  global.__yaajsVars__ = {
    define: Module.define,
    nodeRequire: ctx.nodeRequire || require,
    yaajs: module.exports,
  };
};

var mainCtx = Module.currentCtx = new Context({baseUrl: __dirname});
var yaajs = module.exports = mainCtx.require;
yaajs.config = mainCtx.config.bind(mainCtx);
