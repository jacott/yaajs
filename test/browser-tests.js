(function () {
  var mocha = window.mocha;
  var expect = window.expect;

  mocha.setup('bdd');

  var run = false;

  define(function(require, exports, module) {
    var testSuite = require('test-suite');

    module.ctx.onError = function (error, mod) {
      describe('test Loading', function () {
        it('failed', function () {
          expect().fail("test loading failed: " + error + ": " +  mod.id);
        });
      });
      run || mocha.run();
      throw error;
    };

    describe("Browser only tests", function () {
      it("should set main module", function () {
        expect(module.ctx.modules['browser-tests']).to.be(module);
      });
    });

    testSuite(expect);
    run = true;
    mocha.run();
  });
})();
