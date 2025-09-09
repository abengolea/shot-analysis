import argparse
import glob
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from extract_keypoints import extract_from_video  # type: ignore


def process_one(video_path: str, out_dir: str, stride: int) -> str:
    base = os.path.splitext(os.path.basename(video_path))[0]
    out_path = os.path.join(out_dir, base + ".json")
    try:
        data = extract_from_video(video_path=video_path, stride=stride)
        os.makedirs(out_dir, exist_ok=True)
        with open(out_path, "wb") as f:
            try:
                import orjson as fastjson
                f.write(fastjson.dumps(data))
            except Exception:
                import json
                f.write(json.dumps(data).encode("utf-8"))
        return f"OK {out_path}"
    except Exception as e:
        return f"ERROR {video_path}: {e}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--videos_dir", type=str, required=True)
    parser.add_argument("--output_dir", type=str, required=True)
    parser.add_argument("--pattern", type=str, default="**/*.mp4")
    parser.add_argument("--stride", type=int, default=1)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()

    paths = glob.glob(os.path.join(args.videos_dir, args.pattern), recursive=True)
    if not paths:
        print("No videos found")
        return

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(process_one, p, args.output_dir, args.stride) for p in paths]
        for fut in as_completed(futs):
            print(fut.result())


if __name__ == "__main__":
    main()
