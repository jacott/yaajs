const expect = require('expect.js');
const path = require('path');
const generate = require('babel-generator').default;

const compiler = require('../lib/compiler');

const config = {
  baseUrl: path.resolve(__dirname),
};

describe("Compiling modules", function () {
  it("can combine modules", done => {
    config.name =  "data/compile-top";

    compiler.compile(config, function ({ast, code}) {
      expect(ast.type).to.be("Program");
      expect(ast.body.length).to.be(8);
      expect(Object.keys(code).sort()).to.eql([
        '/data/compile-top.js',
        '/data/complex-plugin!data/simple.js',
        '/data/complex-plugin.js',
        '/data/dep2.js',
        '/data/simple-plugin!data/fuzz.js',
        '/data/simple-plugin.js',
        '/data/simple.js',
        '/data/subdir/dep1.js',
      ]);
      expect(gcode(ast.body[0], code)).to
        .be('define("data/dep2",["require","exports","module"],function(require,exports,module){return true});');

      expect(gcode(ast.body[1], code)).to
        .be('define("data/subdir/dep1",["require","exports","module","data/dep2"],function(require,exports,module){var dep2=require("../dep2");module.onUnload(function(){dep1.testUnload=true});var count=0;return dep1;function dep1(){var name="data/dep2";return dep2===require(name)&&++count===1};});');
      expect(gcode(ast.body[2], code)).to
        .be('(function(){define("data/compile-top",["require","exports","data/subdir/dep1","data/simple-plugin!data/fuzz","data/complex-plugin!data/simple"],function(require,exports,dep1,fuzz){var util=require("data/dep2")})})();');
      expect(gcode(ast.body[3], code)).to
        .be('define("data/simple",["require","exports","module"],function(require,exports,module){return"simple"});');
      expect(gcode(ast.body[4], code)).to
        .be('define("data/complex-plugin!data/simple",["data/simple"],function(client){return client});');
      expect(gcode(ast.body[5], code)).to
        .be('define("data/complex-plugin",{load:function(name,req,onload,config){req(name,function(value,pMod){pMod.addDependancy(req.module);onload(value)},onload.error)},pluginBuilder:"./complex-plugin-builder"});');
      expect(gcode(ast.body[6], code)).to
        .be('define("data/simple-plugin!data/fuzz","simple data/fuzz");');
      expect(gcode(ast.body[7], code)).to
        .be('define("data/simple-plugin",["require","exports","module"],function(require,exports,module){return{load:function(name,req,onLoad){onLoad(req.module.state===module.constructor.PREPARING?"simple "+name:"not preparing")},write:function(pluginName,name,write){write("define("+JSON.stringify(pluginName+"!"+name)+","+JSON.stringify("simple "+name)+");\\n")}}});');

      done();
    });
  });

  it("can detech require dependencies", done => {
    var myConfig = {
      baseUrl: config.baseUrl,
      name: "data/compile-deps",
      onBuildRead: function (mod, contents) {
        if (mod.id === 'data/compile-deps-1') {
          return contents.toString().replace(/foo/g, 'fooBar');
        }
        return contents;
      }
    };
    compiler.compile(myConfig, function ({ast, code}) {
      expect(ast.type).to.be("Program");
      expect(ast.body.length).to.be(4);
      expect(gcode(ast.body[0], code)).to
        .be('define("data/compile-deps-1",["require","exports","module"],function(require,exports,module){return{define:function(fooBar){return"defined: "+fooBar}}});');

      expect(gcode(ast.body[1], code)).to
        .be('define("data/compile-deps",["require","exports","module","data/norm-plugin!norm/one","data/compile-deps-1"],function(require,exports,module){var name="./other";require(name);require(["./fuzz"]);require("./foo",function(){});name.require("./baz");require("./norm-plugin!one/load");require("./norm-plugin!one/more/load");return require("./compile-deps-1").define("x")});');

      expect(gcode(ast.body[2], code)).to
        .be('define("data/norm-plugin!norm/one","norm norm/one");');

      expect(gcode(ast.body[3], code)).to
        .be('define("data/norm-plugin",["require","exports","module"],function(require,exports,module){return{normalize:function(name,parent){return"norm/"+name.split("/")[0]},load:function(name,req,onLoad){onLoad("hello "+name)},write:function(pluginName,name,write){write("define("+JSON.stringify(pluginName+"!"+name)+","+JSON.stringify("norm "+name)+");\\n")}}});');

      done();
    });
  });

  it("can compile es6", done => {
    config.name = "data/compile-es6";
    compiler.compile(config, function ({ast, code}) {
      expect(ast.type).to.be("Program");
      expect(ast.body.length).to.be(1);
      expect(gcode(ast.body[0], code)).to.be('define("data/compile-es6",["require"],require=>require("data/dep2"));');
      done();
    });
  });

  function gcode(node, code) {
    return generate({type: 'Program', body: [node]}, {minified: true, comments: false}, node && code[node.loc.filename]).code;
  }

});
