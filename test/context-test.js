/*global yaajs*/
define(function(require, exports, module) {
  var Context = module.ctx.constructor;

  return function (expect) {
    describe(module.id, function () {
      var ctx;
      beforeEach(function () {ctx = new Context({context: "my ctx"})});
      afterEach(function () {Context.remove("my ctx")});
      it("should call _onConfig after changing settings", function () {
        var orig = Context._onConfig;
        var called, baseUrl;
        after(function () {Context._onConfig = orig});
        Context._onConfig = function (ctx) {
          baseUrl =  ctx.baseUrl;
          called = true;
        };
        ctx.config({baseUrl: "foo"});
        expect(called).to.be(true);
        expect(baseUrl).to.be("foo/");
      });

      it("should set paths", function () {
        ctx.config({
          paths: {
            foobar: "data/subdir",
            "multi/part/id": "here",
            multi: "there",
          },
        });

        expect(ctx.paths).to.eql({
          "foobar": {
            "/location": "data/subdir"
          },
          "multi": {
            "/location": "there",
            "part": {
              "id": {
                "/location": "here"
              }
            }
          }
        });
      });
    });
  };
});
