'use strict';

const common = require('../common');

const arrayBuffer = new ArrayBuffer();
const uint8Array = new Uint8Array(arrayBuffer);
const int32Array = new Int32Array(arrayBuffer);

const args = {
  TypedArray: {
    'true': int32Array,
    'false-primitive': true,
    'false-object': arrayBuffer
  },
  Uint8Array: {
    'true': uint8Array,
    'false-primitive': true,
    'false-object': int32Array
  }
};

const bench = common.createBenchmark(main, {
  type: Object.keys(args),
  version: ['native', 'js'],
  argument: ['true', 'false-primitive', 'false-object'],
  n: [5e6]
}, {
  flags: ['--expose-internals']
});

function main(conf) {
  // For testing, if supplied with an empty type, default to ArrayBufferView.
  conf.type = conf.type || 'ArrayBufferView';

  const util = process.binding('util');
  const types = require('internal/util/types');

  const n = (+conf.n) | 0;
  const func = { native: util, js: types }[conf.version][`is${conf.type}`];
  const arg = args[conf.type][conf.argument];

  bench.start();
  for (var i = 0; i < n; i++) {
    func(arg);
  }
  bench.end(n);
}
