const Context = require('./context');
const Module = require('./module');
Context.Module = Module;
const path = require('path');
const fs = require('fs');
const yaajs = require('./index');
const {parse} = require('babylon');
const traverse = require('babel-traverse').default;
const ty = require('babel-types');

Context.setGlobalName('requirejs');

function addCode(opts) {
  opts.next = codeTree;
  codeTree = opts;
  ++fileCount;
}

var compileConfig, codeTree, fileCount;
var compileCtx, runtimeCtx;

module.exports.compile = compile;
function compile(config, callback, error) {
  runtimeCtx = yaajs.config(config);

  compileCtx = Module.mainCtx = new Context(config);
  compileCtx.loadModule = loadModule;
  compileConfig = config;
  codeTree = {};
  fileCount = 0;

  var globalDefine = global.default;
  global.define = Module.define;

  compileCtx.require(config.name, function () {
    global.define = globalDefine; // restore define in global environement
    const body = new Array(fileCount);
    const code = {};
    var entry = codeTree;
    for(var i = 0; i < fileCount; ++i, entry = entry.next) {
      body[i] = entry.ast;
      code[entry.filename] = entry.code;
    }
    runtimeCtx = compileCtx = compileConfig = codeTree = fileCount = null;

    callback({ast: {type: 'Program', body}, code});
  });
}

const runtimePluginFetch = Module.Plugin.prototype.fetch;

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

  const mod = new Module(pluginMod.ctx, id, Module.WAIT_PLUGIN);

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
    const sfn = filename(mod);
    addCode({ast: parse(code, {
      sourceType: 'module',
      sourceFilename: sfn,
    }).program, filename: sfn, code});
  }
  loader.write && loader.write(pluginMod.id, name, onWrite);
  return mod;
};


function parseContents(mod, code) {
  const sfn = filename(mod);
  const ast = (() => {
    try {
      return parse(code, {
        sourceType: 'module',
        sourceFilename: sfn,
      });
    }
    catch (ex) {
      if (ex instanceof SyntaxError) {
        const m = /^(.*)+\s\((\d+:\d+)\)/.exec(ex.message);
        throw new SyntaxError(`${m[1]}\n    at ${mod.uri}:${m[2]}`);
      } else
        throw ex;
    }
  })();


  var deps;
  const depsMap = {};

  traverse(ast, {
    CallExpression (path) {
      const node = path.node;
      if (node.callee.name === 'define' &&
          node.arguments.length > 0) {
        let [name, deps1, body] = node.arguments;
        if (deps1 === undefined) {
          body = name; name = null;
        } else {
          if (body === undefined) {
            body = deps1;
            if (ty.isStringLiteral(name)) {
              deps1 = null;
            } else {
              deps1 = name; name = null;
            }
          }
        }
        if (! name) name = ty.StringLiteral(mod.id);

        if (deps1) {
          deps = [];
          deps1.elements.forEach(node => addDep(node.value));
        } else if (ty.isFunctionExpression(body) && body.params.length) {
          deps = [];
          node.arguments = [name, deps, body];
          body.params.forEach(node => {
            if (ty.isIdentifier(node))
              /^(?:require|exports|module)$/.test(node.name) &&
              addDep(node.name);
          });
          traverse(body, {
            noScope: true,
            BlockStatement (path) {
              traverse(path.node, {
                noScope: true,
                CallExpression ({node}) {
                  if (node.callee.name === 'require' &&
                      node.arguments.length === 1) {
                    let arg = node.arguments[0];
                    if (ty.isStringLiteral(arg))
                      addDep(arg.value);
                  }
                },
              });
              path.shouldSkip = true;
            }
          });
        }
        if (deps) {
          node.arguments = [name, ty.ArrayExpression(deps.map(name => ty.StringLiteral(name))), body];
        } else {
          node.arguments = [name, body];
        }
        path.shouldSkip = true;
        return;
      }
    }
  });

  addCode({ast: ast.program, filename: sfn, code});

  Module._prepare(mod, deps, mod.exports);

  function addDep(name) {
    const match = /^([^!]+)!(.*)$/.exec(name);
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
}

function filename(mod) {return `/${mod.id}.js`}

function loadModule(mod) {
  const oldCtx = Module.currentCtx;
  const ctx = Module.currentCtx = this;
  try {
    const contents = fs.readFileSync(mod.uri);
    if (compileConfig.onBuildRead)
      contents = compileConfig.onBuildRead(mod, contents);

    parseContents(mod, contents.toString());

  } catch(ex) {
    throw ex;
  } finally {
    Module.currentCtx = oldCtx;
  }
};
