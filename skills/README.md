# Skills

このディレクトリは Agent / Codex が再利用可能な作業手順を格納するための領域。
現時点ではプロジェクト固有 Skill は未実装。

## Layout

```text
skills/
  README.md
  <skill-name>/
    SKILL.md
    ...optional scripts / templates / references
```

## Rules

- 1 Skill は1つの再利用可能な作業責務に限定する。
- Skill の入口は原則 `SKILL.md` とする。
- product / architecture / database / testing の通常仕様は `docs/` を正とし、Skill 内へ複製しない。
- Skill は必要な Repository SSOT を参照する。
- task 固有の一時手順や単発メモを Skill 化しない。
- secret、user data、環境固有 credential を含めない。

Skill を追加する必要が生じた時点で `<skill-name>/` を作成する。将来拡張のためだけに空の Skill folder を先行作成しない。
