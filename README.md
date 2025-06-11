# Full-stack take-home test for Overview.ai

## Overview
This project is a full-stack application that showcases an AI object detection model's predictions through a user-friendly dashboard. The backend is built with Flask in Python, serving predictions from an ONNX model. The front end is developed using React and Fabric.js, providing an interactive interface to display the detected objects.

## The Task
Build a frontend that:
  - Plays a video file
  - Periodically captures frames (e.g., every 300ms) and sends them to the `/detect` API
  - Displays bounding boxes using Fabric.js
  - Allows configuring model parameters (IoU & Confidence thresholds)
  - Shows a table with the last 10 detection results
  - Saves each prediction result to a PostgreSQL database

## Prerequisites

- **Docker & Docker Compose** (required)
- **Python 3.8+** (only needed if running backend without Docker)
- **PostgreSQL** (only needed if running backend without Docker)
- **Node.js 20+** (only needed if running frontend without Docker)

> All Python and Node.js dependencies are already included in the Docker setup. No manual installation is needed unless you run the app outside Docker.

### Running the Project
GitHub repo: [https://github.com/JennaLiao5/object-detection-player.git](https://github.com/JennaLiao5/object-detection-player.git)

### 0. Clone the repository

```bash
git clone https://github.com/JennaLiao5/object-detection-player.git
cd object-detection-player
```

### 1. Set up environment files

In the root and `backend/` directories, copy the example environment files and fill in your PostgreSQL credentials:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

> PostgreSQL will be automatically initialized by Docker based on these environment variables.

### 2. Start services with Docker Compose

```bash
docker compose up --build
```

This will launch the backend, frontend, and PostgreSQL services.

### 3. Initialize the database

```bash
docker compose exec backend bash
python init_db.py
```

This script creates the necessary tables inside the PostgreSQL container.

### 4. Access the application

Open your browser and navigate to:

```
http://localhost:3000
```

You can now use the object detection dashboard.

### API Endpoints

- **Detect Objects:**
  - Endpoint: `/detect`
  - Method: POST
  - Description: Receives an image (either as base64 or file path), confidence threshold, and IoU threshold and returns the detection results.
  - Request Parameters
    - You **must provide either** of the following image parameters:
      - `image_data` (string): Base64-encoded JPEG string (recommended for frontend)
      - `image_path` (string): Full file path (used internally within backend)
    - Optional parameters:
      - `confidence` (float): Detection confidence threshold (default: 0.7)
      - `iou` (float): IoU threshold for non-maximum suppression (default: 0.5)
  - Example 1:
    - request:
    ```
    {
      "image_path": "/app/test/bus.jpg",
      "confidence": 0.7,
      "iou": 0.5
    }
    ```
    - response:
    ```
    [
      {
        "box": {"height": 503, "left": 50, "top": 400, "width": 195},
        "class_name": "person",
        "confidence": 0.9132577180862427
      },
      {
        "box": {"height": 489, "left": 668, "top": 391, "width": 140},
        "class_name": "person",
        "confidence": 0.9127665758132935
      },
      {
        "box": {"height": 515,  "left": 3, "top": 228,  "width": 805},
        "class_name": "bus",
        "confidence": 0.9017127752304077
      },
      {
        "box": {"height": 452, "left": 223,  "top": 407, "width": 121},
        "class_name": "person",
        "confidence": 0.8749434351921082
      }
    ]
    ```
  - Example 2:
    - request:
    ```
    {
      "image_data": "/9j/4AAQSkZJRgABAQAAAQABAAD…",,
      "confidence": 0.7,
      "iou": 0.5
    }
    ```
    - response:
    ```
    [
      {
        "box": {"height": 562, "left": 924, "top": 522, "width": 572},
        "class_name": "person",
        "confidence": 0.925483226776123
      },
      {
        "box": {"height": 623, "left": 456, "top": 585, "width": 733},
        "class_name": "dog",
        "confidence": 0.8675347566604614
      }
    ]
    ```
    
- **Health Check:**
  - Endpoint: `/health_check`
  - Method: GET
  - Description: Checks if the model is loaded and returns the status.

- **Load Model:**
  - Endpoint: `/load_model`
  - Method: POST
  - Description: Loads a specified `model_name` for object detection. One of `yolov8n` (nano, faster, less accurate) or `yolov8s` (small, a bit slower and more accurate). 

## Architecture

- **Backend:** Flask + ONNX Runtime
- **Frontend:** React + Fabric.js (TypeScript)
- **Database:** PostgreSQL

