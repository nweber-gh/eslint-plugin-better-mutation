import test from 'ava';
import avaRuleTester from 'eslint-ava-rule-tester';
import rule from '../rules/no-mutation';

const ruleTester = avaRuleTester(test, {
  env: {
    es6: true,
  },
  parserOptions: {
    sourceType: 'module',
  },
});

const getReassignmentError = (assignee, messageId = 'reassignmentError') => ({
  messageId,
  data: {assignee},
});
const getError = (messageId) => ({
  messageId,
});
const incrementError = getError('incrementError');
const decrementError = getError('decrementError');

ruleTester.run('no-mutation', rule, {
  valid: [
    'var a = 2;',
    'let a = 2;',
    'const a = 2;',
    'function foo(a={}) {}',
    'let a = 1; a = 2;',
    'let a, b; b = 2;',
    'let a = ""; if (false) { a += "b"; }',
    'var b = { x: 1 }; b.x += 1;',
    'for(var i = 0; i < 3; i+=1) {}',
    'function foo() {const a = {}; if (true) {a.b = "c"}}',
    'function foo(bar) { let a = bar; return a; }',
    'function foo(bar) { let a = bar; if (true) {a = {}}}',
    'function foo(bar) { let a = bar; while (true) { if (true) { a = {} } } }',
    'const a = []; a[0] = 2;',
    'const o = {}; o["name"] = 2;',
    // 'let a = 2; function() { a += 2; }',
    '_.reduce((acc, x) => { acc[2] = 1; return acc; }, [], [1,2,3])',
    '[1,2,3].reduce((acc, x) => { acc += x; return acc; }, 0)',
    'let array = [1,2,3]; array.reduce((acc, x) => { acc[2] = 1 });',
    // 'let b = c(); b = 1;', // fix isValidInit by looking at called function's return value
    `
    function foo() {
      let a = 2;
      [1, 2].forEach(function(x) {
        a = a + x;
      });
      return a;
    }
    `,
    `
    function foo() {
      let a = 2;
      [1, 2].forEach(x => {
        a = a + x;
      });
      return a;
    }
    `,
    `
    function doFoo() {
      let a = 0;
      for (let i = 0; i < 5; i = i + 1) {
        a += i;
      }
      return a;
    }
    `,
    `
    function doFoo() {
      let a = 0;
      for (let y = 0; y < 5; y++) {
        a += y;
      }
      return a;
    }
    `,
    `
    function doFoo() {
      let a = 0;
      for (let x = 0; x < 5; x += 1) {
        a += x;
      }
      return a;
    }
    `,
    `
    function doBaz() {
      const foo = { a: 1 };
    
      let { a } = foo;
      a = 4;
    
      return a;
    }
    `,
    `
    function doBaz() {
      const foo = { c: { foo: 1 } };
  
      let { c } = foo;
      c.foo = 2;
  
      return c;
    }
    `,
    // TODO - add typescript support to test this
    // `
    // export type Foo = {
    //   a: number;
    // };

    // export type Bar = {
    //   a: number;
    //   b: number;
    // };

    // function isBar(x: unknown): x is Bar {
    //   return !!x;
    // }

    // export function doStuff(o: Foo): Foo {
    //   let x = {
    //     ...o,
    //   };

    //   if (isBar(x)) {
    //     (x as Bar).b = 2;
    //   }

    //   return x;
    // }
    // `,
    {
      code: 'exports = {};',
      options: [{commonjs: true}],
    },
    {
      code: 'exports.foo = {};',
      options: [{commonjs: true}],
    },
    {
      code: 'exports.foo.bar = {};',
      options: [{commonjs: true}],
    },
    {
      code: 'module.exports = {};',
      options: [{commonjs: true}],
    },
    {
      code: 'module.exports.foo = {};',
      options: [{commonjs: true}],
    },
    {
      code: 'module.exports.foo.bar = {};',
      options: [{commonjs: true}],
    },
    {
      code: 'foo.bar = {};',
      options: [{exceptions: [{object: 'foo', property: 'bar'}]}],
    },
    {
      code: 'foo.bar = {};',
      options: [{exceptions: [{object: 'foo'}]}],
    },
    {
      code: 'baz.propTypes = {};',
      options: [{exceptions: [{property: 'propTypes'}]}],
    },
    {
      code: 'module.exports = {};',
      options: [{exceptions: [{object: 'module', property: 'exports'}]}],
    },
    {
      code: 'module.exports[foo].bar = {};',
      options: [{exceptions: [{object: 'module', property: 'exports'}]}],
    },
    {
      code: 'module.exports.foo = {};',
      options: [
        {
          exceptions: [
            {object: 'foo', property: 'bar'},
            {object: 'module', property: 'exports'},
          ],
        },
      ],
    },
    {
      code: 'foo.bar = {};',
      options: [
        {
          exceptions: [
            {object: 'foo', property: 'bar'},
            {object: 'module', property: 'exports'},
          ],
        },
      ],
    },
    {
      code: 'this.foo = 100;',
      options: [{allowThis: true}],
    },
    {
      code: 'this.foo.bar = 100;',
      options: [{allowThis: true}],
    },
    {
      code: 'function bar() { this.foo = 100; }',
      options: [{allowThis: true}],
    },
    {
      code: 'class Clazz {}; Clazz.staticFoo = 3',
      options: [{functionProps: true}],
    },
    {
      code: 'export default class Clazz {}; Clazz.staticFoo = 3',
      options: [{functionProps: true}],
    },
    {
      code: 'export class Clazz {}; Clazz.staticFoo = 3',
      options: [{functionProps: true}],
    },
    {
      code: 'function foo() {}; foo.metadata = {}',
      options: [{functionProps: true}],
    },
    {
      code: 'function Clazz() { }; Clazz.prototype.foo = function() {}',
      options: [{prototypes: true}],
    },
  ],
  invalid: [
    {
      code: `
        function doFoo(i) {
          let a = 0;
          for (i; i < 5; i = i + 1) {
            a += i;
          }
          return a;
        }
      `,
      errors: [getReassignmentError('i')],
    },
    {
      code: `
        function doFoo(y) {
          let a = 0;
          for (y; y < 5; y++) {
            a += y;
          }
          return a;
        }
      `,
      errors: [incrementError],
    },
    {
      code: `
        function doFoo(x) {
          let a = 0;
          for (x; x < 5; x += 1) {
            a += x;
          }
          return a;
        }
      `,
      errors: [getReassignmentError('x')],
    },
    {
      code: `
        function doMutation(a) {
          [1, 2].forEach(function(x) {
            a = a + x;
          });
          return a;
        }
        function foo() {
          let a = 2;
          doMutation(a);
        }
      `,
      errors: [getReassignmentError('a')],
    },
    {
      code: `
        function doMutation(a) {
          [1, 2].forEach(x => {
            a = a + x;
          });
          return a;
        }
        function foo() {
          let a = 2;
          doMutation(a);
        }
      `,
      errors: [getReassignmentError('a')],
    },
    {
      code: 'class Clazz {}; Clazz.staticFoo = 3',
      errors: [getReassignmentError('Clazz.staticFoo')],
    },
    {
      code: 'function foo() {}; foo.metadata = {}',
      errors: [getReassignmentError('foo.metadata')],
    },
    {
      code: 'function Clazz() { }; Clazz.prototype.foo = function() {}',
      errors: [getReassignmentError('Clazz.prototype.foo', 'prototypesError')],
    },
    {
      code: 'a = 2;',
      errors: [getReassignmentError('a')],
    },
    {
      code: 'a += 2;',
      errors: [getReassignmentError('a')],
    },
    {
      code: 'a -= 2;',
      errors: [getReassignmentError('a')],
    },
    {
      code: 'a *= 2;',
      errors: [getReassignmentError('a')],
    },
    {
      code: 'a /= 2;',
      errors: [getReassignmentError('a')],
    },
    {
      code: 'a %= 2;',
      errors: [getReassignmentError('a')],
    },
    {
      code: 'a++;',
      errors: [incrementError],
    },
    {
      code: '++a;',
      errors: [incrementError],
    },
    {
      code: 'a--;',
      errors: [decrementError],
    },
    {
      code: '--a;',
      errors: [decrementError],
    },
    {
      code: 'function foo(a) { a = a || {}; }',
      errors: [getReassignmentError('a')],
    },
    {
      code: 'module.foo = {};',
      errors: [getReassignmentError('module.foo')],
    },
    {
      code: 'foo.exports = {};',
      errors: [getReassignmentError('foo.exports')],
    },
    {
      code: 'exports = {};',
      errors: [getReassignmentError('exports', 'commonJsError')],
    },
    {
      code: 'exports.foo = {};',
      errors: [getReassignmentError('exports.foo', 'commonJsError')],
    },
    {
      code: 'exports.foo.bar = {};',
      errors: [getReassignmentError('exports.foo.bar', 'commonJsError')],
    },
    {
      code: 'exports[foo] = {};',
      errors: [getReassignmentError('exports[foo]', 'commonJsError')],
    },
    {
      code: 'exports.foo[bar] = {};',
      errors: [getReassignmentError('exports.foo[bar]', 'commonJsError')],
    },
    {
      code: 'exports[foo].bar = {};',
      errors: [getReassignmentError('exports[foo].bar', 'commonJsError')],
    },
    {
      code: 'module.exports = {};',
      errors: [getReassignmentError('module.exports', 'commonJsError')],
    },
    {
      code: 'module.exports.foo = {};',
      errors: [getReassignmentError('module.exports.foo', 'commonJsError')],
    },
    {
      code: 'module.exports[foo] = {};',
      errors: [getReassignmentError('module.exports[foo]', 'commonJsError')],
    },
    {
      code: 'module.exports.foo[bar] = {};',
      errors: [
        getReassignmentError('module.exports.foo[bar]', 'commonJsError'),
      ],
    },
    {
      code: 'module.exports[foo].bar = {};',
      errors: [
        getReassignmentError('module.exports[foo].bar', 'commonJsError'),
      ],
    },
    {
      code: 'foo.bar = {};',
      options: [{exceptions: [{object: 'foo', property: 'boo'}]}],
      errors: [getReassignmentError('foo.bar')],
    },
    {
      code: 'baz.propTypes = {};',
      options: [{exceptions: [{object: 'foo'}]}],
      errors: [getReassignmentError('baz.propTypes')],
    },
    {
      code: 'baz.propTypes = {};',
      options: [{exceptions: [{property: 'props'}]}],
      errors: [getReassignmentError('baz.propTypes')],
    },
    {
      code: 'baz.propTypes = {};',
      options: [{exceptions: [{}]}],
      errors: [getReassignmentError('baz.propTypes')],
    },
    {
      code: 'this.foo = 100;',
      errors: [getReassignmentError('this.foo')],
    },
    {
      code: 'this.foo.bar = 100;',
      errors: [getReassignmentError('this.foo.bar')],
    },
    {
      code: 'function bar() { this.foo = 100; }',
      errors: [getReassignmentError('this.foo')],
    },
    {
      code: 'let a = 1; function bar() { a = 2; }',
      errors: [getReassignmentError('a')],
    },
    {
      code: 'a[0] = 2;',
      errors: [getReassignmentError('a[0]')],
    },
    {
      code: 'o["name"] = 2;',
      errors: [getReassignmentError('o["name"]')],
    },
    {
      code: '_.reduce((acc, x) => { acc[2] = 1; return acc; }, [], [1,2,3])',
      options: [{reducers: []}],
      errors: [getReassignmentError('acc[2]')],
    },
  ],
});
