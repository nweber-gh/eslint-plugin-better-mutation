'use strict';

const _ = require('lodash/fp');
const {
  isScopedVariable,
  isScopedFunction,
  isExemptedReducer,
  isScopedLetVariableAssignment,
} = require('./utils/common');

const isModuleExports = _.matches({
  type: 'MemberExpression',
  object: {
    type: 'Identifier',
    name: 'module',
  },
  property: {
    type: 'Identifier',
    name: 'exports',
  },
});

const isExports = _.matches({
  type: 'Identifier',
  name: 'exports',
});

const isPrototype = _.matches({
  type: 'MemberExpression',
  object: {
    object: {
      type: 'Identifier',
    },
    property: {
      type: 'Identifier',
      name: 'prototype',
    },
  },
});

function isModuleExportsMemberExpression(node) {
  return _.overSome([
    isExports,
    isModuleExports,
    function (node) {
      return (
        node.type === 'MemberExpression' &&
        isModuleExportsMemberExpression(node.object)
      );
    },
  ])(node);
}

const isPrototypeAssignment = (node) => {
  return (
    _.flow(_.property('left'), isPrototype)(node) &&
    isScopedFunction(node.left, node.parent)
  );
};

const isCommonJsExport = _.flow(
  _.property('left'),
  _.overSome([isExports, isModuleExports, isModuleExportsMemberExpression])
);

const ERROR_TYPES = {
  COMMON_JS: 'COMMON_JS',
  PROTOTYPE: 'PROTOTYPE',
  REGULAR: 'REGULAR',
};

function getMessageId(error) {
  switch (error) {
    case ERROR_TYPES.COMMON_JS:
      return 'commonJsError';
    case ERROR_TYPES.PROTOTYPE:
      return 'prototypesError';
    case '++':
      return 'incrementError';
    case '--':
      return 'decrementError';
    default:
      return 'reassignmentError';
  }
}

function makeException(exception) {
  if (!exception.object && !exception.property) {
    return _.stubFalse;
  }

  let query = {type: 'MemberExpression'};
  if (exception.object) {
    query = _.assign(query, {
      object: {type: 'Identifier', name: exception.object},
    });
  }

  if (exception.property) {
    query = _.assign(query, {
      property: {type: 'Identifier', name: exception.property},
    });
  }

  return _.matches(query);
}

function isExemptedIdentifier(exemptedIdentifiers, node) {
  if (node.type !== 'MemberExpression') {
    return false;
  }

  const matches = exemptedIdentifiers.some((matcher) => matcher(node));
  return (
    matches ||
    (node.object.type === 'MemberExpression' &&
      isExemptedIdentifier(exemptedIdentifiers, node.object))
  );
}

const create = function (context) {
  const options = context.options[0] || {};
  const allowFunctionProps = options.functionProps;
  const acceptCommonJs = options.commonjs;
  const acceptPrototypes = options.prototypes;
  const exemptedIdentifiers = _.map(makeException, options.exceptions);
  if (options.allowThis) {
    exemptedIdentifiers.push(
      _.matches({
        type: 'MemberExpression',
        object: {type: 'ThisExpression'},
      })
    );
  }

  const exemptedReducerCallees = _.getOr(
    ['reduce'],
    ['options', 0, 'reducers'],
    context
  );

  return {
    AssignmentExpression(node) {
      const isCommonJs = isCommonJsExport(node);
      const isPrototypeAss = isPrototypeAssignment(node);

      // Console.log('no mutation rule check');

      const commonJSCheck = isCommonJs && acceptCommonJs;
      const prototypeCheck = isPrototypeAss && acceptPrototypes;
      const exemptedIdentifierCheck = isExemptedIdentifier(
        exemptedIdentifiers,
        node.left
      );
      const scopedLetVariableAssignmentCheck = isScopedLetVariableAssignment(
        node
      );
      const scopedVariableCheck = isScopedVariable(
        node.left,
        node.parent,
        allowFunctionProps
      );
      const exemptedReducerCheck = isExemptedReducer(
        exemptedReducerCallees,
        node.parent
      );

      // Console.log('commonJSCheck:', commonJSCheck);
      // console.log('prototypeCheck:', prototypeCheck);
      // console.log('exemptedIdentifierCheck:', exemptedIdentifierCheck);
      // console.log('scopedLetVariableAssignmentCheck:', scopedLetVariableAssignmentCheck);
      // console.log('scopedVariableCheck:', scopedVariableCheck);
      // console.log('exemptedReducerCheck:', exemptedReducerCheck);
      // console.log(node);

      if (
        commonJSCheck ||
        prototypeCheck ||
        exemptedIdentifierCheck ||
        scopedLetVariableAssignmentCheck ||
        scopedVariableCheck ||
        exemptedReducerCheck
      ) {
        // Console.log('allowed!')
        // console.log('---------------------------------------------------------------------------------');
        return;
      }

      let errorType = ERROR_TYPES.REGULAR;
      if (isCommonJs) {
        errorType = ERROR_TYPES.COMMON_JS;
      } else if (isPrototypeAss) {
        errorType = ERROR_TYPES.PROTOTYPE;
      }

      // Console.log('failed!')
      // console.log('---------------------------------------------------------------------------------');

      context.report({
        node,
        messageId: getMessageId(errorType),
        data: {
          assignee: context.getSourceCode().getText(node.left),
        },
      });
    },
    UpdateExpression(node) {
      if (
        isScopedLetVariableAssignment(node.argument) ||
        isScopedVariable(
          node.argument,
          node.argument.parent,
          allowFunctionProps
        )
      ) {
        return;
      }

      context.report({
        node,
        messageId: getMessageId(node.operator),
      });
    },
  };
};

const schema = [
  {
    type: 'object',
    properties: {
      commonjs: {
        type: 'boolean',
      },
      allowThis: {
        type: 'boolean',
      },
      prototypes: {
        type: 'boolean',
      },
      functionProps: {
        type: 'boolean',
      },
      exceptions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            object: {
              type: 'string',
            },
            property: {
              type: 'string',
            },
          },
        },
      },
      reducers: {
        type: 'array',
        items: {type: 'string'},
        default: ['reduce'],
      },
    },
  },
];

module.exports = {
  create,
  meta: {
    schema,
    messages: {
      reassignmentError: 'Unallowed reassignment to `{{assignee}}`',
      incrementError: 'Unallowed use of `++` operator',
      decrementError: 'Unallowed use of `--` operator',
      commonJsError:
        'Unallowed reassignment to `{{assignee}}`. You may want to activate the `commonjs` option for this rule',
      prototypesError:
        'Unallowed reassignment to `{{assignee}}`. You may want to activate the `prototypes` option for this rule',
    },
    docs: {
      description: 'Forbid the use of mutating operators.',
      recommended: 'error',
    },
  },
};
