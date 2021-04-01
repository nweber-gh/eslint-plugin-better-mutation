const _ = require('lodash/fp');
const debug = require('debug')('eslint-better-mutation');

// TypeScript AST
const TS_AS_EXPRESSION = 'TSAsExpression';

const isReference = _.flow(
  _.property('type'),
  _.includes(_, ['MemberExpression', 'Identifier'])
);

const isExportDeclaration = _.flow(
  _.property('type'),
  _.includes(_, ['ExportDefaultDeclaration', 'ExportNamedDeclaration'])
);

const isObjectExpression = _.flow(
  _.property('type'),
  _.includes(_, ['ObjectExpression', 'ArrayExpression'])
);

const isLiteralExpression = _.flow(
  _.property('type'),
  _.includes(_, ['Literal'])
);

const isFunctionExpression = _.flow(
  _.property('type'),
  _.includes(_, ['FunctionExpression', 'ArrowFunctionExpression'])
);

const isConditionalExpression = _.flow(
  _.property('type'),
  _.includes(_, ['ConditionalExpression'])
);

const isClassOrFunctionDeclaration = _.flow(
  _.property('type'),
  _.includes(_, ['ClassDeclaration', 'FunctionDeclaration'])
);

const isEndOfVariableScope = _.flow(
  _.property('type'),
  _.includes(_, ['Program', 'FunctionDeclaration', 'ClassDeclaration'])
);

const isEndOfBlock = _.flow(
  _.property('type'),
  _.includes(_, ['Program', 'FunctionDeclaration', 'ClassDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])
);

function getIdentifier(node) {
  const namePath = _.get('type')(node) === TS_AS_EXPRESSION
    ? 'expression.name'
    : 'name';
  return _.get(namePath)(node);
}

function getBlockAncestor(node) {
  if (isEndOfBlock(node)) {
    return node;
  }

  return getBlockAncestor(node.parent);
}

function isFunctionDeclaration(identifier) {
  return _.overEvery([isClassOrFunctionDeclaration, _.matches({id: {name: identifier}})]);
}

function isExportedFunctionDeclaration(identifier) {
  return function (node) {
    return isExportDeclaration(node) && isFunctionDeclaration(identifier)(_.get('declaration')(node));
  };
}

function isForStatementVariable(identifier, node) {
  if (node.type === 'ForStatement') {
    return isVariableDeclaration(identifier)(node.init);
  }

  return false;
}

function getReference(node) {
  switch (node.type) {
    case 'MemberExpression':
      return node.object;
    case 'Identifier':
      return node;
    default:
      return undefined;
  }
}

function isValidInit(rhsExpression, node) {
  return isObjectExpression(rhsExpression) ||
    isLiteralExpression(rhsExpression) ||
    // TODO Fix 'let a = c(); a = 1;' by ensuring that function c() { return  {} };
    // isCallExpression(rhsExpression) /* && called Function always returns a ValidInit */ ||
    (isReference(rhsExpression) && isScopedVariable(getReference(rhsExpression), node.parent)) ||
    (isConditionalExpression(rhsExpression) && isValidInit(rhsExpression.alternate, node) && isValidInit(rhsExpression.consequent, node));
}

function getLeftMostObject(arg) {
  const object = _.get('object')(arg);
  if (!object) {
    return arg;
  }

  return getLeftMostObject(object);
}

function getDeclaration(identifier, node) {
  // console.log('foo:', identifier);
  const declarations = _.get('declarations', node) || [];
  return declarations.find(n => {
    if (_.get('id.type', n) === 'ObjectPattern') {
      const destructuredProperties = _.get('properties', _.get('id', n)) || [];
      return destructuredProperties
        .filter(p => _.get('type', p) !== 'ExperimentalRestProperty')
        .find(p => _.get('value.name', p) === identifier);
    }
    else {
      return _.get('id.name', n) === identifier;
    }
  });
}

function isVariableDeclaration(identifier) {
  return function (node = {}) { // Todo not sure about this defaulting. seems to fix weird bug
    if (_.get('type', node) !== 'VariableDeclaration') {
      return;
    }

    const declaration = getDeclaration(identifier, node);
    const validInitCheck = isValidInit(_.get('init', declaration), node);
    return !!declaration && validInitCheck;
  };
}

function isIdentifierDeclared(identifier, idNode) {
  return !_.isNil(idNode) && (
    // Regular declaration: let a = ...
    _.isMatch({name: identifier}, idNode) ||
    // Destructuring declaration: let { a } = ...
    _.some({value: {name: identifier}}, idNode.properties)
  );
}

function isLetDeclaration(identifier) {
  return function (node = {}) { // Todo not sure about this defaulting. seems to fix weird bug
    if (_.get('kind', node) !== 'let' || _.get('type', node) !== 'VariableDeclaration') {
      return;
    }

    // debug('%j', {f: 'isLetDeclaration', declaration, nodeType: node?.type, nodeKind: node?.kind, idNode: declaration?.id, idNodeProps: declaration?.id?.properties});

    const declaration = getDeclaration(identifier, node);

    // if from a destructure verify the source as well
    if (declaration && _.get('id.type', declaration) === 'ObjectPattern') {
      const validInitCheck = isValidInit(_.get('init', declaration), node);
      return !!declaration && validInitCheck;
    }

    return (
      !!declaration &&
      _.isMatch({type: 'VariableDeclarator'}, declaration) &&
      isIdentifierDeclared(identifier, _.get('id', declaration))
    );
  };
}

function isScopedVariableIdentifier(identifier, node, allowFunctionProps) {
  if (_.isNil(node)) {
    return false;
  }

  return _.some(isVariableDeclaration(identifier))(node.body) ||
    (allowFunctionProps && isScopedFunctionIdentifier(identifier, node)) ||
    isForStatementVariable(identifier, node) ||
    (!isEndOfVariableScope(node) && isScopedVariableIdentifier(identifier, node.parent));
}

function isScopedLetIdentifier(identifier, node) {
  if (_.isNil(node)) {
    return false;
  }

  // debug('%j', {f: 'isScopedLetIdentifier', identifier, nodeBody: node.body});

  return _.some(isLetDeclaration(identifier))(node.body) ||
    (!isEndOfVariableScope(node) && isScopedLetIdentifier(identifier, node.parent));
}

function isScopedLetVariableAssignment(node) {
  const identifier = getIdentifier(getLeftMostObject(node.left));
  if (!identifier) {
    return false;
  }

  // debug('%j', {f: 'isScopedLetVariableAssignment', left: node.left});

  return isScopedLetIdentifier(identifier, node.parent);
}

function isScopedVariable(arg, node, allowFunctionProps) {
  // debug('%j', {f: 'isScopedVariable', arg});

  const identifier = getIdentifier(getLeftMostObject(arg));
  if (!identifier) {
    return false;
  }

  return isScopedVariableIdentifier(identifier, node, allowFunctionProps);
}

function isScopedFunctionIdentifier(identifier, node) {
  if (_.isNil(node)) {
    return false;
  }

  return _.some(
    n => isFunctionDeclaration(identifier)(n) || isExportedFunctionDeclaration(identifier)(n)
  )(node.body) ||
    (!isEndOfBlock(node) && isScopedFunctionIdentifier(identifier, node.parent));
}

function isScopedFunction(arg, node) {
  const identifier = getIdentifier(getLeftMostObject(arg));
  return isScopedFunctionIdentifier(identifier, node);
}

function isExemptedReducer(exemptedReducerCallees, node) {
  const endOfBlockNode = getBlockAncestor(node);
  const callee = _.get('parent.callee', endOfBlockNode);
  return callee && _.includes(_.getOr(_.get('name', callee), 'property.name', callee), exemptedReducerCallees);
}

module.exports = {
  isReference,
  isObjectExpression,
  isLiteralExpression,
  isFunctionExpression,
  isConditionalExpression,
  isScopedVariable,
  isScopedLetVariableAssignment,
  isScopedFunction,
  isExemptedReducer
};
