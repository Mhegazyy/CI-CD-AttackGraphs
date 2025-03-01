import json
import logging
import os

# Configure logging for clear output during parsing.
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

class InputParser:
    def __init__(self, file_path):
        self.file_path = file_path
        self.data = None

    def load_input(self):
        """
        Loads and validates the JSON input file.
        """
        try:
            with open(self.file_path, 'r') as f:
                self.data = json.load(f)
            logging.info("Input file loaded successfully.")
            self.validate_data()
        except Exception as e:
            logging.error(f"Error loading input file: {e}")
            raise

    def validate_data(self):
        """
        Validates that the essential fields are present in the data.
        """
        # Check for the presence of top-level keys: nodes and edges.
        if "nodes" not in self.data:
            raise ValueError("Input data missing 'nodes' field.")
        if "edges" not in self.data:
            raise ValueError("Input data missing 'edges' field.")

        # Validate each node contains the required fields.
        required_node_fields = ["id", "name", "type", "ip"]
        for node in self.data["nodes"]:
            for field in required_node_fields:
                if field not in node:
                    raise ValueError(f"Node missing required field '{field}': {node}")

        # Validate each edge contains the required fields.
        required_edge_fields = ["source", "target", "connection"]
        for edge in self.data["edges"]:
            for field in required_edge_fields:
                if field not in edge:
                    raise ValueError(f"Edge missing required field '{field}': {edge}")
        logging.info("Input data validation successful.")

    def get_data(self):
        """
        Returns the parsed and validated data.
        """
        return self.data

if __name__ == '__main__':
    # Example usage:
    parser = InputParser("json_parser/input samples/sample.json")
    try:
        parser.load_input()
        data = parser.get_data()
        logging.info("Parsed Data:")
        logging.info(data)
    except Exception as e:
        logging.error(f"Parser failed: {e}")
        print("Current working directory:", os.getcwd())
