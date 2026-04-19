# GNOME Dynamic Island

[English](README.md)

[![CI](https://github.com/hacksynth/gnome-dynamic-island/actions/workflows/ci.yml/badge.svg)](https://github.com/hacksynth/gnome-dynamic-island/actions/workflows/ci.yml)
[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2%2B-blue.svg)](LICENSE)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-50-informational)](https://release.gnome.org/50/)

一个面向 GNOME Shell 50 的扩展，用 Adwaita 风格的 Dynamic Island 替换顶部面板中央区域。

## 功能

- 将顶部面板中央的日期/菜单区域替换为紧凑的 Dynamic Island 胶囊，并在禁用扩展时恢复原有面板内容。
- 根据当前 live activity 自动切换 idle、compact、split 和 expanded 视觉状态。
- 支持配置空闲内容：本地时钟、留空或自定义文本。
- 显示当前播放的 MPRIS 媒体信息，包括曲目标题和艺术家。
- 在尾部区域聚合活跃通知，并在通知数量达到配置阈值后合并显示。
- 对音量变化、Caps Lock 切换、键盘布局切换、充电器插拔和低电量警告显示 transient flash。
- 通过 UPower 跟踪电池状态，并使用配置的低电量阈值触发警告。
- 可在首选项窗口中启用或禁用各个 provider，也可通过右键菜单打开首选项或禁用当前 provider。
- 支持悬停展开、点击固定，按 Escape 取消固定。
- 使用 gettext 做本地化，并包含简体中文翻译。

## 安装（开发环境）

```sh
./scripts/install-dev.sh
```

该脚本会把扩展符号链接到 `~/.local/share/gnome-shell/extensions/`，并编译 gschema。GNOME 50 on Wayland 已移除 `--nested` 参数，因此需要注销并重新登录，然后运行：

```sh
gnome-extensions enable dynamic-island@hacksynth.github.io
gnome-extensions prefs  dynamic-island@hacksynth.github.io
```

可以用下面的命令查看日志：

```sh
journalctl --user --follow /usr/bin/gnome-shell
```

如果扩展导致 Shell 崩溃，切换到 TTY（Ctrl-Alt-F3），删除 `~/.local/share/gnome-shell/extensions/dynamic-island@hacksynth.github.io` 后即可恢复。

## 测试

```sh
npm test            # 使用 node --test 运行纯逻辑单元测试
```

## 架构

详见 `docs/superpowers/specs/2026-04-19-gnome-dynamic-island-design.md` 和 `dynamic-island@hacksynth.github.io/docs/provider-contract.md`。

## 贡献

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。简要规则：提交信息使用 conventional commit，`npm test` 必须通过；如果修改了用户可见字符串，请运行 `npm run i18n:update`。

## 行为准则

本项目遵循 [Contributor Covenant v2.1](CODE_OF_CONDUCT.md)。

## 安全

如需报告安全问题，请阅读 [SECURITY.md](SECURITY.md)。请不要为安全问题创建公开 issue。

## 许可证

GPL-2.0-or-later。详见 [LICENSE](LICENSE)。
