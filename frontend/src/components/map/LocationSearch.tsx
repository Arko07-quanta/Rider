import { useState, useCallback, useRef } from "react";
import "./LocationSearch.css";

export interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface LocationSearchProps {
  placeholder: string;
  onSelect: (location: LocationData) => void;
}

export default function LocationSearch({ placeholder, onSelect }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{place_id: string, display_name: string, lat: string, lon: string}[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchOSM = useCallback(async (text: string) => {
    if (!text || text.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}`, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await res.json();
      setResults(data);
      setIsOpen(true);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    // Cancel any previously scheduled search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Only fire the API call 350ms after user stops typing
    debounceRef.current = setTimeout(() => searchOSM(val), 350);
  };

  const handleSelect = (item: any) => {
    setQuery(item.display_name);
    setIsOpen(false);
    onSelect({
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    });
  };

  return (
    <div className="location-search-container">
      <input
        value={query}
        onChange={handleInput}
        placeholder={placeholder}
        className="location-search-input"
      />
      {isOpen && results.length > 0 && (
        <ul className="location-search-results">
          {results.map((item) => (
            <li 
              key={item.place_id} 
              onClick={() => handleSelect(item)}
              className="location-search-item"
            >
              {item.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
