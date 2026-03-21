export interface Section {
  title: string;
  content: string;
  start: number;
  end: number;
}

/**
 * Detect logical sections in prompt text.
 * Supports markdown headers, XML tags, and labeled blocks.
 */
export function detectSections(text: string): Section[] {
  if (!text.trim()) {
    return [{ title: '', content: text, start: 0, end: text.length }];
  }

  const sections: Section[] = [];

  // Try markdown headers first
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const headers: Array<{ title: string; index: number; fullMatch: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = headerRegex.exec(text)) !== null) {
    headers.push({
      title: match[2].trim(),
      index: match.index,
      fullMatch: match[0],
    });
  }

  if (headers.length > 0) {
    // Content before the first header (if any)
    if (headers[0].index > 0) {
      const preamble = text.slice(0, headers[0].index).trim();
      if (preamble) {
        sections.push({
          title: '',
          content: preamble,
          start: 0,
          end: headers[0].index,
        });
      }
    }

    for (let i = 0; i < headers.length; i++) {
      const contentStart = headers[i].index + headers[i].fullMatch.length;
      const contentEnd = i + 1 < headers.length ? headers[i + 1].index : text.length;
      const content = text.slice(contentStart, contentEnd).trim();

      sections.push({
        title: headers[i].title,
        content,
        start: headers[i].index,
        end: contentEnd,
      });
    }

    return sections;
  }

  // Try XML-style tags
  const xmlRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  const xmlSections: Section[] = [];
  while ((match = xmlRegex.exec(text)) !== null) {
    xmlSections.push({
      title: match[1],
      content: match[2].trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  if (xmlSections.length > 0) {
    return xmlSections;
  }

  // Try labeled blocks (e.g., "Instructions:" followed by content)
  const labelRegex = /^([A-Z][A-Za-z\s]+):\s*$/gm;
  const labels: Array<{ title: string; index: number; endOfLine: number }> = [];
  while ((match = labelRegex.exec(text)) !== null) {
    labels.push({
      title: match[1].trim(),
      index: match.index,
      endOfLine: match.index + match[0].length,
    });
  }

  if (labels.length > 0) {
    if (labels[0].index > 0) {
      const preamble = text.slice(0, labels[0].index).trim();
      if (preamble) {
        sections.push({
          title: '',
          content: preamble,
          start: 0,
          end: labels[0].index,
        });
      }
    }

    for (let i = 0; i < labels.length; i++) {
      const contentStart = labels[i].endOfLine;
      const contentEnd = i + 1 < labels.length ? labels[i + 1].index : text.length;
      const content = text.slice(contentStart, contentEnd).trim();

      sections.push({
        title: labels[i].title,
        content,
        start: labels[i].index,
        end: contentEnd,
      });
    }

    return sections;
  }

  // No sections detected: return the whole text as a single section
  return [{ title: '', content: text, start: 0, end: text.length }];
}
