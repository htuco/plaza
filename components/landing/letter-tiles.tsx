"use client";

import { useState, type CSSProperties } from "react";

const GHOST = ["A", "B", "C", "D", "E"];

/**
 * The join-code input rendered as five wooden letter tiles. The real
 * <input name="code"> lies invisibly over the tiles (so the form posts
 * exactly as before, taps open the keyboard on mobile, and paste works);
 * typed letters stamp onto the tiles, and the next empty tile glows while
 * the input is focused. Pair it with an external <label htmlFor=...>.
 */
export function CodeTileInput({ id, name = "code" }: { id: string; name?: string }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const activeIndex = focused ? Math.min(value.length, GHOST.length - 1) : -1;

  return (
    <span className="plaza-code-entry">
      <span className="plaza-code-tiles" aria-hidden="true">
        {GHOST.map((ghost, index) => {
          const char = value[index];
          return (
            <span
              key={index}
              className={`plaza-code-tile ${char ? "plaza-code-tile--filled" : ""} ${
                index === activeIndex ? "plaza-code-tile--active" : ""
              }`}
              style={{ "--tile-i": index } as CSSProperties}
            >
              {char ? (
                <span key={`${char}-${index}`} className="plaza-code-tile__char">
                  {char}
                </span>
              ) : (
                <span className="plaza-code-tile__ghost">{ghost}</span>
              )}
            </span>
          );
        })}
      </span>
      <input
        id={id}
        name={name}
        className="plaza-code-entry__input"
        value={value}
        maxLength={5}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        onChange={(event) =>
          setValue(
            event.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 5),
          )
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </span>
  );
}
