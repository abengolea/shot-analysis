import argparse
from typing import Any, Dict, Optional

import torch
import torch.nn as nn
import pytorch_lightning as pl
from torch.utils.data import DataLoader

from datasets import PoseSequenceDataset
from models.tcn import TCNMultiHead


class LitModel(pl.LightningModule):
    def __init__(self, num_labels: int, num_targets: int, lr: float = 1e-3):
        super().__init__()
        self.save_hyperparameters()
        self.model = TCNMultiHead(num_labels=num_labels, num_targets=num_targets)
        self.loss_cls = nn.BCEWithLogitsLoss() if num_labels > 0 else None
        self.loss_reg = nn.SmoothL1Loss() if num_targets > 0 else None

    def forward(self, x: torch.Tensor):
        return self.model(x)

    def common_step(self, batch: Dict[str, Any], stage: str):
        x = batch["x"].float()  # [B, T, J, 3]
        logits, preds = self(x)
        loss = torch.tensor(0.0, device=self.device)
        logs = {}

        if self.loss_cls is not None and batch.get("y_cls") is not None:
            y_cls = batch["y_cls"].float()
            loss_cls = self.loss_cls(logits, y_cls)
            loss = loss + loss_cls
            logs[f"{stage}_loss_cls"] = loss_cls

        if self.loss_reg is not None and batch.get("y_reg") is not None:
            y_reg = batch["y_reg"].float()
            loss_reg = self.loss_reg(preds, y_reg)
            loss = loss + loss_reg
            logs[f"{stage}_loss_reg"] = loss_reg

        logs[f"{stage}_loss"] = loss
        self.log_dict(logs, prog_bar=True, on_step=(stage == "train"), on_epoch=True)
        return loss

    def training_step(self, batch: Dict[str, Any], batch_idx: int):
        return self.common_step(batch, "train")

    def validation_step(self, batch: Dict[str, Any], batch_idx: int):
        self.common_step(batch, "val")

    def configure_optimizers(self):
        return torch.optim.Adam(self.parameters(), lr=self.hparams.lr)


def collate(samples):
    # simple collate: pad/crop to min length in batch
    T_min = min(s["x"].shape[0] for s in samples)
    xs = []
    y_clss = []
    y_regs = []
    for s in samples:
        x = s["x"][:T_min]
        xs.append(x.unsqueeze(0))
        y_clss.append(s.get("y_cls"))
        y_regs.append(s.get("y_reg"))

    x_batch = torch.cat(xs, dim=0)

    y_cls_batch = None
    if all(y is not None for y in y_clss):
        y_cls_batch = torch.stack(y_clss, dim=0)

    y_reg_batch = None
    if all(y is not None for y in y_regs):
        y_reg_batch = torch.stack(y_regs, dim=0)

    return {"x": x_batch, "y_cls": y_cls_batch, "y_reg": y_reg_batch}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir", type=str, required=True)
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--max_epochs", type=int, default=20)
    parser.add_argument("--num_labels", type=int, default=4)
    parser.add_argument("--num_targets", type=int, default=2)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    train_ds = PoseSequenceDataset(args.data_dir, split="train")
    val_ds = PoseSequenceDataset(args.data_dir, split="val")

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, collate_fn=collate)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, collate_fn=collate)

    model = LitModel(num_labels=args.num_labels, num_targets=args.num_targets, lr=args.lr)

    trainer = pl.Trainer(max_epochs=args.max_epochs, accelerator="auto")
    trainer.fit(model, train_loader, val_loader)


if __name__ == "__main__":
    main()
