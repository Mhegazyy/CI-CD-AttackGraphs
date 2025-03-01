import networkx as nx
import matplotlib.pyplot as plt
import os
import sys
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)
from json_parser.code.parser import InputParser


def generate_attack_graph(data):
    # Create a directed graph. You can change to nx.Graph() for an undirected graph if needed.
    graph = nx.DiGraph()

    # Add nodes to the graph
    for node in data["nodes"]:
        graph.add_node(
            node["id"],
            name=node["name"],
            type=node["type"],
            ip=node["ip"],
            vulnerabilities=node.get("vulnerabilities", [])
        )
    
    # Add edges to the graph
    for edge in data["edges"]:
        graph.add_edge(
            edge["source"],
            edge["target"],
            connection=edge["connection"]
        )
    
    return graph

if __name__ == '__main__':
    # Assuming your InputParser is already defined and working
    parser = InputParser("json_parser/input samples/sample.json")
    try:
        parser.load_input()
        data = parser.get_data()
        attack_graph = generate_attack_graph(data)
        
        # Print nodes and edges for verification
        print("Graph Nodes:", attack_graph.nodes(data=True))
        print("Graph Edges:", attack_graph.edges(data=True))
        
        # Optionally, draw the graph for a quick visualization (static image)
        pos = nx.spring_layout(attack_graph)
        nx.draw(attack_graph, pos, with_labels=True, node_color='lightblue', edge_color='gray')
        labels = nx.get_edge_attributes(attack_graph, 'connection')
        nx.draw_networkx_edge_labels(attack_graph, pos, edge_labels=labels)
        plt.show()
        
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Current working directory:", os.getcwd())
