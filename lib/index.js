var path = require('path');
var vm = require('vm');
var fs = require('fs');

var Context = require('./context');
var Module = require('./module');
Context.Module = Module;

Context.prototype.undef = function () {};

Context.prototype.loadModule = function (mod) {
  var oldCtx = Module.currentCtx;
  Module.currentCtx = this;
  try {
    vm.runInThisContext(wrap(mod,fs.readFileSync(mod.uri)), {filename: mod.uri, displayErrors: true, timeout: 5000});

    if (mod.state > Module.LOADING)
      return;
  } catch(ex) {
    if (ex.code === 'ENOENT') {
      try {
        var result = yaajs.nodeRequire(mod.id);
        Module._prepare(mod, null, null, result);
        return;
      } catch(ex2) {
        if (ex2.code !== 'MODULE_NOT_FOUND')
          ex = ex2;
      }
      ex.onload = true;
    }
    ex.module = mod;
    mod._error(ex);
    return;
  } finally {
    Module.currentCtx = oldCtx;
  }

  var gdr = Module._globalDefineResult;
  Module._globalDefineResult = null;
  if (! gdr) {
    return mod._nodefine();
  }

  Module._prepare(mod, gdr[1], gdr[2], gdr[3]);
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
