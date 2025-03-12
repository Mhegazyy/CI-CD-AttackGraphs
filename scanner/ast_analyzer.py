import ast
import os

class FunctionInfo:
    def __init__(self, name, lineno, end_lineno, filepath, class_name=None, is_lambda=False):
        self.name = name
        self.lineno = lineno
        self.end_lineno = end_lineno  # For Python 3.8+; otherwise fallback to lineno
        self.filepath = filepath
        self.class_name = class_name
        self.is_lambda = is_lambda

    def full_name(self):
        if self.is_lambda:
            return f"{self.filepath}:lambda@{self.lineno}"
        if self.class_name:
            return f"{self.filepath}:{self.class_name}.{self.name}"
        return f"{self.filepath}:{self.name}"

    def __repr__(self):
        return f"<{'Lambda' if self.is_lambda else 'Function'} {self.full_name()} from line {self.lineno} to {self.end_lineno}>"

class CallGraphAnalyzer(ast.NodeVisitor):
    def __init__(self, filepath):
        self.filepath = filepath
        self.current_function = None
        self.functions = []
        self.calls = []
        self.class_context = None
        self.lambda_counter = 0  # To help generate unique names for lambdas

    def visit_ClassDef(self, node):
        previous_class = self.class_context
        self.class_context = node.name
        self.generic_visit(node)
        self.class_context = previous_class

    def visit_FunctionDef(self, node):
        end_lineno = getattr(node, 'end_lineno', node.lineno)
        func_info = FunctionInfo(
            name=node.name,
            lineno=node.lineno,
            end_lineno=end_lineno,
            filepath=self.filepath,
            class_name=self.class_context
        )
        self.functions.append(func_info)
        previous_function = self.current_function
        self.current_function = func_info
        self.generic_visit(node)
        self.current_function = previous_function

    def visit_AsyncFunctionDef(self, node):
        end_lineno = getattr(node, 'end_lineno', node.lineno)
        func_info = FunctionInfo(
            name=node.name,
            lineno=node.lineno,
            end_lineno=end_lineno,
            filepath=self.filepath,
            class_name=self.class_context
        )
        self.functions.append(func_info)
        previous_function = self.current_function
        self.current_function = func_info
        self.generic_visit(node)
        self.current_function = previous_function

    def visit_Lambda(self, node):
        # Generate a synthetic name for the lambda function
        lambda_name = f"lambda_{self.lambda_counter}"
        self.lambda_counter += 1
        end_lineno = getattr(node, 'end_lineno', node.lineno)
        func_info = FunctionInfo(
            name=lambda_name,
            lineno=node.lineno,
            end_lineno=end_lineno,
            filepath=self.filepath,
            class_name=self.class_context,
            is_lambda=True
        )
        self.functions.append(func_info)
        previous_function = self.current_function
        self.current_function = func_info
        # Lambdas are expressions; visit their body if possible
        self.generic_visit(node)
        self.current_function = previous_function

    def visit_Call(self, node):
        callee = self._get_callee_name(node.func)
        if self.current_function and callee:
            self.calls.append((self.current_function.full_name(), callee))
        self.generic_visit(node)

    def _get_callee_name(self, node):
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            base = self._get_callee_name(node.value)
            if base:
                return f"{base}.{node.attr}"
            else:
                return node.attr
        elif isinstance(node, ast.Call):
            return self._get_callee_name(node.func)
        return None

def analyze_file(filepath):
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
    analysis = analyze_code("clones/dvpwa")
    from pprint import pprint
    pprint(analysis)
