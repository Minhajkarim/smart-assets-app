#!/usr/bin/env python
import cv2
import sys
import os
import json
import logging
import subprocess

from YOLO_Pred import YOLO_Pred


def get_format_by_extension(file_path):
    _, ext = os.path.splitext(file_path)
    return ext.lower().replace('.', '') if ext else 'unknown'


def convert_webm_to_mp4(input_path, output_path, preset='fast', crf=22):
    """
    Converts a WebM video file to MP4 format using FFmpeg.

    Args:
        input_path (str): Path to the source WebM video file.
        output_path (str): Path where the converted MP4 video will be saved.
        preset (str, optional): FFmpeg preset for encoding speed and compression.
                                Options include: ultrafast, superfast, veryfast, faster,
                                fast, medium (default), slow, slower, veryslow.
        crf (int, optional): Constant Rate Factor for controlling video quality.
                             Lower values mean higher quality. Range: 0-51 (default: 22).

    Returns:
        bool: True if conversion is successful, False otherwise.
    """

    # Validate input file existence
    if not os.path.isfile(input_path):
        print(json.dumps(
            {'message': f"Error: Input file '{input_path}' not found."}))
        return False

    # Ensure the output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        try:
            os.makedirs(output_dir, exist_ok=True)
            print(json.dumps(
                {'message': f"Created output directory '{output_dir}'."}))
        except Exception as e:
            print(json.dumps(
                {'message': f"Error creating output directory '{output_dir}': {str(e)}"}))
            return False

    # Construct the FFmpeg command
    ffmpeg_command = [
        'ffmpeg',
        '-i', input_path,          # Input file
        '-c:v', 'libx264',         # Video codec
        '-preset', preset,         # Preset for encoding speed and compression
        '-crf', str(crf),          # Constant Rate Factor for quality
        '-c:a', 'aac',             # Audio codec
        '-b:a', '128k',            # Audio bitrate
        # Enables fast start for MP4 (progressive download)
        '-movflags', '+faststart',
        '-y',                      # Overwrite output file without asking
        output_path                # Output file
    ]

    print(json.dumps({'message': 'Converting WebM to MP4...'}))

    try:
        # Execute the FFmpeg command
        process = subprocess.run(
            ffmpeg_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )

        # Optionally, you can log or print FFmpeg's output
        # print(process.stdout)
        # print(process.stderr)

        print(json.dumps({'message': 'Conversion completed successfully.'}))
        return output_path

    except subprocess.CalledProcessError as e:
        # Handle errors in FFmpeg execution
        print(json.dumps(
            {'message': f"Error converting WebM to MP4: {e.stderr}"}))
        print(e.stderr)
        return None

    except FileNotFoundError:
        # FFmpeg is not installed or not found in PATH
        print(json.dumps(
            {'message': "Error: FFmpeg not found. Please install FFmpeg."}))
        return None

    except Exception as e:
        # Catch-all for any other exceptions
        print(json.dumps(
            {'message': f"An error occurred during conversion: {str(e)}"}))
        return None


# Configure logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

# Check if the input is a file or a stream
input_source = sys.argv[1]
is_live_stream = input_source.lower() == 'live'


ext = get_format_by_extension(input_source)

if ext == 'webm':
    # Convert WebM to MP4
    mp4_output = convert_webm_to_mp4(
        input_source, input_source.replace('.webm', '.mp4'))
    if mp4_output:
        input_source = mp4_output
    else:
        error_message = {
            'progress': 100,
            'message': 'Error converting WebM to MP4. Please check the input file.'
        }
        print(json.dumps(error_message))
        sys.exit(1)

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

# fourcc = cv2.VideoWriter_fourcc(*'mp4v')
fourcc = cv2.VideoWriter_fourcc(*'avc1')


# Get video properties (use defaults for live streams)
frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = int(cap.get(cv2.CAP_PROP_FPS)) if not is_live_stream else 30
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)
                  ) if not is_live_stream else -1

# Output video path
file_extension = os.path.splitext(input_source)[1]
output_video_path = os.path.join(output_dir, os.path.basename(
    input_source).replace(file_extension, f'-output{file_extension}'))
out = cv2.VideoWriter(output_video_path, fourcc, fps,
                      (frame_width, frame_height))

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
# Send the final output video path to the backend
print(json.dumps(output_video_info))
sys.exit(0)
