/**
 * Cartographer's Desk: warm editorial planner, cool immersive map, numbered route spine,
 * and Signal Vermilion for every decisive interaction.
 */
/// <reference types="@types/google.maps" />

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapView } from "@/components/Map";
import { Streamdown } from "streamdown";
import {
  Bike,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Crosshair,
  Download,
  Footprints,
  Fuel,
  Link2,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Route as RouteIcon,
  Search,
  Sparkles,
  TrainFront,
  Trash2,
  Zap,
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const BRAND_MARK = "/manus-storage/waypoint-mark_91de7cf3_8c05158d.webp";

const parseHtmlToText = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const extractDirectionSteps = (result: google.maps.DirectionsResult): DirectionStep[] => {
  const steps: DirectionStep[] = [];
  result.routes[0]?.legs.forEach(leg => {
    leg.steps.forEach(step => {
      steps.push({
        instruction: parseHtmlToText(step.instructions),
        distance: step.distance?.value || 0,
        duration: step.duration?.value || 0,
        maneuver: step.maneuver,
      });
    });
  });
  return steps;
};

const formatDistanceShort = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDurationShort = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
const CAFE_IMAGE = "/manus-storage/place-cafe_06229247.png";
const PARK_IMAGE = "/manus-storage/place-park_f72255d5.png";

type TravelModeKey = "DRIVING" | "WALKING" | "BICYCLING" | "TRANSIT";

type Stop = {
  id: string;
  label: string;
  address: string;
  placeId?: string;
  location?: google.maps.LatLngLiteral;
  notes?: string;
  durationMinutes?: number;
};

type NearbyPlace = {
  id: string;
  name: string;
  category: string;
  address?: string;
  rating?: number;
  userRatingsTotal?: number;
  location?: google.maps.LatLngLiteral;
  photoUrl?: string;
};

type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
  legs?: Array<{ distance: { value: number }; duration: { value: number } }>;
};

type DirectionStep = {
  instruction: string;
  distance: number;
  duration: number;
  maneuver?: string;
};

type DriveStep = {
  stepIndex: number;
  legIndex: number;
  instruction: string;
  distance: string;
  duration: string;
  nextInstruction?: string;
};

const encodeUtf8Base64 = (str: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(str)));

const decodeUtf8Base64 = (str: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0)));

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const emptyStop = (): Stop => ({
  id: makeId(),
  label: "",
  address: "",
});

const INITIAL_STOPS: Stop[] = [
  {
    id: "paris-nord",
    label: "Gare du Nord",
    address: "18 Rue de Dunkerque, Paris",
    placeId: "ChIJD2LSkBtq5kcR5-wvM3b1l0Y",
    location: { lat: 48.8809, lng: 2.3553 },
  },
  {
    id: "paris-louvre",
    label: "Musée du Louvre",
    address: "Rue de Rivoli, Paris",
    placeId: "ChIJD3uTd9hx5kcR1IQvGfr8dbk",
    location: { lat: 48.8606, lng: 2.3376 },
  },
  {
    id: "paris-eiffel",
    label: "Eiffel Tower",
    address: "5 Avenue Anatole France, Paris",
    placeId: "ChIJLU7jZClu5kcR4PcOOO6p3I0",
    location: { lat: 48.8584, lng: 2.2945 },
  },
];

const TRAVEL_MODES: Array<{
  value: TravelModeKey;
  label: string;
  icon: typeof Car;
}> = [
  { value: "DRIVING", label: "Drive", icon: Car },
  { value: "WALKING", label: "Walk", icon: Footprints },
  { value: "BICYCLING", label: "Bike", icon: Bike },
  { value: "TRANSIT", label: "Transit", icon: TrainFront },
];

function splitIntoRouteChunks(stops: Stop[], maxPoints: number) {
  const chunks: Stop[][] = [];
  let start = 0;

  while (start < stops.length - 1) {
    const end = Math.min(start + maxPoints - 1, stops.length - 1);
    chunks.push(stops.slice(start, end + 1));
    start = end;
  }

  return chunks;
}

function formatDistance(meters: number) {
  if (!meters) return "—";
  const km = meters / 1000;
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: km < 10 ? 1 : 0,
  }).format(km)} km`;
}

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function cleanCategory(types?: string[]) {
  const preferred = types?.find(
    type =>
      ![
        "point_of_interest",
        "establishment",
        "premise",
        "tourist_attraction",
      ].includes(type),
  );
  return (preferred || "Place").replaceAll("_", " ");
}

function StopSearchInput({
  stop,
  googleReady,
  onChange,
  onPlaceSelected,
}: {
  stop: Stop;
  googleReady: boolean;
  onChange: (value: string) => void;
  onPlaceSelected: (next: Partial<Stop>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionCallback = useRef(onPlaceSelected);

  useEffect(() => {
    selectionCallback.current = onPlaceSelected;
  }, [onPlaceSelected]);

  useEffect(() => {
    if (!googleReady || !inputRef.current || !window.google?.maps?.places) {
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["geometry", "name", "formatted_address", "place_id"],
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location) {
        toast.error("Choose a place from the suggestions to map this stop.");
        return;
      }

      selectionCallback.current({
        label: place.name || place.formatted_address || "Selected place",
        address: place.formatted_address || place.name || "",
        placeId: place.place_id,
        location: location.toJSON(),
      });
    });

    return () => listener.remove();
  }, [googleReady, stop.id]);

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/35" />
      <Input
        ref={inputRef}
        value={stop.label}
        onChange={event => onChange(event.target.value)}
        placeholder="Search an address or place"
        aria-label="Destination"
        className="h-11 border-ink/10 bg-white/75 pl-9 pr-9 text-[14px] font-semibold shadow-none placeholder:font-normal placeholder:text-ink/35 focus-visible:border-vermilion/50 focus-visible:ring-vermilion/15"
      />
      {stop.label ? (
        <button
          type="button"
          aria-label="Clear destination"
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink/35 transition hover:bg-ink/5 hover:text-ink"
          onClick={() => onChange("")}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export default function Home() {
  const [stops, setStops] = useState<Stop[]>(INITIAL_STOPS);
  const [selectedStopId, setSelectedStopId] = useState(INITIAL_STOPS[1].id);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [travelMode, setTravelMode] = useState<TravelModeKey>("DRIVING");
  const [mapReady, setMapReady] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary>({
    distanceMeters: 0,
    durationSeconds: 0,
  });
  const [isAddingChargingStops, setIsAddingChargingStops] = useState(false);
  const [evRange, setEvRange] = useState(300);
  const [sightseeingInterest, setSightseeingInterest] = useState<string>("museums");
  const [sightseeingPlaces, setSightseeingPlaces] = useState<NearbyPlace[]>([]);

  const mapRef = useRef<google.maps.Map | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const directionsRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const calculationIdRef = useRef(0);
  const directionsResultRef = useRef<google.maps.DirectionsResult | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
    const [currentLeg, setCurrentLeg] = useState(0);
  const stopsSegmentsRef = useRef<Stop[][]>([]);

  // Split stops into 10-stop segments for Google Maps navigation
  const splitIntoLegs = useCallback((allStops: Stop[]) => {
    const segments: Stop[][] = [];
    const STOPS_PER_LEG = 10;
    
    for (let i = 0; i < allStops.length; i += STOPS_PER_LEG - 1) {
      const end = Math.min(i + STOPS_PER_LEG, allStops.length);
      segments.push(allStops.slice(i, end));
      if (end === allStops.length) break;
    }
    
    stopsSegmentsRef.current = segments;
    setCurrentLeg(0);
    return segments;
  }, []);

  // Load route from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const routeParam = params.get("route");
    if (routeParam) {
      try {
        const decoded = JSON.parse(decodeUtf8Base64(routeParam));
        if (decoded.stops && Array.isArray(decoded.stops)) {
          const loadedStops = decoded.stops.map((s: any) => ({
            id: makeId(),
            label: s.label || "",
            address: s.address || "",
            location: s.location,
            notes: s.notes,
          }));
          setStops(loadedStops);
          if (loadedStops.length > 0) setSelectedStopId(loadedStops[0].id);
          if (decoded.travelMode) setTravelMode(decoded.travelMode);
          toast.success("Route loaded from link!");
        }
      } catch (error) {
        console.error("Failed to load route from URL", error);
        toast.error("Could not load route from link.");
      }
    }
  }, []);

  const selectedStop = useMemo(
    () => stops.find(stop => stop.id === selectedStopId) || stops[0],
    [selectedStopId, stops],
  );

  const resolvedStops = useMemo(
    () => stops.filter(stop => Boolean(stop.location)),
    [stops],
  );

  const onMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    placesServiceRef.current = new google.maps.places.PlacesService(map);
    setMapReady(true);
  }, []);

  const clearMapObjects = useCallback(() => {
    directionsRenderersRef.current.forEach(renderer => renderer.setMap(null));
    directionsRenderersRef.current = [];
  }, []);

  const fitAllStops = useCallback(() => {
    const map = mapRef.current;
    const locations = stops.flatMap(stop => (stop.location ? [stop.location] : []));
    if (!map || locations.length === 0) return;
    if (locations.length === 1) {
      map.panTo(locations[0]);
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    locations.forEach(location => bounds.extend(location));
    map.fitBounds(bounds, 74);
  }, [stops]);

  const calculateRoute = useCallback(async () => {
    if (!mapRef.current || resolvedStops.length < 2) {
      clearMapObjects();
      setRouteSummary({ distanceMeters: 0, durationSeconds: 0 });
      return;
    }

    const calculationId = ++calculationIdRef.current;
    setIsCalculating(true);
    clearMapObjects();

    const maxPoints = travelMode === "TRANSIT" ? 2 : 10;
    const chunks = splitIntoRouteChunks(resolvedStops, maxPoints);
    const directionsService = new google.maps.DirectionsService();
    let totalDistance = 0;
    let totalDuration = 0;

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const origin = chunk[0].location!;
        const destination = chunk[chunk.length - 1].location!;
        const waypoints = chunk.slice(1, -1).map(stop => ({
          location: stop.location!,
          stopover: true,
        }));

        const result = await new Promise<google.maps.DirectionsResult>(
          (resolve, reject) => {
            directionsService.route(
              {
                origin,
                destination,
                waypoints,
                travelMode: google.maps.TravelMode[travelMode],
                provideRouteAlternatives: false,
              },
              (response, status) => {
                if (status === google.maps.DirectionsStatus.OK && response) {
                  resolve(response);
                } else {
                  reject(new Error(status));
                }
              },
            );
          },
        );

        if (calculationId !== calculationIdRef.current) return;

        result.routes[0]?.legs.forEach(leg => {
          totalDistance += leg.distance?.value || 0;
          totalDuration += leg.duration?.value || 0;
        });

        const renderer = new google.maps.DirectionsRenderer({
          map: mapRef.current,
          directions: result,
          preserveViewport: true,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#F05A3C",
            strokeOpacity: 0.92,
            strokeWeight: 5,
          },
        });

        directionsRenderersRef.current.push(renderer);

        if (index === chunks.length - 1) {
          directionsResultRef.current = result;
          stopsSegmentsRef.current = splitIntoLegs(stops);
          const stopDurationSeconds = stops.reduce((sum, stop) => sum + ((stop.durationMinutes || 0) * 60), 0);
          setRouteSummary({
            distanceMeters: totalDistance,
            durationSeconds: totalDuration + stopDurationSeconds,
          });
          window.setTimeout(fitAllStops, 80);
        }
      }
    } catch (error) {
      console.error("Route calculation failed", error);
      toast.error("That route could not be calculated. Try another travel mode or stop.");
    } finally {
      if (calculationId === calculationIdRef.current) setIsCalculating(false);
    }
  }, [clearMapObjects, fitAllStops, resolvedStops, travelMode]);

  useEffect(() => {
    if (!mapReady) return;
    const timer = window.setTimeout(calculateRoute, 280);
    return () => window.clearTimeout(timer);
  }, [calculateRoute, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];

    stops.forEach((stop, index) => {
      if (!stop.location) return;
      const markerNode = document.createElement("button");
      markerNode.className = `waypoint-marker ${
        stop.id === selectedStopId ? "is-selected" : ""
      }`;
      markerNode.type = "button";
      const markerLabel = document.createElement("span");
      markerLabel.textContent = String(index + 1);
      markerNode.appendChild(markerLabel);
      markerNode.setAttribute("aria-label", `Select ${stop.label || `stop ${index + 1}`}`);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: stop.location,
        title: stop.label,
        content: markerNode,
        zIndex: stop.id === selectedStopId ? 20 : 10,
      });

      marker.addListener("click", () => setSelectedStopId(stop.id));
      markersRef.current.push(marker);
    });
  }, [mapReady, selectedStopId, stops]);

  useEffect(() => {
    const service = placesServiceRef.current;
    if (!mapReady || !service || !selectedStop?.location) {
      setNearbyPlaces([]);
      return;
    }

    setNearbyLoading(true);
    service.nearbySearch(
      {
        location: selectedStop.location,
        radius: 2200,
        type: "tourist_attraction",
      },
      (results, status) => {
        setNearbyLoading(false);
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !results
        ) {
          setNearbyPlaces([]);
          return;
        }

        const nextPlaces = results
          .filter(place => place.place_id && place.geometry?.location && place.name)
          .sort((a, b) => {
            const scoreA = (a.rating || 0) * Math.log10((a.user_ratings_total || 0) + 10);
            const scoreB = (b.rating || 0) * Math.log10((b.user_ratings_total || 0) + 10);
            return scoreB - scoreA;
          })
          .slice(0, 6)
          .map((place, index): NearbyPlace => ({
            id: place.place_id!,
            name: place.name!,
            category: cleanCategory(place.types),
            address: place.vicinity,
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            location: place.geometry!.location!.toJSON(),
            photoUrl:
              place.photos?.[0]?.getUrl({ maxWidth: 640, maxHeight: 420 }) ||
              (index % 2 ? PARK_IMAGE : CAFE_IMAGE),
          }));

        setNearbyPlaces(nextPlaces);
      },
    );
  }, [mapReady, selectedStop?.id, selectedStop?.location]);

  // Calculate and add optimal EV charging stops using OpenChargeMap API
  const addOptimalChargingStops = useCallback(async () => {
    if (resolvedStops.length < 2 || routeSummary.distanceMeters === 0) {
      toast.error("Calculate a route first");
      return;
    }

    setIsAddingChargingStops(true);
    try {
      const origin = `${resolvedStops[0].location?.lat},${resolvedStops[0].location?.lng}`;
      const destination = `${resolvedStops[resolvedStops.length - 1].location?.lat},${resolvedStops[resolvedStops.length - 1].location?.lng}`;
      const via = resolvedStops.slice(1, -1).map(s => `${s.location?.lat},${s.location?.lng}`).join(';');
      
      const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${origin}&destination=${destination}${via ? `&via=${via}` : ''}&ev[chargingCapacity]=${evRange}&return=polyline,summary`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_FRONTEND_FORGE_API_KEY}` }
      });
      const data = await response.json();
      
      if (!data.routes || data.routes.length === 0) {
        toast.warning("No charging stops needed for this route");
        setIsAddingChargingStops(false);
        return;
      }

      const route = data.routes[0];
      const chargingStops: Stop[] = [];
      
      if (route.sections) {
        for (const section of route.sections) {
          if (section.chargingStations && section.chargingStations.length > 0) {
            for (const station of section.chargingStations) {
              const stop: Stop = {
                id: makeId(),
                label: `Charging Station (${station.power || 'Unknown'} kW)`,
                address: station.name || 'EV Charging Station',
                placeId: `here-charger-${makeId()}`,
                location: {
                  lat: station.position.latitude,
                  lng: station.position.longitude,
                },
              };
              chargingStops.push(stop);
            }
          }
        }
      }

      if (chargingStops.length > 0) {
        const newStops = [...stops, ...chargingStops];
        setStops(newStops);
        toast.success(`Added ${chargingStops.length} optimal charging stops via HERE API`);
      } else {
        toast.warning("No charging stops found along the route");
      }
    } catch (error) {
      console.error("HERE API error:", error);
      toast.error("Could not fetch charging stops from HERE API");
    } finally {
      setIsAddingChargingStops(false);
    }
  }, [resolvedStops, evRange, stops]);

  // Fetch sightseeing attractions by interest
  useEffect(() => {
    const service = placesServiceRef.current;
    if (!mapReady || !service || !selectedStop?.location) {
      setSightseeingPlaces([]);
      return;
    }

    const typeMap: Record<string, string> = {
      museums: "museum",
      parks: "park",
      restaurants: "restaurant",
      cafes: "cafe",
      shopping: "shopping_mall",
      landmarks: "point_of_interest",
    };

    if (sightseeingInterest === "all") {
      // Fetch multiple types and merge results
      const types = ["museum", "park", "restaurant", "cafe", "point_of_interest"];
      const allResults: NearbyPlace[] = [];
      let completed = 0;

      types.forEach((type) => {
        service.nearbySearch(
          {
            location: selectedStop.location,
            radius: 2500,
            type,
          },
          (results, status) => {
            completed++;
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              results.forEach((place) => {
                if (place.place_id && place.geometry?.location && place.name) {
                  allResults.push({
                    id: place.place_id,
                    name: place.name,
                    category: type.charAt(0).toUpperCase() + type.slice(1),
                    address: place.vicinity,
                    rating: place.rating,
                    userRatingsTotal: place.user_ratings_total,
                    location: place.geometry.location.toJSON(),
                    photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 640, maxHeight: 420 }),
                  });
                }
              });
            }

            if (completed === types.length) {
              const merged = allResults
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 5);
              setSightseeingPlaces(merged);
            }
          },
        );
      });
    } else {
      const searchType = typeMap[sightseeingInterest] || "museum";

      service.nearbySearch(
        {
          location: selectedStop.location,
          radius: 2500,
          type: searchType,
        },
        (results, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
            setSightseeingPlaces([]);
            return;
          }

          const sights = results
            .filter(place => place.place_id && place.geometry?.location && place.name)
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 5)
            .map((place): NearbyPlace => ({
              id: place.place_id!,
              name: place.name!,
              category: sightseeingInterest,
              address: place.vicinity,
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              location: place.geometry!.location!.toJSON(),
              photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 640, maxHeight: 420 }),
            }));

          setSightseeingPlaces(sights);
        },
      );
    }
  }, [mapReady, selectedStop?.id, selectedStop?.location, sightseeingInterest]);

  useEffect(() => {
    if (!selectedStop?.location || !mapRef.current) return;
    mapRef.current.panTo(selectedStop.location);
  }, [selectedStop?.id, selectedStop?.location]);

  const updateStop = useCallback((id: string, patch: Partial<Stop>) => {
    setStops(current =>
      current.map(stop => (stop.id === id ? { ...stop, ...patch } : stop)),
    );
  }, []);

  const updateStopLabel = useCallback((id: string, value: string) => {
    setStops(current =>
      current.map(stop =>
        stop.id === id
          ? {
              ...stop,
              label: value,
              address: value,
              placeId: undefined,
              location: undefined,
            }
          : stop,
      ),
    );
  }, []);

  const addStop = useCallback((afterIndex?: number) => {
    const next = emptyStop();
    setStops(current => {
      if (typeof afterIndex !== "number") return [...current, next];
      const copy = [...current];
      copy.splice(afterIndex + 1, 0, next);
      return copy;
    });
    setSelectedStopId(next.id);
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-stop-id="${next.id}"] input`)?.focus();
    }, 80);
  }, []);

  const addPlaceToRoute = useCallback(
    (place: NearbyPlace) => {
      const next: Stop = {
        id: makeId(),
        label: place.name,
        address: place.address || place.name,
        placeId: place.id,
        location: place.location,
      };
      const selectedIndex = Math.max(
        0,
        stops.findIndex(stop => stop.id === selectedStopId),
      );

      setStops(current => {
        const copy = [...current];
        copy.splice(selectedIndex + 1, 0, next);
        return copy;
      });
      setSelectedStopId(next.id);
      toast.success(`${place.name} added to the route.`);
    },
    [selectedStopId, stops],
  );

  const removeStop = useCallback(
    (id: string) => {
      setStops(current => {
        if (current.length <= 2) {
          toast.info("A route needs at least two destination fields.");
          return current;
        }
        const index = current.findIndex(stop => stop.id === id);
        const next = current.filter(stop => stop.id !== id);
        if (id === selectedStopId) {
          setSelectedStopId(next[Math.max(0, index - 1)]?.id || next[0]?.id);
        }
        return next;
      });
    },
    [selectedStopId],
  );

  const moveStop = useCallback((index: number, direction: -1 | 1) => {
    setStops(current => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }, []);

  const clearRoute = useCallback(() => {
    const next = [emptyStop(), emptyStop()];
    setStops(next);
    setSelectedStopId(next[0].id);
    setNearbyPlaces([]);
    setSightseeingPlaces([]);
    setRouteSummary({ distanceMeters: 0, durationSeconds: 0 });
    clearMapObjects();
  }, [clearMapObjects]);

  const generateShareLink = useCallback(() => {
    const routeData = {
      stops: stops.map(s => ({
        label: s.label,
        address: s.address,
        location: s.location,
        notes: s.notes,
      })),
      travelMode,
      distance: routeSummary.distanceMeters,
      duration: routeSummary.durationSeconds,
    };
    const encoded = encodeUtf8Base64(JSON.stringify(routeData));
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?route=${encoded}`;
    setShareLink(url);
    return url;
  }, [stops, travelMode, routeSummary]);

  const exportAsHTML = useCallback(() => {
    const url = generateShareLink();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waypoint Route - ${stops.map(s => s.label).join(" → ")}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f1ed; color: #1a1a1a; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
    .route-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .info-card { background: #f9f7f4; padding: 1rem; border-radius: 8px; border-left: 4px solid #d84c3c; }
    .info-card strong { display: block; font-size: 0.8rem; color: #d84c3c; text-transform: uppercase; margin-bottom: 0.5rem; }
    .info-card .value { font-size: 1.5rem; font-weight: bold; }
    .stops-list { margin: 2rem 0; }
    .stops-list h2 { font-size: 1.2rem; margin-bottom: 1rem; }
    .stop-item { display: flex; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: #f9f7f4; border-radius: 8px; }
    .stop-number { width: 32px; height: 32px; background: #d84c3c; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
    .stop-details h3 { margin-bottom: 0.25rem; font-size: 1rem; }
    .stop-details p { color: #666; font-size: 0.9rem; }
    .link-section { background: #f9f7f4; padding: 1.5rem; border-radius: 8px; margin-top: 2rem; }
    .link-section h3 { margin-bottom: 1rem; }
    .link-input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-family: monospace; font-size: 0.85rem; word-break: break-all; }
    .footer { margin-top: 2rem; text-align: center; color: #999; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧭 Waypoint Route</h1>
    <p class="subtitle">Your complete route itinerary</p>
    
    <div class="route-info">
      <div class="info-card">
        <strong>Distance</strong>
        <div class="value">${formatDistance(routeSummary.distanceMeters)}</div>
      </div>
      <div class="info-card">
        <strong>Duration</strong>
        <div class="value">${formatDuration(routeSummary.durationSeconds)}</div>
      </div>
      <div class="info-card">
        <strong>Stops</strong>
        <div class="value">${stops.length}</div>
      </div>
      <div class="info-card">
        <strong>Travel Mode</strong>
        <div class="value" style="text-transform: capitalize; font-size: 1.1rem;">${travelMode.toLowerCase()}</div>
      </div>
    </div>

    <div class="stops-list">
      <h2>Route Stops</h2>
      ${stops
        .map(
          (stop, idx) => `
        <div class="stop-item">
          <div class="stop-number">${idx === 0 ? "📍" : idx === stops.length - 1 ? "🏁" : idx}</div>
          <div class="stop-details">
            <h3>${stop.label}</h3>
            <p>${stop.address}</p>
            ${stop.location ? `<p style="font-size: 0.8rem; color: #999; margin-top: 0.25rem;">${stop.location.lat.toFixed(4)}°, ${stop.location.lng.toFixed(4)}°</p>` : ""}
            ${stop.notes ? `<div style="margin-top: 0.75rem; padding: 0.5rem; background: #f0ebe5; border-left: 3px solid #d84c3c; font-size: 0.85rem;"><strong>Notes:</strong><br>${stop.notes.replace(/\n/g, "<br>")}</div>` : ""}
          </div>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="link-section">
      <h3>Share This Route</h3>
      <p style="margin-bottom: 1rem; color: #666; font-size: 0.9rem;">Open this link in Waypoint to view the route:</p>
      <div class="link-input">${url}</div>
    </div>

    <div class="footer">
      <p>Generated by <strong>Waypoint</strong> — Unlimited Route Planner</p>
      <p style="margin-top: 0.5rem;">Created on ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `waypoint-route-${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Route exported as HTML.");
  }, [stops, travelMode, routeSummary, generateShareLink]);

  const exportAsPDF = useCallback(() => {
    const markdown = `# Waypoint Route: ${stops.map(s => s.label).join(" → ")}

**Distance:** ${(routeSummary.distanceMeters / 1000).toFixed(1)} km | **Duration:** ${Math.floor(routeSummary.durationSeconds / 60)} min

---

## Stops

${stops
  .map(
    (stop, idx) => `### ${idx === 0 ? "📍 Start" : idx === stops.length - 1 ? "🏁 Finish" : `Stop ${idx}`}: ${stop.label}

**Address:** ${stop.address}

${stop.location ? `**Coordinates:** ${stop.location.lat.toFixed(4)}°, ${stop.location.lng.toFixed(4)}°\n\n` : ""}${stop.notes ? `**Notes:**\n\n${stop.notes}\n\n` : ""}`
  )
  .join("---\n\n")}

---

*Generated by Waypoint on ${new Date().toLocaleString()}*`;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `waypoint-route-${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Route exported as Markdown.");
  }, [stops, routeSummary]);

  const copyShareLink = useCallback(() => {
    if (!shareLink) {
      const url = generateShareLink();
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Link copied to clipboard!");
      }).catch(() => {
        toast.error("Failed to copy link.");
      });
      return;
    }
    navigator.clipboard.writeText(shareLink).then(() => {
      toast.success("Link copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy link.");
    });
  }, [shareLink, generateShareLink]);

  const optimizeRoute = useCallback(async () => {
    if (travelMode === "TRANSIT") {
      toast.info("Transit routes keep the stop order you choose.");
      return;
    }
    if (resolvedStops.length < 3) {
      toast.info("Add at least three mapped stops to optimize the order.");
      return;
    }

    setIsOptimizing(true);
    const service = new google.maps.DirectionsService();
    const chunks = splitIntoRouteChunks(resolvedStops, 10);
    const reordered: Stop[] = [];

    try {
      for (const chunk of chunks) {
        const result = await new Promise<google.maps.DirectionsResult>(
          (resolve, reject) => {
            service.route(
              {
                origin: chunk[0].location!,
                destination: chunk[chunk.length - 1].location!,
                waypoints: chunk.slice(1, -1).map(stop => ({
                  location: stop.location!,
                  stopover: true,
                })),
                optimizeWaypoints: true,
                travelMode: google.maps.TravelMode[travelMode],
              },
              (response, status) => {
                if (status === google.maps.DirectionsStatus.OK && response) {
                  resolve(response);
                } else {
                  reject(new Error(status));
                }
              },
            );
          },
        );

        const order = result.routes[0]?.waypoint_order || [];
        const middle = chunk.slice(1, -1);
        const optimizedChunk = [
          chunk[0],
          ...order.map(index => middle[index]),
          chunk[chunk.length - 1],
        ];
        reordered.push(...(reordered.length ? optimizedChunk.slice(1) : optimizedChunk));
      }

      const unresolved = stops.filter(stop => !stop.location);
      setStops([...reordered, ...unresolved]);
      toast.success("Stops reordered for a more efficient route.");
    } catch (error) {
      console.error("Optimization failed", error);
      toast.error("The route could not be optimized right now.");
    } finally {
      setIsOptimizing(false);
    }
  }, [resolvedStops, stops, travelMode]);

  return (
    <main className="route-app">
      <section className="planner-panel" aria-label="Route planner">
        <header className="planner-header">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={BRAND_MARK} alt="" className="size-10 object-contain" />
              <div>
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[20px] tracking-[-0.055em] text-ink" aria-label="Waypoint">
                    <span className="font-extrabold">Way</span><span className="font-medium">point</span>
                  </h1>
                  <span className="legend-label">Route planner</span>
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-ink/50">
                  Put every stop on the same page.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExportModalOpen(true)}
                className="h-9 gap-2 rounded-md px-2.5 text-xs font-bold text-ink/55 hover:bg-white/55 hover:text-ink"
                title="Export or share this route"
              >
                <Download className="size-3.5" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearRoute}
                className="h-9 gap-2 rounded-md px-2.5 text-xs font-bold text-ink/55 hover:bg-white/55 hover:text-ink"
              >
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="relative z-[1]">
              <p className="legend-label mb-1.5">Current itinerary</p>
              <h2 className="font-editorial text-[31px] leading-none text-ink">
                Paris afternoon
              </h2>
              <p className="coordinate-label mt-2">48.8566° N · 2.3522° E · FR–75</p>
            </div>
            <div className="hidden text-right sm:block">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-vermilion">
                {stops.length} stops
              </span>
              <p className="mt-1 text-[11px] text-ink/45">No planner limit</p>
            </div>
          </div>
        </header>

        <div className="planner-scroll">
          <section className="px-5 pb-3 pt-5 sm:px-7" aria-labelledby="travel-mode-title">
            <div className="flex items-center justify-between gap-4">
              <p id="travel-mode-title" className="legend-label">
                Travel mode
              </p>
              {isCalculating ? (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-vermilion">
                  <span className="size-1.5 animate-pulse rounded-full bg-vermilion" />
                  Updating route
                </span>
              ) : null}
            </div>
            <div className="mode-switcher mt-2.5" role="group" aria-label="Travel mode">
              {TRAVEL_MODES.map(mode => {
                const Icon = mode.icon;
                const active = travelMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTravelMode(mode.value)}
                    className={active ? "is-active" : ""}
                  >
                    <Icon className="size-4" />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="manifest-section px-5 py-4 sm:px-7" aria-labelledby="destinations-title">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="legend-label">Destinations</p>
                <h3 id="destinations-title" className="mt-1 text-[17px] font-extrabold tracking-[-0.025em] text-ink">
                  Build your route
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={optimizeRoute}
                disabled={isOptimizing}
                className="stamped-action h-9 gap-2 border-vermilion/30 bg-vermilion/[0.055] px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-vermilion hover:bg-vermilion/10"
              >
                {isOptimizing ? (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-vermilion/25 border-t-vermilion" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Find a better order
              </Button>
            </div>

            <div className="route-spine mt-5">
              {stops.map((stop, index) => {
                const isSelected = selectedStopId === stop.id;
                const isFirst = index === 0;
                const isLast = index === stops.length - 1;
                return (
                  <article
                    key={stop.id}
                    data-stop-id={stop.id}
                    className={`stop-row ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setSelectedStopId(stop.id)}
                  >
                    <div className="stop-node-column" aria-hidden="true">
                      <span className={`stop-node ${isSelected ? "is-selected" : ""}`}>
                        {isFirst ? (
                          <Navigation className="size-3.5" />
                        ) : isLast ? (
                          <MapPin className="size-3.5" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      {!isLast ? <span className="stop-connector" /> : null}
                    </div>

                    <div className="min-w-0 flex-1 pb-5">
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-ink/40">
                          {isFirst ? "Start" : isLast ? "Finish" : `Stop ${index}`}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            aria-label="Move destination up"
                            disabled={isFirst}
                            className="row-action"
                            onClick={event => {
                              event.stopPropagation();
                              moveStop(index, -1);
                            }}
                          >
                            <ChevronUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move destination down"
                            disabled={isLast}
                            className="row-action"
                            onClick={event => {
                              event.stopPropagation();
                              moveStop(index, 1);
                            }}
                          >
                            <ChevronDown className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove destination"
                            className="row-action hover:!text-red-600"
                            onClick={event => {
                              event.stopPropagation();
                              removeStop(stop.id);
                            }}
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <StopSearchInput
                        stop={stop}
                        googleReady={mapReady}
                        onChange={value => updateStopLabel(stop.id, value)}
                        onPlaceSelected={patch => updateStop(stop.id, patch)}
                      />
                      {stop.address && stop.address !== stop.label ? (
                        <p className="mt-1.5 truncate pl-1 text-[11px] text-ink/40">
                          {stop.address}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          const newExpanded = new Set(expandedNotes);
                          if (newExpanded.has(stop.id)) {
                            newExpanded.delete(stop.id);
                          } else {
                            newExpanded.add(stop.id);
                          }
                          setExpandedNotes(newExpanded);
                        }}
                        className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-ink/60 hover:text-ink"
                      >
                        <ChevronDown
                          className={`size-3.5 transition-transform ${
                            expandedNotes.has(stop.id) ? "rotate-180" : ""
                          }`}
                        />
                        Notes
                      </button>
                      {expandedNotes.has(stop.id) && (
                        <div className="mt-1.5 space-y-1.5">
                          <textarea
                            placeholder="**bold** *italic* - list. Markdown OK."
                            value={stop.notes || ""}
                            onChange={(e) => updateStop(stop.id, { notes: e.target.value })}
                            className="w-full rounded-sm border border-ink/20 bg-white/50 px-2 py-1.5 text-[11px] text-ink placeholder-ink/40 focus:border-ink/40 focus:outline-none"
                            rows={2}
                          />
                          {stop.notes && (
                            <div className="rounded-sm border border-ink/10 bg-white/30 px-2 py-1.5 text-[11px] text-ink prose prose-sm max-w-none">
                              <Streamdown>{stop.notes}</Streamdown>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-[11px] font-bold text-ink/60">Duration:</label>
                        <input
                          type="number"
                          min="0"
                          max="480"
                          value={stop.durationMinutes || 0}
                          onChange={(e) => updateStop(stop.id, { durationMinutes: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                          className="w-16 rounded-sm border border-ink/20 bg-white/50 px-2 py-1 text-[11px] text-ink focus:border-ink/40 focus:outline-none"
                        />
                        <span className="text-[10px] text-ink/50">min</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <Button
              variant="outline"
              onClick={() => addStop()}
              className="stamped-action mt-1 h-11 w-full gap-2 border-dashed border-ink/20 bg-white/30 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink/60 hover:border-vermilion/40 hover:bg-vermilion/[0.05] hover:text-vermilion"
            >
              <Plus className="size-4" />
              Add another stop
            </Button>
          </section>

          <section className="places-section border-t border-ink/10 pt-4" aria-labelledby="places-title">
            <div className="mb-4 space-y-3">

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-ink/70">Sightseeing:</label>
                <select
                  value={sightseeingInterest}
                  onChange={(e) => setSightseeingInterest(e.target.value)}
                  className="rounded-sm border border-ink/20 bg-white/50 px-2 py-1 text-[11px] font-bold text-ink"
                >
                  <option value="all">All attractions</option>
                  <option value="museums">Museums</option>
                  <option value="parks">Parks</option>
                  <option value="restaurants">Restaurants</option>
                  <option value="cafes">Cafés</option>
                  <option value="shopping">Shopping</option>
                  <option value="landmarks">Landmarks</option>
                </select>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="legend-label">Around selected stop</p>
                <h3 id="places-title" className="mt-1 text-[17px] font-extrabold tracking-[-0.025em] text-ink">
                  Best {sightseeingInterest === "all" ? "attractions" : sightseeingInterest} near {selectedStop?.label || "your destination"}
                </h3>
              </div>
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-ink text-paper">
                <Sparkles className="size-3.5" />
              </span>
            </div>

            {nearbyLoading ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[0, 1].map(item => (
                  <div key={item} className="h-48 animate-pulse rounded-md bg-ink/[0.06]" />
                ))}
              </div>
            ) : sightseeingPlaces.length ? (
              <div className="places-grid mt-4">
                {sightseeingPlaces.map((place, index) => (
                  <article key={place.id} className="place-card">
                    <div className="relative h-28 overflow-hidden bg-ink/5">
                      <img
                        src={place.photoUrl || (index % 2 ? PARK_IMAGE : CAFE_IMAGE)}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                      <span className="absolute left-2 top-2 rounded-sm bg-paper/90 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink backdrop-blur">
                        {place.category}
                      </span>
                    </div>
                    <div className="p-3">
                      <h4 className="line-clamp-1 text-[13px] font-extrabold text-ink">
                        {place.name}
                      </h4>
                      <div className="mt-1 flex min-h-4 items-center gap-2 text-[10px] font-bold text-ink/45">
                        {place.rating ? (
                          <span className="flex items-center gap-1 text-ink/60">
                            <span className="text-vermilion">★</span>
                            {place.rating.toFixed(1)}
                            {place.userRatingsTotal ? (
                              <span className="font-medium">({place.userRatingsTotal.toLocaleString()})</span>
                            ) : null}
                          </span>
                        ) : (
                          <span>{place.address || "Nearby place"}</span>
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => addPlaceToRoute(place)}
                          className="h-8 flex-1 gap-1.5 rounded-sm bg-ink px-2 text-[10px] font-extrabold text-paper hover:bg-ink/85"
                        >
                          <Plus className="size-3" /> Add stop
                        </Button>
                        <button
                          type="button"
                          aria-label={`Show ${place.name} on map`}
                          className="grid size-8 place-items-center rounded-sm border border-ink/10 bg-white/50 text-ink/55 transition hover:border-vermilion/30 hover:text-vermilion"
                          onClick={() => {
                            if (place.location && mapRef.current) {
                              mapRef.current.panTo(place.location);
                              mapRef.current.setZoom(16);
                            }
                          }}
                        >
                          <LocateFixed className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : nearbyPlaces.length ? (
              <div className="places-grid mt-4">
                {nearbyPlaces.map((place, index) => (
                  <article key={place.id} className="place-card">
                    <div className="relative h-28 overflow-hidden bg-ink/5">
                      <img
                        src={place.photoUrl || (index % 2 ? PARK_IMAGE : CAFE_IMAGE)}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                      <span className="absolute left-2 top-2 rounded-sm bg-paper/90 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink backdrop-blur">
                        {place.category}
                      </span>
                    </div>
                    <div className="p-3">
                      <h4 className="line-clamp-1 text-[13px] font-extrabold text-ink">
                        {place.name}
                      </h4>
                      <div className="mt-1 flex min-h-4 items-center gap-2 text-[10px] font-bold text-ink/45">
                        {place.rating ? (
                          <span className="flex items-center gap-1 text-ink/60">
                            <span className="text-vermilion">★</span>
                            {place.rating.toFixed(1)}
                            {place.userRatingsTotal ? (
                              <span className="font-medium">({place.userRatingsTotal.toLocaleString()})</span>
                            ) : null}
                          </span>
                        ) : (
                          <span>{place.address || "Nearby place"}</span>
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => addPlaceToRoute(place)}
                          className="h-8 flex-1 gap-1.5 rounded-sm bg-ink px-2 text-[10px] font-extrabold text-paper hover:bg-ink/85"
                        >
                          <Plus className="size-3" /> Add stop
                        </Button>
                        <button
                          type="button"
                          aria-label={`Show ${place.name} on map`}
                          className="grid size-8 place-items-center rounded-sm border border-ink/10 bg-white/50 text-ink/55 transition hover:border-vermilion/30 hover:text-vermilion"
                          onClick={() => {
                            if (place.location && mapRef.current) {
                              mapRef.current.panTo(place.location);
                              mapRef.current.setZoom(16);
                            }
                          }}
                        >
                          <LocateFixed className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="places-empty mt-4">
                <MapPin className="size-5 text-vermilion" />
                <div>
                  <p className="text-[12px] font-extrabold text-ink">Select a mapped destination</p>
                  <p className="mt-0.5 text-[11px] text-ink/45">We'll surface notable {sightseeingInterest === "all" ? "attractions" : sightseeingInterest} nearby.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="map-panel" aria-label="Map">
        <MapView
          initialCenter={{ lat: 48.8629, lng: 2.3297 }}
          initialZoom={13}
          onMapReady={onMapReady}
          className="h-full min-h-[42vh] w-full"
        />

        <button
          type="button"
          onClick={fitAllStops}
          className="map-locate-button"
          aria-label="Fit the whole route on the map"
        >
          <LocateFixed className="size-4" />
          <span>Fit route</span>
        </button>

        <aside className="route-summary" aria-label="Route summary">
          <div className="route-summary-kicker">
            <RouteIcon className="size-3.5" />
            <span>{isCalculating ? "Calculating" : "Route ready"}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 divide-x divide-white/10">
            <div className="pr-3">
              <span className="summary-label">Distance</span>
              <strong>{formatDistance(routeSummary.distanceMeters)}</strong>
            </div>
            <div className="px-3">
              <span className="summary-label">Duration</span>
              <strong>{formatDuration(routeSummary.durationSeconds)}</strong>
            </div>
            <div className="pl-3">
              <span className="summary-label">Stops</span>
              <strong>{resolvedStops.length}</strong>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] font-semibold text-white/50">
            <Clock3 className="size-3" />
            Times update when the route changes
          </div>
          {routeSummary && !isCalculating && (
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const legs = stopsSegmentsRef.current;
                  const currentLegStops = legs[currentLeg];
                  if (currentLegStops && currentLegStops.length >= 2 && currentLegStops[0].location && currentLegStops[currentLegStops.length - 1].location) {
                    const waypoints = currentLegStops.slice(1, -1).map(s => `${s.location?.lat},${s.location?.lng}`).join('|');
                    const origin = `${currentLegStops[0].location?.lat},${currentLegStops[0].location?.lng}`;
                    const destination = `${currentLegStops[currentLegStops.length - 1].location?.lat},${currentLegStops[currentLegStops.length - 1].location?.lng}`;
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
                    window.open(url, '_blank');
                    if (currentLeg < legs.length - 1) {
                      setCurrentLeg(currentLeg + 1);
                    }
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-vermilion hover:bg-vermilion/90 text-white rounded-lg transition font-semibold"
                aria-label="Open in Google Maps"
              >
                <Navigation className="size-4" />
                Leg {currentLeg + 1} in Google Maps
              </button>
              {stopsSegmentsRef.current.length > 1 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentLeg(Math.max(0, currentLeg - 1))}
                    disabled={currentLeg === 0}
                    className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition text-sm"
                  >
                    ← Previous
                  </button>
                  <div className="flex-1 flex items-center justify-center text-xs text-white/70 bg-white/5 rounded-lg">
                    {currentLeg + 1} / {stopsSegmentsRef.current.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentLeg(Math.min(stopsSegmentsRef.current.length - 1, currentLeg + 1))}
                    disabled={currentLeg === stopsSegmentsRef.current.length - 1}
                    className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition text-sm"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </section>

      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-4" />
              Export Your Route
            </DialogTitle>
            <DialogDescription>
              Download your route as an HTML file or copy a shareable link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Download as HTML</h4>
              <p className="text-xs text-ink/55">
                Save your route as a standalone HTML file that opens in any browser.
              </p>
              <Button
                onClick={() => {
                  exportAsHTML();
                  setExportModalOpen(false);
                }}
                className="w-full gap-2 bg-vermilion hover:bg-vermilion/90"
              >
                <Download className="size-4" />
                Download HTML File
              </Button>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold">Download as Markdown</h4>
              <p className="text-xs text-ink/55">
                Export route with all stops and notes as a Markdown file.
              </p>
              <Button
                onClick={() => {
                  exportAsPDF();
                  setExportModalOpen(false);
                }}
                variant="outline"
                className="w-full gap-2"
              >
                <Download className="size-4" />
                Download Markdown
              </Button>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold">Share via Link</h4>
              <p className="text-xs text-ink/55 mb-3">
                Generate a link to share your route. Recipients can open it in Waypoint.
              </p>
              <div className="space-y-2">
                {shareLink ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareLink}
                        readOnly
                        className="flex-1 px-3 py-2 text-xs border border-border rounded-md bg-white/50 font-mono"
                      />
                      <Button
                        onClick={copyShareLink}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Check className="size-3.5" />
                        Copy
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      const url = generateShareLink();
                      navigator.clipboard.writeText(url);
                      toast.success("Link copied to clipboard!");
                    }}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <Link2 className="size-4" />
                    Generate &amp; Copy Link
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setExportModalOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </main>
  );
}
