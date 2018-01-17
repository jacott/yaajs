"use strict";
const Context = require('./context');
const Module = require('./module');
Context.Module = Module;
const path = require('path');
const fs = require('fs');
const yaajs = require('./index');
const {parse} = require('babylon');
const traverse = require('babel-traverse').default;
const ty = require('babel-types');

let compileConfig, codeTree, fileCount,
    compileCtx, runtimeCtx;

Context.setGlobalName('requirejs');

const addCode = opts =>{
  opts.next = codeTree;
  codeTree = opts;
  ++fileCount;
};

const compile = module.exports.compile = (config, callback, error)=>{
  runtimeCtx = yaajs.config(config);

  compileCtx = Module.mainCtx = new Context(config);
  compileCtx.loadModule = loadModule;
  compileConfig = config;
  codeTree = {};
  fileCount = 0;

  const globalDefine = global.default;
  let name = config.name;
  global.define = Module.define;

  const _comp = () =>{
    global.define = globalDefine; // restore define in global environement
    const body = new Array(fileCount);
    const code = {};
    let entry = codeTree;

    for(let i = 0; i < fileCount; ++i, entry = entry.next) {
      body[i] = entry.ast;
      code[entry.filename] = entry.code;
    }

    callback({ast: {type: 'Program', body}, code, name});

    global.define = Module.define;
    fileCount = 0;
    codeTree = {};
  };

  if (config.hierarchy === undefined) {
    compileCtx.require(config.name, _comp);

  } else for (const n of config.hierarchy) {
    name = n;
    compileCtx.require(n, _comp);
  }
  runtimeCtx = compileCtx = compileConfig = codeTree = fileCount = null;
};

const runtimePluginFetch = Module.Plugin.prototype.fetch;

Module.Plugin.prototype.fetch = function (name, parent) {
  const pluginMod = this.mod;
  if (pluginMod.ctx !== compileCtx) return runtimePluginFetch.call(this, name, parent);

  let loader, loaderMod;

  const loaderCallback = (arg, mod)=>{loader = arg, loaderMod = mod};
  runtimeCtx.require(pluginMod.id, loaderCallback);
  if (loader.pluginBuilder) {
    runtimeCtx.require(loaderMod.normalizeId(loader.pluginBuilder), loaderCallback);
  }
  name = loader.normalize ? loader.normalize(name, parent) : parent.normalizeId(name);
  const id = pluginMod.id+'!'+name;
  const modules = pluginMod.ctx.modules;
  const resMod = modules[id];

  if (resMod) return resMod;

  const mod = new Module(pluginMod.ctx, id, Module.WAIT_PLUGIN);

  const onLoad = value =>{
    if (value !== undefined)
      mod.exports = value;
    mod.state = Module.READY;
    Module._informDependants(mod);
  };

  onLoad.error = ()=>{};
  onLoad.fromText = code =>{parseContents(mod, code)};

  loader.load(name, mod.require, onLoad);

  const onWrite = code =>{
    const sfn = filename(mod);
    addCode({ast: parse(code, {
      sourceType: 'module',
      sourceFilename: sfn,
    }).program, filename: sfn, code});
  };
  loader.write && loader.write(pluginMod.id, name, onWrite);
  return mod;
};


const parseContents = (mod, code)=>{
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

  const depsMap = {};
  let deps;

  const addDep = name =>{
    const match = /^([^!]+)!(.*)$/.exec(name);
    if (match) {
      mod.require(name, (_, mod)=>{name = mod.id});
    }
    name = mod.normalizeId(name);
    if (name && ! depsMap[name]) {
      depsMap[name] = true;
      deps.push(name);
    }
  };

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

};

const filename = mod => `/${mod.id}.js`;

function loadModule(mod) {
  const oldCtx = Module.currentCtx;
  const ctx = Module.currentCtx = this;
  try {
    const contents = fs.readFileSync(mod.uri);

    parseContents(mod, (
      compileConfig.onBuildRead !== undefined ?
        compileConfig.onBuildRead(mod, contents) : contents).toString());

  } catch(ex) {
    throw ex;
  } finally {
    Module.currentCtx = oldCtx;
  }
};
