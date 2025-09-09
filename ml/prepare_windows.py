import argparse
import json
import os
from typing import Any, Dict

try:
    import orjson as fastjson
    def dumps(obj):
        return fastjson.dumps(obj)
    def loads(b):
        return fastjson.loads(b)
except Exception:
    def dumps(obj):
        return json.dumps(obj).encode("utf-8")
    def loads(b):
        return json.loads(b)


def crop_window(sample: Dict[str, Any], release_time_sec: float, pre_ms: int, post_ms: int) -> Dict[str, Any]:
    fps = float(sample.get("fps", 30.0))
    frames = sample.get("frames", [])
    if not frames:
        return sample

    start_t = release_time_sec - pre_ms / 1000.0
    end_t = release_time_sec + post_ms / 1000.0

    cropped = [fr for fr in frames if start_t <= float(fr.get("time_sec", 0.0)) <= end_t]
    out = dict(sample)
    out["frames"] = cropped
    out["window"] = {
        "release_time_sec": release_time_sec,
        "pre_ms": pre_ms,
        "post_ms": post_ms,
    }
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_json", type=str, required=True)
    parser.add_argument("--output_json", type=str, required=True)
    parser.add_argument("--release_time_sec", type=float, required=True)
    parser.add_argument("--pre_ms", type=int, default=500)
    parser.add_argument("--post_ms", type=int, default=200)
    args = parser.parse_args()

    with open(args.input_json, "rb") as f:
        sample = loads(f.read())

    out = crop_window(sample, args.release_time_sec, args.pre_ms, args.post_ms)

    out_dir = os.path.dirname(os.path.abspath(args.output_json))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    with open(args.output_json, "wb") as f:
        f.write(dumps(out))

    print(f"OK {args.output_json}")


if __name__ == "__main__":
    main()
