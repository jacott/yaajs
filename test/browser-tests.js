(()=>{
  const {yaajs, mocha, expect} = window;
  let run = false;

  yaajs.config().onError = (error, mod)=>{
    describe('test Loading', ()=>{
      it('failed', ()=>{
        expect().fail("test loading failed: " + error + ": " +  mod.id);
      });
    });
    run || mocha.run();
    throw error;
  };

  mocha.setup('bdd');

  define((require, exports, module)=>{
    const testSuite = require('test-suite');

    testSuite(expect);
    run = true;
    mocha.run();
  });
})();
