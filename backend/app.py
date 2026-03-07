from flask import Flask, jsonify
from flask_cors import CORS
import osmnx as ox

app = Flask(__name__)
# Apply CORS BEFORE defining routes
CORS(app)
#CORS(app, origins=["http://localhost:8080", "http://localhost:6001", "http://10.180.0.161:8080", "http://10.180.0.161:6001"])  # allow your frontend only

# Example OSM graph (preload for demo)
place = "Avery County, North Carolina, USA"
G = ox.graph_from_place(place, network_type="drive")
nodes, edges = ox.graph_to_gdfs(G)

@app.route("/nodes")
def get_nodes():
    # only x, y for now to avoid 500
    nodes_json = nodes[['x','y']].to_dict(orient='records')
    return jsonify(nodes_json)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6001, debug=True)
