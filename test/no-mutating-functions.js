import test from 'ava';
import avaRuleTester from 'eslint-ava-rule-tester';
import rule from '../rules/no-mutating-functions';

const ruleTester = avaRuleTester(test, {
  env: {
    es6: true,
  },
  parserOptions: {
    sourceType: 'module',
  },
});

function getError(mutatingFunction) {
  return {
    message: `Unallowed use of mutating function '${mutatingFunction}'`,
  };
}

ruleTester.run('no-mutating-functions', rule, {
  valid: [
    'foo.bar(a, b);',
    'assign();',
    'foo.assign(a, b);',
    'Object.foo(a, b);',
    'Object.assign({});',
    '_.assign({});',
    'Object.assign({}, b);',
    'Object.assign({}, b, c, d, e);',
    'Object.assign({foo: 1, bar: 2}, b);',
    'Object.assign([1, 2], b);',
    'Object.assign(() => {}, a);',
    'Object.assign(function() {}, a);',
    'Object.assign(function foo() {}, a);',
    'var a = {foo: 1, bar: 2}; Object.assign(a, b);',
    'function fn() { var a = {foo: 1, bar: 2}; Object.assign(a, b); }',
    'function fn(b) { var a = {foo: 1, bar: 2}; Object.assign(a, b); }',
    'var b = {}; var a = b; Object.assign(a, b);',
    'var b = {foo: 1}; var a = b.foo; Object.assign(a, c);',
    'var a = x === 1 ? {} : { foo: 1 }; Object.assign(a, c);',
    'var b = {}; var a = x === 1 ? b : { foo: 1 }; Object.assign(a, c);',
    'var b = { x: {} }; Object.assign(b.x, {a: 1})',
    {
      code: 'function fn() {}; Object.assign(fn, b);',
      options: [{functionProps: true}],
    },
    'function fn () {const o = {}; Object.defineProperty(o, "foo")}',
    {
      code: 'function fn() {}; Object.defineProperty(fn, "foo");',
      options: [{functionProps: true}],
    },
    'let array = [1,2,3]; _.reduce((acc, x) => Object.assign(acc, { [x]: x }), {}, array);',
  ],
  invalid: [
    {
      code: 'Object.assign();',
      errors: [getError('Object.assign')],
    },
    {
      code: 'assign();',
      options: [
        {
          useLodashFunctionImports: true,
        },
      ],
      errors: [getError('assign')],
    },
    {
      code: 'Object.assign();',
      options: [
        {
          ignoredMethods: ['Object.assign'],
        },
      ],
      errors: [getError('Object.assign')],
    },
    {
      code: '_.defaults(a);',
      errors: [getError('_.defaults')],
    },
    {
      code: '_.assign(a, b);',
      errors: [getError('_.assign')],
    },
    {
      code: 'Object.assign(a);',
      errors: [getError('Object.assign')],
    },
    {
      code: 'Object.assign(a, b);',
      errors: [getError('Object.assign')],
    },
    {
      code: 'Object.assign(a, b, c, d, e);',
      errors: [getError('Object.assign')],
    },
    {
      code: 'var fn = () => {}; Object.assign(fn, b);',
      errors: [getError('Object.assign')],
    },
    {
      code: 'function fn() {}; Object.assign(fn, b);',
      errors: [getError('Object.assign')],
    },
    {
      code: 'var a; Object.assign(a, b);',
      errors: [getError('Object.assign')],
    },
    {
      code: 'function fn(b) { var a = b; Object.assign(a, c); }',
      errors: [getError('Object.assign')],
    },
    {
      code: 'function fn(b) { var a = b.foo; Object.assign(a, c); }',
      errors: [getError('Object.assign')],
    },
    {
      code: 'var a = {foo: 1, bar: 2}; function fn() { Object.assign(a, b); }',
      errors: [getError('Object.assign')],
    },
    {
      code:
        'function fn(b) { var a = x === 1 ? b : { foo: 1 }; Object.assign(a, c); }',
      errors: [getError('Object.assign')],
    },
    {
      code: 'Object.defineProperties(a)',
      errors: [getError('Object.defineProperties')],
    },
    {
      code: 'Object.defineProperty(a)',
      errors: [getError('Object.defineProperty')],
    },
    {
      code: 'Object.setPrototypeOf(a)',
      errors: [getError('Object.setPrototypeOf')],
    },
    {
      code:
        'let array = [1,2,3]; _.reduce((acc, x) => Object.assign(acc, { [x]: x }), {}, array);',
      options: [{reducers: []}],
      errors: [getError('Object.assign')],
    },
  ],
});
