import { Text, type TextProps } from '@kawaikara/kawai-ui';

/** Describes the highlighted text props contract. */
export interface HighlightedTextProps extends Omit<TextProps, 'children'> {
  /** The full visible value. */
  readonly value: string;
  /** The search query value. */
  readonly query: string;
  /** The locale used for case-insensitive matching. */
  readonly locale: string;
}

/** Renders plain text with every matching search segment highlighted. */
export function HighlightedText({
  value,
  query,
  locale,
  ...props
}: HighlightedTextProps) {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  if (!normalizedQuery) return <Text {...props}>{value}</Text>;

  const normalizedValue = value.toLocaleLowerCase(locale);
  const segments: Array<{ value: string; highlighted: boolean
  }> = [];
  let cursor = 0;
  while (cursor < value.length) {
    const matchIndex = normalizedValue.indexOf(normalizedQuery, cursor);
    if (matchIndex < 0) {
      segments.push({ value: value.slice(cursor), highlighted: false
      });
      break;
    }
    if (matchIndex > cursor) {
      segments.push({
        value: value.slice(cursor, matchIndex),
        highlighted: false,
      });
    }
    const matchEnd = matchIndex + normalizedQuery.length;
    segments.push({
      value: value.slice(matchIndex, matchEnd),
      highlighted: true,
    });
    cursor = matchEnd;
  }

  return (
    <Text {...props}>
      {segments.map((segment, index) => segment.highlighted ? (
        <mark className="log-viewer-search-highlight" key={index}>
          {segment.value}
        </mark>
      ) : segment.value)}
    </Text>
  );
}
