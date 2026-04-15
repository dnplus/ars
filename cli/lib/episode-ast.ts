import fs from 'fs';

type Range = {
  start: number;
  end: number;
};

type PropertyMatch = {
  keyStart: number;
  colonIndex: number;
  valueStart: number;
  valueEnd: number;
};

function getLineIndent(source: string, index: number): string {
  const lineStart = source.lastIndexOf('\n', index) + 1;
  return source.slice(lineStart, index).match(/^\s*/)?.[0] ?? '';
}

function renderLiteral(value: string | number | boolean | null): string {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }

  if (value === null) {
    return 'null';
  }

  return String(value);
}

function skipTrivia(source: string, index: number, limit: number): number {
  let cursor = index;
  while (cursor < limit) {
    const char = source[cursor];
    const next = source[cursor + 1];

    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      cursor += 2;
      while (cursor < limit && source[cursor] !== '\n') cursor += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      cursor += 2;
      while (cursor < limit && !(source[cursor] === '*' && source[cursor + 1] === '/')) cursor += 1;
      cursor += 2;
      continue;
    }

    break;
  }

  return cursor;
}

function readQuotedString(source: string, index: number, quote: string, limit: number): number {
  let cursor = index + 1;
  while (cursor < limit) {
    const char = source[cursor];
    if (char === '\\') {
      cursor += 2;
      continue;
    }

    if (quote === '`' && char === '$' && source[cursor + 1] === '{') {
      cursor = findMatching(source, cursor + 1, '{', '}', limit) + 1;
      continue;
    }

    if (char === quote) {
      return cursor + 1;
    }

    cursor += 1;
  }

  return limit;
}

function findMatching(source: string, start: number, openChar: string, closeChar: string, limit = source.length): number {
  let depth = 0;
  let cursor = start;

  while (cursor < limit) {
    const char = source[cursor];
    const next = source[cursor + 1];

    if (char === '"' || char === '\'' || char === '`') {
      cursor = readQuotedString(source, cursor, char, limit);
      continue;
    }

    if (char === '/' && next === '/') {
      cursor += 2;
      while (cursor < limit && source[cursor] !== '\n') cursor += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      cursor += 2;
      while (cursor < limit && !(source[cursor] === '*' && source[cursor + 1] === '/')) cursor += 1;
      cursor += 2;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }

    cursor += 1;
  }

  return -1;
}

function findStepsArrayRange(source: string): Range | null {
  const stepsMatch = /steps\s*:\s*\[/.exec(source);
  if (!stepsMatch) {
    return null;
  }

  const openIndex = source.indexOf('[', stepsMatch.index);
  if (openIndex === -1) {
    return null;
  }

  const closeIndex = findMatching(source, openIndex, '[', ']');
  if (closeIndex === -1) {
    return null;
  }

  return { start: openIndex, end: closeIndex };
}

function findStepObjectRange(source: string, stepId: string): Range | null {
  const stepsRange = findStepsArrayRange(source);
  if (!stepsRange) {
    return null;
  }

  let cursor = stepsRange.start + 1;

  while (cursor < stepsRange.end) {
    cursor = skipTrivia(source, cursor, stepsRange.end);
    if (cursor >= stepsRange.end) {
      break;
    }

    if (source[cursor] === '{') {
      const objectEnd = findMatching(source, cursor, '{', '}', stepsRange.end + 1);
      if (objectEnd === -1) {
        return null;
      }

      const objectText = source.slice(cursor, objectEnd + 1);
      const idProperty = findTopLevelProperty(objectText, 'id');
      const idValue = idProperty
        ? objectText.slice(idProperty.valueStart, idProperty.valueEnd).trim()
        : null;
      const normalizedId = idValue?.match(/^['"](.+)['"]$/)?.[1] ?? null;

      if (normalizedId === stepId) {
        return { start: cursor, end: objectEnd + 1 };
      }

      cursor = objectEnd + 1;
      continue;
    }

    cursor += 1;
  }

  return null;
}

function readPropertyName(source: string, index: number, limit: number): { name: string; nextIndex: number } | null {
  const start = skipTrivia(source, index, limit);
  const char = source[start];

  if (char === '\'' || char === '"') {
    let cursor = start + 1;
    let value = '';
    while (cursor < limit) {
      const current = source[cursor];
      if (current === '\\') {
        value += source.slice(cursor, cursor + 2);
        cursor += 2;
        continue;
      }

      if (current === char) {
        return { name: value, nextIndex: cursor + 1 };
      }

      value += current;
      cursor += 1;
    }

    return null;
  }

  const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(start));
  if (!identifier) {
    return null;
  }

  return {
    name: identifier[0],
    nextIndex: start + identifier[0].length,
  };
}

function findTopLevelProperty(objectText: string, field: string): PropertyMatch | null {
  let cursor = 1;
  const limit = objectText.length - 1;

  while (cursor < limit) {
    cursor = skipTrivia(objectText, cursor, limit);
    if (cursor >= limit) {
      break;
    }

    if (objectText[cursor] === ',') {
      cursor += 1;
      continue;
    }

    const keyInfo = readPropertyName(objectText, cursor, limit);
    if (!keyInfo) {
      cursor += 1;
      continue;
    }

    const colonIndex = skipTrivia(objectText, keyInfo.nextIndex, limit);
    if (objectText[colonIndex] !== ':') {
      cursor = keyInfo.nextIndex;
      continue;
    }

    let valueStart = skipTrivia(objectText, colonIndex + 1, limit);
    let scan = valueStart;
    let curlyDepth = 0;
    let squareDepth = 0;
    let parenDepth = 0;

    while (scan < limit) {
      const char = objectText[scan];
      const next = objectText[scan + 1];

      if (char === '"' || char === '\'' || char === '`') {
        scan = readQuotedString(objectText, scan, char, limit);
        continue;
      }

      if (char === '/' && next === '/') {
        scan += 2;
        while (scan < limit && objectText[scan] !== '\n') scan += 1;
        continue;
      }

      if (char === '/' && next === '*') {
        scan += 2;
        while (scan < limit && !(objectText[scan] === '*' && objectText[scan + 1] === '/')) scan += 1;
        scan += 2;
        continue;
      }

      if (char === '{') {
        curlyDepth += 1;
      } else if (char === '}') {
        if (curlyDepth === 0 && squareDepth === 0 && parenDepth === 0) {
          break;
        }
        curlyDepth -= 1;
      } else if (char === '[') {
        squareDepth += 1;
      } else if (char === ']') {
        squareDepth -= 1;
      } else if (char === '(') {
        parenDepth += 1;
      } else if (char === ')') {
        parenDepth -= 1;
      } else if (char === ',' && curlyDepth === 0 && squareDepth === 0 && parenDepth === 0) {
        break;
      }

      scan += 1;
    }

    if (keyInfo.name === field) {
      let valueEnd = scan;
      while (valueEnd > valueStart && /\s/.test(objectText[valueEnd - 1])) {
        valueEnd -= 1;
      }

      return {
        keyStart: cursor,
        colonIndex,
        valueStart,
        valueEnd,
      };
    }

    cursor = scan + 1;
  }

  return null;
}

export function updateStepField(
  epFilePath: string,
  stepId: string,
  field: string,
  value: string | number | boolean | null,
): void {
  const source = fs.readFileSync(epFilePath, 'utf-8');
  const stepRange = findStepObjectRange(source, stepId);

  if (!stepRange) {
    throw new Error(`Step "${stepId}" not found in ${epFilePath}`);
  }

  const objectText = source.slice(stepRange.start, stepRange.end);
  const propertyMatch = findTopLevelProperty(objectText, field);
  const renderedValue = renderLiteral(value);

  if (propertyMatch) {
    const absoluteValueStart = stepRange.start + propertyMatch.valueStart;
    const absoluteValueEnd = stepRange.start + propertyMatch.valueEnd;
    const nextSource = `${source.slice(0, absoluteValueStart)}${renderedValue}${source.slice(absoluteValueEnd)}`;
    fs.writeFileSync(epFilePath, nextSource, 'utf-8');
    return;
  }

  const insertIndex = stepRange.end - 1;
  const closingIndent = getLineIndent(source, insertIndex);
  const propertyIndent = `${closingIndent}  `;
  const insertion = `\n${propertyIndent}${field}: ${renderedValue},\n${closingIndent}`;
  const nextSource = `${source.slice(0, insertIndex)}${insertion}${source.slice(insertIndex)}`;
  fs.writeFileSync(epFilePath, nextSource, 'utf-8');
}
