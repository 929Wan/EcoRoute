import osmnx as ox

print("starting")
place = "Avery County, North Carolina, USA"
G = ox.graph_from_place(place, network_type="drive")
G = ox.project_graph(G)
G = ox.add_edge_speeds(G)

print("Sample edges with speed data:")
# Print a sample of edges with their speed values
for u, v, data in list(G.edges(data=True))[:100]:
    print(data.get("highway"), "→", data.get("speed_kph"), "kph")
