const assert = require('assert');
const path = require('path');

const compiler = require('../lib/compiler');

const baseUrl = path.resolve(__dirname);

describe("Compiling modules", ()=>{
  let contextConfig;

  beforeEach(()=>{
    contextConfig = {baseUrl};
  });

  it("can combine modules", () => {
    let ast;
    compiler.compile({name: "data/compile-top", contextConfig, callback(r) {ast = r.ast}});
    assert.equal(ast.TYPE, "Toplevel");
    assertAst(ast, [
      'define("data/simple-plugin",["require","exports","module"],function(require,exports,module){return{load:function(name,req,onLoad){onLoad(req.module.state===module.constructor.PREPARING?"simple "+name:"not preparing")},write:function(pluginName,name,write){write("define("+JSON.stringify(pluginName+"!"+name)+","+JSON.stringify("simple "+name)+");\\n")}}});',

      'define("data/simple-plugin!data/fuzz","simple data/fuzz");',

      'define("data/complex-plugin",{load:function(name,req,onload,config){req(name,function(value,pMod){pMod.addDependancy(req.module);onload(value)},onload.error)},pluginBuilder:"./complex-plugin-builder"});',
      'define("data/simple",["require","exports","module"],function(require,exports,module){return"simple"});',
      'define("data/complex-plugin!data/simple",["data/simple"],function(client){return client});',

      'define("data/dep2",["require","exports","module"],(require,exports,module)=>true);',
      'define("data/subdir/dep1",["require","exports","module","data/dep2"],function(require,exports,module){var dep2=require("../dep2");module.onUnload(function(){dep1.testUnload=true});var count=0;return dep1;function dep1(){var name="data/dep2";return dep2===require(name)&&++count===1}});',
      '(function(){define("data/compile-top",["require","exports","data/subdir/dep1","data/simple-plugin!data/fuzz","data/complex-plugin!data/simple"],function(require,exports,dep1,fuzz){var util=require("data/dep2")})})();',
    ]);

    assert.equal(ast.body.length, 8);
  });

  it("can compile unusual defines", ()=>{
    let ast;
    compiler.compile({name: "data/funny-define", contextConfig, callback(r) {ast = r.ast}});
    assert.equal(ast.TYPE, "Toplevel");
    let code = gcode(ast);
    assertAst(ast, [
      `(function(global,factory){typeof exports==="object"&&typeof module!=="undefined"`,
      `?factory(exports):typeof define==="function"&&define.amd?`,
      `define("data/funny-define",["exports"],factory):`,
      `factory(global.d3=global.d3||{})})`,
      `(this,function(exports){exports.foo=123;`,
      `function define(){}const define=()=>{};`,
      `let a,b,c;define(a,b,c)});`
    ]);
  });

  it("can detech require dependencies", ()=>{
    let ast;
    compiler.compile({
      contextConfig,
      name: "data/compile-deps",
      onBuildRead(mod, contents) {
        if (mod.id === 'data/compile-deps-1') {
          return contents.toString().replace(/foo/g, 'fooBar');
        }
        return contents;
      },
      callback(r) {ast = r.ast}
    });
    assert.equal(ast.TYPE, "Toplevel");
    assert.equal(ast.body.length, 4);
    assertAst(ast, [
      'define("data/norm-plugin",["require","exports","module"],function(require,exports,module){return{normalize:function(name,parent){return"norm/"+name.split("/")[0]},load:function(name,req,onLoad){onLoad("hello "+name)},write:function(pluginName,name,write){write("define("+JSON.stringify(pluginName+"!"+name)+","+JSON.stringify("norm "+name)+");\\n")}}});',
      'define("data/norm-plugin!norm/one","norm norm/one");',

      'define("data/compile-deps-1",["require","exports","module"],function(require,exports,module){return{define:function(fooBar){return"defined: "+fooBar}}});',
      'define("data/compile-deps",["require","exports","module","data/norm-plugin!norm/one","data/compile-deps-1"],function(require,exports,module){var name="./other";require(name);require(["./fuzz"]);require("./foo",function(){});name.require("./baz");require("./norm-plugin!one/load");require("./norm-plugin!one/more/load");return require("./compile-deps-1").define("x")});',
    ]);
  });

  it("can compile es6", () => {
    let ast;
    compiler.compile({
      name: "data/compile-es6",
      contextConfig,
      toplevel: compiler.terser.parse("window.isClient = true;", {}),
      callback(r) {ast = r.ast}
    });
    assertAst(ast, [
      'window.isClient=true;',
      'define("data/dep2",["require","exports","module"],(require,exports,module)=>true);',
      'define("data/compile-es6",["require","data/dep2"],require=>{return require("data/dep2")});',
    ]);
  });

  it("can build hierarchy", () => {
    const groups = [];
    compiler.compile({
      toplevel: compiler.terser.parse("window.isClient = true;", {}),
      hierarchy: ["data/dep2", "data/subdir/dep1", "data/dep3"],
      contextConfig, callback({ast, name}) {
        groups.push(ast);
      }
    });
    assertAst(groups[0], [
      `window.isClient=true;`,
      `define("data/dep2",["require","exports","module"],(require,exports,module)=>true);`
    ]);
    assertAst(groups[1], [
      `define("data/subdir/dep1",["require","exports","module","data/dep2"],function(require,exports,module){var dep2=require("../dep2");module.onUnload(function(){dep1.testUnload=true});var count=0;return dep1;function dep1(){var name="data/dep2";return dep2===require(name)&&++count===1}});`
    ]);
    assertAst(groups[2], [
      `define("data/dep3",["require","exports","module","data/dep2"],function(require,exports,module){const dep2=require("./dep2");return true});`
    ]);
    assert.equal(groups.length, 3);
  });

  const assertAst = (ast, expecteds)=>{
    let code = gcode(ast);
    for(let i = 0; i < expecteds.length; ++i) {
      const expected = expecteds[i];
      const actual = code.slice(0, expected.length);
      if (actual !== expected) {
        throw new assert.AssertionError({
          message: `line ${i+1} does not match`,
          operator: 'assertAst',
          actual, expected,
        });
      }
      code = code.slice(expected.length);
    }
    assert.equal(code, '');
  };

  const gcode = (node)=> {
    const ans = compiler.terser.minify(node, {
      compress: false,
      mangle: false,
      output: {
        beautify: false,
        ast: false,
        code: true,
      }
    });
    if (ans.error) throw ans.error;
    return ans.code;
  };
});
