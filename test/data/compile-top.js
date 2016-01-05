/*global define */

(
  function () {

    define(["require", "exports", "./subdir/dep1", "./simple-plugin!./fuzz", "./complex-plugin!data/simple"], function(require, exports, dep1, fuzz) {
      var util = require('data/dep2');


    });
  }
)();
