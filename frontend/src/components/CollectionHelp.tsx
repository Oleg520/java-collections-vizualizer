import { useI18n } from "../i18n/LocaleProvider";
import { useEffect, useRef } from "react";
import { Info } from "lucide-react";

export function CollectionHelp({ description }: { description: string }) {
  const { t } = useI18n();
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
        aria-label={t("CollectionHelp.about_the_collection_and_switching")}
        title={t("CollectionHelp.about_the_collection_and_switching")}
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
          {t("CollectionHelp.teaching_model_openjdk_21")}
        </strong>
        {description}{" "}
        <span id="collection-switch-hint">
          {t("CollectionHelp.switching_collections_replaces_the_contents_and")}
        </span>
      </p>
    </details>
  );
}
