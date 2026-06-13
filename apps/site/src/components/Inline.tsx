import { Fragment } from "react";
import { parseInline } from "../lib/markdown";

export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((s, i) => {
        if (s.href) {
          return (
            <a key={i} href={s.href} rel="noreferrer" target="_blank">
              {s.text}
            </a>
          );
        }
        return s.bold ? <strong key={i}>{s.text}</strong> : <Fragment key={i}>{s.text}</Fragment>;
      })}
    </>
  );
}
