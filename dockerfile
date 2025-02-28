# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file to the container
COPY requirements.txt .

# Install the required packages
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose any necessary ports (e.g., if the tool runs a web server)
# EXPOSE 8000

# Set the default command to run the application
# Here, "main.py" is the entry point of your tool. Change it accordingly.
CMD ["python", "main.py"]
