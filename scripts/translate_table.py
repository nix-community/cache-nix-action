import sys
import yaml

from lxml.etree import tostring, fromstring
from lxml.builder import E
import markdown
from pathlib import Path


def convert_to_table(attrs, is_inputs=True):
    columns = ["name", "description"]

    if is_inputs:
        columns += ["default", "required"]

    root = E.table(
        E.tr(*[E.th(c) for c in columns]),
    )

    for key, value in attrs.items():
        key_pretty = f"`{key}`"
        description = value.get("description", "")
        columns = [key_pretty, description]

        if is_inputs:
            required = (
                "`true`"
                if (required := value.get("required", "`false`")) == True
                else required
            )

            default = (
                f"`{default}`"
                if (default := value.get("default"))
                else "`''`"
                if default == ""
                else ""
            )

            columns += [
                default,
                required,
            ]

        root.append(
            E.tr(
                *[
                    E.td(fromstring(f"<div>{markdown.markdown(x)}</div>"))
                    for x in columns
                ]
            )
        )

    return (
        tostring(
            root,
            encoding="UTF-16",
            xml_declaration=False,
        )
        .decode("UTF-16")
        .replace("\n", "")
    )


def main():
    actions = [
        ["save/action.yml", False],
        ["restore/action.yml", True],
        ["action.yml", True],
    ]

    for path, has_outputs in actions:
        dir = Path(path).parent
        readme_md = dir / "README.md"
        with open(path, "r") as action:
            action_yaml = yaml.safe_load(action.read())

        with open(readme_md, "r") as readme:
            readme_lines = readme.readlines()

        for i, line in enumerate(readme_lines):
            for attr, heading, is_inputs in [
                ["inputs", "Inputs", True],
                ["outputs", "Outputs", False],
            ]:
                if line.find(f"### {heading}") != -1 and not (
                    heading == "Outputs" and not has_outputs
                ):
                    readme_lines[i + 2] = convert_to_table(
                        action_yaml.get(attr), is_inputs=is_inputs
                    ) + "\n"

        with open(readme_md, "w") as readme:
            readme.writelines(readme_lines)


if __name__ == "__main__":
    main()
