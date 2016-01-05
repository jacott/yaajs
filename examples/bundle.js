#!/usr/bin/env node
Error.stackTraceLimit = 50;

var Path = require('path');
var fs = require('fs');

var compiler = require('../lib/compiler');

// Converts more types than JSON.stringify including functions
function stringify(value) {
  if (value == null) return ''+value;
  switch (typeof value) {
  case 'object':
    if (Array.isArray(value)) {
      var result = [];
      for(var i = 0; i < value.length; ++i) {
        result.push(stringify(value[i]));
      }
      return "["+result.join(",")+"]";
    } else {
      var result = [];
      for (var key in value) {
        result.push(JSON.stringify(key)+':' + stringify(value[key]));
      }
      return "{"+result.join(",")+"}";
    }
  case 'function':
    return value.toString();
  default:
    return JSON.stringify(value);
  }
}

var clientCfg = {baseUrl: "/"};

var baseDir = Path.resolve(__dirname+'/..');

var buildDir = Path.resolve(Path.join(baseDir, 'build'));

var topDir = Path.join(baseDir, 'test');

process.chdir(topDir);

var cfgStr = "yaajs.config(" + stringify(clientCfg) + ");\n";

var compileConfig = {
  // optimize: 'none',
  baseUrl: topDir,

  // // example onBuildRead
  // onBuildRead: function (moduleName, contents) {
  //   if (moduleName === 'css/loader')
  //     return "define({loadAll: function(){}});";

  //   if (moduleName === 'client') {
  //     contents = fs.readFileSync(Path.join(topDir, "foo.js")).toString();
  //     return contents;
  //   }

  //   return contents;
  // },

  name: 'data/compile-top',
  out: Path.join(buildDir, "index.js"),
};

try {fs.mkdirSync(buildDir);} catch(ex) {}



try {
  compiler.compile(compileConfig, function (codeTree) {
    var code = ["window.isServer = false; window.isClient = true;\n", fs.readFileSync(Path.join(baseDir, 'yaa.js')), cfgStr];
    for (;codeTree; codeTree = codeTree.next) {
      code.push(codeTree.code);
    }
    fs.writeFileSync(compileConfig.out, code.join("\n"));
  });
} catch(ex) {
  process.stderr.write(ex.stack);
  process.exit(1);
}
