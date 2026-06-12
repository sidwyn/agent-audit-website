import { Fragment } from "react";
import { parseInline } from "../lib/markdown";

export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((s, i) =>
        s.bold ? <strong key={i}>{s.text}</strong> : <Fragment key={i}>{s.text}</Fragment>,
      )}
    </>
  );
}
