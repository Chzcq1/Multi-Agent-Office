import { useState, useEffect, useRef, useCallback } from "react";

interface TypewriterOptions {
  baseDelay?: number;
  onComplete?: (wasSkipped: boolean) => void;
}

interface TypewriterResult {
  displayed: string;
  done: boolean;
  skip: () => void;
}

function getCharDelay(char: string, baseDelay: number): number {
  const jitter = Math.random() * 12;
  if (char === "\n") return 120 + jitter;
  if (char === "." || char === "!" || char === "?" || char === "。" || char === "！" || char === "？") return 190 + jitter;
  if (char === "," || char === "，" || char === ";" || char === "；" || char === ":") return 140 + jitter;
  if (char === " ") return baseDelay * 1.2 + jitter;
  return baseDelay + jitter;
}

export function useTypewriter(
  fullText: string,
  enabled: boolean,
  options: TypewriterOptions = {}
): TypewriterResult {
  const { baseDelay = 22, onComplete } = options;
  const [displayed, setDisplayed] = useState(enabled ? "" : fullText);
  const [done, setDone] = useState(!enabled);
  const skipRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep ref in sync without re-running the effect
  useEffect(() => { onCompleteRef.current = onComplete; });

  const skip = useCallback(() => {
    skipRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(fullText);
      setDone(true);
      return;
    }

    setDisplayed("");
    setDone(false);
    skipRef.current = false;
    let index = 0;

    function tick() {
      if (skipRef.current) {
        setDisplayed(fullText);
        setDone(true);
        onCompleteRef.current?.(true);
        return;
      }

      if (index >= fullText.length) {
        setDone(true);
        onCompleteRef.current?.(false);
        return;
      }

      index++;
      setDisplayed(fullText.slice(0, index));

      const char = fullText[index - 1];
      const delay = getCharDelay(char, baseDelay);
      timerRef.current = setTimeout(tick, delay);
    }

    timerRef.current = setTimeout(tick, 80);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fullText, enabled]);

  return { displayed, done, skip };
}
