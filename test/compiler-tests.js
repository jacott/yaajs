const assert = require('assert');
const path = require('path');
const terser = require('terser');

const compiler = require('../lib/compiler');

const baseUrl = path.resolve(__dirname);

describe("Compiling modules", ()=>{
  let config;

  beforeEach(()=>{
    config = {baseUrl};
  });

  it("can combine modules", done => {
    config.name = "data/compile-top";

    compiler.compile(config, ({ast, code})=>{
      assert.equal(ast.TYPE, "Toplevel");
      assert.equal(
        gcode(ast.body[0]),
        'define("data/dep2",["require","exports","module"],(require,exports,module)=>true);');
      assert.equal(
        gcode(ast.body[1]),
        'define("data/subdir/dep1",["require","exports","module","data/dep2"],function(require,exports,module){var dep2=require("../dep2");module.onUnload(function(){dep1.testUnload=true});var count=0;return dep1;function dep1(){var name="data/dep2";return dep2===require(name)&&++count===1}});');
      assert.equal(
        gcode(ast.body[2]),
        '(function(){define("data/compile-top",["require","exports","data/subdir/dep1","data/simple-plugin!data/fuzz","data/complex-plugin!data/simple"],function(require,exports,dep1,fuzz){var util=require("data/dep2")})})();');
      assert.equal(
        gcode(ast.body[3]),
        'define("data/simple",["require","exports","module"],function(require,exports,module){return"simple"});');
      assert.equal(
        gcode(ast.body[4]),
        'define("data/complex-plugin!data/simple",["data/simple"],function(client){return client});');
      assert.equal(
        gcode(ast.body[5]),
        'define("data/complex-plugin",{load:function(name,req,onload,config){req(name,function(value,pMod){pMod.addDependancy(req.module);onload(value)},onload.error)},pluginBuilder:"./complex-plugin-builder"});');
      assert.equal(
        gcode(ast.body[6]),
        'define("data/simple-plugin!data/fuzz","simple data/fuzz");');
      assert.equal(
        gcode(ast.body[7]),
        'define("data/simple-plugin",["require","exports","module"],function(require,exports,module){return{load:function(name,req,onLoad){onLoad(req.module.state===module.constructor.PREPARING?"simple "+name:"not preparing")},write:function(pluginName,name,write){write("define("+JSON.stringify(pluginName+"!"+name)+","+JSON.stringify("simple "+name)+");\\n")}}});');

      assert.equal(ast.body.length, 8);
      assert.deepEqual(Object.keys(code).sort(), [
        '/data/compile-top.js',
        '/data/complex-plugin!data/simple.js',
        '/data/complex-plugin.js',
        '/data/dep2.js',
        '/data/simple-plugin!data/fuzz.js',
        '/data/simple-plugin.js',
        '/data/simple.js',
        '/data/subdir/dep1.js',
      ]);
      done();
    });
  });

  it("can detech require dependencies", done => {
    var myConfig = {
      baseUrl: config.baseUrl,
      name: "data/compile-deps",
      onBuildRead(mod, contents) {
        if (mod.id === 'data/compile-deps-1') {
          return contents.toString().replace(/foo/g, 'fooBar');
        }
        return contents;
      }
    };
    compiler.compile(myConfig, ({ast})=>{
      assert.equal(ast.TYPE, "Toplevel");
      assert.equal(ast.body.length, 4);
      assert.equal(
        gcode(ast.body[0]),
        'define("data/compile-deps-1",["require","exports","module"],function(require,exports,module){return{define:function(fooBar){return"defined: "+fooBar}}});');

      assert.equal(
        gcode(ast.body[1]),
        'define("data/compile-deps",["require","exports","module","data/norm-plugin!norm/one","data/compile-deps-1"],function(require,exports,module){var name="./other";require(name);require(["./fuzz"]);require("./foo",function(){});name.require("./baz");require("./norm-plugin!one/load");require("./norm-plugin!one/more/load");return require("./compile-deps-1").define("x")});');

      assert.equal(
        gcode(ast.body[2]),
        'define("data/norm-plugin!norm/one","norm norm/one");');

      assert.equal(
        gcode(ast.body[3]),
        'define("data/norm-plugin",["require","exports","module"],function(require,exports,module){return{normalize:function(name,parent){return"norm/"+name.split("/")[0]},load:function(name,req,onLoad){onLoad("hello "+name)},write:function(pluginName,name,write){write("define("+JSON.stringify(pluginName+"!"+name)+","+JSON.stringify("norm "+name)+");\\n")}}});');

      done();
    });
  });

  it("can compile es6", done => {
    config.name = "data/compile-es6";
    let called = false;

    compiler.compile(config, ({ast})=>{
      const parts = gcode(ast).split(';');
      assert.deepEqual(parts, [
        'define("data/dep2",["require","exports","module"],(require,exports,module)=>true)',
        'define("data/compile-es6",["require","data/dep2"],require=>{return require("data/dep2")})',
        ''
      ]);
      called = true;
    });
    assert.equal(called, true);
    done();
  });

  it("can build hierarchy", done => {
    config.name = undefined;
    config.hierarchy = ["data/dep2", "data/subdir/dep1", "data/dep3"];
    const groups = [];
    compiler.compile(config, ({ast, name})=>{
      groups.push(gcode(ast.body[0]));
    });
    assert.equal(groups[0], `define("data/dep2",["require","exports","module"],(require,exports,module)=>true);`);
    assert.equal(groups[1], `define("data/subdir/dep1",["require","exports","module","data/dep2"],function(require,exports,module){var dep2=require("../dep2");module.onUnload(function(){dep1.testUnload=true});var count=0;return dep1;function dep1(){var name="data/dep2";return dep2===require(name)&&++count===1}});`);
    assert.equal(groups[2], `define("data/dep3",["require","exports","module","data/dep2"],function(require,exports,module){const dep2=require("./dep2");return true});`);
    assert.equal(groups.length, 3);
    done();
  });

  const gcode = (node)=> {
    const ans = terser.minify(node, {
      compress: false,
      mangle: false,
      output: {
        beautify: false,
        indent_level: 0,
        ast: false,
        code: true,
      }
    });
    if (ans.error) throw ans.error;
    return ans.code;
  };
});
