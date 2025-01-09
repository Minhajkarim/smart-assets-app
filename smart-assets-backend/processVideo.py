#!/usr/bin/env python
import cv2
import sys
import os
import json
import logging
from YOLO_Pred import YOLO_Pred

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Check if the input is a file or a stream
input_source = sys.argv[1]
is_live_stream = input_source.lower() == 'live'

output_dir = 'videos'
os.makedirs(output_dir, exist_ok=True)

# Initialize YOLO model as a singleton
model_path = 'models/best.onnx'
data_yaml = 'models/data.yaml'

try:
    yolo_model = YOLO_Pred(model_path, data_yaml)
except Exception as e:
    error_message = {
        'progress': 100,
        'message': f'Error initializing YOLO model: {str(e)}'
    }
    logging.error(error_message['message'])
    print(json.dumps(error_message))
    sys.exit(1)

# Video source: live stream or uploaded video
cap = cv2.VideoCapture(0) if is_live_stream else cv2.VideoCapture(input_source)

if not cap.isOpened():
    error_message = {
        'progress': 100,
        'message': 'Error: Unable to open video source. Please check the input.'
    }
    logging.error(error_message['message'])
    print(json.dumps(error_message))
    sys.exit(1)

fourcc = cv2.VideoWriter_fourcc(*'mp4v')

# Get video properties (use defaults for live streams)
frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = int(cap.get(cv2.CAP_PROP_FPS)) if not is_live_stream else 30
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) if not is_live_stream else -1

# Output video path
file_extension = os.path.splitext(input_source)[1]
output_video_path = os.path.join(output_dir, os.path.basename(input_source).replace(file_extension, f'-output{file_extension}'))
out = cv2.VideoWriter(output_video_path, fourcc, fps, (frame_width, frame_height))

frame_num = 0
last_reported_progress = 0

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            if not is_live_stream:  # For files, stop when frames are exhausted
                break
            continue  # For live streams, continue reading

        # Process the frame using YOLO model
        processed_frame = yolo_model.predictions(frame)

        if processed_frame is None:
            error_message = {
                'progress': 100,
                'message': f'Error processing frame {frame_num}. Skipping.'
            }
            logging.warning(error_message['message'])
            print(json.dumps(error_message))
            continue

        # Write the processed frame to the output video
        out.write(processed_frame)

        # Update progress (only for uploaded videos)
        if not is_live_stream and frame_count > 0:
            frame_num += 1
            progress = int((frame_num / frame_count) * 100)
            if progress - last_reported_progress >= 10:
                progress_update = {
                    'progress': progress,
                    'message': f'Processing frame {frame_num}/{frame_count}'
                }
                print(json.dumps(progress_update))
                last_reported_progress = progress

except Exception as e:
    error_message = {
        'progress': 100,
        'message': f'An error occurred during processing: {str(e)}'
    }
    logging.error(error_message['message'])
    print(json.dumps(error_message))
finally:
    cap.release()
    out.release()

# Final output path
output_video_info = {
    'output_video': output_video_path  # This includes the correct -output suffix
}
print(json.dumps(output_video_info))  # Send the final output video path to the backend
sys.exit(0)
