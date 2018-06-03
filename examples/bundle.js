#!/usr/bin/env node
Error.stackTraceLimit = 100;

const Path = require('path');
const fs = require('fs');

const compiler = require('../lib/compiler');

// Converts more types than JSON.stringify including functions
const stringify = value =>{
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
};

const clientCfg = {baseUrl: "/"};

const baseDir = Path.resolve(__dirname+'/..');

const buildDir = Path.resolve(Path.join(baseDir, 'build'));

const topDir = Path.join(baseDir, 'test');

process.chdir(topDir);

const configCode = "yaajs.config(" + stringify(clientCfg) + ");\n";

const compileConfig = {
  baseUrl: topDir,

  // // example onBuildRead
  // onBuildRead(mod, contents) {
  //   if (mod.id === 'css/loader')
  //     return "define({loadAll(){}});";

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

const astConfig = {
  parse: {},
  compress: false,
  mangle: false,
  output: {
    ast: true,
    code: false,
  }
};

const parse = (codeIn, codeFilename)=> compiler.parse(codeIn, astConfig).ast;

try {
  compiler.compile(compileConfig, ({ast, code: codeMap})=>{
    const yaajsCode = fs.readFileSync(require.resolve('yaajs/yaa.js')).toString();
    codeMap['/index.js'] = yaajsCode;
    const yaajsAst = parse(yaajsCode, '/index.js');
    codeMap['/__config__.js'] = configCode;
    var configCodeAst = parse(configCode, '/__config__.js');
    ast.body.splice(0, 0, yaajsAst, configCodeAst);

    console.log('generate...');
    const {code, error} = compiler.parse(ast, {
      compress: false,
      mangle: false,
      output: {
        beautify: true,
        indent_level: 2,
        ast: false,
        code: true,
      }
    });
    if (error) throw error;
    console.log('done');

    fs.writeFileSync(compileConfig.out, code);
  });
} catch(ex) {
  process.stderr.write(ex.stack);
  process.exit(1);
}
