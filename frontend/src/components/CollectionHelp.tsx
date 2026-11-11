import { useEffect, useRef } from "react";
import { Info } from "lucide-react";

export function CollectionHelp({ description }: { description: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const mouseOpened = useRef(false);
  useEffect(() => {
    const help = ref.current!;
    const outside = (event: PointerEvent) => {
      if (!help.contains(event.target as Node)) help.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !help.open) return;
      help.open = false;
      if (help.contains(document.activeElement))
        help.querySelector("summary")!.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details
      ref={ref}
      className="collection-help"
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && mouseOpened.current)
          event.currentTarget.open = false;
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          event.currentTarget.open = false;
      }}
    >
      <summary
        aria-label="О коллекции и переключении"
        title="О коллекции и переключении"
        onPointerDown={(event) => {
          mouseOpened.current = event.pointerType === "mouse";
        }}
        onKeyDown={() => {
          mouseOpened.current = false;
        }}
      >
        <Info size={16} aria-hidden="true" />
      </summary>
      <p>
        <strong className="model-help-title">
          Учебная модель · OpenJDK 21
        </strong>
        {description}{" "}
        <span id="collection-switch-hint">
          Смена коллекции заменяет её содержимое и очищает историю операций.
        </span>
      </p>
    </details>
  );
}
