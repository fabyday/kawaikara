const { readFileSync, readdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourceRoots = [
  'src',
  'packages/site-api/src',
  'packages/builtin-sites/src',
  'stories',
];
const shouldWrite = process.argv.includes('--write');

const sourceFiles = sourceRoots.flatMap(listSourceFiles).sort();

const undocumented = [];
let documented = 0;
let declarations = 0;

for (const relativePath of sourceFiles) {
  const absolutePath = path.join(root, relativePath);
  const sourceText = readFileSync(absolutePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const insertions = [];

  visit(sourceFile, (node) => {
    if (!isDocumentableDeclaration(node)) return;
    declarations += 1;
    if (ts.getJSDocCommentsAndTags(node).length > 0) return;
    const position = node.getStart(sourceFile);
    const location = sourceFile.getLineAndCharacterOfPosition(position);
    const entry = {
      file: relativePath,
      line: location.line + 1,
      kind: declarationKind(node),
      name: declarationName(node, sourceFile),
    };
    undocumented.push(entry);
    if (!shouldWrite) return;
    insertions.push({
      position,
      text: createDocumentationInsertion(
        sourceText,
        position,
        createDocumentation(node, sourceFile),
      ),
    });
  });

  const documentationInsertionCount = insertions.length;
  if (shouldWrite) {
    collectContainerFormatting(sourceFile, sourceText, insertions);
  }

  if (insertions.length === 0) continue;
  let output = sourceText;
  for (const insertion of insertions.sort((left, right) =>
    right.position - left.position)) {
    output = output.slice(0, insertion.position) +
      insertion.text +
      output.slice(insertion.end ?? insertion.position);
  }
  writeFileSync(absolutePath, output.replace(/[ \t]+$/gm, ''));
  documented += documentationInsertionCount;
}

if (shouldWrite) {
  console.log(`Added TSDoc comments to ${documented} declarations.`);
  process.exit(0);
}

if (undocumented.length > 0) {
  for (const entry of undocumented) {
    console.error(
      `${entry.file}:${entry.line} - ${entry.kind} ${entry.name} has no TSDoc comment.`,
    );
  }
  console.error(`Found ${undocumented.length} undocumented declarations.`);
  process.exit(1);
}

console.log(
  `Source documentation check passed for ${declarations} declarations ` +
  `across ${sourceFiles.length} files.`,
);

function listSourceFiles(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(relativePath);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [relativePath] : [];
  });
}

function visit(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => visit(child, visitor));
}

function isDocumentableDeclaration(node) {
  if (
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isEnumMember(node)
  ) {
    return true;
  }
  if (
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  ) {
    return !ts.isObjectLiteralExpression(node.parent) || hasDocumentableValueOwner(node);
  }
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
    return hasDocumentableValueOwner(node);
  }
  if (ts.isParameter(node) && ts.isConstructorDeclaration(node.parent)) {
    return Boolean(node.modifiers?.some((modifier) =>
      modifier.kind === ts.SyntaxKind.PublicKeyword ||
      modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
      modifier.kind === ts.SyntaxKind.PrivateKeyword ||
      modifier.kind === ts.SyntaxKind.ReadonlyKeyword));
  }
  if (
    ts.isMethodSignature(node) ||
    ts.isPropertySignature(node) ||
    ts.isCallSignatureDeclaration(node) ||
    ts.isConstructSignatureDeclaration(node) ||
    ts.isIndexSignatureDeclaration(node)
  ) {
    return hasDocumentableTypeOwner(node);
  }
  if (!ts.isVariableStatement(node)) return false;
  return ts.isSourceFile(node.parent) ||
    ts.isModuleBlock(node.parent) ||
    node.declarationList.declarations.some((declaration) =>
      declaration.initializer &&
      (ts.isArrowFunction(declaration.initializer) ||
        ts.isFunctionExpression(declaration.initializer)));
}

function hasDocumentableValueOwner(node) {
  let current = node.parent;
  while (current) {
    if (ts.isVariableDeclaration(current)) {
      const statement = current.parent?.parent;
      return Boolean(
        statement && ts.isVariableStatement(statement) &&
        (ts.isSourceFile(statement.parent) || ts.isModuleBlock(statement.parent)),
      );
    }
    if (ts.isPropertyDeclaration(current)) return true;
    if (ts.isReturnStatement(current)) {
      let owner = current.parent;
      while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
      return Boolean(owner && isDocumentableDeclaration(owner));
    }
    if (
      ts.isObjectLiteralExpression(current) ||
      ts.isArrayLiteralExpression(current) ||
      ts.isPropertyAssignment(current) ||
      ts.isCallExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isConditionalExpression(current)
    ) {
      current = current.parent;
      continue;
    }
    return false;
  }
  return false;
}

function hasDocumentableTypeOwner(node) {
  let current = node.parent;
  while (current) {
    if (
      ts.isInterfaceDeclaration(current) ||
      ts.isTypeAliasDeclaration(current) ||
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isMethodSignature(current) ||
      ts.isPropertyDeclaration(current) ||
      ts.isPropertySignature(current)
    ) {
      return true;
    }
    if (ts.isVariableDeclaration(current)) {
      const statement = current.parent?.parent;
      return Boolean(
        statement && ts.isVariableStatement(statement) &&
        (ts.isSourceFile(statement.parent) || ts.isModuleBlock(statement.parent)),
      );
    }
    if (
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isSourceFile(current)
    ) {
      return false;
    }
    current = current.parent;
  }
  return false;
}

function createDocumentationInsertion(sourceText, position, documentation) {
  const lineStart = sourceText.lastIndexOf('\n', position - 1) + 1;
  const prefix = sourceText.slice(lineStart, position);
  const lineIndentation = prefix.match(/^\s*/)?.[0] ?? '';
  if (prefix.trim() === '') {
    return `${documentation}\n${lineIndentation}`;
  }
  const memberIndentation = `${lineIndentation}  `;
  return `\n${memberIndentation}${documentation}\n${memberIndentation}`;
}

function collectContainerFormatting(sourceFile, sourceText, insertions) {
  const scheduled = new Set();
  visit(sourceFile, (node) => {
    if (ts.isTypeLiteralNode(node)) {
      scheduleClosingDelimiter(node, node.members, node.getEnd() - 1, ';');
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      scheduleClosingDelimiter(node, node.properties, node.getEnd() - 1, ',');
      return;
    }
    if (!ts.isFunctionLike(node) || node.parameters.length === 0) return;
    const lastParameter = node.parameters[node.parameters.length - 1];
    if (ts.getJSDocCommentsAndTags(lastParameter).length === 0) return;
    const closePosition = sourceText.indexOf(')', lastParameter.getEnd());
    if (closePosition < 0) return;
    scheduleClosingDelimiter(node, [lastParameter], closePosition, ',');
  });

  function scheduleClosingDelimiter(node, members, closePosition, punctuation) {
    if (members.length === 0) return;
    if (!members.some((member) =>
      ts.getJSDocCommentsAndTags(member).length > 0)) return;
    const lastMember = members[members.length - 1];
    const separator = sourceText.slice(lastMember.getEnd(), closePosition);
    const memberText = sourceText
      .slice(lastMember.getStart(sourceFile), lastMember.getEnd())
      .trimEnd();
    const hasPunctuation =
      memberText.endsWith(punctuation) || separator.includes(punctuation);
    if (isSameLine(lastMember.getEnd(), closePosition)) {
      scheduleNewLine(node, closePosition, hasPunctuation ? '' : punctuation);
      return;
    }
    if (!hasPunctuation) {
      insertions.push({
        position: lastMember.getEnd(),
        text: punctuation,
      });
    }
  }

  function scheduleNewLine(node, position, prefix = '') {
    let whitespaceStart = position;
    while (whitespaceStart > 0 && /[ \t]/.test(sourceText[whitespaceStart - 1])) {
      whitespaceStart -= 1;
    }
    const key = `${whitespaceStart}:${position}`;
    if (scheduled.has(key)) return;
    scheduled.add(key);
    const nodeLineStart = sourceText.lastIndexOf('\n', node.getStart(sourceFile) - 1) + 1;
    const indentation = sourceText
      .slice(nodeLineStart, node.getStart(sourceFile))
      .match(/^\s*/)?.[0] ?? '';
    insertions.push({
      position: whitespaceStart,
      end: position,
      text: `${prefix}\n${indentation}`,
    });
  }

  function isSameLine(left, right) {
    return !sourceText.slice(left, right).includes('\n');
  }
}

function declarationKind(node) {
  if (ts.isClassDeclaration(node)) return 'class';
  if (ts.isInterfaceDeclaration(node)) return 'interface';
  if (ts.isTypeAliasDeclaration(node)) return 'type';
  if (ts.isEnumDeclaration(node)) return 'enum';
  if (ts.isModuleDeclaration(node)) return 'namespace';
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isVariableStatement(node)) return 'variable';
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) return 'method';
  if (
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node) ||
    ts.isParameter(node)
  ) return 'property';
  if (ts.isGetAccessorDeclaration(node)) return 'getter';
  if (ts.isSetAccessorDeclaration(node)) return 'setter';
  if (ts.isCallSignatureDeclaration(node)) return 'call signature';
  if (ts.isConstructSignatureDeclaration(node)) return 'construct signature';
  if (ts.isIndexSignatureDeclaration(node)) return 'index signature';
  if (ts.isEnumMember(node)) return 'enum member';
  return 'declaration';
}

function declarationName(node, sourceFile) {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .map((declaration) => declaration.name.getText(sourceFile))
      .join(', ');
  }
  if (ts.isConstructorDeclaration(node)) {
    return namedParent(node, sourceFile) ?? 'constructor';
  }
  if (ts.isCallSignatureDeclaration(node)) return 'call';
  if (ts.isConstructSignatureDeclaration(node)) return 'new';
  if (ts.isIndexSignatureDeclaration(node)) return node.getText(sourceFile).split(':', 1)[0];
  if ('name' in node && node.name) return node.name.getText(sourceFile);
  return 'default';
}

function createDocumentation(node, sourceFile) {
  const name = declarationName(node, sourceFile);
  const words = splitIdentifier(name);
  let summary;

  if (ts.isClassDeclaration(node)) {
    summary = classSummary(words);
  } else if (ts.isInterfaceDeclaration(node)) {
    summary = `Describes the ${words} contract.`;
  } else if (ts.isTypeAliasDeclaration(node)) {
    summary = `Defines the ${words} type.`;
  } else if (ts.isEnumDeclaration(node)) {
    summary = `Lists the supported ${words} values.`;
  } else if (ts.isModuleDeclaration(node)) {
    summary = `Groups the ${words} declarations.`;
  } else if (ts.isVariableStatement(node)) {
    summary = variableSummary(node, name, words);
  } else if (ts.isConstructorDeclaration(node)) {
    summary = `Creates an instance of ${namedParent(node, sourceFile) ?? 'this class'}.`;
  } else if (
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node) ||
    ts.isParameter(node)
  ) {
    summary = propertySummary(name, words, 'type' in node ? node.type : undefined);
  } else if (ts.isGetAccessorDeclaration(node)) {
    summary = `Returns the ${words}.`;
  } else if (ts.isSetAccessorDeclaration(node)) {
    summary = `Sets the ${words}.`;
  } else if (ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node)) {
    summary = callableSummary(name, words);
  } else if (ts.isCallSignatureDeclaration(node)) {
    summary = 'Invokes this callable value.';
  } else if (ts.isConstructSignatureDeclaration(node)) {
    summary = 'Creates a value that satisfies this construct signature.';
  } else if (ts.isIndexSignatureDeclaration(node)) {
    summary = 'Maps each supported key to its corresponding value.';
  } else if (ts.isEnumMember(node)) {
    summary = `Selects the ${words} option.`;
  } else {
    summary = `Documents the ${words} declaration.`;
  }

  return `/** ${summary} */`;
}

function classSummary(words) {
  if (/ manager$/.test(words)) {
    return `Coordinates ${words.replace(/ manager$/, '')} behavior.`;
  }
  if (/ provider$/.test(words)) {
    return `Implements the ${words.replace(/ provider$/, '')} site provider.`;
  }
  if (/ error$/.test(words)) {
    return `Reports a ${words.replace(/ error$/, '')} failure.`;
  }
  return `Represents the ${words}.`;
}

function variableSummary(node, name, words) {
  const declarations = node.declarationList.declarations;
  if (declarations.length === 1) {
    const initializer = declarations[0].initializer;
    if (/^[A-Z][A-Za-z0-9]*$/.test(name) && initializer &&
      (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return `Renders the ${words} component.`;
    }
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return callableSummary(name, words);
    }
  }
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
    return `Defines the shared ${words} constant.`;
  }
  return `Stores the ${words} value.`;
}

function propertySummary(name, words, type) {
  if (/^(?:is|has|can|should|enable|enabled|allow|allowed|active|visible|ready|available)/i.test(name) ||
    type?.kind === ts.SyntaxKind.BooleanKeyword) {
    return `Whether the ${words.replace(/^(?:is|has|can|should)\s+/, '')} option is enabled.`;
  }
  if (type && (ts.isFunctionTypeNode(type) || ts.isConstructorTypeNode(type))) {
    return `Callback used to handle ${words}.`;
  }
  return `The ${words} value.`;
}

function callableSummary(name, words) {
  const rules = [
    ['create', 'Creates'], ['build', 'Builds'], ['get', 'Returns'],
    ['read', 'Reads'], ['resolve', 'Resolves'], ['find', 'Finds'],
    ['list', 'Lists'], ['load', 'Loads'], ['save', 'Saves'],
    ['set', 'Sets'], ['update', 'Updates'], ['apply', 'Applies'],
    ['clear', 'Clears'], ['remove', 'Removes'], ['delete', 'Deletes'],
    ['open', 'Opens'], ['close', 'Closes'], ['register', 'Registers'],
    ['subscribe', 'Subscribes to'], ['handle', 'Handles'], ['on', 'Handles'],
    ['start', 'Starts'], ['stop', 'Stops'], ['initialize', 'Initializes'],
    ['dispose', 'Releases'], ['assert', 'Asserts'], ['validate', 'Validates'],
    ['normalize', 'Normalizes'], ['serialize', 'Serializes'], ['parse', 'Parses'],
    ['format', 'Formats'], ['schedule', 'Schedules'], ['send', 'Sends'],
    ['execute', 'Executes'], ['inject', 'Injects'], ['restore', 'Restores'],
    ['ensure', 'Ensures'], ['collect', 'Collects'], ['compute', 'Computes'],
    ['convert', 'Converts'], ['map', 'Maps'], ['render', 'Renders'],
    ['toggle', 'Toggles'], ['reset', 'Resets'], ['attach', 'Attaches'],
    ['detach', 'Detaches'], ['install', 'Installs'], ['uninstall', 'Uninstalls'],
    ['request', 'Requests'], ['publish', 'Publishes'], ['notify', 'Notifies'],
    ['wait', 'Waits for'], ['watch', 'Watches'], ['select', 'Selects'],
    ['move', 'Moves'], ['copy', 'Copies'], ['merge', 'Merges'],
    ['replace', 'Replaces'], ['prepare', 'Prepares'], ['run', 'Runs'],
  ];
  const normalizedName = name.replace(/^['"`]|['"`]$/g, '');
  for (const [prefix, verb] of rules) {
    if (normalizedName.toLowerCase() === prefix) return `${verb} the operation.`;
    if (!normalizedName.toLowerCase().startsWith(prefix)) continue;
    const boundary = normalizedName[prefix.length];
    if (boundary && boundary === boundary.toLowerCase() && !/[0-9_:-]/.test(boundary)) {
      continue;
    }
    const remainder = splitIdentifier(normalizedName.slice(prefix.length));
    return `${verb} the ${remainder || words}.`;
  }
  for (const prefix of ['is', 'has', 'can', 'should']) {
    if (normalizedName.toLowerCase().startsWith(prefix)) {
      const remainder = splitIdentifier(normalizedName.slice(prefix.length));
      if (remainder) return `Determines whether the ${remainder} condition applies.`;
    }
  }
  return `Performs the ${words} operation.`;
}

function namedParent(node, sourceFile) {
  let current = node.parent;
  while (current) {
    if ((ts.isClassDeclaration(current) || ts.isClassExpression(current)) && current.name) {
      return current.name.getText(sourceFile);
    }
    current = current.parent;
  }
  return undefined;
}

function splitIdentifier(value) {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeWord)
    .join(' ');
  return words || 'unnamed declaration';
}

function normalizeWord(word) {
  const vocabulary = {
    api: 'API', css: 'CSS', dom: 'DOM', drm: 'DRM', gpu: 'GPU',
    html: 'HTML', http: 'HTTP', https: 'HTTPS', id: 'ID', ids: 'IDs',
    ipc: 'IPC', json: 'JSON', mpv: 'MPV', oauth: 'OAuth', os: 'OS',
    pip: 'PiP', rpc: 'RPC', ua: 'UA', ui: 'UI', url: 'URL', urls: 'URLs',
    uuid: 'UUID', zip: 'ZIP', chzzk: 'CHZZK', electron: 'Electron',
    kawaikara: 'Kawaikara', macos: 'macOS', netflix: 'Netflix',
    watcha: 'WATCHA', youtube: 'YouTube', webkit: 'WebKit', windows: 'Windows',
  };
  return vocabulary[word.toLowerCase()] ?? word.toLowerCase();
}
