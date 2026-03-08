import rasterio
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
import osmnx as ox
import networkx as nx
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
import math
import itertools
from pyproj import Transformer
from sklearn.cluster import KMeans


app = Flask(__name__)
CORS(app)

# ── Region & Graph ────────────────────────────────────────────────────────────
place = "Avery County, North Carolina, USA"
print("Loading OSM graph…")
G = ox.graph_from_place(place, network_type="drive")
G_proj = ox.project_graph(G)
G_proj = ox.add_edge_speeds(G_proj, hwy_speeds={
    "motorway":     89,
    "trunk":        72,
    "primary":      72,
    "secondary":    56,
    "tertiary":     40,
    "residential":  32,
    "unclassified": 40,
    "service":      16,
    "track":        16,
}, fallback=40)
G_proj = ox.add_edge_travel_times(G_proj)
nodes, edges = ox.graph_to_gdfs(G_proj)
print(f"Graph loaded: {len(nodes)} nodes, {len(edges)} edges")

# ── DEM elevation lookup ──────────────────────────────────────────────────────
DEM_PATH = "avtif.tif"

def get_elevation(lat, lon):
    with rasterio.open(DEM_PATH) as src:
        row, col = src.index(lon, lat)
        row = max(0, min(row, src.height - 1))
        col = max(0, min(col, src.width - 1))
        window = rasterio.windows.Window(col, row, 1, 1)
        data = src.read(1, window=window)
        return float(data[0][0])

def sample_edge_elevation(geom):
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
BASE_EMISSION_RATE  = 1.2
STUDENT_MASS_KG     = 70
BUS_EMPTY_MASS_KG   = 11_000
IDLE_EMISSION_KG_S  = 0.001
IDLE_TIME_S         = 30
MAX_BUS_CAPACITY    = 54

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
    length_m  = edge_data.get("length", 1.0)
    length_km = length_m / 1000.0
    co2 = BASE_EMISSION_RATE * length_km
    rt  = road_type(edge_data)
    co2 *= ROAD_FUEL_FACTOR.get(rt, 1.05)
    geom = edge_data.get("geometry", None)
    if geom is not None and length_m > 0:
        elevs = sample_edge_elevation(geom)
        total_ascent  = sum(max(0, elevs[i+1] - elevs[i]) for i in range(len(elevs)-1))
        total_descent = sum(max(0, elevs[i] - elevs[i+1]) for i in range(len(elevs)-1))
        net_grade_effect = (total_ascent * 2.5) - (total_descent * 1.2)
        grade_factor = 1.0 + max(-0.15, min(0.4, net_grade_effect / length_m))
    elif length_m > 0:
        grade = (elev_v - elev_u) / length_m
        grade_factor = 1.0 + max(-0.15, min(0.4, grade * 2.5))
    else:
        grade_factor = 1.0
    co2 *= grade_factor
    total_mass  = BUS_EMPTY_MASS_KG + num_students * STUDENT_MASS_KG
    load_factor = total_mass / BUS_EMPTY_MASS_KG
    co2 *= load_factor ** 0.15
    return co2

def travel_time_edge(edge_data):
    return edge_data.get("travel_time", edge_data.get("length", 1.0) / 11.0)

# ── Pre-compute node elevations ───────────────────────────────────────────────
print("Pre-computing node elevations…")
node_ids    = list(G_proj.nodes())
node_coords = [(G_proj.nodes[n]["y"], G_proj.nodes[n]["x"]) for n in node_ids]
elev_list   = get_elevation_batch(node_coords)
NODE_ELEV   = {nid: elev for nid, elev in zip(node_ids, elev_list)}
print("Elevations cached.")

# ── Build weighted graph ──────────────────────────────────────────────────────
def build_carbon_graph(num_students):
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

# ── Snap stop to nearest walkable intersection ────────────────────────────────
def snap_to_walkable_intersection(lat, lon, min_degree=3, max_walk_m=800):
    """
    If the nearest OSM node is on a low-connectivity road (degree < min_degree),
    walk outward along the graph until we find a node with degree >= min_degree
    (a real intersection on a more significant road) within max_walk_m metres.
    Returns the snapped (lat, lon) in WGS-84.
    """
    start_node = nearest_node(lat, lon)

    # If already on a well-connected node, return as-is
    if G_proj.degree(start_node) >= min_degree:
        return lat, lon

    # BFS outward, tracking cumulative distance
    visited = {start_node: 0.0}
    queue = [(0.0, start_node)]

    while queue:
        queue.sort(key=lambda x: x[0])
        dist_so_far, current = queue.pop(0)

        for neighbor in G_proj.neighbors(current):
            edge_data = min(G_proj[current][neighbor].values(),
                            key=lambda d: d.get("length", 1e9))
            edge_len = edge_data.get("length", 50.0)
            new_dist = dist_so_far + edge_len

            if new_dist > max_walk_m:
                continue
            if neighbor in visited and visited[neighbor] <= new_dist:
                continue

            visited[neighbor] = new_dist

            if G_proj.degree(neighbor) >= min_degree:
                # Found a suitable intersection — convert back to WGS-84
                crs = G_proj.graph["crs"]
                transformer = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
                nx_data = G_proj.nodes[neighbor]
                lon_out, lat_out = transformer.transform(nx_data["x"], nx_data["y"])
                return lat_out, lon_out

            queue.append((new_dist, neighbor))

    # Nothing found within walk distance — return original
    return lat, lon

# ── Greedy route with 2-opt improvement ──────────────────────────────────────
def greedy_route(H, school_node, stop_nodes, weight_key):
    if not stop_nodes:
        return [school_node], 0.0

    all_nodes = [school_node] + stop_nodes
    cost_cache = {}
    path_cache = {}
    for a, b in itertools.combinations(all_nodes, 2):
        try:
            cost = nx.shortest_path_length(H, a, b, weight=weight_key)
            path = nx.shortest_path(H, a, b, weight=weight_key)
            cost_cache[(a, b)] = cost_cache[(b, a)] = cost
            path_cache[(a, b)] = path
            path_cache[(b, a)] = list(reversed(path))
        except nx.NetworkXNoPath:
            cost_cache[(a, b)] = cost_cache[(b, a)] = math.inf
            path_cache[(a, b)] = path_cache[(b, a)] = []

    # Greedy nearest-neighbor initial ordering
    unvisited = list(stop_nodes)
    order = []
    current = school_node
    while unvisited:
        best = min(unvisited, key=lambda n: cost_cache.get((current, n), math.inf))
        if cost_cache.get((current, best), math.inf) == math.inf:
            break
        order.append(best)
        unvisited.remove(best)
        current = best

    # 2-opt improvement
    def route_cost(ord):
        seq = [school_node] + ord + [school_node]
        return sum(cost_cache.get((seq[i], seq[i+1]), math.inf)
                   for i in range(len(seq)-1))

    improved = True
    while improved:
        improved = False
        for i in range(len(order)):
            for j in range(i+2, len(order)):
                new_order = order[:i] + order[i:j+1][::-1] + order[j+1:]
                if route_cost(new_order) < route_cost(order):
                    order = new_order
                    improved = True

    # Stitch full OSM node path
    full_path = []
    total_w   = 0.0
    seq = [school_node] + order + [school_node]
    for i in range(len(seq)-1):
        a, b = seq[i], seq[i+1]
        sub  = path_cache.get((a, b), [])
        if not sub:
            continue
        full_path += sub if not full_path else sub[1:]
        total_w   += cost_cache.get((a, b), 0)

    return full_path, total_w

# ── Path to coords with full edge geometry ────────────────────────────────────
def path_to_coords(path):
    G_unproj = ox.project_graph(G_proj, to_crs="EPSG:4326")
    coords = []
    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        if not G_unproj.has_edge(u, v):
            continue
        edge_data = min(G_unproj[u][v].values(), key=lambda d: d.get("length", 1e9))
        geom = edge_data.get("geometry")
        if geom is not None:
            pts = list(geom.coords)
            for lon, lat in pts[:-1]:
                coords.append({"lat": lat, "lon": lon})
        else:
            coords.append({"lat": G_unproj.nodes[u]["y"], "lon": G_unproj.nodes[u]["x"]})
    if path:
        last = path[-1]
        coords.append({"lat": G_unproj.nodes[last]["y"], "lon": G_unproj.nodes[last]["x"]})
    return coords

def compute_path_stats(path, num_students):
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
    total_carbon += num_students * IDLE_EMISSION_KG_S * IDLE_TIME_S
    return {
        "carbon_kg":   round(total_carbon, 3),
        "distance_km": round(total_dist,   2),
        "time_min":    round(total_time / 60, 1),
    }

# ── Multi-bus VRP solver ──────────────────────────────────────────────────────
def solve_vrp(school_node, stop_nodes, stop_coords, num_students, H):
    n_stops = len(stop_nodes)
    if n_stops == 0:
        return {"buses": [], "num_buses": 0, "total_carbon_kg": 0.0}

    min_buses = math.ceil(num_students / MAX_BUS_CAPACITY)
    max_buses = max(min(10, n_stops), min_buses)

    best_result = None
    best_carbon = math.inf

    for n_buses in range(min_buses, max_buses + 1):
        if n_buses == 1:
            clusters = [list(range(n_stops))]
        else:
            coords_arr = np.array([[c[0], c[1]] for c in stop_coords])
            km = KMeans(n_clusters=n_buses, n_init=10, random_state=42)
            labels = km.fit_predict(coords_arr)
            clusters = [[] for _ in range(n_buses)]
            for idx, label in enumerate(labels):
                clusters[label].append(idx)
            clusters = [c for c in clusters if c]

        buses = []
        total_carbon = 0.0
        valid = True

        for cluster_idxs in clusters:
            cluster_stops = [stop_nodes[i] for i in cluster_idxs]
            students_on_bus = math.ceil(num_students * len(cluster_idxs) / n_stops)
            students_on_bus = min(students_on_bus, MAX_BUS_CAPACITY)

            # Carbon-optimal route
            carbon_path, _ = greedy_route(H, school_node, cluster_stops, "carbon_weight")
            if not carbon_path:
                valid = False
                break
            carbon_stats  = compute_path_stats(carbon_path, students_on_bus)
            carbon_coords = path_to_coords(carbon_path)
            total_carbon += carbon_stats["carbon_kg"]

            # Fastest route
            time_path, _  = greedy_route(H, school_node, cluster_stops, "time_weight")
            time_stats    = compute_path_stats(time_path, students_on_bus)
            time_coords   = path_to_coords(time_path)

            buses.append({
                "bus_id":        len(buses) + 1,
                "stop_indices":  cluster_idxs,
                "num_students":  students_on_bus,
                "carbon_route":  {"coords": carbon_coords, "stats": carbon_stats},
                "fastest_route": {"coords": time_coords,   "stats": time_stats},
            })

        if valid and total_carbon < best_carbon:
            best_carbon = total_carbon
            total_fastest_carbon = sum(
                b["fastest_route"]["stats"]["carbon_kg"] for b in buses
            )
            carbon_saved = round(total_fastest_carbon - total_carbon, 3)
            carbon_saved_pct = round(100 * carbon_saved / total_fastest_carbon, 1) if total_fastest_carbon > 0 else 0.0
            best_result = {
                "buses":            buses,
                "num_buses":        len(buses),
                "total_carbon_kg":  round(total_carbon, 3),
                "carbon_saved_kg":  carbon_saved,
                "carbon_saved_pct": carbon_saved_pct,
            }

    return best_result

# ── Geocoding ─────────────────────────────────────────────────────────────────
geolocator      = Nominatim(user_agent="bus_router", timeout=10)
geocode_limited = RateLimiter(geolocator.geocode, min_delay_seconds=1)

def geocode_address(address):
    loc = geocode_limited(address)
    if loc:
        return loc.latitude, loc.longitude
    return None

# ── Flask routes ──────────────────────────────────────────────────────────────

@app.route("/nodes")
def get_nodes():
    nodes_json = nodes[["x", "y"]].to_dict(orient="records")
    return jsonify(nodes_json)

@app.route("/topography")
def get_topography():
    with rasterio.open(DEM_PATH) as src:
        data     = src.read(1)
        stride   = 5
        dem      = data[::stride, ::stride]
        x, y     = np.gradient(dem)
        slope    = np.pi / 2.0 - np.arctan(np.sqrt(x * x + y * y))
        aspect   = np.arctan2(-x, y)
        azimuth  = 315 * np.pi / 180
        altitude = 45  * np.pi / 180
        shaded   = (
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
    body         = request.get_json()
    school_coord = body["school"]
    stops        = body["stops"]
    num_students = int(body.get("num_students", 20))
    num_students = max(1, min(num_students, MAX_BUS_CAPACITY * 10))

    school_node = nearest_node(school_coord["lat"], school_coord["lon"])
    snapped     = [snap_to_walkable_intersection(s["lat"], s["lon"]) for s in stops]
    stop_nodes  = [nearest_node(lat, lon) for lat, lon in snapped]
    stop_coords = snapped

    H = build_carbon_graph(num_students)
    result = solve_vrp(school_node, stop_nodes, stop_coords, num_students, H)

    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6001, debug=True)