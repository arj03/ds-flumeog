var tape = require('tape')
var fs = require('fs')
var Log = require('../')

const filename = '/tmp/dsf-test-stream-pause.log'

try { fs.unlinkSync(filename) } catch (_) {}
var log = Log(filename, {blockSize: 64*1024})

function B (fill, length) {
  var b = Buffer.alloc(length)
  b.fill(fill)
  return b
}

function collect (cb) {
  return {
    array: [],
    paused: false,
    write: function (v) { this.array.push(v) },
    end: function (err) {
      this.ended = err || true
      cb(err, this.array)
    }
  }
}

var v1 = B(0x10, 100);
tape('populate', function (t) {
  let i = 0;
  (function next() {
    log.append(v1, function (err) {
      i++
      if (i < 1000) next()
      else {
        log.onDrain(() => {
          log.stream({offsets: false}).pipe(
            collect(function (err, ary) {
              t.equal(ary.length, 1000);
              t.end();
            }),
          );
        });
      }
    });
  })();
});

tape('pausable', function (t) {
  let sink
  let i = 0
  t.timeoutAfter(50000)
  log.stream({offsets: false}).pipe(sink = {
    paused: false,
    write: function(data) {
      if (sink.paused) t.fail('should not write sink when it is paused')
      if (data.compare(v1) !== 0) t.fail('record does not match v1')

      sink.paused = true
      setTimeout(() => {
        sink.paused = false
        sink.source.resume()
      }, 1)
    },
    end: function() {
      t.end()
    }
  })
})

tape('close', function (t) {
  t.equal(log.streams.length, 0, 'no open streams')
  log.stream({offsets: false}).pipe({
    paused: false,
    write: function () {},
    end: function() {
      t.end()
    }
  })
  log.close(() => {})
})
