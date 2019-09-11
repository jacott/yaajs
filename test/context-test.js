/*global yaajs*/
define((require, exports, module)=>{
  const Context = module.ctx.constructor;

  return expect =>{
    describe(module.id, ()=>{
      let ctx;

      beforeEach(()=>{ctx = new Context({context: "my ctx"})});
      afterEach(()=>{Context.remove("my ctx")});

      it("should call _onConfig after changing settings", ()=>{
        const orig = Context._onConfig;
        let called, baseUrl;

        after(()=>{Context._onConfig = orig});

        Context._onConfig = ctx =>{
          baseUrl =  ctx.baseUrl;
          called = true;
        };
        ctx.config({baseUrl: "foo"});
        expect(called).to.be(true);
        expect(baseUrl).to.be("foo/");
      });

      it("should set paths", ()=>{
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
