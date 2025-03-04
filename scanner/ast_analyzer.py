import ast
import os

class FunctionInfo:
    """
    Holds metadata about a function definition.
    """
    def __init__(self, name, lineno, filepath, class_name=None):
        self.name = name
        self.lineno = lineno
        self.filepath = filepath
        self.class_name = class_name  # If it's a method inside a class

    def full_name(self):
        if self.class_name:
            return f"{self.filepath}:{self.class_name}.{self.name}"
        else:
            return f"{self.filepath}:{self.name}"

    def __repr__(self):
        return f"<Function {self.full_name()} at line {self.lineno}>"

class CallGraphAnalyzer(ast.NodeVisitor):
    """
    An AST visitor that extracts function definitions and call relationships.
    """
    def __init__(self, filepath):
        self.filepath = filepath
        self.current_function = None
        self.functions = []  # List of FunctionInfo objects
        self.calls = []      # List of (caller_full_name, callee_name) tuples
        self.class_context = None  # Tracks current class for methods

    def visit_ClassDef(self, node):
        # Enter class context
        previous_class = self.class_context
        self.class_context = node.name
        self.generic_visit(node)
        self.class_context = previous_class

    def visit_FunctionDef(self, node):
        # Record function definition with potential class context.
        func_info = FunctionInfo(
            name=node.name,
            lineno=node.lineno,
            filepath=self.filepath,
            class_name=self.class_context
        )
        self.functions.append(func_info)
        
        # Set current function context
        previous_function = self.current_function
        self.current_function = func_info
        
        # Traverse the function body to extract calls.
        self.generic_visit(node)
        
        self.current_function = previous_function

    def visit_Call(self, node):
        """
        When a call is encountered, try to extract the name of the function or method called.
        """
        callee = self._get_callee_name(node.func)
        if self.current_function and callee:
            self.calls.append((self.current_function.full_name(), callee))
        self.generic_visit(node)

    def _get_callee_name(self, node):
        """
        Extracts a name from a call node.
        Handles:
          - Direct calls (e.g., foo())
          - Method calls (e.g., self.bar())
        """
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            # For an attribute, attempt to get the base and the attribute.
            base = self._get_callee_name(node.value)
            if base:
                return f"{base}.{node.attr}"
            else:
                return node.attr
        return None

def analyze_file(filepath):
    """
    Analyzes a single Python file to extract function definitions and call relationships.
    
    Returns:
        dict: A dictionary with two keys:
              'functions': list of FunctionInfo objects
              'calls': list of (caller, callee) tuples
    """
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            source = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return {"functions": [], "calls": []}

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        print(f"Syntax error in {filepath}: {e}")
        return {"functions": [], "calls": []}

    analyzer = CallGraphAnalyzer(filepath)
    analyzer.visit(tree)
    return {"functions": analyzer.functions, "calls": analyzer.calls}

def analyze_code(code_path):
    """
    Walks through the directory to analyze all Python files.
    
    Returns:
        dict: A dictionary with keys 'functions' and 'calls'
    """
    aggregated = {"functions": [], "calls": []}
    for root, _, files in os.walk(code_path):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                result = analyze_file(filepath)
                aggregated["functions"].extend(result["functions"])
                aggregated["calls"].extend(result["calls"])
    return aggregated

if __name__ == "__main__":
    # Test the updated analyzer on the current directory
    results = analyze_code(".")
    print("Functions Found:")
    for func in results["functions"]:
        print(func)
    print("\nCall Relationships (caller -> callee):")
    for caller, callee in results["calls"]:
        print(f"{caller} -> {callee}")
