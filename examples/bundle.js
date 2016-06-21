#!/usr/bin/env node
Error.stackTraceLimit = 100;

var Path = require('path');
var fs = require('fs');

var compiler = require('../lib/compiler');
const {parse} = require('babylon');
const generate = require('babel-generator').default;

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
  baseUrl: topDir,

  // // example onBuildRead
  // onBuildRead: function (mod, contents) {
  //   if (mod.id === 'css/loader')
  //     return "define({loadAll: function(){}});";

  //   if (mod.id === 'client') {
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
  compiler.compile(compileConfig, function ({ast, code: codeMap}) {
    const yaajsCode = fs.readFileSync(require.resolve('yaajs/yaa.js')).toString();
    codeMap['/index.js'] = yaajsCode;
    const yaajsAst = parse(yaajsCode, {sourceType: 'module', sourceFilename: '/index.js'}).program;
    codeMap['/__config__.js'] = cfgStr;
    const cfgStrAst = parse(cfgStr, {sourceType: 'module', sourceFilename: '/__config__.js'}).program;
    ast.body.splice(0, 0, yaajsAst, cfgStrAst);

    console.log('generate...');
    const { code, map } = generate(ast, {
      comments: false,
      compact: true,
      sourceMaps: true,
    }, codeMap);
    console.log('done');

    fs.writeFileSync(compileConfig.out, code);
    fs.writeFileSync(compileConfig.out+'.map', JSON.stringify(map));
  });
} catch(ex) {
  process.stderr.write(ex.stack);
  process.exit(1);
}
