import rasterio
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
import osmnx as ox
import networkx as nx
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
import math
from pyproj import Transformer


app = Flask(__name__)
CORS(app)

# ── Region & Graph ────────────────────────────────────────────────────────────
place = "Avery County, North Carolina, USA"
print("Loading OSM graph…")
G = ox.graph_from_place(place, network_type="drive")
G_proj = ox.project_graph(G)
G_proj = ox.add_edge_speeds(G_proj)
G_proj = ox.add_edge_travel_times(G_proj)
nodes, edges = ox.graph_to_gdfs(G_proj)
print(f"Graph loaded: {len(nodes)} nodes, {len(edges)} edges")

# ── DEM elevation lookup ──────────────────────────────────────────────────────
DEM_PATH = "avtif.tif"

def get_elevation(lat, lon):
    """Sample DEM raster at a lat/lon coordinate."""
    with rasterio.open(DEM_PATH) as src:
        row, col = src.index(lon, lat)
        row = max(0, min(row, src.height - 1))
        col = max(0, min(col, src.width - 1))
        window = rasterio.windows.Window(col, row, 1, 1)
        data = src.read(1, window=window)
        return float(data[0][0])
    
def sample_edge_elevation(geom):
    """
    Sample elevation at every coordinate point along an edge geometry.
    Returns a list of elevation values in order.
    """
    elevations = []
    with rasterio.open(DEM_PATH) as src:
        for lon, lat in geom.coords:
            try:
                row, col = src.index(lon, lat)
                row = max(0, min(row, src.height - 1))
                col = max(0, min(col, src.width - 1))
                window = rasterio.windows.Window(col, row, 1, 1)
                data = src.read(1, window=window)
                elevations.append(float(data[0][0]))
            except Exception:
                elevations.append(0.0)
    return elevations

def get_elevation_batch(coords):
    """Batch elevation lookup — opens raster once."""
    elevations = []
    with rasterio.open(DEM_PATH) as src:
        for lat, lon in coords:
            try:
                row, col = src.index(lon, lat)
                row = max(0, min(row, src.height - 1))
                col = max(0, min(col, src.width - 1))
                window = rasterio.windows.Window(col, row, 1, 1)
                data = src.read(1, window=window)
                elevations.append(float(data[0][0]))
            except Exception:
                elevations.append(0.0)
    return elevations

# ── Carbon model constants ────────────────────────────────────────────────────
# Diesel bus baseline: ~1.2 kg CO2 / km at flat, 30 km/h, empty
BASE_EMISSION_RATE  = 1.2          # kg CO2 / km (flat road, light load)
STUDENT_MASS_KG     = 70           # average student + bag
BUS_EMPTY_MASS_KG   = 11_000       # typical school bus curb weight
IDLE_EMISSION_KG_S  = 0.001        # kg CO2 per second idling (stop)
IDLE_TIME_S         = 30           # seconds idling per student pickup
MAX_BUS_CAPACITY    = 50           # students per bus

# Road-type speed limits (km/h) — used for travel time and engine load


# Road-type fuel-load multipliers (relative to residential baseline)
ROAD_FUEL_FACTOR = {
    "motorway": 0.95, "trunk": 0.96, "primary": 0.97,
    "secondary": 0.98, "tertiary": 1.00, "residential": 1.04,
    "unclassified": 1.02, "service": 1.06, "track": 1.12,
}

def road_type(edge_data):
    hw = edge_data.get("highway", "unclassified")
    if isinstance(hw, list):
        hw = hw[0]
    return hw

def carbon_cost_edge(u, v, edge_data, num_students, elev_u, elev_v):
    """
    Detailed carbon cost (kg CO2) for traversing one edge.

    Factors:
      1. Base emission × distance
      2. Road-type fuel factor
      3. Grade (slope) load factor  — uphill burns more, downhill less
      4. Bus load (mass) factor
      5. Idle emissions at each stop are added separately
    """
    length_m  = edge_data.get("length", 1.0)
    length_km = length_m / 1000.0

    # 1. Base
    co2 = BASE_EMISSION_RATE * length_km

    # 2. Road type
    rt  = road_type(edge_data)
    co2 *= ROAD_FUEL_FACTOR.get(rt, 1.05)

    # 3. Grade factor — cumulative ascent and descent along edge geometry
    geom = edge_data.get("geometry", None)
    if geom is not None and length_m > 0:
        elevs = sample_edge_elevation(geom)
        total_ascent  = sum(max(0, elevs[i+1] - elevs[i]) for i in range(len(elevs)-1))
        total_descent = sum(max(0, elevs[i] - elevs[i+1]) for i in range(len(elevs)-1))
        net_grade_effect = (total_ascent * 2.5) - (total_descent * 1.2)
        grade_factor = 1.0 + max(-0.15, min(0.4, net_grade_effect / length_m))
    elif length_m > 0:
        # fallback to endpoint-only if no geometry
        grade = (elev_v - elev_u) / length_m
        grade_factor = 1.0 + max(-0.15, min(0.4, grade * 2.5))
    else:
        grade_factor = 1.0
    co2 *= grade_factor

    # 4. Load factor
    total_mass   = BUS_EMPTY_MASS_KG + num_students * STUDENT_MASS_KG
    load_factor  = total_mass / BUS_EMPTY_MASS_KG
    co2 *= load_factor ** 0.15   # sub-linear — engine doesn't scale linearly

    return co2

def travel_time_edge(edge_data):
    return edge_data.get("travel_time", edge_data.get("length", 1.0) / 11.0)

# ── Pre-compute node elevations (cache) ───────────────────────────────────────
print("Pre-computing node elevations…")
node_ids   = list(G_proj.nodes())
node_coords = [(G_proj.nodes[n]["y"], G_proj.nodes[n]["x"]) for n in node_ids]
elev_list  = get_elevation_batch(node_coords)
NODE_ELEV  = {nid: elev for nid, elev in zip(node_ids, elev_list)}
print("Elevations cached.")

# ── Build weighted graphs ─────────────────────────────────────────────────────
def build_carbon_graph(num_students):
    """Return a copy of G with carbon-cost edge weights."""
    H = G_proj.copy()
    for u, v, key, data in G_proj.edges(keys=True, data=True):
        eu = NODE_ELEV.get(u, 0)
        ev = NODE_ELEV.get(v, 0)
        H[u][v][key]["carbon_weight"] = carbon_cost_edge(u, v, data, num_students, eu, ev)
        H[u][v][key]["time_weight"]   = travel_time_edge(data)
    return H

# ── Nearest graph node ────────────────────────────────────────────────────────
def nearest_node(lat, lon):
    crs = G_proj.graph["crs"]
    transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    x, y = transformer.transform(lon, lat)
    return ox.distance.nearest_nodes(G_proj, x, y)


# ── TSP-style greedy route through stops ─────────────────────────────────────
def greedy_route(H, school_node, stop_nodes, weight_key):
    """
    Greedy nearest-next ordering of stops, returning a full ordered path
    of OSM node IDs from school → all stops → school (round trip),
    using Dijkstra between consecutive waypoints.
    """
    unvisited = list(stop_nodes)
    path      = []
    total_w   = 0.0
    current   = school_node

    while unvisited:
        best_node = None
        best_cost = math.inf
        best_sub  = []
        for candidate in unvisited:
            try:
                sub_path = nx.shortest_path(H, current, candidate, weight=weight_key)
                cost     = nx.shortest_path_length(H, current, candidate, weight=weight_key)
                if cost < best_cost:
                    best_cost = cost
                    best_node = candidate
                    best_sub  = sub_path
            except nx.NetworkXNoPath:
                continue
        if best_node is None:
            break
        # append sub_path (skip first node to avoid duplication)
        path     += best_sub if not path else best_sub[1:]
        total_w  += best_cost
        current   = best_node
        unvisited.remove(best_node)

    # Return to school
    try:
        return_path = nx.shortest_path(H, current, school_node, weight=weight_key)
        return_cost = nx.shortest_path_length(H, current, school_node, weight=weight_key)
        path    += return_path[1:]
        total_w += return_cost
    except nx.NetworkXNoPath:
        pass

    return path, total_w

def path_to_coords(path):
    G_unproj = ox.project_graph(G_proj, to_crs="EPSG:4326")
    return [{"lat": G_unproj.nodes[n]["y"], "lon": G_unproj.nodes[n]["x"]} for n in path]

def compute_path_stats(path, num_students):
    """Compute total carbon (kg), distance (km), time (s) for a node path."""
    total_carbon = 0.0
    total_dist   = 0.0
    total_time   = 0.0
    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        if G_proj.has_edge(u, v):
            data = min(G_proj[u][v].values(), key=lambda d: d.get("length", 1e9))
            eu   = NODE_ELEV.get(u, 0)
            ev   = NODE_ELEV.get(v, 0)
            total_carbon += carbon_cost_edge(u, v, data, num_students, eu, ev)
            total_dist   += data.get("length", 0) / 1000.0
            total_time   += travel_time_edge(data)
    # Add idle emissions
    idle = len([n for n in path if n in set()]) * IDLE_EMISSION_KG_S * IDLE_TIME_S
    total_carbon += num_students * IDLE_EMISSION_KG_S * IDLE_TIME_S
    return {
        "carbon_kg":   round(total_carbon, 3),
        "distance_km": round(total_dist,   2),
        "time_min":    round(total_time / 60, 1),
    }

# ── Geocoding ─────────────────────────────────────────────────────────────────
geolocator = Nominatim(user_agent="bus_router")

def geocode_address(address):
    loc = geolocator.geocode(address)
    if loc:
        return loc.latitude, loc.longitude
    return None

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/nodes")
def get_nodes():
    nodes_json = nodes[["x", "y"]].to_dict(orient="records")
    return jsonify(nodes_json)

@app.route("/topography")
def get_topography():
    with rasterio.open(DEM_PATH) as src:
        data    = src.read(1)
        stride  = 5
        dem     = data[::stride, ::stride]
        x, y    = np.gradient(dem)
        slope   = np.pi / 2.0 - np.arctan(np.sqrt(x * x + y * y))
        aspect  = np.arctan2(-x, y)
        azimuth = 315 * np.pi / 180
        altitude= 45  * np.pi / 180
        shaded  = (
            np.sin(altitude) * np.sin(slope)
            + np.cos(altitude) * np.cos(slope) * np.cos(azimuth - aspect)
        )
        data_small = (255 * (shaded - shaded.min()) / (shaded.max() - shaded.min())).astype(np.uint8)
        bounds = {
            "left": src.bounds.left, "bottom": src.bounds.bottom,
            "right": src.bounds.right, "top": src.bounds.top,
        }
    return jsonify({"elevations": data_small.tolist(), "bounds": bounds})

@app.route("/geocode")
def geocode():
    address = request.args.get("address", "")
    result  = geocode_address(address)
    if result:
        return jsonify({"lat": result[0], "lon": result[1]})
    return jsonify({"error": "Address not found"}), 404

@app.route("/route", methods=["POST"])
def compute_route():
    """
    POST body (JSON):
    {
      "school": { "lat": ..., "lon": ... },          # destination
      "stops":  [{ "lat": ..., "lon": ... }, ...],   # student pickup points
      "num_students": 30                              # total students on bus
    }

    Returns both carbon-optimal and fastest routes with stats.
    """
    body         = request.get_json()
    school_coord = body["school"]          # {lat, lon}
    stops        = body["stops"]           # [{lat, lon}, ...]
    num_students = int(body.get("num_students", 20))
    num_students = max(1, min(num_students, MAX_BUS_CAPACITY))

    school_node = nearest_node(school_coord["lat"], school_coord["lon"])
    stop_nodes  = [nearest_node(s["lat"], s["lon"]) for s in stops]

    # Build both weighted graphs
    H = build_carbon_graph(num_students)

    # Carbon-optimal route
    print("school_node1:", school_node)
    print("stop_nodes1:", stop_nodes)
    carbon_path, _ = greedy_route(H, school_node, stop_nodes, "carbon_weight")
    print("carbon_path length2:", len(carbon_path))
    print("carbon_path2:", carbon_path[:5])
    carbon_stats   = compute_path_stats(carbon_path, num_students)
    carbon_coords  = path_to_coords(carbon_path)

    # Fastest route (time-weighted)
    time_path, _   = greedy_route(H, school_node, stop_nodes, "time_weight")
    time_stats     = compute_path_stats(time_path, num_students)
    time_coords    = path_to_coords(time_path)

    # Carbon saved
    carbon_saved   = round(time_stats["carbon_kg"] - carbon_stats["carbon_kg"], 3)
    carbon_saved_pct = 0.0
    if time_stats["carbon_kg"] > 0:
        carbon_saved_pct = round(100 * carbon_saved / time_stats["carbon_kg"], 1)

    return jsonify({
        "carbon_route": {
            "coords": carbon_coords,
            "stats":  carbon_stats,
        },
        "fastest_route": {
            "coords": time_coords,
            "stats":  time_stats,
        },
        "carbon_saved_kg":  carbon_saved,
        "carbon_saved_pct": carbon_saved_pct,
        "num_students":     num_students,
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6001, debug=True)