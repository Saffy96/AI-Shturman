import { MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { searchGeoSuggestions } from "../services/fuelApi";
import type { GeoSearchResult } from "../types/fuel";

interface Props {
  value?: string;
  placeholder?: string;
  theme?: "dark" | "light";
  autoFocus?: boolean;
  onSelect: (result: GeoSearchResult) => void;
}

export function AddressAutocomplete({ value = "", placeholder = "Введите город, улицу или адрес", theme = "dark", autoFocus = false, onSelect }: Props) {
  const [text, setText] = useState(value);
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [message, setMessage] = useState<string | null>(null);
  const selectedTextRef = useRef(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setText(value);
    selectedTextRef.current = value;
  }, [value]);

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setSuggestions([]);
      setActiveIndex(-1);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, []);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2 || query === selectedTextRef.current) {
      setSuggestions([]);
      setActiveIndex(-1);
      setLoading(false);
      setMessage(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage(null);
      try {
        const response = await searchGeoSuggestions(query, controller.signal);
        setSuggestions(response.results);
        setActiveIndex(response.results.length ? 0 : -1);
        setMessage(response.results.length ? null : "Ничего не найдено. Уточните адрес.");
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setActiveIndex(-1);
          setMessage("Не удалось загрузить подсказки.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  function select(result: GeoSearchResult) {
    const nextText = result.address || result.name;
    selectedTextRef.current = nextText;
    setText(nextText);
    setSuggestions([]);
    setActiveIndex(-1);
    setMessage(null);
    onSelect(result);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="address-autocomplete" data-theme={theme}>
      <div className="address-autocomplete__field">
        <Search size={17} aria-hidden="true" />
        <input
          autoFocus={autoFocus}
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          onChange={(event) => {
            selectedTextRef.current = "";
            setText(event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />
        {loading ? <span className="address-autocomplete__loading" aria-label="Загрузка подсказок" /> : null}
      </div>
      {suggestions.length ? (
        <div id={listId} className="address-autocomplete__suggestions" role="listbox">
          {suggestions.map((item, index) => (
            <button
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              key={`${item.lat}:${item.lon}:${item.address}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(item)}
            >
              <MapPin size={16} aria-hidden="true" />
              <span><strong>{item.title || item.name}</strong><small>{item.address}</small></span>
            </button>
          ))}
        </div>
      ) : null}
      {message && text.trim().length >= 2 ? <div className="address-autocomplete__message" role="status">{message}</div> : null}
    </div>
  );
}
