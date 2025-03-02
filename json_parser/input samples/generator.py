import json
import random

# Define possible device types
device_types = ["server", "workstation", "router", "firewall", "switch", "IoT"]

# Names for different device types
names_by_type = {
    "server": ["Web Server", "Database Server", "Email Server", "File Server", "Domain Controller", "Application Server"],
    "workstation": ["Workstation", "Laptop", "Desktop"],
    "router": ["Edge Router", "Core Router"],
    "firewall": ["Firewall Appliance", "Security Gateway"],
    "switch": ["Switch", "Core Switch"],
    "IoT": ["Security Camera", "Smart Sensor", "IoT Device"]
}

# Operating systems for each device type
os_by_type = {
    "server": ["Windows Server 2016", "Windows Server 2019", "Ubuntu Server 20.04", "CentOS 7"],
    "workstation": ["Windows 10", "Windows 11", "Ubuntu 20.04", "macOS"],
    "router": ["Cisco IOS", "Juniper Junos", "MikroTik RouterOS"],
    "firewall": ["FortiOS", "Palo Alto PAN-OS", "Cisco ASA"],
    "switch": ["Cisco IOS", "Juniper Junos"],
    "IoT": ["Proprietary OS", "Linux-based IoT OS"]
}

# Services provided by each device type
services_by_type = {
    "server": ["HTTP", "HTTPS", "FTP", "SSH", "SQL", "SMTP", "DNS", "RDP"],
    "workstation": ["SSH", "RDP", "Web Browser"],
    "router": ["Routing", "VPN"],
    "firewall": ["Packet Filtering", "NAT", "VPN"],
    "switch": ["Switching", "VLAN"],
    "IoT": ["RTSP", "MQTT", "HTTP"]
}

def generate_ip(used_ips):
    """
    Generates a unique IP address within a /24 subnet (192.168.1.x).
    """
    while True:
        ip = f"192.168.1.{random.randint(2, 254)}"
        if ip not in used_ips:
            used_ips.add(ip)
            return ip

def generate_node(node_id, used_ips):
    """
    Generate a single network node with realistic attributes including device type,
    operating system, services, and vulnerabilities appropriate for the device type.
    """
    # Randomly select a device type
    device_type = random.choice(device_types)
    # Select a name based on device type
    name = f"{random.choice(names_by_type[device_type])} {node_id}"
    ip = generate_ip(used_ips)
    subnet = "192.168.1.0/24"
    os_choice = random.choice(os_by_type[device_type])
    # Randomly select some services (1 to all available for that type)
    services = random.sample(services_by_type[device_type], random.randint(1, len(services_by_type[device_type])))

    # Define realistic vulnerabilities mapped to each device type
    vuln_mapping = {
        "server": [
            {"id": "CVE-2021-34527", "severity": "high", "description": "PrintNightmare vulnerability"},
            {"id": "CVE-2022-26923", "severity": "critical", "description": "Certificate Services Elevation of Privilege"},
            {"id": "CVE-2020-0618", "severity": "high", "description": "SQL Server Reporting Services RCE"},
            {"id": "CVE-2022-3715", "severity": "critical", "description": "Remote code execution in IIS"},
            {"id": "CVE-2022-23277", "severity": "high", "description": "Exchange Server Elevation of Privilege"}
        ],
        "workstation": [
            {"id": "CVE-2021-34527", "severity": "high", "description": "PrintNightmare vulnerability"},
            {"id": "CVE-2022-26923", "severity": "critical", "description": "Certificate Services Elevation of Privilege"},
            {"id": "CVE-2022-3715", "severity": "critical", "description": "Remote code execution in IIS"}
        ],
        "router": [
            {"id": "CVE-2019-12667", "severity": "low", "description": "Cisco IOS VLAN Trunking Protocol Denial of Service"}
        ],
        "switch": [
            {"id": "CVE-2019-12667", "severity": "low", "description": "Cisco IOS VLAN Trunking Protocol Denial of Service"}
        ],
        "IoT": [
            {"id": "CVE-2022-9999", "severity": "high", "description": "Unauthenticated remote code execution"}
        ],
        "firewall": []  # Firewalls are usually hardened
    }

    # Select applicable vulnerabilities based on device type, with a 50% chance to assign any
    possible_vulns = vuln_mapping.get(device_type, [])
    vuln_list = []
    if possible_vulns and random.random() < 0.5:
        vuln_list = random.sample(possible_vulns, random.randint(1, min(2, len(possible_vulns))))

    return {
        "id": str(node_id),
        "name": name,
        "type": device_type,
        "ip": ip,
        "subnet": subnet,
        "os": os_choice,
        "services": services,
        "vulnerabilities": vuln_list
    }

def generate_edges(nodes):
    """
    Generate connections (edges) between nodes.
    Each node will connect to 1-3 other random nodes.
    """
    edges = []
    node_ids = [node["id"] for node in nodes]
    for node in nodes:
        # Each node connects to 1-3 other nodes (avoid self-loops)
        num_edges = random.randint(1, min(3, len(node_ids) - 1))
        targets = random.sample([nid for nid in node_ids if nid != node["id"]], num_edges)
        for target in targets:
            connection_type = random.choice(["Ethernet", "TCP", "UDP", "SMB"])
            description = f"{node['name']} to node {target} via {connection_type}"
            edges.append({
                "source": node["id"],
                "target": target,
                "connection": connection_type,
                "description": description
            })
    return edges

def generate_synthetic_network(num_nodes=20):
    """
    Generate a synthetic network with a given number of nodes and corresponding edges.
    """
    used_ips = set()
    nodes = [generate_node(i + 1, used_ips) for i in range(num_nodes)]
    edges = generate_edges(nodes)
    network_data = {
        "nodes": nodes,
        "edges": edges
    }
    return network_data

if __name__ == '__main__':
    # Generate synthetic network data with 30 nodes
    data = generate_synthetic_network(num_nodes=30)
    # Save the generated data to a JSON file
    with open("json_parser/input samples/synthetic_network.json", "w") as f:
        json.dump(data, f, indent=4)
    print("Synthetic network data generated and saved to synthetic_network.json")
