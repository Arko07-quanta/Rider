import { useState, useCallback } from "react";

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

  const searchOSM = useCallback(async (text: string) => {
    if (!text || text.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}`);
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
    searchOSM(val);
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
    <div className="location-search" style={{ position: "relative", marginBottom: "1rem" }}>
      <input
        value={query}
        onChange={handleInput}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "12px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          boxSizing: "border-box",
          fontSize: "16px"
        }}
      />
      {isOpen && results.length > 0 && (
        <ul style={{ 
          position: "absolute", 
          zIndex: 1000, 
          background: "white", 
          listStyleType: "none", 
          padding: 0, 
          margin: 0, 
          width: "100%",
          maxHeight: "250px",
          overflowY: "auto",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          borderRadius: "0 0 4px 4px",
          border: "1px solid #ddd",
          borderTop: "none"
        }}>
          {results.map((item) => (
            <li 
              key={item.place_id} 
              onClick={() => handleSelect(item)}
              style={{ 
                padding: "12px", 
                cursor: "pointer", 
                borderBottom: "1px solid #f0f0f0",
                fontSize: "14px"
              }}
            >
              {item.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
