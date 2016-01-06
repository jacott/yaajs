var expect = require('expect.js');
var path = require('path');

var compiler = require('../lib/compiler');

var config = {
  baseUrl: path.resolve(__dirname),
};

describe("Compiling modules", function () {
  it("can combine modules", function (done) {
    config.name =  "data/compile-top";
    compiler.compile(config, function (codeTree) {
      expect(codeTree.code).to.match(/define\("data\/dep2",\["require","exports","module"\], function/); codeTree = codeTree.next;
      expect(codeTree.code).to.match(/define\("data\/subdir\/dep1",\["require","exports","module","data\/dep2"\], function/); codeTree = codeTree.next;
      expect(codeTree.code).to.match(/define\("data\/compile-top",\["require","exports","data\/subdir\/dep1"\,.*!data\/fuzz".*complex-plugin!data\/simple"], function/);  codeTree = codeTree.next;
      expect(codeTree.code).to.match(/define\("data\/simple"/); codeTree = codeTree.next;
      expect(codeTree.code).to.match(/define\("data\/complex-plugin!data\/simple",\["data\/simple"\], function/); codeTree = codeTree.next;
      expect(codeTree.code).to.match(/define\("data\/complex-plugin",{/); codeTree = codeTree.next;
      expect(codeTree.code).to.match(/define\("data\/simple-plugin!data\/fuzz","simple data\/fuzz"\);/); codeTree = codeTree.next;
      expect(codeTree.code).to.match(/define\("data\/simple-plugin",\["require","exports","module"\], function/); codeTree = codeTree.next;
      done();
    });
  });

  it("can detech require dependencies", function (done) {
    config.name = "data/compile-deps";
    compiler.compile(config, function (codeTree) {
      expect(codeTree.code).to.match(/define\("data\/compile-deps-1",\["require","exports","module"\], function/);
      expect((codeTree = codeTree.next).code).to.match(/define\("data\/compile-deps",\["require","exports","module","data\/norm-plugin!norm\/one","data\/compile-deps-1"\], function/);
      expect((codeTree = codeTree.next).code).to.match(/define\("data\/norm-plugin!norm\/one"/); // should only be one of these
      expect((codeTree = codeTree.next).code).to.match(/define\("data\/norm-plugin"/);
      expect((codeTree = codeTree.next).code).to.be(undefined);
      done();
    });
  });
});
