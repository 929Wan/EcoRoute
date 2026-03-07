from flask import Flask, jsonify
from flask_cors import CORS
import osmnx as ox

app = Flask(__name__)
CORS(app)

# --- Load graph once at startup ---
place = "Avery County, North Carolina, USA"
G = ox.graph_from_place(place, network_type="drive")  # downloaded once
nodes, edges = ox.graph_to_gdfs(G)  # converted to GeoDataFrames once

# --- API routes ---
@app.route("/nodes")
def get_nodes():
    # only send minimal info
    nodes_json = nodes[['x','y','elevation']].fillna(0).to_dict(orient='records')
    return jsonify(nodes_json)

if __name__ == "__main__":
    app.run(debug=True)