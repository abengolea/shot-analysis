from typing import Optional

import torch
import torch.nn as nn


class TemporalBlock(nn.Module):
    def __init__(self, in_ch: int, out_ch: int, kernel_size: int, dilation: int, dropout: float = 0.1):
        super().__init__()
        padding = (kernel_size - 1) * dilation
        self.conv1 = nn.Conv1d(in_ch, out_ch, kernel_size, padding=padding, dilation=dilation)
        self.relu1 = nn.ReLU(inplace=True)
        self.dropout1 = nn.Dropout(dropout)
        self.conv2 = nn.Conv1d(out_ch, out_ch, kernel_size, padding=padding, dilation=dilation)
        self.relu2 = nn.ReLU(inplace=True)
        self.dropout2 = nn.Dropout(dropout)
        self.downsample = nn.Conv1d(in_ch, out_ch, 1) if in_ch != out_ch else None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.conv1(x)
        out = self.relu1(out)
        out = self.dropout1(out)
        out = self.conv2(out)
        out = self.relu2(out)
        out = self.dropout2(out)
        if self.downsample is not None:
            x = self.downsample(x)
        # corte para causal: alinear longitudes (pad lateral derecha)
        out = out[:, :, : x.size(2)]
        return out + x


class TCNMultiHead(nn.Module):
    def __init__(
        self,
        num_joints: int = 33,
        channels_per_joint: int = 3,
        hidden: int = 256,
        num_blocks: int = 4,
        kernel_size: int = 3,
        num_labels: int = 4,
        num_targets: int = 2,
        dropout: float = 0.1,
    ):
        super().__init__()
        in_ch = num_joints * channels_per_joint
        layers = []
        ch = in_ch
        for b in range(num_blocks):
            layers.append(TemporalBlock(ch, hidden, kernel_size=kernel_size, dilation=2 ** b, dropout=dropout))
            ch = hidden
        self.backbone = nn.Sequential(*layers)
        self.head_cls = nn.Sequential(
            nn.Conv1d(ch, ch, 1), nn.ReLU(inplace=True), nn.AdaptiveAvgPool1d(1), nn.Flatten(), nn.Linear(ch, num_labels)
        ) if num_labels > 0 else None
        self.head_reg = nn.Sequential(
            nn.Conv1d(ch, ch, 1), nn.ReLU(inplace=True), nn.AdaptiveAvgPool1d(1), nn.Flatten(), nn.Linear(ch, num_targets)
        ) if num_targets > 0 else None

    def forward(self, x: torch.Tensor) -> tuple[Optional[torch.Tensor], Optional[torch.Tensor]]:
        # x: [B, T, J, C] -> [B, (J*C), T]
        B, T, J, C = x.shape
        x = x.view(B, T, J * C).transpose(1, 2)
        feats = self.backbone(x)
        logits = self.head_cls(feats) if self.head_cls is not None else None
        preds = self.head_reg(feats) if self.head_reg is not None else None
        return logits, preds
