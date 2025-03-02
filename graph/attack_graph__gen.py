import json
import networkx as nx
from pyvis.network import Network

def build_full_graph(data):
    """
    Creates a single NetworkX DiGraph containing:
      1. The original (physical/logical) network edges.
      2. Additional exploit edges if the node is vulnerable and reachable.
    Each edge is tagged with an 'edge_type' attribute: 'network' or 'exploit'.
    """
    G = nx.DiGraph()

    # 1. Add all nodes with attributes
    for node in data["nodes"]:
        G.add_node(
            node["id"],
            **node  # includes name, ip, vulnerabilities, etc.
        )

    # 2. Add the original network edges (color them differently later)
    for edge in data["edges"]:
        # Mark these as normal "network" edges
        G.add_edge(
            edge["source"],
            edge["target"],
            edge_type="network",
            connection=edge["connection"],
            description=edge.get("description", "")
        )

    # 3. Build adjacency info for reachability checks
    adjacency = {}
    for node in data["nodes"]:
        adjacency[node["id"]] = set()
    for edge in data["edges"]:
        adjacency[edge["source"]].add(edge["target"])

    # 4. Define a basic exploit logic: if Node B has a high/critical vuln and is reachable from A
    def can_exploit(nodeA_id, nodeB_id):
        if nodeB_id not in adjacency[nodeA_id]:
            return False
        nodeB = next(n for n in data["nodes"] if n["id"] == nodeB_id)
        vulns = nodeB.get("vulnerabilities", [])
        return any(v["severity"].lower() in ["high", "critical"] for v in vulns)

    # 5. Add exploit edges (A->B) if can_exploit is True
    for nodeA in data["nodes"]:
        for nodeB in data["nodes"]:
            if nodeA["id"] != nodeB["id"]:
                if can_exploit(nodeA["id"], nodeB["id"]):
                    # Tag these edges as 'exploit'
                    G.add_edge(
                        nodeA["id"],
                        nodeB["id"],
                        edge_type="exploit",
                        exploit="Potential exploit path"
                    )
    return G


def visualize_combined_graph(G, output_html="combined_graph.html"):
    """
    Creates a PyVis interactive visualization that shows:
      - 'network' edges in gray
      - 'exploit' edges in red
    Also uses tooltips for details, and color-codes nodes that have vulnerabilities.
    """
    net = Network(height="800px", width="100%", directed=True)

    # 1. Add nodes with minimal label, more info in tooltip
    for node_id, attrs in G.nodes(data=True):
        # If node has vulnerabilities, color it differently
        vulns = attrs.get("vulnerabilities", [])
        color = "lightgreen" if not vulns else "tomato"

        label = f"{attrs.get('name', 'Unknown')}\n{attrs.get('ip', '')}"
        title = label
        if vulns:
            title += "\nVulnerabilities:"
            for v in vulns:
                title += f"\n - {v['id']} ({v['severity']})"

        net.add_node(
            node_id,
            label=label,
            title=title,
            color=color
        )

    # 2. Add edges, color-coded by edge_type
    for u, v, edge_attrs in G.edges(data=True):
        edge_type = edge_attrs.get("edge_type", "network")
        if edge_type == "network":
            # Normal network edges in gray
            color = "gray"
            label = edge_attrs.get("connection", "")
            title = edge_attrs.get("description", "")
        else:
            # Exploit edges in red
            color = "red"
            label = ""
            title = edge_attrs.get("exploit", "")

        net.add_edge(
            u,
            v,
            label=label,
            title=title,
            color=color,
            arrows="to"
        )

    # 3. Tweak the layout/physics for better spacing
    net.set_options("""
    var options = {
      "nodes": {
        "shape": "dot",
        "size": 15,
        "font": {
          "size": 12,
          "face": "Tahoma"
        }
      },
      "edges": {
        "arrows": {
          "to": {
            "enabled": true,
            "scaleFactor": 0.5
          }
        },
        "smooth": {
          "enabled": true,
          "type": "dynamic"
        }
      },
      "physics": {
        "barnesHut": {
          "gravitationalConstant": -20000,
          "springLength": 200,
          "springConstant": 0.001
        },
        "minVelocity": 0.75
      }
    }
    """)
    net.show(output_html, notebook=False)
    print(f"Combined graph saved to {output_html}")

if __name__ == "__main__":
    # 1. Load your synthetic network JSON
    with open("json_parser/input samples/synthetic_network.json", "r") as f:
        data = json.load(f)
    
    # 2. Build a simple attack graph
    attack_graph = build_full_graph(data)
    
    # 3. Generate an interactive HTML visualization
    visualize_combined_graph(attack_graph, "attack_graph.html")
