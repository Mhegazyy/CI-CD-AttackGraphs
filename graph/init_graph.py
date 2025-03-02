import networkx as nx
import matplotlib.pyplot as plt
import os
import sys

# Dynamically add the project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from json_parser.code.parser import InputParser  # Adjust if your package name/folder differs

def generate_attack_graph(data):
    """
    Creates a directed graph from the JSON data.
    Each node represents an asset; each edge represents a connection.
    """
    graph = nx.DiGraph()

    # Add nodes with attributes
    for node in data["nodes"]:
        graph.add_node(
            node["id"],
            name=node["name"],
            type=node["type"],
            ip=node["ip"],
            vulnerabilities=node.get("vulnerabilities", [])
        )
    
    # Add edges with attributes
    for edge in data["edges"]:
        graph.add_edge(
            edge["source"],
            edge["target"],
            connection=edge["connection"]
        )
    
    return graph

if __name__ == '__main__':
    json_file_path = "json_parser/input samples/sample.json"

    parser = InputParser(json_file_path)
    try:
        parser.load_input()
        data = parser.get_data()
        attack_graph = generate_attack_graph(data)
        
        # Print nodes and edges for verification
        print("Graph Nodes:", attack_graph.nodes(data=True))
        print("Graph Edges:", attack_graph.edges(data=True))
        
        # Generate a layout for node positioning
        pos = nx.spring_layout(attack_graph, k=0.25)  # Adjust 'k' to spread out the nodes

        # Draw the basic graph without default labels
        nx.draw(
            attack_graph,
            pos,
            with_labels=False,
            node_color='lightblue',
            edge_color='gray',
            node_size=800
        )
        
        # Build custom labels to show 'name' and 'ip'
        node_labels = {
            node: f"{attack_graph.nodes[node]['name']}\n{attack_graph.nodes[node]['ip']}"
            for node in attack_graph.nodes()
        }
        nx.draw_networkx_labels(attack_graph, pos, labels=node_labels, font_size=8)

        # Draw edge labels for 'connection'
        edge_labels = nx.get_edge_attributes(attack_graph, 'connection')
        nx.draw_networkx_edge_labels(attack_graph, pos, edge_labels=edge_labels, font_size=8)
        
        plt.title("Attack Graph (Network Topology)")
        plt.show()
        
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Current working directory:", os.getcwd())
