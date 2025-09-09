import argparse
import torch

from models.tcn import TCNMultiHead


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=str, required=True)
    parser.add_argument("--output", type=str, required=True)
    parser.add_argument("--num_labels", type=int, default=4)
    parser.add_argument("--num_targets", type=int, default=2)
    parser.add_argument("--seq_len", type=int, default=64)
    args = parser.parse_args()

    # Cargar arquitectura e inicializar
    model = TCNMultiHead(num_labels=args.num_labels, num_targets=args.num_targets)

    # Si el checkpoint es de Lightning, puede requerir cargar state_dict['state_dict']
    ckpt = torch.load(args.checkpoint, map_location="cpu")
    state_dict = ckpt.get("state_dict", ckpt)
    new_state_dict = {}
    for k, v in state_dict.items():
        nk = k
        if nk.startswith("model."):
            nk = nk[len("model."):]
        new_state_dict[nk] = v
    model.load_state_dict(new_state_dict, strict=False)
    model.eval()

    dummy = torch.randn(1, args.seq_len, 33, 3)  # [B, T, J, C]

    torch.onnx.export(
        model,
        dummy,
        args.output,
        input_names=["x"],
        output_names=["logits", "preds"],
        dynamic_axes={"x": {1: "T"}},
        opset_version=17,
    )
    print(f"Exported ONNX to {args.output}")


if __name__ == "__main__":
    main()
