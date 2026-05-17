/** Parse JSON from model text (handles ```json fences). */
export function parseModelJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenced) {
    text = fenced[1]!.trim();
  } else {
    const inline = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (inline) text = inline[1]!.trim();
  }
  return JSON.parse(text) as unknown;
}
