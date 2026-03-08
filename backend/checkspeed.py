import osmnx as ox

print("starting")
place = "Avery County, North Carolina, USA"
G = ox.graph_from_place(place, network_type="drive")
G = ox.project_graph(G)
G = ox.add_edge_speeds(G)

# Count edges with and without speed_kph
edges_with_speed = 0
edges_without_speed = 0

for u, v, data in G.edges(data=True):
    if data.get("speed_kph") is not None:
        edges_with_speed += 1
    else:
        edges_without_speed += 1

total_edges = edges_with_speed + edges_without_speed

print(f"Total edges: {total_edges}")
print(f"Edges with speed: {edges_with_speed} ({edges_with_speed/total_edges*100:.1f}%)")
print(f"Edges without speed: {edges_without_speed} ({edges_without_speed/total_edges*100:.1f}%)")

# print("Sample edges with speed data:")
# # Print a sample of edges with their speed values
# for u, v, data in list(G.edges(data=True))[:200]:
#     print(data.get("highway"), "→", data.get("speed_kph"), "kph")

