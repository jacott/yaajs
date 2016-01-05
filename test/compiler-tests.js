var expect = require('expect.js');
var path = require('path');

var compiler = require('../lib/compiler');

var config = {
  baseUrl: path.resolve(__dirname),
  name: "data/compile-top"
};

describe("Compiling modules", function () {
  it("can combine modules", function (done) {
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
});
