import ast
import os

class FunctionInfo:
    def __init__(self, name, lineno, filepath, class_name=None):
        self.name = name
        self.lineno = lineno
        self.filepath = filepath
        self.class_name = class_name

    def full_name(self):
        if self.class_name:
            return f"{self.filepath}:{self.class_name}.{self.name}"
        return f"{self.filepath}:{self.name}"

    def __repr__(self):
        return f"<Function {self.full_name()} at line {self.lineno}>"

class CallGraphAnalyzer(ast.NodeVisitor):
    def __init__(self, filepath):
        self.filepath = filepath
        self.current_function = None
        self.functions = []
        self.calls = []
        self.class_context = None

    def visit_ClassDef(self, node):
        previous_class = self.class_context
        self.class_context = node.name
        self.generic_visit(node)
        self.class_context = previous_class

    def visit_FunctionDef(self, node):
        func = FunctionInfo(
            name=node.name,
            lineno=node.lineno,
            filepath=self.filepath,
            class_name=self.class_context
        )
        self.functions.append(func)
        previous_function = self.current_function
        self.current_function = func
        self.generic_visit(node)
        self.current_function = previous_function

    def visit_Call(self, node):
        callee = self._get_callee_name(node.func)
        if self.current_function and callee:
            self.calls.append((self.current_function.full_name(), callee))
        self.generic_visit(node)

    def _get_callee_name(self, node):
        # Handle different call types.
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            base = self._get_callee_name(node.value)
            if base:
                return f"{base}.{node.attr}"
            else:
                return node.attr
        elif isinstance(node, ast.Call):
            # In case of chained calls, try to extract the base name.
            return self._get_callee_name(node.func)
        return None

def analyze_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()
    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        print(f"Syntax error in {filepath}: {e}")
        return {"functions": [], "calls": []}
    analyzer = CallGraphAnalyzer(filepath)
    analyzer.visit(tree)
    return {"functions": analyzer.functions, "calls": analyzer.calls}

def analyze_code(code_path):
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
